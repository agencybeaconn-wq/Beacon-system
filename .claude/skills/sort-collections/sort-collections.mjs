#!/usr/bin/env node
// sort-collections — reordena produtos dentro de todas as coleções de uma loja.
//
// Regra canônica de ordenação (decrescente):
//   Ano (26/27 > 2026 > 25/26 > 24/25 > retrô) →
//   Gênero (Masculino > Feminino > Infantil) →
//   Tipo dentro do gênero (Home/Away torcedor > Jogador > Manga Longa > Regata > Treino > Goleiro > Short > Retrô) →
//   Número (I > II > III)
//
// Uso:
//   node sort-collections.mjs <clientIdOrName>                       # DRY-RUN (só lista o que mudaria)
//   node sort-collections.mjs <clientIdOrName> --apply               # aplica
//   node sort-collections.mjs <clientIdOrName> --apply --resume      # retoma checkpoint
//   node sort-collections.mjs <clientIdOrName> --status              # status do checkpoint
//
// Background-safe: checkpoint após cada coleção + SIGINT + resume.

import fs from 'fs';
import { shReq, shopifyGraphQL, delay, API_VERSION, paginate, getGraphQLErrors } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { writeCheckpoint, readCheckpoint, clearCheckpoint, installSigintHandler, hasCheckpoint } from '../../lib/checkpoint.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';

const SKILL_NAME = 'sort-collections';

function parseArgs() {
  const args = { _: [], apply: false, resume: false, status: false, priorityBr: false, forceLocale: null, onlyHandles: null, homePlan: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--resume') args.resume = true;
    else if (a === '--status') args.status = true;
    else if (a === '--priority-br') args.priorityBr = true;
    else if (a === '--force-br') args.forceLocale = 'BR';
    else if (a === '--force-en') args.forceLocale = 'EN';
    else if (a.startsWith('--only-handles=')) args.onlyHandles = a.slice(15).split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--home-plan') args.homePlan = argv[++i];
    else if (a.startsWith('--home-plan=')) args.homePlan = a.slice('--home-plan='.length);
    else args._.push(a);
  }
  return args;
}

/**
 * Detecta se a loja é BR ou EN baseado em currency/country/locale do shop.
 * Lojas EN (Brasileirissimo, GM Sports, MatchWear, etc) NÃO devem aplicar
 * regras de "Brasil primeiro" — clientela é internacional, gatilho emocional muda.
 */
async function detectStoreLocale(shop, token) {
  try {
    const r = await fetch(`https://${shop}/admin/api/2025-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    });
    if (!r.ok) return 'BR'; // fallback conservador
    const j = await r.json();
    const s = j.shop || {};
    const currency = (s.currency || '').toUpperCase();
    const country = (s.country_code || s.country || '').toUpperCase();
    const locale = (s.primary_locale || '').toLowerCase();
    if (currency === 'BRL' || country === 'BR' || locale.startsWith('pt')) return 'BR';
    return 'EN';
  } catch (e) {
    return 'BR'; // fallback conservador
  }
}

// Seleção Brasil + clubes brasileiros da Série A — usado com --priority-br
// Ordem importa: quanto antes, maior o score (Brasil seleção vem primeiro)
const BR_PRIORITY = [
  'Brasil',
  'Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Santos',
  'Cruzeiro', 'Atlético Mineiro', 'Botafogo', 'Fluminense',
  'Internacional', 'Grêmio', 'Vasco',
];

// Remove diacríticos pra resistir a produtos com "Sao Paulo" / "Gremio" sem acento
const stripDiacritics = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const BR_PRIORITY_NORM = BR_PRIORITY.map(stripDiacritics);

function brScore(title) {
  const t = stripDiacritics(title);
  for (let i = 0; i < BR_PRIORITY_NORM.length; i++) {
    if (t.includes(BR_PRIORITY_NORM[i])) return BR_PRIORITY.length - i; // Brasil=13, Flamengo=12, ... Vasco=1
  }
  return 0;
}

/**
 * Calcula sort key de um produto baseado no título.
 * Return number — quanto maior, mais acima aparece na coleção.
 *
 * Year bucket (1000x peso):
 *   2026+ → 100
 *   2025  → 90
 *   2024  → 80
 *   retrô → 10
 *   else  → 50
 *
 * Type bucket (1x peso):
 *   jogador/authentic → 95
 *   feminina (não infantil) → 85
 *   infantil/kids → 80
 *   manga longa → 75
 *   regata/tank → 70
 *   conjunto de treino → 60
 *   treino → 55
 *   goleiro → 45
 *   short → 40
 *   retrô → 30
 *   camisa/jersey padrão → 100 (torcedor é o mais comum)
 *   else → 50
 *
 * Number bucket (0.01x peso):
 *   I → 3, II → 2, III → 1
 */
const BR_SELECAO_RE = /^brasil\b/i;
const BR_CLUBS_RE = /^(flamengo|palmeiras|corinthians|s[ãa]o paulo|santos|fluminense|botafogo|vasco|cruzeiro|atl[ée]tico mineiro|atletico[ -]mg|gr[êe]mio|internacional(?! da)|bahia|fortaleza|cear[áa]|mirassol|juventude|sport recife|vit[óo]ria|chapecoense|goi[áa]s|cuiab[áa]|am[ée]rica[ -]mg|athletico paranaense|athletico[ -]pr|coritiba|paysandu|red bull bragantino|rb bragantino|juventus da mooca|crici[úu]ma|santa cruz|remo|ponte preta|bragantino)/i;

// Popularidade por time — gatilho emocional do torcedor (não necessariamente torcida absoluta).
// Ordem revisada pelo colaborador (2026):
//   BR: Flamengo (torcida) > Palmeiras (títulos) > Corinthians (Yuri/mídia) > Santos (Neymar/Memphis) > SP (história)
//   Seleções: Brasil > Argentina (Messi/Copa 2022) > Portugal (CR7) > França (Mbappé/Copa 2018) > Alemanha > resto
//   Clubes EU emocionais (gatilho craque): Inter Miami (Messi) > Al-Nassr (CR7) > Al-Hilal — ACIMA de tradicionais
//   Clubes EU tradicionais: Real Madrid > Barça > Bayern > Manchester United > ...
// Essa tabela muda a cada temporada conforme craques mudam de time — manter atualizada.
const TEAM_POPULARITY = [
  // BR — ordem revisada 2026
  [/^flamengo/i, 100],
  [/^palmeiras/i, 99],
  [/^corinthians/i, 98],
  [/^santos/i, 97],
  [/^s[ãa]o paulo/i, 96],
  [/^vasco/i, 95],
  [/^cruzeiro/i, 94],
  [/^atl[ée]tico mineiro|^atletico[ -]mg/i, 93],
  [/^gr[êe]mio/i, 92],
  [/^internacional(?! de mil)/i, 91],
  [/^botafogo/i, 90],
  [/^fluminense/i, 89],
  [/^bahia/i, 88],
  [/^fortaleza/i, 87],
  [/^athletico paranaense|^athletico[ -]pr/i, 86],
  [/^cear[áa]/i, 85],
  // Seleções — Brasil primeiro (já resolvido no bucket), depois ordem por gatilho emocional
  [/^argentina/i, 80],
  [/^portugal/i, 79],
  [/^fran[çc]a|^france/i, 78],
  [/^alemanha|^germany/i, 77],
  [/^espanha|^spain/i, 76],
  [/^it[áa]lia|^italy/i, 75],
  [/^inglaterra|^england/i, 74],
  [/^m[ée]xico|^mexico/i, 73],
  [/^holanda|^netherlands/i, 72],
  [/^uruguai|^uruguay/i, 71],
  [/^col[oô]mbia|^colombia/i, 70],
  [/^jap[ãa]o|^japan/i, 69],
  [/^brazil\b/i, 82], // EN alias pra Brasil
  [/^b[ée]lgica|^belgium/i, 68],
  // Clubes EU emocionais — gatilho craque (2026). Pode mudar a cada temporada.
  [/^inter miami/i, 65],
  [/^al[ -]?nassr/i, 64],
  [/^al[ -]?hilal/i, 63],
  // Clubes internacionais tradicionais
  [/^real madrid/i, 60],
  [/^barcelona/i, 59],
  [/^bayern/i, 58],
  [/^manchester united/i, 57],
  [/^liverpool/i, 56],
  [/^psg|^paris saint/i, 55],
  [/^manchester city/i, 54],
  [/^arsenal/i, 53],
  [/^chelsea/i, 52],
  [/^tottenham/i, 51],
  [/^juventus(?! da mooca)/i, 50],
  [/^(ac )?milan/i, 49],
  [/^inter de mil[ãa]o|^internazionale/i, 48],
  [/^atl[ée]tico de madrid|^atl[ée]tico madrid/i, 47],
  [/^napoli/i, 46],
  [/^borussia dortmund|^dortmund/i, 45],
  [/^(as )?roma/i, 44],
  [/^l[áa]zio/i, 43],
  [/^fiorentina/i, 42],
  [/^newcastle/i, 41],
  [/^ajax/i, 40],
  [/^benfica/i, 39],
  [/^porto/i, 38],
  [/^sporting/i, 37],
];

function getTeamPopularity(title) {
  const c = coreTitle(title);
  for (const [re, score] of TEAM_POPULARITY) {
    if (re.test(c)) return score;
  }
  return 1; // resto
}

// Remove prefixos/modificadores ITERATIVAMENTE em qualquer ordem.
// "Conjunto Treino Infantil Argentina" → strip "Conjunto" → "Treino" → "Infantil" → "Argentina".
const MODIFIERS_RE = /^\s*(camisa|camiseta|kit|conjunto|agasalho|short|bon[ée]|cropped|moletom|jaqueta|casaco|polo|regata|body|jersey|shirt|jacket|tank|set|kids kit|national team|training kit|infantil|feminin[ao]|masculin[ao]|woman|women|men|man|kids?|de|treino|training|jogador|player|authentic|torcedor|fan|retr[ôo]|retro|goleiro|goalkeeper|pr[ée][- ]?jogo|pre[- ]?match|manga longa|long[- ]?sleeve|viagem|academy|pro)\b[\s\-–]*/i;
function coreTitle(title) {
  let s = (title || '').trim();
  while (MODIFIERS_RE.test(s)) s = s.replace(MODIFIERS_RE, '');
  return s.trim();
}

// ===== HELPERS DE CLASSIFICAÇÃO (pra estratégias) =====

function normalizeAccents(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// Goleiro — SEMPRE no fim de qualquer vitrine, ignora ano e popularidade.
function isGoleiro(t) { return /goleir|goalk/i.test(t || ''); }

// Não-camisas (boné/blusa/jaqueta/casaco/moletom/etc) fora de Lançamentos e Rumo ao Hexa.
// Fragmentos curtos pra pegar variações/typos (bon→Boné, blus→Blusa, jaq→Jaqueta).
const NON_JERSEY_RE = /\b(bon[eé]?|blus|jaq|casac|molet|windb|anor|agas|meia|luva|chute|mochi|cachec|touca)/i;
function isNonJersey(t) { return NON_JERSEY_RE.test((t || '').toLowerCase()); }

// Seleções — detecta em QUALQUER posição do título normalizado (sem acentos).
// Lista ampla de fragmentos de países — novo país na loja? adicionar aqui.
const SELECAO_BASE_RE = /\b(sele[cç][aã]o\s+)?(brasil|argentin|portug|fran[cç]|alema|german|espan[hy]|it[aá]li|ingl|engl|m[eé]xic|holand|netherl|uruguai|uruguay|col[oô]mbi|b[eé]lgic|jap[aã]o|japan|sui[çc]a|swiss|su[eé]ci|swed|dina|denm|[aá]ustri|noru|polon|ucr[aâ]|finl|irlan|gr[eé]ci|s[eé]rvi|serbia|rom[aâ]ni|cro[aá]ci|bulg|r[uú]ssi|hungr|tchec|czech|eslov|turc|turq|turk|isra|ir[aã](?!ni)|iraq|s[aá]udi|ar[aá]bia saudita|arabia saudita|cat[aá]r|qatar|emir|emirados|arg[eé]li|algeri|tun[ií]si|marr|morocc|egit|egyp|nig[eé]ri|ghana|gana|camar|cameroon|senegal|costa do marfim|costa rica|chil[ei]|venez|equad|peru|bol[ií]vi|panam|hondur|guatem|jamaic|cuba|trinidad|austr[aá]li|nova zel|zel[aâ]nd|tail|thail|viet|indon|filip|chin|mal[aá]si|[ií]ndia|paqu[ií]st|bangl|sing|myan|cor[eé]i|korea|[aá]fric do sul|[aá]frica do sul|arm[eé]ni|az[eé]rbai|isl[aâ]ndi|est[oô]ni|let[oô]ni|litu[aâ]ni|bielorr|cana[dt]|eua|estados unidos|usa|hait|salvad|nicarag|porto ric|rep[uú]bli|esc[oó]ci|escocia|gal[eê]s|pais de gales|wales|irlanda do norte|monten|macedo|alb[aâ]ni|b[oó]snia|kosov|luxem|mold[aáo]|beliz|paragua|guia?na|suri|polin|tahiti|fiji|samoa|tonga|jord[aâ]ni|om[ãa]|s[íi]ria|afeg|libia|sud[aã]o|kuwait|palesti|lí?bano|liban|zimb|z[aâ]mbi|uganda|qu[eê]?ni|tanz|mo[cç]?amb|angola|et[íi]opi|eritre|som[aá]li|ruanda|burkin|mali|ch?ade|guin[eé]|lib[eé]?ri|serra leoa|togo|mad[ae]gasc|cabo verde|maur[ií]t|benin|gaboa?n|congo)\b/i;
function isSelecao(title) { return SELECAO_BASE_RE.test(normalizeAccents(title)); }

// Clubes BR — detector pra filtrar de coleções "internacionais".
const BR_CLUBS_FRAG_RE = /\b(flamengo|palmeiras|corinthians|s[ãa]o paulo|santos|fluminense|botafogo|vasco|cruzeiro|atl[ée]tico mineiro|atletico[ -]mg|gr[êe]mio|internacional(?! de mil)|bahia|fortaleza|cear[áa]|mirassol|juventude|sport recife|vit[óo]ria|chapecoense|goi[áa]s|cuiab[áa]|am[ée]rica[ -]mg|athletico paranaense|athletico[ -]pr|coritiba|paysandu|red bull bragantino|rb bragantino|juventus da mooca|crici[úu]ma|santa cruz|remo|ponte preta|bragantino)\b/i;
function isBRClub(title) { return BR_CLUBS_FRAG_RE.test(normalizeAccents(title)); }

// Filtro de gênero baseado no contexto da coleção.
// Coleção feminina só aceita Feminin*; infantil só aceita Infantil|Kids;
// masculino rejeita Feminin* e Infantil|Kids (neutros passam).
function matchesGender(title, gender) {
  const t = (title || '').toLowerCase();
  if (gender === 'feminino') return /feminin/i.test(t);
  if (gender === 'infantil') return /infantil|kids|body infantil/i.test(t);
  if (gender === 'masculino') return !/feminin|infantil|kids/i.test(t);
  return true;
}

function getSortKey(title) {
  const t = (title || '').toLowerCase();
  const core = coreTitle(title);

  // País (coleções mistas — lançamentos, retrôs, mais-vendidos). Em coleções de time/liga,
  // todos os produtos recebem o mesmo valor (ex: todo Flamengo é BR club), então não afeta ordem.
  // Usa `core` pra ignorar prefixos como "Camisa", "Conjunto Infantil", etc.
  // Hierarquia: Brasil sel > clubes BR > clubes estrangeiros > seleções estrangeiras > misc
  let country;
  if (BR_SELECAO_RE.test(core)) country = 5;        // Seleção Brasil — topo
  else if (BR_CLUBS_RE.test(core)) country = 4;     // Clubes brasileiros
  else if (isSelecao(title)) country = 2;             // Outras seleções (Argentina, Portugal, etc.) — depois de clubes EU
  else country = 3;                                    // Clubes estrangeiros (default — Real Madrid, Barça, Bayern, etc.)

  // Ano (desc). Checa mais específico primeiro (26/27 antes de 2026 solo).
  // Bonés vão pro final sempre (mesmo abaixo de retrô) — cliente não quer na home.
  // Retrôs icônicos do Brasil (anos de Copa: 1958, 1962, 1970, 1994, 2002) sobem dentro da faixa retrô.
  let year = 50;
  if (/^bon[ée]|\sbon[ée]\s|\bcaps?\b|\bhats?\b/i.test(t)) year = 1;  // bonés = último de tudo
  else if (/2026\/27|26\/27/.test(t)) year = 100;
  else if (/\b2026\b(?!\s*\/)/.test(t)) year = 95;
  else if (/2025\/26|25\/26/.test(t)) year = 90;
  else if (/\b2025\b(?!\s*\/)/.test(t)) year = 85;
  else if (/2024\/25|24\/25/.test(t)) year = 80;
  else if (/retr[oô]/.test(t) && /brasil/.test(t) && /\b(2002|1994|1970|1958|1962)\b/.test(t)) year = 18; // Brasil campeão Copa (icônico)
  else if (/retr[oô]/.test(t) && /brasil/.test(t)) year = 15;        // outros Brasil retrô
  else if (/retr[oô]/.test(t) && /argentina.*1986|maradona|pel[ée]|inglaterra.*1966|milan.*\b(1989|1990)\b|man.*united.*1999|barcelona.*2009/i.test(t)) year = 14; // outros icônicos mundiais
  else if (/retr[oô]/.test(t)) year = 10;

  // Gênero (masc → fem → kids → RESTO).
  // VISÃO PEDRO 2026-05-28 (final): RESTO inclui apenas — goleiro, treino, pré-jogo,
  // jacket, casaco, corta-vento, hoodie, moletom. Bloco FINAL depois das Kids, independente do gênero.
  // Manga longa + Comemorativa + Edição Especial RESPEITAM O ANO em que se encaixam
  // (entram junto da Fan do mesmo ano), NÃO vão pro RESTO.
  // Retrô fica no fim do bloco Homem (não no RESTO).
  let gender;
  const isResto = /jaqueta|jacket|casaco|windbreaker|anorak|sweatshirt|moletom|hoodie|corta[- ]vento|cape|goleiro|goalkeeper|\btreino\b|\btraining\b|pr[ée][- ]?jogo|pre.?game|prejogo|\bpolo\b|t.?shirt|\btank\s*top\b/i.test(t);
  if (isResto) gender = 0; // RESTO — vai depois de Kids
  else if (/infantil|kids|body infantil/i.test(t)) gender = 10;
  else if (/feminin|woman/i.test(t)) gender = 20;
  else gender = 30; // masculino (default)

  // Tipo dentro do gênero (VISÃO PEDRO 2026-05-28 final):
  // Fan/Torcedor (100) → Player/Jogador (80) → Comemorativa/Edição Especial (75) → Manga Longa (70) → Regata (60) →
  // → Retrô (10) → Short (8) → Boné (1).
  // Manga longa + Comemorativa + Edição Especial são tier 1 (camisa principal) — entram junto
  // do bloco do ano. Retrô fica no fim do bloco Homem (tier 0). Goleiro/Treino/Jacket vão pro
  // bloco RESTO via gender=0 (não passam por aqui).
  let type;
  if (/jogador|authentic|player/i.test(t)) type = 80;
  else if (/comemorat|commemorative|edi[çc][ãa]o especial|special edition|limited edition|originals|legacy|legado|tribute|tributo|throwback|\b125\b|\b120\b/i.test(t)) type = 75;
  else if (/manga longa|longsleeve|long.?sleeve/i.test(t)) type = 70;
  else if (/regata|tank/i.test(t)) type = 60;
  else if (/retr[oô]|retro/i.test(t)) type = 10;
  else if (/short/i.test(t)) type = 8;
  else type = 100; // torcedor Home/Away/Third padrão (Fan)

  let num = 0;
  if (/\bI\b/.test(title) && !/II|III/.test(title)) num = 3;
  else if (/\bII\b/.test(title) && !/III/.test(title)) num = 2;
  else if (/\bIII\b/.test(title)) num = 1;

  // Popularidade do time (Flamengo > Palmeiras > São Paulo > ..., Real Madrid > Barcelona > ...)
  const popularity = getTeamPopularity(title);

  // Tier: tier 1 = pertence ao "bloco do ano" (Fan, Player, Comemorativa, Manga Longa, Edição Especial).
  // Tier 0 = só Retrô + Short (vão pro fim do bloco gênero antes do RESTO).
  // VISÃO PEDRO 2026-05-28 final: comemorativa+manga longa+edição especial respeitam o ano,
  // então entram no tier 1 junto da Fan do mesmo ano.
  const tier = type >= 60 ? 1 : 0;

  // Ordem hierárquica (VISÃO PEDRO 2026-05-28 — vale TODAS as lojas):
  //   Gênero (Masc > Fem > Kids > RESTO) — manga longa/jacket/casaco no bloco RESTO ao fim
  //   Tier (camisas principais Fan/Player > resto: treino/goleiro/comemorativa/retrô/short)
  //   Ano (26/27 > 2026 > 25/26 > ... > retrô)
  //   País (Brasil sel > clubes BR > clubes EU > seleções estrangeiras)
  //   Tipo (Fan/Torcedor > Player/Jogador > Treino > Goleiro > Comemorativa > Retrô > Short)
  //   Popularidade (time de mais torcida primeiro)
  //   Número (I > II > III)
  //
  // Exemplo coleção Flamengo (masculino primeiro, depois fem, kids, e por último resto):
  //   Fan 2026/27 I → Fan 2026/27 II → Fan 2026/27 III → Player 2026/27 I → II → III →
  //   Fan 2025/26 I → II → III → Player 2025/26 → ... → Retrô / Comemorativa / Treino →
  //   [Fem 2026 Fan I → II → ...] → [Kids 2026 Fan I → II → ...] →
  //   [Manga Longa Flamengo → Jacket Flamengo → Casaco Flamengo Corta-Vento]
  return gender * 1e17 + tier * 1e15 + year * 1e12 + country * 1e10 + type * 1e7 + popularity * 1e2 + num;
}

// Bucket key: tudo do getSortKey EXCETO popularity e num.
// Produtos com mesmo bucket key vão pro round-robin por time.
function getBucketKey(title) {
  const k = getSortKey(title);
  // Remove popularity e num do bucket → mantém year/country/type/gender
  return Math.floor(k / 1e5) * 1e5;
}

function getNumScore(title) {
  if (/\bI\b/.test(title) && !/II|III/.test(title)) return 3;
  if (/\bII\b/.test(title) && !/III/.test(title)) return 2;
  if (/\bIII\b/.test(title)) return 1;
  return 0;
}

function sortProducts(products, opts = {}) {
  const { priorityBr = false } = opts;
  return [...products].sort((a, b) => {
    if (priorityBr) {
      const brDiff = brScore(b.title) - brScore(a.title);
      if (brDiff !== 0) return brDiff;
    }
    return getSortKey(b.title) - getSortKey(a.title);
  });
}

// Round-robin: agrupa por time (popularidade) e intercala 1 de cada,
// começando pelo mais popular. Usado em coleções tipo Lançamentos onde
// o cliente quer ver "1 camisa de cada time" antes de repetir.
function roundRobinByTeam(sortedProducts) {
  const groups = new Map();
  for (const p of sortedProducts) {
    const key = getTeamPopularity(p.title) * 10 + (BR_SELECAO_RE.test(coreTitle(p.title)) ? 1000 : BR_CLUBS_RE.test(coreTitle(p.title)) ? 500 : 0);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => b - a);
  const out = [];
  const maxLen = Math.max(0, ...[...groups.values()].map(g => g.length));
  for (let i = 0; i < maxLen; i++) {
    for (const k of sortedKeys) {
      const g = groups.get(k);
      if (g[i]) out.push(g[i]);
    }
  }
  return out;
}

// Aplica round-robin só em coleções "mistas" (lançamentos, mais-vendidos, destaques).
// Em coleções de time único (flamengo) ou liga (brasileirao) o sort key normal já basta.
function shouldRoundRobin(handle) {
  return /^(lan[çc]amentos|mais-vendidos|destaques|home|featured)/i.test(handle || '');
}

// ===== ESTRATÉGIAS DE ORDENAÇÃO (pra vitrines específicas da Home) =====
// Usadas via --home-plan. Sem plan, a skill usa o comportamento default (sortProducts + round-robin).

// Ano bucket específico pras estratégias — mesma hierarquia do getSortKey mas independente.
// Corte retrô: 22/23 ou mais antigo = retrô (fora de Lançamentos/Rumo ao Hexa).
function stratYearKey(t) {
  const s = (t || '').toLowerCase();
  if (/2026\/27|26\/27/.test(s)) return 100;
  if (/\b2026\b(?!\s*\/)/.test(s)) return 95;
  if (/2025\/26|25\/26/.test(s)) return 90;
  if (/\b2025\b(?!\s*\/)/.test(s)) return 85;
  if (/2024\/25|24\/25/.test(s)) return 80;
  if (/2023\/24|23\/24/.test(s)) return 75;
  if (/2022\/23|22\/23/.test(s)) return 10;
  if (/2021\/22|21\/22|2020\/21|20\/21|\b20[0-2][0-9]\b/.test(s)) return 5;
  if (/retr[ôo]|retro/.test(s)) return 10;
  return 50;
}
function stratIsRetro(t) { return stratYearKey(t) <= 10; }

// Tipo: Home Torcedor > Away > Third > Jogador > Manga Longa > Regata > Treino > Goleiro.
function stratTypeKey(t) {
  const s = (t || '').toLowerCase();
  if (/jaqueta|jacket|casaco/i.test(s)) return 5;
  if (/goleiro|goalkeeper/i.test(s)) return 10;
  if (/edi[çc][ãa]o especial|special edition/i.test(s)) return 15;
  if (/short(?!t sleeve)/i.test(s)) return 20;
  if (/conjunto.*treino|training set/i.test(s)) return 30;
  if (/treino|training|pr[ée][- ]?jogo/i.test(s)) return 35;
  if (/regata|tank/i.test(s)) return 40;
  if (/manga longa|long.?sleeve/i.test(s)) return 45;
  if (/jogador|player|authentic/i.test(s)) return 60;
  if (/\baway\b|\bii\b|fora de casa|azul/i.test(s) && !/\biii\b/.test(s)) return 90;
  if (/\bthird\b|\biii\b/.test(s)) return 85;
  return 100;
}

// Retrôs icônicos — Brasil 2002 (penta) > Brasil 1970 (Pelé) > outros Copa > outros ícones.
function retroIconScore(t) {
  const s = (t || '').toLowerCase();
  if (/brasil.*\b2002\b/.test(s)) return 100;
  if (/brasil.*\b(1970|70)\b/.test(s)) return 95;
  if (/brasil.*\b(1994|1958|1962)\b/.test(s)) return 90;
  if (/brasil/.test(s)) return 80;
  if (/argentina.*\b1986\b|maradona/.test(s)) return 70;
  if (/milan.*\b(1989|1990|1994)\b/.test(s)) return 65;
  if (/barcelona.*\b(2009|2011)\b/.test(s)) return 60;
  if (/inglaterra.*\b1966\b/.test(s)) return 58;
  if (/man.*united.*\b(1999|2008)\b/.test(s)) return 55;
  if (/real madrid/.test(s)) return 50;
  if (/barcelona/.test(s)) return 48;
  return 30;
}

// Ordena dentro de um grupo: não-goleiros por tipo/ano desc, goleiros no fim.
function sortGroupGoleiroLast(products, cmpFn) {
  const nonG = products.filter(p => !isGoleiro(p.title)).sort(cmpFn);
  const gol = products.filter(p => isGoleiro(p.title)).sort(cmpFn);
  return [...nonG, ...gol];
}

// Agrupa por time (chave = fragmento da TEAM_POPULARITY que bate, ou "outros"),
// ordena dentro do grupo, e retorna round-robin (1 por time por rodada).
function roundRobinByTeamStrat(products, innerCmp) {
  const groups = new Map();
  for (const p of products) {
    const core = coreTitle(p.title);
    let key = 'outros';
    let score = 1;
    for (const [re, s] of TEAM_POPULARITY) {
      if (re.test(core)) { key = re.source; score = s; break; }
    }
    if (!groups.has(key)) groups.set(key, { score, products: [] });
    groups.get(key).products.push(p);
  }
  for (const g of groups.values()) g.products = sortGroupGoleiroLast(g.products, innerCmp);
  const sortedGroups = [...groups.values()].sort((a, b) => b.score - a.score);
  const maxLen = Math.max(0, ...sortedGroups.map(g => g.products.length));
  const out = [];
  for (let round = 0; round < maxLen; round++) {
    for (const g of sortedGroups) if (g.products[round]) out.push(g.products[round]);
  }
  return out;
}

// Estratégia 1 — Rumo ao Hexa / Seleção Brasileira
// Só Brasil seleção, não-retrô, gênero certo, sem não-camisas. TIPO domina ANO.
function stratBrasilSelecaoOnly(products, { gender } = {}) {
  const filtered = products.filter(p =>
    /^brasil\b/i.test(coreTitle(p.title))
    && !stratIsRetro(p.title)
    && !isNonJersey(p.title)
    && matchesGender(p.title, gender)
  );
  const cmp = (a, b) => (stratTypeKey(b.title) - stratTypeKey(a.title)) || (stratYearKey(b.title) - stratYearKey(a.title));
  return sortGroupGoleiroLast(filtered, cmp);
}

// Estratégia 2 — Lançamentos (só clubes, sem seleções, sem retrô, sem não-camisas)
// Round-robin por TIME — 1 por time na rodada 1.
function stratLancamentosClubes(products, { gender } = {}) {
  const active = products.filter(p =>
    !stratIsRetro(p.title)
    && !isNonJersey(p.title)
    && !isSelecao(p.title)
    && matchesGender(p.title, gender)
  );
  const cmp = (a, b) => (stratYearKey(b.title) - stratYearKey(a.title)) || (stratTypeKey(b.title) - stratTypeKey(a.title));
  return roundRobinByTeamStrat(active, cmp);
}

// Estratégia 3 — Conjuntos Infantis (round-robin, sem retrô)
// opts.onlyInternational: filtra clubes BR fora (pra "Conjuntos Infantis Internacionais").
function stratConjuntosInfantis(products, { gender, onlyInternational } = {}) {
  const active = products.filter(p => {
    if (stratIsRetro(p.title)) return false;
    if (!matchesGender(p.title, gender)) return false;
    if (onlyInternational && isBRClub(p.title)) return false;
    return true;
  });
  const cmp = (a, b) => (stratYearKey(b.title) - stratYearKey(a.title)) || (stratTypeKey(b.title) - stratTypeKey(a.title));
  return roundRobinByTeamStrat(active, cmp);
}

// Estratégia 4 — Retrôs icônicos. Brasil 2002 topo, goleiro no fim.
function stratRetrosIconicos(products, { gender } = {}) {
  const filtered = products.filter(p => matchesGender(p.title, gender));
  const cmp = (a, b) => {
    const d = retroIconScore(b.title) - retroIconScore(a.title); if (d) return d;
    let sa = 1, sb = 1;
    for (const [re, s] of TEAM_POPULARITY) {
      if (re.test(coreTitle(a.title))) { sa = s; break; }
    }
    for (const [re, s] of TEAM_POPULARITY) {
      if (re.test(coreTitle(b.title))) { sb = s; break; }
    }
    return sb - sa;
  };
  return sortGroupGoleiroLast(filtered, cmp);
}

const STRATEGIES = {
  'brasil-selecao-only': stratBrasilSelecaoOnly,
  'lancamentos-clubes': stratLancamentosClubes,
  'conjuntos-infantis': stratConjuntosInfantis,
  'retros-iconicos': stratRetrosIconicos,
};

function applyStrategy(products, strategyName, opts) {
  const fn = STRATEGIES[strategyName];
  if (!fn) throw new Error(`Estratégia desconhecida: "${strategyName}". Disponíveis: ${Object.keys(STRATEGIES).join(', ')}`);
  return fn(products, opts || {});
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function fetchAllSmartCollections(shop, token) {
  return paginate(shop, token,
    `/admin/api/${API_VERSION}/smart_collections.json?limit=250&fields=id,title,handle,sort_order`,
    'smart_collections', 500);
}
async function fetchAllCustomCollections(shop, token) {
  return paginate(shop, token,
    `/admin/api/${API_VERSION}/custom_collections.json?limit=250&fields=id,title,handle,sort_order`,
    'custom_collections', 500);
}

async function fetchCollectionProducts(shop, token, colId) {
  const all = [];
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,handle,title,status&collection_id=${colId}`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    all.push(...(r.body?.products || []));
    const linkHeader = r.link || '';
    const m = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (!m) break;
    const u = new URL(m[1]);
    p = u.pathname + u.search;
    await delay(300);
  }
  return all;
}

const COLLECTION_REORDER_MUT = `mutation reorder($id: ID!, $moves: [MoveInput!]!) {
  collectionReorderProducts(id: $id, moves: $moves) {
    job { id }
    userErrors { field message }
  }
}`;

const SMART_COLLECTION_UPDATE_MUT = `mutation($input: CollectionInput!) {
  collectionUpdate(input: $input) {
    collection { id sortOrder }
    userErrors { field message }
  }
}`;

async function setSortOrderManual(shop, token, gid, colType, numericId) {
  // GraphQL collectionUpdate não persiste sortOrder em custom collections antigas (bug Shopify).
  // Fallback: PUT REST no endpoint específico do tipo (custom/smart).
  const r = await shopifyGraphQL(shop, token, SMART_COLLECTION_UPDATE_MUT, {
    input: { id: gid, sortOrder: 'MANUAL' },
  });
  const errs = getGraphQLErrors(r, 'collectionUpdate');
  if (errs.length === 0) {
    const returnedSort = r.body?.data?.collectionUpdate?.collection?.sortOrder;
    if (returnedSort === 'MANUAL') return true;
    // GraphQL retornou OK mas sortOrder não persistiu — fallback REST
  }
  // Fallback REST
  const endpoint = colType === 'custom' ? 'custom_collections' : 'smart_collections';
  const wrapKey = colType === 'custom' ? 'custom_collection' : 'smart_collection';
  try {
    const restRes = await shReq(shop, token, 'PUT', `/admin/api/${API_VERSION}/${endpoint}/${numericId}.json`,
      { [wrapKey]: { id: numericId, sort_order: 'manual' } });
    return restRes.status >= 200 && restRes.status < 300 && restRes.body?.[wrapKey]?.sort_order === 'manual';
  } catch { return false; }
}

async function reorderCollection(shop, token, colId, productIds) {
  const gid = `gid://shopify/Collection/${colId}`;
  // Shopify limita moves a 250 por call. Pra colecoes grandes, paginar.
  const BATCH = 250;
  const allMoves = productIds.map((pid, idx) => ({
    id: `gid://shopify/Product/${pid}`,
    newPosition: String(idx),
  }));
  const allErrs = [];
  for (let i = 0; i < allMoves.length; i += BATCH) {
    const moves = allMoves.slice(i, i + BATCH);
    const r = await shopifyGraphQL(shop, token, COLLECTION_REORDER_MUT, { id: gid, moves });
    const errs = getGraphQLErrors(r, 'collectionReorderProducts');
    if (errs.length) allErrs.push(...errs);
    if (i + BATCH < allMoves.length) await new Promise(r => setTimeout(r, 800));
  }
  return allErrs;
}

async function main() {
  const args = parseArgs();

  if (args.status) {
    const ck = readCheckpoint(SKILL_NAME);
    if (!ck) { console.log('Nenhum checkpoint ativo pra sort-collections.'); return; }
    console.log('=== Checkpoint sort-collections ===');
    console.log('  ts:', ck.ts);
    console.log('  cliente:', ck.data?.clientName || '?');
    console.log('  processedCollectionIds:', ck.data?.processedIds?.length || 0, '/', ck.data?.total || '?');
    console.log('\nRode com --resume pra retomar.');
    return;
  }

  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node sort-collections.mjs <clientIdOrName> [--apply] [--resume] [--status] [--home-plan <file.json>]');
    process.exit(1);
  }

  // Carrega home-plan se fornecido.
  // Formato: { "masculino-brasil": { "strategy": "brasil-selecao-only", "gender": "masculino" }, ... }
  let homePlan = null;
  if (args.homePlan) {
    if (!fs.existsSync(args.homePlan)) {
      console.error(`✗ home-plan não encontrado: ${args.homePlan}`);
      process.exit(1);
    }
    homePlan = JSON.parse(fs.readFileSync(args.homePlan, 'utf8'));
    console.log(`✓ home-plan carregado: ${Object.keys(homePlan).length} handles com estratégia`);
  }

  console.log(`\n=== sort-collections ${args.apply ? '[APPLY]' : '[DRY-RUN]'}${homePlan ? ' [HOME-PLAN]' : ''} ===`);

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  const shop = client.shopify_domain;
  const token = client.shopify_access_token;

  // Detecta locale (BR vs EN) — afeta `--priority-br` e popularidade emocional
  const locale = args.forceLocale || await detectStoreLocale(shop, token);
  console.log(`✓ Locale: ${locale}${args.forceLocale ? ' (forçado)' : ' (auto-detectado via shop info)'}`);
  if (args.priorityBr && locale === 'EN') {
    console.warn(`⚠ --priority-br IGNORADO: loja EN não deve priorizar times brasileiros`);
    console.warn(`  Pra forçar mesmo assim use --force-br --priority-br`);
    args.priorityBr = false;
  }

  // FETCH
  console.log(`\nBuscando coleções (smart + custom)...`);
  const [smart, custom] = await Promise.all([
    fetchAllSmartCollections(shop, token),
    fetchAllCustomCollections(shop, token),
  ]);
  let allCols = [
    ...smart.map(c => ({ ...c, type: 'smart' })),
    ...custom.map(c => ({ ...c, type: 'custom' })),
  ];
  console.log(`  ${allCols.length} coleções (${smart.length} smart + ${custom.length} custom)`);

  if (args.onlyHandles) {
    const want = new Set(args.onlyHandles);
    allCols = allCols.filter(c => want.has(c.handle));
    console.log(`  filtro --only-handles: ${allCols.length} coleções (${args.onlyHandles.join(', ')})`);
  }
  if (args.priorityBr) {
    console.log(`  modo --priority-br: seleção Brasil + clubes BR primeiro`);
  }

  // Checkpoint resume
  let processedIds = new Set();
  if (args.resume && hasCheckpoint(SKILL_NAME)) {
    const ck = readCheckpoint(SKILL_NAME);
    if (ck?.data?.clientId === client.id) {
      processedIds = new Set(ck.data.processedIds || []);
      console.log(`\n⏯  Resumindo: ${processedIds.size} já processadas`);
    }
  } else if (hasCheckpoint(SKILL_NAME)) {
    console.warn(`\n⚠ Checkpoint anterior existe. Rode com --resume pra retomar.`);
  }

  // SIGINT handler
  if (args.apply) {
    installSigintHandler(SKILL_NAME, () => ({
      clientId: client.id,
      clientName: client.name,
      processedIds: [...processedIds],
      total: allCols.length,
    }));
  }

  // Analyze each collection
  console.log(`\nAnalisando produtos por coleção...`);
  const toReorder = [];
  let alreadySorted = 0;
  let empty = 0;
  let checked = 0;

  for (const col of allCols) {
    if (processedIds.has(col.id)) continue;

    const products = await fetchCollectionProducts(shop, token, col.id);
    checked++;
    if (products.length < 2) { empty++; continue; }

    // Estratégia: se handle tem mapeamento no home-plan, usa estratégia customizada.
    // Senão, comportamento default (sortProducts + round-robin quando aplicável).
    const planEntry = homePlan && homePlan[col.handle];
    let sorted, strategyUsed;
    if (planEntry) {
      const { strategy, gender, ...opts } = planEntry;
      // ACTIVE antes de DRAFT/ARCHIVED (rascunhos poluem)
      const active = products.filter(p => p.status === 'ACTIVE' || p.status === 'active');
      const inactive = products.filter(p => p.status !== 'ACTIVE' && p.status !== 'active');
      sorted = [...applyStrategy(active, strategy, { gender, ...opts }), ...inactive];
      strategyUsed = strategy;
    } else {
      sorted = sortProducts(products, { priorityBr: args.priorityBr });
      // Round-robin desabilitado — o sort com tier (camisa/non-camisa) já agrupa Home+Away por time.
      strategyUsed = 'default';
    }
    const currentOrder = products.map(p => p.id);
    const desiredOrder = sorted.map(p => p.id);

    if (arraysEqual(currentOrder, desiredOrder)) {
      alreadySorted++;
    } else {
      toReorder.push({
        col,
        products: sorted,
        count: products.length,
        strategy: strategyUsed,
      });
    }

    if (checked % 20 === 0) {
      process.stdout.write(`\r  analisadas ${checked}/${allCols.length - processedIds.size}   `);
    }
    await delay(300);
  }
  console.log(`\n`);

  // PREVIEW
  console.log(`=== PREVIEW ===`);
  console.log(`Total coleções: ${allCols.length}`);
  console.log(`  Já processadas (checkpoint): ${processedIds.size}`);
  console.log(`  Já ordenadas corretamente:   ${alreadySorted}`);
  console.log(`  Vazias ou com 1 produto:     ${empty}`);
  console.log(`  A reordenar:                 ${toReorder.length}`);

  if (toReorder.length === 0) {
    console.log(`\n✓ Nada a fazer.`);
    if (args.apply) clearCheckpoint(SKILL_NAME);
    return;
  }

  // Se home-plan: mostra TODAS as coleções do plano com top 10 (vitrine completa).
  // Senão: amostra de 5.
  if (homePlan) {
    const planned = toReorder.filter(r => r.strategy !== 'default');
    console.log(`\nColeções com estratégia customizada (${planned.length}):`);
    for (const r of planned) {
      console.log(`\n  [${r.strategy}] ${r.col.title} (${r.count} produtos)`);
      r.products.slice(0, 10).forEach((p, i) => console.log(`    ${String(i+1).padStart(2)}. ${p.title}`));
    }
    const others = toReorder.filter(r => r.strategy === 'default');
    if (others.length) console.log(`\n  + ${others.length} coleções com estratégia default (fora do plano)`);
  } else {
    console.log(`\nAmostra (até 5 coleções afetadas):`);
    for (const r of toReorder.slice(0, 5)) {
      console.log(`  ${r.col.title} (${r.count} produtos) — ${r.col.type}`);
      console.log(`    top 3 após reorder:`);
      r.products.slice(0, 3).forEach((p, i) => console.log(`      ${i + 1}. ${p.title}`));
    }
    if (toReorder.length > 5) console.log(`  ...+${toReorder.length - 5}`);
  }

  printEstimate({ count: toReorder.length, opName: 'reorder collections', rateLimitMs: 600, unit: 'coleções' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: toReorder.length, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra reordenar.`);
    return;
  }

  // EXECUTE
  console.log(`\n=== EXECUTANDO ===`);
  let ok = 0, fail = 0;
  for (let i = 0; i < toReorder.length; i++) {
    const r = toReorder[i];
    try {
      // Todas collections (smart e custom) precisam sortOrder=MANUAL antes de reorder.
      // Custom antigas têm bug no GraphQL collectionUpdate (sortOrder não persiste),
      // por isso setSortOrderManual tem fallback REST.
      const gid = `gid://shopify/Collection/${r.col.id}`;
      await setSortOrderManual(shop, token, gid, r.col.type, r.col.id);
      await delay(400);
      const errs = await reorderCollection(shop, token, r.col.id, r.products.map(p => p.id));
      if (errs.length) {
        fail++;
        console.log(`\n  ✗ ${r.col.title}: ${JSON.stringify(errs).slice(0, 200)}`);
      } else {
        ok++;
        processedIds.add(r.col.id);
      }
    } catch (e) {
      fail++;
      console.log(`\n  ✗ ${r.col.title}: ${e.message}`);
    }

    // Checkpoint a cada 5 coleções
    if (processedIds.size % 5 === 0) {
      writeCheckpoint(SKILL_NAME, {
        clientId: client.id,
        clientName: client.name,
        processedIds: [...processedIds],
        total: allCols.length,
      });
    }
    process.stdout.write(`\r  [${i + 1}/${toReorder.length}] ok=${ok} fail=${fail}   `);
    await delay(500);
  }

  console.log(`\n\nResultado: ok=${ok} fail=${fail}`);

  if (fail === 0) clearCheckpoint(SKILL_NAME);

  await appendExecutionLog({
    skill: SKILL_NAME,
    client_id: client.id,
    client_name: client.name,
    shop,
    collections_total: allCols.length,
    collections_reordered: ok,
    collections_failed: fail,
    dry_run: false,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
