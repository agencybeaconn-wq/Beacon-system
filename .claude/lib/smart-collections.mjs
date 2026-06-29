// smart-collections.mjs — análise e geração de rules de smart collections Shopify.
//
// Usado por:
//   - .claude/skills/audit-smart-collections  (novo)
//   - .claude/skills/fix-empty-collections    (retrocompat via reexport)
//   - futuramente quality-gate, deploy-store
//
// Funções principais:
//   ruleMatches(productTitle, rule)
//   countMatches(products, rules, disjunctive)
//   tryFragment(condition, products, maxMatches?)
//   detectDisjunctiveBug(rules, disjunctive, products) — o "entendedor de lógica"
//   canonicalRuleForHandle(handle, locale) — gera rules pra criar coleção faltante

export function normalize(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Simula uma Shopify smart rule contra um título de produto
export function ruleMatches(productTitle, rule) {
  if (rule.column !== 'title') return null;
  const t = (productTitle || '').toLowerCase();
  const c = (rule.condition || '').toLowerCase();
  if (rule.relation === 'contains') return t.includes(c);
  if (rule.relation === 'not_contains') return !t.includes(c);
  if (rule.relation === 'equals') return t === c;
  if (rule.relation === 'starts_with') return t.startsWith(c);
  if (rule.relation === 'ends_with') return t.endsWith(c);
  return null;
}

// Retorna count de produtos que matcham o conjunto de rules (AND/OR)
export function countMatches(products, rules, disjunctive) {
  if (!rules || !rules.length) return 0;
  let count = 0;
  for (const p of products) {
    const results = rules.map(r => ruleMatches(p.title, r)).filter(r => r !== null);
    if (results.length === 0) continue;
    const match = disjunctive ? results.some(r => r) : results.every(r => r);
    if (match) count++;
  }
  return count;
}

// Fragmento parcial pra resistir a typos (ex: "feminina" → "femin")
export function tryFragment(condition, products, maxMatches = 80) {
  const cond = (condition || '').toLowerCase();
  const candidates = [];
  if (cond.endsWith('a') || cond.endsWith('o')) candidates.push(cond.slice(0, -1));
  if (cond.length > 4) candidates.push(cond.slice(0, Math.ceil(cond.length * 0.7)));
  let best = null, bestCount = 0;
  for (const cand of candidates) {
    const count = products.filter(p => (p.title || '').toLowerCase().includes(cand)).length;
    if (count > maxMatches) continue;
    if (count > bestCount) { bestCount = count; best = cand; }
  }
  return best && bestCount >= 3 ? { fragment: best, count: bestCount } : null;
}

// === O "entendedor de lógica" ===
// Detecta bugs de semântica em rules. Retorna null se não há bug.
//
// Padrões detectados:
//   CATCH_ALL_OR      — disjunctive:true + not_contains (OR vira catch-all)
//   RULE_TOO_STRICT   — disjunctive:false mas AND=0 e OR>0
//   ONLY_EXCLUSIONS   — só not_contains (suspeita, flag)
//
// Retorna objeto com: { type, severity, current, suggested, fix, reason }
export function detectDisjunctiveBug(rules, disjunctive, products) {
  if (!rules || rules.length <= 1) return null;

  const titleRules = rules.filter(r => r.column === 'title');
  if (titleRules.length === 0) return null; // só analisamos title rules

  const hasNotContains = rules.some(r => r.relation === 'not_contains');
  const hasContains = rules.some(r => r.relation === 'contains');
  const onlyNotContains = hasNotContains && !hasContains;

  const orCount = countMatches(products, rules, true);
  const andCount = countMatches(products, rules, false);

  // 1) CATCH_ALL_OR: OR + exclusões = catch-all
  if (disjunctive && hasNotContains) {
    // Se OR bate > 10× o AND (ou AND = 0 e OR > 20), é catch-all quase garantido
    const andFloor = Math.max(andCount, 1);
    const isCatchAll = orCount > 10 * andFloor || (andCount === 0 && orCount > 20);
    if (isCatchAll) {
      return {
        type: 'CATCH_ALL_OR',
        severity: 'CRITICAL',
        current: { mode: 'OR', count: orCount },
        suggested: { mode: 'AND', count: andCount },
        fix: { disjunctive: false },
        reason: `OR+not_contains virou catch-all (${orCount} matches). AND daria ${andCount}.`,
      };
    }
  }

  // 2) RULE_TOO_STRICT: AND muito restrito, OR traz produtos
  if (!disjunctive && hasContains && andCount === 0 && orCount >= 3) {
    // SANITY CHECK: se OR também vira catch-all (>50% do catálogo), não é fix — a regra em si tá mal formulada
    if (orCount > products.length * 0.5) {
      return {
        type: 'RULE_TOO_STRICT_BROAD',
        severity: 'WARN',
        current: { mode: 'AND', count: andCount },
        suggested: null,
        fix: null,
        reason: `AND=0 mas OR bate ${orCount} (>50% do catálogo) — regra mal formulada, revisar manualmente.`,
      };
    }
    return {
      type: 'RULE_TOO_STRICT',
      severity: 'HIGH',
      current: { mode: 'AND', count: andCount },
      suggested: { mode: 'OR', count: orCount },
      fix: { disjunctive: true },
      reason: `AND=0 mas OR bate ${orCount} produtos.`,
    };
  }

  // 3) ONLY_EXCLUSIONS: só not_contains é sempre suspeito
  if (onlyNotContains) {
    return {
      type: 'ONLY_EXCLUSIONS',
      severity: 'WARN',
      current: { mode: disjunctive ? 'OR' : 'AND', count: disjunctive ? orCount : andCount },
      suggested: null,
      fix: null,
      reason: `Coleção só tem exclusões (not_contains) — semântica ambígua, revisar manualmente.`,
    };
  }

  return null;
}

// === Gerador de rule canônica a partir de handle ===
// Usado pra criar smart collections faltantes (handle referenciado pelo tema mas sem coleção).
//
// Estratégia:
//   1) Lookup em dicionário conhecido (times populares, categorias, ligas)
//   2) Fallback: derivar nome do handle (split dashes + capitalizar), rule contains parcial
//
// Retorna: { rules: [...], disjunctive: bool, title: string } ou null se não souber
export function canonicalRuleForHandle(handle, locale = 'br') {
  const h = handle.toLowerCase();

  // Dicionário de handles conhecidos — chave é o handle, valor é a regra canônica
  const dict = {
    // === Categorias BR ===
    'masculino':              { title: 'Masculino',           rules: [{ column:'title', relation:'not_contains', condition:'femin' }, { column:'title', relation:'not_contains', condition:'infantil' }, { column:'title', relation:'not_contains', condition:'conjunto' }], disjunctive: false },
    'feminina-brasil':        { title: 'Feminina Brasil',     rules: [{ column:'title', relation:'contains', condition:'Brasil' }, { column:'title', relation:'contains', condition:'femin' }], disjunctive: false },
    'feminino':               { title: 'Feminino',            rules: [{ column:'title', relation:'contains', condition:'femin' }], disjunctive: false },
    'infantil':               { title: 'Infantil',            rules: [{ column:'title', relation:'contains', condition:'infantil' }], disjunctive: false },
    'infantil-selecao':       { title: 'Infantil Seleção',    rules: [{ column:'title', relation:'contains', condition:'infantil' }, { column:'title', relation:'contains', condition:'seleção' }], disjunctive: true },
    'conjuntos-infantis':     { title: 'Conjuntos Infantis',  rules: [{ column:'title', relation:'contains', condition:'infantil' }], disjunctive: false },
    'conjuntos-infantis-internacionais': { title: 'Conjuntos Infantis Internacionais', rules: [{ column:'title', relation:'contains', condition:'infantil' }, { column:'title', relation:'not_contains', condition:'Brasil' }], disjunctive: false },
    'retro':                  { title: 'Retrô',               rules: [{ column:'title', relation:'contains', condition:'retr' }, { column:'title', relation:'not_contains', condition:'MANGA LONGA' }, { column:'title', relation:'not_contains', condition:'NBA' }, { column:'title', relation:'not_contains', condition:'short' }], disjunctive: false },
    'lancamentos':            { title: 'Lançamentos',         rules: [{ column:'title', relation:'contains', condition:'2026' }], disjunctive: true },
    'selecoes':               { title: 'Seleções',            rules: [{ column:'title', relation:'contains', condition:'seleç' }], disjunctive: false },

    // === Ligas ===
    'brasileirao':            { title: 'Brasileirão',         rules: [{ column:'title', relation:'contains', condition:'Flamengo' }, { column:'title', relation:'contains', condition:'Palmeiras' }, { column:'title', relation:'contains', condition:'Corinthians' }, { column:'title', relation:'contains', condition:'São Paulo' }, { column:'title', relation:'contains', condition:'Santos' }, { column:'title', relation:'contains', condition:'Cruzeiro' }, { column:'title', relation:'contains', condition:'Atlético Mineiro' }, { column:'title', relation:'contains', condition:'Botafogo' }, { column:'title', relation:'contains', condition:'Fluminense' }, { column:'title', relation:'contains', condition:'Internacional' }, { column:'title', relation:'contains', condition:'Grêmio' }, { column:'title', relation:'contains', condition:'Vasco' }], disjunctive: true },
    'premier-league':         { title: 'Premier League',      rules: [{ column:'title', relation:'contains', condition:'Arsenal' }, { column:'title', relation:'contains', condition:'Manchester' }, { column:'title', relation:'contains', condition:'Chelsea' }, { column:'title', relation:'contains', condition:'Liverpool' }, { column:'title', relation:'contains', condition:'Tottenham' }, { column:'title', relation:'contains', condition:'Newcastle' }, { column:'title', relation:'contains', condition:'Everton' }], disjunctive: true },
    'la-liga':                { title: 'La Liga',              rules: [{ column:'title', relation:'contains', condition:'Real Madrid' }, { column:'title', relation:'contains', condition:'Barcelona' }, { column:'title', relation:'contains', condition:'Atlético' }, { column:'title', relation:'contains', condition:'Sevilla' }, { column:'title', relation:'contains', condition:'Valencia' }, { column:'title', relation:'contains', condition:'Real Betis' }], disjunctive: true },
    'serie-a':                { title: 'Serie A',              rules: [{ column:'title', relation:'contains', condition:'Juventus' }, { column:'title', relation:'contains', condition:'Inter' }, { column:'title', relation:'contains', condition:'Milan' }, { column:'title', relation:'contains', condition:'Roma' }], disjunctive: true },
    'ligue-1':                { title: 'Ligue 1',              rules: [{ column:'title', relation:'contains', condition:'PSG' }, { column:'title', relation:'contains', condition:'Paris' }, { column:'title', relation:'contains', condition:'Lyon' }, { column:'title', relation:'contains', condition:'Marseille' }, { column:'title', relation:'contains', condition:'Monaco' }], disjunctive: true },
    'bundesliga':             { title: 'Bundesliga',           rules: [{ column:'title', relation:'contains', condition:'Bayern' }, { column:'title', relation:'contains', condition:'Borussia' }, { column:'title', relation:'contains', condition:'Dortmund' }], disjunctive: true },

    // === Categorias EN ===
    'kids-kit':               { title: 'Kids Kit',             rules: [{ column:'title', relation:'contains', condition:'Kid' }], disjunctive: false },
    '2026-27-jerseys':        { title: '2026/27 Jerseys',      rules: [{ column:'title', relation:'contains', condition:'2026' }], disjunctive: true },
    'europe-teams':           { title: 'Europe Teams',         rules: [{ column:'title', relation:'contains', condition:'Real Madrid' }, { column:'title', relation:'contains', condition:'Barcelona' }, { column:'title', relation:'contains', condition:'Manchester' }, { column:'title', relation:'contains', condition:'Liverpool' }, { column:'title', relation:'contains', condition:'Bayern' }, { column:'title', relation:'contains', condition:'Juventus' }, { column:'title', relation:'contains', condition:'PSG' }, { column:'title', relation:'contains', condition:'Arsenal' }], disjunctive: true },
    'destaques-europeus':     { title: 'Destaques Europeus',   rules: [{ column:'title', relation:'contains', condition:'Real Madrid' }, { column:'title', relation:'contains', condition:'Barcelona' }, { column:'title', relation:'contains', condition:'Manchester' }, { column:'title', relation:'contains', condition:'Liverpool' }, { column:'title', relation:'contains', condition:'Bayern' }, { column:'title', relation:'contains', condition:'PSG' }], disjunctive: true },
  };

  if (dict[h]) return { ...dict[h], fromDict: true };

  // Fallback — team/seleção name from handle
  // "real-madrid" → "Real Madrid" → contains partial
  // "bayern-de-munique" → "Bayern" (primeira palavra > 3 chars)
  const parts = h.split('-').filter(p => p.length > 0);
  // Remove sufixos numéricos (manchester-city-1 → manchester-city)
  const cleanParts = parts.filter(p => !/^\d+$/.test(p));
  if (cleanParts.length === 0) return null;

  // Capitalize
  const title = cleanParts.map(p => p[0].toUpperCase() + p.slice(1)).join(' ');

  // Condition: primeira palavra significativa (>3 chars), fallback pro nome completo
  const mainWord = cleanParts.find(p => p.length > 3) || cleanParts[0];
  const condition = mainWord[0].toUpperCase() + mainWord.slice(1);

  return {
    title,
    rules: [{ column: 'title', relation: 'contains', condition }],
    disjunctive: false,
    fromDict: false,
  };
}
