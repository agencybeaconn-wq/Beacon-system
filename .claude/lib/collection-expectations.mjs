// Ranges esperados de produtos por handle de coleção em lojas Lever.
// Usado por sort-collections e audit-smart-collections pra detectar
// underfilled ("rule restrita demais") ou overfilled ("rule virou catch-all").
//
// Memory feedback_read_section_titles + history mega_mantos_collection_templates
// flagaram que rules sem semantic check geram coleções estranhas.

/**
 * Mapping handle → { min, max, why }
 * - min: abaixo disso provavelmente a rule está restritiva demais
 * - max: acima disso provavelmente disjunctive=true virou catch-all
 * - why: razão semântica do range
 *
 * Aplica a BR e EN (use o handle canônico — fix-handles deve ter alinhado os PT/EN).
 */
export const EXPECTATIONS = {
  // ── Vitrines de Home (BR + EN) ──
  'lancamentos':         { min: 15, max: 60,  why: 'Lançamentos = só novos; +60 vira catálogo todo' },
  'new-arrivals':        { min: 15, max: 60,  why: 'New arrivals = recent only' },
  'destaques':           { min: 8,  max: 30,  why: 'Destaques = curadoria, não tudo' },
  'destaques-europeus':  { min: 8,  max: 30,  why: 'Curadoria europeia' },
  'top-leagues':         { min: 30, max: 200, why: 'Big-5 leagues juntas' },

  // ── Categorias amplas ──
  'masculina':           { min: 100, max: 5000, why: 'Toda camisa masculina' },
  'feminina':            { min: 20,  max: 500,  why: 'Camisas femininas' },
  'womens':              { min: 20,  max: 500,  why: 'Womens' },
  'infantil':            { min: 15,  max: 300,  why: 'Camisas infantis' },
  'kids':                { min: 15,  max: 300,  why: 'Kids' },
  'kids-sets':           { min: 5,   max: 100,  why: 'Kit infantil = pares (camisa+short)' },
  'conjuntos-infantis':  { min: 5,   max: 100,  why: 'Kit infantil' },

  // ── Tipo de camisa ──
  'retro':               { min: 5,   max: 200, why: 'Retro = nostálgicas; underfilled = rule não pega "retro" no tag' },
  'manga-longa':         { min: 5,   max: 100, why: 'Long sleeve subset' },
  'long-sleeve':         { min: 5,   max: 100, why: 'Long sleeve' },
  'goleiro':             { min: 3,   max: 80,  why: 'Goalkeeper jerseys' },
  'goalkeeper':          { min: 3,   max: 80,  why: 'Goalkeeper' },
  'treino':              { min: 5,   max: 200, why: 'Training kits' },
  'training':            { min: 5,   max: 200, why: 'Training' },
  'jogador':             { min: 10,  max: 800, why: 'Player version' },
  'player':              { min: 10,  max: 800, why: 'Player' },
  'torcedor':            { min: 50,  max: 5000, why: 'Fan version (maioria do catálogo)' },
  'fan':                 { min: 50,  max: 5000, why: 'Fan' },

  // ── Seleções ──
  'selecoes':            { min: 30, max: 200, why: 'National teams' },
  'national-teams':      { min: 30, max: 200, why: 'National teams' },
  'brasil':              { min: 5,  max: 60,  why: 'Brasil seleção (camisas oficiais + alternativas)' },
  'brazil':              { min: 5,  max: 60,  why: 'Brazil' },
  'argentina':           { min: 3,  max: 30,  why: 'Argentina' },
  'portugal':            { min: 3,  max: 30,  why: 'Portugal' },

  // ── Ligas ──
  'brasileirao':         { min: 50,  max: 600, why: 'Brasileirão = 20 clubes × 3-5 versões' },
  'brazilian-league':    { min: 50,  max: 600, why: 'Brazilian league' },
  'premier-league':      { min: 50,  max: 600, why: 'Premier' },
  'la-liga':             { min: 50,  max: 600, why: 'La Liga' },
  'serie-a':             { min: 50,  max: 600, why: 'Serie A' },
  'bundesliga':          { min: 50,  max: 600, why: 'Bundesliga' },
  'ligue-1':             { min: 30,  max: 400, why: 'Ligue 1' },
  'libertadores':        { min: 50,  max: 500, why: 'Libertadores' },
  'champions-league':    { min: 50,  max: 500, why: 'Champions' },
  'mundial':             { min: 30,  max: 200, why: 'Copa do Mundo (seleções)' },
  'world-cup':           { min: 30,  max: 200, why: 'World Cup' },
};

/**
 * Checa se uma collection com `count` produtos está dentro do range esperado.
 * Retorna `null` se OK, ou `{ severity, message, hint }` se fora.
 */
export function checkCount(handle, count, title = '') {
  const exp = EXPECTATIONS[handle];
  if (!exp) return null; // handle não mapeado → sem opinião

  if (count < exp.min) {
    return {
      severity: 'warn',
      message: `Collection "${title || handle}" tem ${count} produtos, esperado ≥${exp.min}. ${exp.why}`,
      hint: `Possível causa: rule muito restritiva (AND demais), filter com typo, ou tag faltando nos produtos. Rodar audit-smart-collections.`,
    };
  }

  if (count > exp.max) {
    return {
      severity: 'warn',
      message: `Collection "${title || handle}" tem ${count} produtos, esperado ≤${exp.max}. ${exp.why}`,
      hint: `Possível causa: disjunctive=true (OR) com rule não-restritiva = catch-all. Rodar audit-smart-collections --no-create.`,
    };
  }

  return null;
}

/**
 * Roda checkCount em um array de collections e retorna lista de issues.
 * @param {Array<{handle:string, count:number, title?:string}>} collections
 */
export function checkAll(collections) {
  return collections
    .map(c => {
      const r = checkCount(c.handle, c.count, c.title);
      return r ? { handle: c.handle, ...r } : null;
    })
    .filter(Boolean);
}
