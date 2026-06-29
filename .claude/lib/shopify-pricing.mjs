// Categorização e cálculo de preço com extras — FONTE ÚNICA DE VERDADE.
// Antes existiam 3 versões divergentes em update-prices, bulk-fix-prices, import-missing.
// Qualquer mudança de regra → faça aqui e todas as skills herdam.
//
// Uso:
//   import { categorize, calcExpectedPrice, BIG_SIZES, CATEGORIES } from '../../lib/shopify-pricing.mjs';

/**
 * Categorias canônicas usadas em client_pricing (section='products').
 * Os mesmos keys devem existir no banco pra match.
 */
export const CATEGORIES = [
  'camisa_torcedor',
  'camisa_jogador',
  'camisa_retro',
  'camisa_manga_longa',  // torcedor + R$30 (variante própria)
  'conjunto_infantil',
  'agasalho_viagem',
  'conjunto_treino',
  'jaqueta',
  'moletom',
  'short',
  // Categorias novas v7 (Fase 7c) — aceitos como categoria legítima mesmo que pricing ainda não exista
  'chuteira',        // Football Boot, Cleats, Mercurial, Predator, etc
  'meia',            // Socks, Meião
  'bone',            // Cap, Boné
  'acessorio',       // Baby Body, Towel, Backpack, Mochila, Toalha, bola, etc
];

/**
 * Tamanhos "grandes" que recebem acréscimo (ex: +R$10).
 * Inclui aliases: GGG = 3GG, GGGG = 4GG.
 */
export const BIG_SIZES = new Set(['2GG', '3GG', '4GG', 'GGG', 'GGGG', '2XL', '3XL', '4XL', 'XXL', 'XXXL', 'XXXXL']);

/**
 * Categoriza um produto pelo título.
 * Retorna uma das CATEGORIES ou null se o produto não é roupa de futebol
 * (tênis, chuteiras, gym sets, patches avulsos, etc).
 *
 * IMPORTANTE: a ordem dos ifs importa — categorias mais específicas primeiro.
 *
 * @param {string} title - título do produto
 * @returns {string|null}
 */
export function categorize(title) {
  if (!title) return null;
  const t = title.toLowerCase();

  // ── SKIP: patches/kits de patches (são extras, não produtos base) ─────
  if (/^patch |^patches |^kit patch/.test(t)) return null;
  // SKIP: bobojaco (categoria não definida)
  if (/bobojaco/.test(t)) return null;

  // ── Categorias de CALÇADO/CHUTEIRA ────────────────────────────────────
  // Antes eram skipped → agora viram categoria 'chuteira' (pricing pode ou não existir)
  if (/predator|mercurial|tiempo|phantom|copa pure|copa sense|f50 elite|king |furon|tekela|ultra |x crazy|x speedportal|future |clone |vapor |superfly |football boot|cleats|chuteir[ao]|football shoes?|speedportal|launch firm/.test(t)) {
    return 'chuteira';
  }
  // Tênis de corrida / lifestyle
  if (/air zoom|running shoes?|tenis corrida|t[eê]nis corrida|t[eê]nis(?: de)? running|nike pegasus|ultraboost|adizero|gel[- ]kayano/.test(t)) {
    return 'chuteira';
  }

  // ── Categorias mais específicas primeiro ───────────────────────────────
  if (/retr[ôo]/.test(t)) return 'camisa_retro';
  if (/agasalho/.test(t)) return 'agasalho_viagem';
  if (/conjunto.*treino|treino.*conjunto/.test(t)) return 'conjunto_treino';
  if (/jaqueta|corta[- ]vento|corta vento|windbreaker/.test(t)) return 'jaqueta';
  if (/moletom|hoodie|sweatshirt/.test(t)) return 'moletom';
  if (/^short|short masculino|short feminino|short treino|cal[çc][ãa]o/.test(t)) return 'short';
  if (/infantil|kids|crian[çc]a|baby body|baby kit|beb[eê]/.test(t)) return 'conjunto_infantil';
  if (/manga (longa|comprida)|long.?sleeve/.test(t)) return 'camisa_manga_longa';
  // Player: aceita também "Player" sozinho como sufixo (loja EN: "Jersey X 25/26 Player")
  if (/jogador|authentic|player version|vers[aã]o jogador|\bplayer\b/.test(t)) return 'camisa_jogador';

  // ── Meias, bonés, acessórios (categorias novas v7) ────────────────────
  if (/^meia |^meias |^meião|^mei[aã]o|\bsocks?\b/.test(t)) return 'meia';
  if (/^bon[eé]|^bone|\bcap\b|beanie|snapback|trucker/.test(t)) return 'bone';
  if (/toalha|towel|mochila|backpack|bolsa esport|gym bag|bola\b|^ball |^pants\b|cachecol|luva|glove/.test(t)) return 'acessorio';

  // Torcedor: "Camisa X", "Versão Torcedor", "Regata", "Jersey"
  if (/vers[ãa]o torcedor|^regata |regata .*\d|^camisa|camiseta|jersey|\bfan\b|torcedor/.test(t)) {
    return 'camisa_torcedor';
  }
  // Padrão "Time Principal/Alternativo YY/YY" sem a palavra "Camisa"
  if (/\b(principal|alternativo|edi[çc][ãa]o especial|travis scott|iii|ii|i)\b.*\d{2}\/\d{2}/.test(t)) {
    return 'camisa_torcedor';
  }
  // Fallback: time + data no formato YY/YY
  if (/\d{2}\/\d{2}/.test(t) && /(principal|alternativo|edi[çc][ãa]o|copa|flamengo|corinthians|tottenham|marselha|manchester|city|united|real madrid|bar[çc]elona|ps[gj]|milan|juventus|bayern|liverpool|chelsea|arsenal|ajax|atl[eé]tico)/.test(t)) {
    return 'camisa_torcedor';
  }

  return null;
}

/**
 * Detecta se o produto tem patrocínio extra no título.
 * "Com Patrocinio" ou "Com Patrocínio" → true
 * @param {string} title
 * @returns {boolean}
 */
export function hasPatrocinio(title) {
  if (!title) return false;
  return /com patroc[ií]nio|\bpatroc[ií]nios?\b/i.test(title);
}

/**
 * Detecta se a variante é personalizada (option1/option2/option3 === "Personalizar").
 * @param {object} variant - variant da Shopify (com option1, option2, option3)
 * @returns {boolean}
 */
export function isPersonalizar(variant) {
  const opts = [variant.option1, variant.option2, variant.option3];
  return opts.some(o => {
    const v = (o || '').trim().toLowerCase();
    return v === 'personalizar' || v === 'customize' || v === 'yes' || v === 'com personalização' || v === 'com personalizacao';
  });
}

/**
 * Detecta se a variante é um tamanho "grande" (2GG/3GG/4GG/GGG/GGGG).
 * @param {object} variant
 * @returns {boolean}
 */
export function isBigSize(variant) {
  const size = (variant.option1 || '').trim();
  return BIG_SIZES.has(size);
}

/**
 * Lê um valor numérico do pricing (string → number). Tolera "R$", vírgula, espaços.
 * @param {string|number} v
 * @returns {number|null}
 */
function toNumber(v) {
  if (typeof v === 'number') return v;
  if (!v) return null;
  const cleaned = String(v).replace(/[R$\s]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Calcula o preço esperado de uma variante dado:
 * - título do produto (pra categoria + detecção de "Com Patrocinio")
 * - variante (pra detecção de Personalizar + Big Size)
 * - pricing do cliente (de fetchPricing — { products: {...}, extras: {...} })
 *
 * Retorna objeto com price, category, breakdown (auditoria do cálculo).
 *
 * @param {string} title
 * @param {object} variant
 * @param {object} pricing - { products, extras, info } de fetchPricing()
 * @returns {{ price: number|null, category: string|null, breakdown: string[] } | null}
 */
export function calcExpectedPrice(title, variant, pricing) {
  const category = categorize(title);
  if (!category) return null;

  const breakdown = [];
  const productPricing = pricing?.products || {};
  const extrasPricing = pricing?.extras || {};

  // Base por categoria
  const categoryKeyMap = {
    camisa_torcedor: 'torcedor',
    camisa_jogador: 'jogador',
    camisa_retro: 'retro',
    camisa_manga_longa: 'torcedor',  // base é torcedor
    conjunto_infantil: 'infantil',
    agasalho_viagem: 'agasalho',
    conjunto_treino: 'conjunto_treino',
    jaqueta: 'jaqueta',
    moletom: 'moletom',
    short: 'short',
    // Categorias v7 — pricing opcional
    chuteira: 'chuteira',
    meia: 'meia',
    bone: 'bone',
    acessorio: 'acessorio',
  };

  const pricingKey = categoryKeyMap[category];

  // Schema v7: sub-keys como camisa_torcedor_patrocinios, camisa_torcedor_2024, camisa_feminina
  // têm precedência sobre a key base quando o título bate o padrão.
  // Se nenhuma sub-key v7 bater, usa a key legacy (torcedor/jogador/retro/etc).
  function pickV7SubKey() {
    if (!(category === 'camisa_torcedor' || category === 'camisa_jogador')) return null;
    const isJog = category === 'camisa_jogador';
    const pref = isJog ? 'camisa_jogador' : 'camisa_torcedor';

    // Pré-personalizada (nome+número fixo no título: "Garro 8", "F. Torres 3", "J. Martinez 70")
    // Padrão: aspas duplas com letra+espaço+número. Categoria base é torcedor (não jogador).
    if (!isJog && /"[A-ZÀ-Ý][^"]*\d+"/.test(title) && productPricing.camisa_torcedor_personalizada) {
      return 'camisa_torcedor_personalizada';
    }
    // Feminina: usa camisa_feminina se configurada
    if (!isJog && /feminina|woman/i.test(title) && productPricing.camisa_feminina) {
      return 'camisa_feminina';
    }
    // Com Patrocínios
    if (hasPatrocinio(title) && productPricing[pref + '_patrocinios']) {
      return pref + '_patrocinios';
    }
    // Total 90 (colagem especial)
    if (/total\s*90/i.test(title) && productPricing[pref + '_total90']) {
      return pref + '_total90';
    }
    // Temporada 2024 ou anterior: detecta 2024, 2023/24, 2022/23, ..., retrô explícito trata separado
    // Casa: 20XX com XX <= 24, OU YY/YY onde YY <= 24
    const mY1 = title.match(/\b20(\d{2})\b/);
    const mY2 = title.match(/\b(\d{2})\/(\d{2})\b/);
    const year = mY1 ? parseInt(mY1[1], 10) : (mY2 ? parseInt(mY2[1], 10) : null);
    if (year != null && year <= 24 && productPricing[pref + '_2024']) {
      return pref + '_2024';
    }
    // Sub-key "base" v7 (camisa_torcedor / camisa_jogador) se existir
    if (productPricing[pref]) return pref;
    return null;
  }

  const v7Key = pickV7SubKey();
  // Tenta v7 sub-key, depois full category name (DB padrão atual), depois legacy short key
  let effectiveKey = v7Key || (productPricing[category] ? category : pricingKey);
  const baseEntry = productPricing[effectiveKey];
  if (!baseEntry) {
    return { price: null, category, breakdown: [`base ${effectiveKey}: NÃO CONFIGURADO`] };
  }
  let price = toNumber(baseEntry.value);
  if (price == null) {
    return { price: null, category, breakdown: [`base ${effectiveKey}: valor inválido "${baseEntry.value}"`] };
  }
  breakdown.push(`base ${effectiveKey}=${price.toFixed(2)}`);

  // Manga longa: +R$30 sobre torcedor (se o extra estiver configurado, usa esse)
  if (category === 'camisa_manga_longa') {
    const mangaExtra = toNumber(extrasPricing.manga_longa?.value) ?? 30;
    price += mangaExtra;
    breakdown.push(`+${mangaExtra.toFixed(2)} manga_longa`);
  }

  // Patrocínio: +R$45 se título tem "Com Patrocinio"
  // Skip se a sub-key v7 "_patrocinios" já foi usada como base (evita dupla contagem)
  if (hasPatrocinio(title) && !/_patrocinios$/.test(effectiveKey)) {
    const patrocinioExtra = toNumber(extrasPricing.patrocinio_extra?.value) ?? 45;
    price += patrocinioExtra;
    breakdown.push(`+${patrocinioExtra.toFixed(2)} patrocinio`);
  }

  // Personalizar: +R$30 se variante tem option === "Personalizar"
  if (isPersonalizar(variant)) {
    const persExtra = toNumber(extrasPricing.nome_numero?.value)
      ?? toNumber(extrasPricing.personalizacao?.value)
      ?? 30;
    price += persExtra;
    breakdown.push(`+${persExtra.toFixed(2)} personalizar`);
  }

  // Tamanho grande: acréscimo específico por tamanho se configurado, senão genérico
  // Suporta BR (2GG/3GG/4GG/GGG/GGGG) e EN (2XL/3XL/4XL/XXL/XXXL/XXXXL)
  if (isBigSize(variant)) {
    const size = (variant.option1 || '').trim().toUpperCase();
    const sizeToKeys = {
      '2GG': ['acrescimo_2gg', 'tamanho_2gg'],
      '2XL': ['acrescimo_2gg', 'tamanho_2gg'],
      'XXL': ['acrescimo_2gg', 'tamanho_2gg'],
      '3GG': ['acrescimo_3gg', 'tamanho_3gg'],
      'GGG': ['acrescimo_3gg', 'tamanho_3gg'],
      '3XL': ['acrescimo_3gg', 'tamanho_3gg'],
      'XXXL': ['acrescimo_3gg', 'tamanho_3gg'],
      '4GG': ['acrescimo_4gg', 'tamanho_4gg'],
      'GGGG': ['acrescimo_4gg', 'tamanho_4gg'],
      '4XL': ['acrescimo_4gg', 'tamanho_4gg'],
      'XXXXL': ['acrescimo_4gg', 'tamanho_4gg'],
    };
    const sizeKeys = sizeToKeys[size] || [];
    let sizeExtra = null;
    for (const k of sizeKeys) {
      const v = toNumber(extrasPricing[k]?.value);
      if (v != null) { sizeExtra = v; break; }
    }
    if (sizeExtra == null) {
      sizeExtra = toNumber(extrasPricing.acrescimo_tamanho_grande?.value) ?? 10;
    }
    price += sizeExtra;
    breakdown.push(`+${sizeExtra.toFixed(2)} tamanho_${size.toLowerCase()}`);
  }

  return { price, category, breakdown };
}

/**
 * Versão simples sem pricing do banco — usa defaults hardcoded.
 * Útil pra dry-run exploratório. NÃO usar em produção (preço deve vir do banco).
 * @param {string} title
 * @param {object} variant
 * @param {object} [overrides] - { torcedor, jogador, retro, ... }
 */
export function calcExpectedPriceWithDefaults(title, variant, overrides = {}) {
  const defaults = {
    torcedor: 209,
    jogador: 249,
    retro: 239,
    infantil: 239,
    agasalho: 359,
    conjunto_treino: 289,
    jaqueta: 389,
    moletom: 289,
    short: 199,
  };
  const products = {};
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    products[k] = { label: k, value: String(v) };
  }
  return calcExpectedPrice(title, variant, {
    products,
    extras: {
      manga_longa: { value: '30' },
      patrocinio_extra: { value: '45' },
      nome_numero: { value: '30' },
      acrescimo_tamanho_grande: { value: '10' },
    },
  });
}
