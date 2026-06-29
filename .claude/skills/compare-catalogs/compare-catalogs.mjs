#!/usr/bin/env node
// compare-catalogs — compara 2 catálogos Shopify por atributos estruturais.
//
// Ao invés de fuzzy match de keywords (que cria falsos positivos),
// extrai { team, year, kit, version, feminina, infantil, player } de cada título
// e compara por chave canônica.
//
// Uso:
//   node compare-catalogs.mjs <clienteA> --csv=path/produtos.csv [--year-filter=2026/27]
//   node compare-catalogs.mjs <clienteA> --client=<clienteB> [--year-filter=2026]
//   node compare-catalogs.mjs <clienteA> --client=<clienteB> --markdown=out.md --out=out.json
//
// Read-only — não modifica nenhum catálogo.

import { shReq, nextPageUrl, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// ═══════════════════════════════════════════════════════════════════════
// TEAM_ALIASES — fonte canônica de times
// ═══════════════════════════════════════════════════════════════════════

const TEAM_ALIASES = {
  // Brasileirão
  'flamengo':         ['flamengo', 'mengao', 'mengão', 'mengo'],
  'palmeiras':        ['palmeiras', 'verdao', 'verdão', 'porco', 'sep'],
  'sao-paulo':        ['são paulo', 'sao paulo', 'spfc', 'tricolor paulista', 'soberano'],
  'corinthians':      ['corinthians', 'timão', 'timao', 'sccp'],
  'santos':           ['santos', 'peixe'],
  'vasco':            ['vasco', 'vasco da gama', 'gigante da colina', 'cruzmaltino'],
  'botafogo':         ['botafogo', 'fogão', 'fogao', 'glorioso'],
  'fluminense':       ['fluminense', 'flu ', 'tricolor carioca', 'fluzão'],
  'cruzeiro':         ['cruzeiro', 'raposa', 'celeste'],
  'atletico-mineiro': ['atlético mineiro', 'atletico mineiro', 'galo', 'galo mineiro', 'atl mg'],
  'gremio':           ['grêmio', 'gremio', 'imortal', 'tricolor gaucho', 'tricolor gaúcho'],
  'internacional':    ['internacional', 'inter ', 'colorado'],
  'bahia':            ['bahia ', 'tricolor baiano', 'bahêa', 'baheia'],
  'athletico-pr':     ['athletico pr', 'athletico paranaense', 'furacão', 'furacao', 'cap'],
  'bragantino':       ['red bull bragantino', 'bragantino'],
  'ceara':            ['ceará', 'ceara', 'vozão', 'vozao'],
  'fortaleza':        ['fortaleza', 'leão do pici', 'leao do pici'],
  'juventude':        ['juventude', 'papo'],
  'vitoria':          ['vitória', 'vitoria ', 'leão da barra'],
  'sport':            ['sport', 'sport recife', 'leão da ilha'],
  'cuiaba':           ['cuiabá', 'cuiaba', 'dourado'],
  'goias':            ['goiás', 'goias', 'esmeraldino'],
  'america-mg':       ['américa mineiro', 'america mineiro', 'coelho'],

  // Champions League / Europeus
  'real-madrid':      ['real madrid', 'merengue', 'los blancos', 'casa blanca'],
  'barcelona':        ['barcelona', 'barça', 'barca', 'fc barcelona', 'fcb', 'blaugrana'],
  'manchester-united':['manchester united', 'man united', 'man utd', 'red devils', 'mufc'],
  'manchester-city':  ['manchester city', 'man city', 'citizens', 'mcfc'],
  'liverpool':        ['liverpool', 'reds', 'lfc', 'anfield'],
  'chelsea':          ['chelsea', 'blues', 'cfc'],
  'arsenal':          ['arsenal', 'gunners', 'afc'],
  'tottenham':        ['tottenham', 'spurs', 'thfc'],
  'psg':              ['psg', 'paris saint-germain', 'paris saint germain', 'paris sg', 'paris fc', 'paris st-germain'],
  'juventus':         ['juventus', 'juve', 'vecchia signora', 'bianconeri'],
  'milan':            ['milan', 'ac milan', 'rossoneri'],
  'inter-milan':      ['inter milan', 'internazionale', 'nerazzurri', 'inter de milão'],
  'bayern':           ['bayern', 'bayern munchen', 'bayern munich', 'fc bayern', 'bayer munich'],
  'ajax':             ['ajax'],
  'benfica':          ['benfica', 'águias', 'aguias'],
  'porto':            ['porto ', 'dragões', 'dragoes', 'fc porto'],
  'atletico-madrid':  ['atlético madrid', 'atletico madrid', 'atletico de madrid', 'colchoneros'],
  'dortmund':         ['borussia dortmund', 'dortmund', 'bvb'],
  'napoli':           ['napoli', 'partenopei'],
  'roma':             ['roma', 'as roma', 'giallorossi'],
  'lazio':            ['lazio', 'biancocelesti'],
  'west-ham':         ['west ham', 'hammers'],
  'newcastle':        ['newcastle', 'newcastle united', 'magpies'],
  'wolves':           ['wolves', 'wolverhampton'],
  'villarreal':       ['villarreal', 'villareal'],
  'sporting':         ['sporting', 'sporting cp', 'sporting lisbon'],
  'fulham':           ['fulham'],
  'everton':          ['everton'],
  'west-bromwich':    ['west bromwich', 'wba'],
  'leicester':        ['leicester'],
  'brighton':         ['brighton', 'seagulls'],
  'southampton':      ['southampton'],
  'crystal-palace':   ['crystal palace', 'palace'],
  'aston-villa':      ['aston villa', 'villa'],
  'monaco':           ['monaco ', 'as monaco'],
  'lille':            ['lille', 'losc'],
  'lyon':             ['lyon', 'olympique lyonnais', 'ol'],
  'nice':             ['nice ', 'ogc nice'],
  'rennes':           ['rennes'],
  'schalke':          ['schalke', 'schalke 04'],
  'union-berlin':     ['union berlin', 'fc union'],
  'frankfurt':        ['frankfurt', 'eintracht frankfurt'],
  'hoffenheim':       ['hoffenheim', 'tsg hoffenheim'],
  'wolfsburg':        ['wolfsburg', 'vfl wolfsburg'],
  'stuttgart':        ['stuttgart', 'vfb stuttgart'],
  'bologna':          ['bologna'],
  'fiorentina':       ['fiorentina', 'viola'],
  'torino':           ['torino', 'toro'],
  'udinese':          ['udinese'],
  'sampdoria':        ['sampdoria'],
  'genoa':            ['genoa'],
  'verona':           ['verona', 'hellas verona'],
  'atalanta':         ['atalanta'],
  'real-betis':       ['real betis', 'betis'],
  'real-sociedad':    ['real sociedad'],
  'athletic-bilbao':  ['athletic bilbao', 'athletic club'],
  'celta-vigo':       ['celta vigo', 'celta de vigo'],
  'getafe':           ['getafe'],
  'espanyol':         ['espanyol'],
  // Sul-americanos
  'boca-juniors':     ['boca juniors', 'boca'],
  'river-plate':      ['river plate'],
  'racing':           ['racing club', 'racing '],
  'independiente':    ['independiente'],
  'estudiantes':      ['estudiantes'],
  'velez':            ['velez', 'vélez'],
  'colo-colo':        ['colo colo', 'colo-colo'],
  'universidad-chile':['universidad de chile', 'u de chile'],
  'nacional-uru':     ['nacional uruguai', 'nacional de montevideo'],
  'penarol':          ['peñarol', 'penarol'],
  'libertad':         ['libertad'],
  'cerro-porteno':    ['cerro porteno', 'cerro porteño'],
  // MLS / EUA
  'la-galaxy':        ['la galaxy', 'los angeles galaxy'],
  'lafc':             ['lafc', 'los angeles fc'],
  'atlanta-united':   ['atlanta united'],
  'ny-red-bulls':     ['new york red bulls', 'red bulls new york', 'ny red bulls'],
  'nycfc':            ['nycfc', 'new york city fc'],
  'inter-miami':      ['inter miami', 'inter de miami'],
  'seattle-sounders': ['seattle sounders'],
  'portland-timbers': ['portland timbers'],
  'vancouver':        ['vancouver whitecaps', 'vancouver '],
  'chicago-fire':     ['chicago fire'],
  'dc-united':        ['dc united', 'd.c. united'],
  'toronto-fc':       ['toronto fc'],
  'st-louis-city':    ['st. louis city', 'st louis city', 'st. louis'],
  'kansas-city':      ['sporting kansas city', 'kansas city'],
  'san-jose':         ['san jose earthquakes'],
  'real-salt-lake':   ['real salt lake'],
  'philadelphia':     ['philadelphia union'],
  'orlando-city':     ['orlando city'],
  'nashville':        ['nashville sc'],
  'minnesota':        ['minnesota united'],
  'houston-dinamo':   ['houston dynamo', 'houston dinamo'],
  'fc-dallas':        ['fc dallas'],
  'columbus-crew':    ['columbus crew'],
  'colorado-rapids':  ['colorado rapids'],
  'austin-fc':        ['austin fc'],
  'charlotte-fc':     ['charlotte fc'],
  'montreal':         ['cf montreal', 'cf montréal', 'montreal impact'],
  'new-england':      ['new england revolution'],
  'cincinnati-fc':    ['fc cincinnati', 'cincinnati fc'],
  // Outros europeus
  'celtic':           ['celtic'],
  'rangers':          ['rangers ', 'glasgow rangers'],
  'copenhagen':       ['copenhagen', 'fc copenhagen', 'fc copenhage'],
  'psv':              ['psv ', 'psv eindhoven'],
  'feyenoord':        ['feyenoord'],
  'az-alkmaar':       ['az alkmaar'],
  'galatasaray':      ['galatasaray'],
  'fenerbahce':       ['fenerbahce', 'fenerbahçe'],
  'besiktas':         ['besiktas', 'beşiktaş'],
  'shakhtar':         ['shakhtar donetsk', 'shakhtar'],
  'dynamo-kyiv':      ['dynamo kyiv', 'dynamo kiev'],
  // México
  'pumas':            ['pumas', 'pumas unam'],
  'chivas':           ['chivas', 'chivas guadalajara'],
  'america-mx':       ['club america', 'club américa'],
  'tigres':           ['tigres uanl', 'tigres'],
  'monterrey':        ['rayados monterrey', 'monterrey'],
  'cruz-azul':        ['cruz azul'],
  // Outros
  'boca-juniors':     ['boca juniors', 'boca jrs', 'xeneize'],
  'ferroviaria':      ['ferroviária', 'ferroviaria'],
  'mirassol':         ['mirassol'],
  'chapecoense':      ['chapecoense', 'chapecó'],
  'csa':              ['csa ', 'csa alagoano'],
  'nautico':          ['náutico', 'nautico'],

  // Seleções Copa do Mundo 2026
  'brasil':           ['brasil', 'seleção brasileira', 'selecao brasileira', 'canarinho', 'verde e amarela'],
  'argentina':        ['argentina', 'albiceleste'],
  'franca':           ['frança', 'franca', 'france', 'les bleus'],
  'inglaterra':       ['inglaterra', 'england', 'three lions'],
  'alemanha':         ['alemanha', 'germany', 'deutschland', 'die mannschaft'],
  'espanha':          ['espanha', 'spain', 'la roja'],
  'portugal':         ['portugal', 'seleção portuguesa', 'selecao portuguesa'],
  'italia':           ['itália', 'italia', 'italy', 'azzurra', 'azzurri'],
  'holanda':          ['holanda', 'netherlands', 'oranje', 'países baixos'],
  'belgica':          ['bélgica', 'belgica', 'belgium', 'red devils'],
  'croacia':          ['croácia', 'croacia', 'croatia'],
  'uruguai':          ['uruguai', 'uruguay', 'la celeste'],
  'mexico':           ['méxico', 'mexico', 'el tri'],
  'canada':           ['canadá', 'canada'],
  'japao':            ['japão', 'japao', 'japan', 'samurai blue'],
  'coreia-sul':       ['coreia do sul', 'south korea', 'korea'],
  'marrocos':         ['marrocos', 'morocco', 'atlas lions'],
  'senegal':          ['senegal', 'lions of teranga'],
  'arabia-saudita':   ['arábia saudita', 'arabia saudita', 'saudi arabia'],
  'suica':            ['suíça', 'suica', 'switzerland'],
  'suecia':           ['suécia', 'suecia', 'sweden'],
  'dinamarca':        ['dinamarca', 'denmark'],
  'polonia':          ['polônia', 'polonia', 'poland'],
  'turquia':          ['turquia', 'turkey'],
  'noruega':          ['noruega', 'norway'],
  'estados-unidos':   ['estados unidos', 'usa', 'united states'],
  'colombia':         ['colômbia', 'colombia'],
  'equador':          ['equador', 'ecuador'],
  'peru':             ['peru '],
  'chile':            ['chile '],
  'paraguai':         ['paraguai', 'paraguay'],
  'venezuela':        ['venezuela'],
  'nigeria':          ['nigéria', 'nigeria', 'super eagles'],
  'egito':            ['egito', 'egypt'],
  'camarões':         ['camarões', 'camaroes', 'cameroon'],
  'tunisia':          ['tunísia', 'tunisia'],
  'australia':        ['austrália', 'australia', 'socceroos'],
  'ira':              ['irã', 'ira ', 'iran'],
  'quatar':           ['catar', 'qatar'],
  'eau':              ['emirados árabes', 'uae'],
  'costa-do-marfim':  ['costa do marfim', 'ivory coast', 'côte divoire'],
  'gana':             ['gana ', 'ghana'],
  'nova-zelandia':    ['nova zelândia', 'nova zelandia', 'new zealand'],
  'austria':          ['áustria', 'austria '],
  'bolivia':          ['bolívia', 'bolivia'],
  'costa-rica':       ['costa rica'],
  'honduras':         ['honduras'],
  'panama':           ['panamá', 'panama'],
  'jamaica':          ['jamaica'],
  'argelia':          ['argélia', 'argelia', 'algeria'],
  'escocia':          ['escócia', 'escocia', 'scotland'],
  'africa-sul':       ['áfrica do sul', 'africa do sul', 'south africa', 'bafana'],
  'irlanda':          ['irlanda', 'ireland'],
  'finlandia':        ['finlândia', 'finlandia', 'finland'],
  'russia':           ['rússia', 'russia'],
  'ucrania':          ['ucrânia', 'ucrania', 'ukraine'],
  'servia':           ['sérvia', 'servia', 'serbia'],
  'hungria':          ['hungria', 'hungary'],
  'romenia':          ['romênia', 'romenia', 'romania'],

  // Outros clubes conhecidos
  'al-nassr':         ['al nassr', 'al-nassr'],
  'al-hilal':         ['al hilal', 'al-hilal'],
  'leverkusen':       ['bayer leverkusen', 'leverkusen'],
  'leipzig':          ['rb leipzig', 'leipzig'],
  'monaco':           ['monaco ', 'as monaco'],
  'marseille':        ['marselha', 'olympique marseille', 'om'],
  'sevilla':          ['sevilla', 'sevilha'],
  'valencia':         ['valencia', 'valência', 'che'],
  'villarreal':       ['villarreal'],
  'ajax-cape-town':   ['ajax cape town'],
  'lecce':            ['lecce'],
  'flamengo-futsal':  ['flamengo futsal'],
};

// ═══════════════════════════════════════════════════════════════════════
// Text normalization + attribute extraction
// ═══════════════════════════════════════════════════════════════════════

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectTeam(title) {
  const norm = normalize(title);
  // Ordena aliases por tamanho desc pra casar os mais longos primeiro
  // (ex: "manchester united" antes de "united")
  const allAliases = [];
  for (const [slug, aliases] of Object.entries(TEAM_ALIASES)) {
    for (const alias of aliases) {
      allAliases.push({ slug, alias: normalize(alias) });
    }
  }
  allAliases.sort((a, b) => b.alias.length - a.alias.length);
  for (const { slug, alias } of allAliases) {
    // match como palavra inteira (boundaries simples)
    const re = new RegExp(`(^|\\s|[-/])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|[-/])`);
    if (re.test(norm)) return slug;
  }
  return null;
}

function detectYear(title, yearFilter) {
  const t = title || '';
  // Exato: 2026/27
  if (/2026\/27/.test(t)) return '2026/27';
  if (/2025\/26/.test(t)) return '2025/26';
  if (/2024\/25/.test(t)) return '2024/25';
  if (/2023\/24/.test(t)) return '2023/24';
  // Só ano (2026, 2025, etc)
  const m = t.match(/\b(20\d{2})\b/);
  if (m) return m[1];
  // Retrô
  if (/retr[ôo]/i.test(t)) {
    // Tenta pegar ano retrô: "Retrô 2002", "Retrô 1994", "1991/92"
    const retroMatch = t.match(/\b(19\d{2}|20[01]\d)(?:\/(\d{2}))?/);
    if (retroMatch) {
      return retroMatch[2] ? `retro-${retroMatch[1]}/${retroMatch[2]}` : `retro-${retroMatch[1]}`;
    }
    return 'retro';
  }
  return null;
}

/**
 * Extrai kit (I, II, III, Goleiro, Treino, Pré-Jogo, Regata).
 * Retorna uma string normalizada.
 */
function detectKit(title) {
  const norm = normalize(title);
  // Ordem importa: goleiro/treino/pre-jogo específicos primeiro, depois I/II/III
  if (/\bgoleiro\b|\bgoalkeeper\b|\bgk\b/i.test(norm)) return 'goleiro';
  if (/pr[eé][ -]jogo|pre[ -]game|pre[ -]match/i.test(norm)) return 'pre-jogo';
  if (/treino|training/i.test(norm)) return 'treino';
  if (/regata|tank top/i.test(norm)) return 'regata';
  // Kit numérico (I, II, III) — boundaries pra evitar pegar "I" de "Infantil"
  if (/\biii\b/i.test(norm)) return 'III';
  if (/\bii\b/i.test(norm)) return 'II';
  if (/\bi\b/i.test(norm)) return 'I';
  return null;
}

/**
 * Detecta versão (torcedor, jogador, manga longa, retrô).
 * Torcedor é o default quando nada explícito.
 */
function detectVersion(title) {
  const norm = normalize(title);
  if (/jogador|authentic|player version|player edition|versao jogador|versão jogador/i.test(norm)) return 'jogador';
  if (/manga (longa|comprida)|long.?sleeve|longsleeve/i.test(norm)) return 'manga-longa';
  if (/retr[ôo]/i.test(norm)) return 'retro';
  if (/regata|tank/i.test(norm)) return 'regata';
  // Default: torcedor (explícito ou implícito)
  return 'torcedor';
}

function detectFeminina(title) {
  return /feminina|woman|mulher\b/i.test(normalize(title));
}

function detectInfantil(title) {
  const t = normalize(title);
  return /infantil|kids|crian[çc]a|baby body|baby kit|beb[eê]\b|juvenil/i.test(t);
}

/**
 * Extrai nome de jogador de padrões como:
 *   "... MEMPHIS N° 10"
 *   '... "Memphis 10"'
 *   "... Ronaldo 7"
 * Retorna slug ou null.
 */
function detectPlayer(title) {
  // Padrão 1: NOME N° NÚMERO ou NOME N NÚMERO
  let m = title.match(/([A-ZÀ-Ú][A-ZÀ-Ú\s]{2,}?)\s*n[o°º.]\s*(\d+)/i);
  if (m) {
    const name = m[1].trim().toLowerCase().replace(/\s+/g, '-');
    return `${name}-${m[2]}`;
  }
  // Padrão 2: "Nome Número"
  m = title.match(/"([^"]+?)\s+(\d+)"/);
  if (m) {
    const name = m[1].trim().toLowerCase().replace(/\s+/g, '-');
    return `${name}-${m[2]}`;
  }
  return null;
}

/**
 * Detecta o TIPO de produto (camisa, bone, short, jaqueta, moletom, agasalho,
 * conjunto, meia, bola, acessorio).
 * Importante pra não matchar Boné com Camisa mesmo que time+ano+kit sejam iguais.
 */
function detectProductType(title) {
  const norm = normalize(title);
  // Mais específicos primeiro
  if (/^bon[eé]\b|^bone\b|\bboné\b|\bcap\b/i.test(norm)) return 'bone';
  if (/^short\b|^shorts\b|\bshort masculin/i.test(norm)) return 'short';
  if (/^cal[çc][ãa]o\b/i.test(norm)) return 'calcao';
  if (/^meia\b|^meias\b|^mei[aã]o|\bsocks?\b/i.test(norm)) return 'meia';
  if (/^bola\b|^ball\b/i.test(norm)) return 'bola';
  if (/^jaqueta|\bcorta[ -]vento\b|\bwindbreaker\b/i.test(norm)) return 'jaqueta';
  if (/^moletom|\bhoodie\b|\bsweatshirt\b/i.test(norm)) return 'moletom';
  if (/^agasalho/i.test(norm)) return 'agasalho';
  if (/^conjunto/i.test(norm)) return 'conjunto';
  if (/^regata\b|\btank top\b/i.test(norm)) return 'regata';
  if (/^camisa\b|^camiseta\b|^jersey\b/i.test(norm)) return 'camisa';
  if (/^mochila|\bbackpack\b|^toalha|\btowel\b/i.test(norm)) return 'acessorio';
  return 'outro';
}

/**
 * Extrai todos os atributos estruturais de um título.
 *
 * Regras importantes:
 * - Se é infantil, productType normaliza pra 'conjunto-infantil' (porque "Camisa Infantil"
 *   e "Conjunto Infantil" são o mesmo tipo de produto — kit completo)
 * - Se tem "Com Patrocínio" ou similar, isso é sinalizado em `sponsor=true` e entra na chave
 */
export function extractAttributes(title) {
  const productType = detectProductType(title);
  const feminina = detectFeminina(title);
  const infantil = detectInfantil(title);
  const sponsor = /com patroc[ií]nio|patroc[ií]nios?/i.test(normalize(title));

  // Normalização: produtos infantis são todos 'conjunto-infantil' (kit completo)
  // independente de começarem com "Camisa" ou "Conjunto"
  let normalizedType = productType;
  if (infantil && (productType === 'camisa' || productType === 'conjunto')) {
    normalizedType = 'conjunto-infantil';
  }

  return {
    productType: normalizedType,
    team: detectTeam(title),
    year: detectYear(title),
    kit: detectKit(title),
    version: detectVersion(title),
    feminina,
    infantil,
    sponsor,
    player: detectPlayer(title),
  };
}

/**
 * Gera chave canônica pra comparação.
 *
 * NÃO inclui sponsor, brand, nem player — esses são diferenciadores cosméticos
 * mas em termos de "é o mesmo produto base", Camisa Flamengo 2026/27 I com ou sem
 * patrocínio é a mesma camisa. Similarly, "com/sem nome de jogador" é variação
 * da mesma camisa.
 */
function buildKey(attrs) {
  return [
    attrs.productType || 'null',
    attrs.team || 'null',
    attrs.year || 'null',
    attrs.kit || 'null',
    attrs.version || 'null',
    attrs.feminina ? 'f' : 'm',
    attrs.infantil ? 'kids' : 'adult',
  ].join('|');
}

/**
 * Retorna true se o produto passa no filtro de ano.
 * yearFilter: "2026/27" (exato) | "2026" (qualquer 2026*) | null (tudo)
 */
function passesYearFilter(attrs, yearFilter) {
  if (!yearFilter) return true;
  if (!attrs.year) return false;
  // Exato
  if (yearFilter === attrs.year) return true;
  // Loose: "2026" aceita "2026/27", "2026", "2026-27" etc
  if (attrs.year.startsWith(yearFilter)) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// CSV parser (Shopify export format)
// ═══════════════════════════════════════════════════════════════════════

function parseCSV(content) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function loadCsvProducts(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);
  const header = rows[0];
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });

  const products = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const handle = r[idx['Handle']];
    if (!handle) continue;
    if (!products.has(handle)) {
      products.set(handle, {
        handle,
        title: r[idx['Title']] || '',
        vendor: r[idx['Vendor']] || '',
        type: r[idx['Type']] || '',
        variants: 0,
        images: 0,
        _imageSet: new Set(),
      });
    }
    const p = products.get(handle);
    if (r[idx['Title']] && !p.title) p.title = r[idx['Title']];
    if (r[idx['Option1 Value']] && r[idx['Variant Price']]) p.variants++;
    const img = r[idx['Image Src']];
    if (img && !p._imageSet.has(img)) {
      p._imageSet.add(img);
      p.images++;
    }
  }
  // limpa o Set temporário
  return [...products.values()].map(p => {
    delete p._imageSet;
    return p;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Shopify catalog loader
// ═══════════════════════════════════════════════════════════════════════

async function loadShopifyProducts(shop, token) {
  const all = [];
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,handle,title,vendor,product_type,images,variants`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    if (r.status !== 200) throw new Error(`Shopify ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
    const items = (r.body?.products || []).map(x => ({
      id: x.id,
      handle: x.handle,
      title: x.title,
      vendor: x.vendor || '',
      type: x.product_type || '',
      variants: x.variants?.length || 0,
      images: x.images?.length || 0,
    }));
    all.push(...items);
    p = nextPageUrl(r.link);
    if (p) await delay(400);
  }
  return all;
}

// ═══════════════════════════════════════════════════════════════════════
// Classificação
// ═══════════════════════════════════════════════════════════════════════

function classify(aProducts, bProducts, yearFilter) {
  // Extrai attrs + filtra por ano
  function prepare(list, source) {
    return list
      .map(p => ({ ...p, attrs: extractAttributes(p.title), source }))
      .filter(p => passesYearFilter(p.attrs, yearFilter));
  }

  const a = prepare(aProducts, 'A');
  const b = prepare(bProducts, 'B');

  // Separa ambíguos (team=null ou year=null, se yearFilter ativo)
  const ambiguousA = a.filter(p => !p.attrs.team || !p.attrs.year);
  const ambiguousB = b.filter(p => !p.attrs.team || !p.attrs.year);

  const aValid = a.filter(p => p.attrs.team && p.attrs.year);
  const bValid = b.filter(p => p.attrs.team && p.attrs.year);

  // Indexa por chave canônica
  const aByKey = new Map();
  for (const p of aValid) {
    const k = buildKey(p.attrs);
    if (!aByKey.has(k)) aByKey.set(k, []);
    aByKey.get(k).push(p);
  }
  const bByKey = new Map();
  for (const p of bValid) {
    const k = buildKey(p.attrs);
    if (!bByKey.has(k)) bByKey.set(k, []);
    bByKey.get(k).push(p);
  }

  // Classifica
  const both = [];
  const onlyA = [];
  const onlyB = [];

  for (const [k, listA] of aByKey) {
    const listB = bByKey.get(k);
    if (listB) {
      // BOTH — pode ter vários produtos com mesma chave em cada lado (raro mas possível)
      both.push({
        key: k,
        attrs: listA[0].attrs,
        a: listA.map(simplifyProduct),
        b: listB.map(simplifyProduct),
      });
    } else {
      for (const p of listA) onlyA.push({ key: k, attrs: p.attrs, ...simplifyProduct(p) });
    }
  }
  for (const [k, listB] of bByKey) {
    if (!aByKey.has(k)) {
      for (const p of listB) onlyB.push({ key: k, attrs: p.attrs, ...simplifyProduct(p) });
    }
  }

  return {
    totals: {
      aTotal: aProducts.length,
      bTotal: bProducts.length,
      aFiltered: a.length,
      bFiltered: b.length,
      aValid: aValid.length,
      bValid: bValid.length,
    },
    counts: {
      both: both.length,
      onlyA: onlyA.length,
      onlyB: onlyB.length,
      ambiguousA: ambiguousA.length,
      ambiguousB: ambiguousB.length,
    },
    both,
    onlyA,
    onlyB,
    ambiguousA: ambiguousA.map(p => ({ title: p.title, attrs: p.attrs, ...simplifyProduct(p) })),
    ambiguousB: ambiguousB.map(p => ({ title: p.title, attrs: p.attrs, ...simplifyProduct(p) })),
  };
}

function simplifyProduct(p) {
  return {
    handle: p.handle,
    title: p.title,
    variants: p.variants || 0,
    images: p.images || 0,
    vendor: p.vendor,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Report generation
// ═══════════════════════════════════════════════════════════════════════

function buildByTeamTable(result) {
  const teams = {};
  // Contabiliza por time: BOTH, ONLY_A, ONLY_B
  for (const b of result.both) {
    const t = b.attrs.team;
    if (!teams[t]) teams[t] = { both: 0, onlyA: 0, onlyB: 0 };
    teams[t].both++;
  }
  for (const a of result.onlyA) {
    const t = a.attrs.team;
    if (!teams[t]) teams[t] = { both: 0, onlyA: 0, onlyB: 0 };
    teams[t].onlyA++;
  }
  for (const b of result.onlyB) {
    const t = b.attrs.team;
    if (!teams[t]) teams[t] = { both: 0, onlyA: 0, onlyB: 0 };
    teams[t].onlyB++;
  }
  // Ordena por gap (onlyB) desc
  return Object.entries(teams)
    .map(([team, counts]) => ({ team, ...counts, total: counts.both + counts.onlyA + counts.onlyB }))
    .sort((x, y) => y.onlyB - x.onlyB);
}

function generateMarkdown(result, nameA, nameB, yearFilter) {
  const lines = [];
  lines.push(`# Comparação: ${nameA} vs ${nameB}`);
  if (yearFilter) lines.push(`**Filtro de ano:** ${yearFilter}`);
  lines.push(`**Gerado em:** ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Totais');
  lines.push(`- ${nameA}: **${result.totals.aTotal}** produtos totais (${result.totals.aFiltered} passam no filtro, ${result.totals.aValid} com team+year extraídos)`);
  lines.push(`- ${nameB}: **${result.totals.bTotal}** produtos totais (${result.totals.bFiltered} passam no filtro, ${result.totals.bValid} com team+year extraídos)`);
  lines.push('');

  lines.push('## Match estrutural');
  lines.push(`- ✓ **BOTH** (ambos têm): **${result.counts.both}**`);
  lines.push(`- ← **ONLY_A** (só ${nameA}): **${result.counts.onlyA}**`);
  lines.push(`- → **ONLY_B** (só ${nameB}) — candidatos a import: **${result.counts.onlyB}**`);
  lines.push(`- ? **AMBÍGUO** (sem team ou year): ${result.counts.ambiguousA} em A + ${result.counts.ambiguousB} em B`);
  lines.push('');

  const byTeam = buildByTeamTable(result);

  lines.push(`## Gap por time — top 30 (ordenado por quantos ${nameB} tem que ${nameA} não tem)`);
  lines.push('');
  lines.push(`| Time | Ambos | Só ${nameA} | Só ${nameB} | Total |`);
  lines.push('|---|---|---|---|---|');
  for (const row of byTeam.slice(0, 30)) {
    lines.push(`| ${row.team} | ${row.both} | ${row.onlyA} | **${row.onlyB}** | ${row.total} |`);
  }
  lines.push('');

  // Amostra BOTH
  lines.push(`## Amostra BOTH (15 produtos em que ambas lojas têm)`);
  lines.push('');
  for (const b of result.both.slice(0, 15)) {
    lines.push(`- **${b.attrs.team}** ${b.attrs.year} ${b.attrs.kit || ''} ${b.attrs.version} ${b.attrs.feminina ? '(feminina)' : ''} ${b.attrs.infantil ? '(infantil)' : ''}`);
    lines.push(`  - ${nameA}: \`${b.a[0].title}\``);
    lines.push(`  - ${nameB}: \`${b.b[0].title}\``);
  }
  lines.push('');

  // ONLY_B — candidatos a import (lista completa mas compacta)
  lines.push(`## ONLY_B — só ${nameB} tem (**${result.counts.onlyB}** produtos candidatos a importar)`);
  lines.push('');
  // Agrupa por time
  const onlyBByTeam = {};
  for (const p of result.onlyB) {
    if (!onlyBByTeam[p.attrs.team]) onlyBByTeam[p.attrs.team] = [];
    onlyBByTeam[p.attrs.team].push(p);
  }
  const sortedTeams = Object.entries(onlyBByTeam).sort((a, b) => b[1].length - a[1].length);
  for (const [team, items] of sortedTeams) {
    lines.push(`### ${team} (${items.length})`);
    for (const p of items) {
      const v = [];
      if (p.attrs.kit) v.push(p.attrs.kit);
      if (p.attrs.version !== 'torcedor') v.push(p.attrs.version);
      if (p.attrs.feminina) v.push('feminina');
      if (p.attrs.infantil) v.push('infantil');
      if (p.attrs.player) v.push(p.attrs.player);
      lines.push(`- \`${p.title}\` — ${p.attrs.year} [${v.join(', ')}] (${p.variants}v, ${p.images}img)`);
    }
    lines.push('');
  }

  // ONLY_A — só A tem
  if (result.onlyA.length > 0) {
    lines.push(`## ONLY_A — só ${nameA} tem (${result.onlyA.length} produtos)`);
    lines.push('');
    const onlyAByTeam = {};
    for (const p of result.onlyA) {
      if (!onlyAByTeam[p.attrs.team]) onlyAByTeam[p.attrs.team] = [];
      onlyAByTeam[p.attrs.team].push(p);
    }
    for (const [team, items] of Object.entries(onlyAByTeam).sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`### ${team} (${items.length})`);
      for (const p of items.slice(0, 10)) lines.push(`- \`${p.title}\``);
      if (items.length > 10) lines.push(`- _...+${items.length - 10} mais_`);
      lines.push('');
    }
  }

  // Ambíguos
  if (result.ambiguousA.length + result.ambiguousB.length > 0) {
    lines.push(`## Ambíguos (team ou year não detectados)`);
    lines.push('');
    lines.push(`### ${nameA} — ${result.ambiguousA.length} produtos`);
    for (const p of result.ambiguousA.slice(0, 15)) {
      lines.push(`- \`${p.title}\` [team=${p.attrs.team || 'null'}, year=${p.attrs.year || 'null'}]`);
    }
    if (result.ambiguousA.length > 15) lines.push(`_...+${result.ambiguousA.length - 15} mais_`);
    lines.push('');
    lines.push(`### ${nameB} — ${result.ambiguousB.length} produtos`);
    for (const p of result.ambiguousB.slice(0, 15)) {
      lines.push(`- \`${p.title}\` [team=${p.attrs.team || 'null'}, year=${p.attrs.year || 'null'}]`);
    }
    if (result.ambiguousB.length > 15) lines.push(`_...+${result.ambiguousB.length - 15} mais_`);
    lines.push('');
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════

function parseArgs() {
  const args = { _: [], csv: null, client: null, yearFilter: null, markdown: null, out: null, json: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--json') args.json = true;
    else if (a.startsWith('--csv=')) args.csv = a.slice(6);
    else if (a.startsWith('--client=')) args.client = a.slice(9);
    else if (a.startsWith('--year-filter=')) args.yearFilter = a.slice(14);
    else if (a.startsWith('--markdown=')) args.markdown = a.slice(11);
    else if (a.startsWith('--out=')) args.out = a.slice(6);
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const clientA = args._[0];

  if (!clientA) {
    console.error('Uso: node compare-catalogs.mjs <clientA> (--csv=path | --client=clientB) [--year-filter=2026/27] [--markdown=out.md] [--out=out.json] [--json]');
    process.exit(1);
  }
  if (!args.csv && !args.client) {
    console.error('❌ Precisa de --csv=path OU --client=<outroCliente>');
    process.exit(1);
  }

  if (!args.json) console.log(`\n=== compare-catalogs ${args.yearFilter ? `[filter=${args.yearFilter}]` : ''} ===`);

  // Load A
  const cA = await assertClientExists(clientA);
  await assertShopifyConnected(cA);
  if (!args.json) console.log(`✓ A: ${cA.name} (${cA.shopify_domain})`);
  if (!args.json) console.log(`  Buscando produtos...`);
  const aProducts = await loadShopifyProducts(cA.shopify_domain, cA.shopify_access_token);
  if (!args.json) console.log(`  ${aProducts.length} produtos`);

  // Load B
  let bProducts, nameB;
  if (args.csv) {
    const csvPath = path.isAbsolute(args.csv) ? args.csv : path.join(REPO_ROOT, args.csv);
    if (!fs.existsSync(csvPath)) throw new Error(`CSV não encontrado: ${csvPath}`);
    nameB = path.basename(csvPath, '.csv');
    if (!args.json) console.log(`✓ B: CSV ${nameB}`);
    if (!args.json) console.log(`  Parseando...`);
    bProducts = loadCsvProducts(csvPath);
  } else {
    const cB = await assertClientExists(args.client);
    await assertShopifyConnected(cB);
    nameB = cB.name;
    if (!args.json) console.log(`✓ B: ${nameB} (${cB.shopify_domain})`);
    if (!args.json) console.log(`  Buscando produtos...`);
    bProducts = await loadShopifyProducts(cB.shopify_domain, cB.shopify_access_token);
  }
  if (!args.json) console.log(`  ${bProducts.length} produtos`);

  // Classify
  if (!args.json) console.log(`\nClassificando por atributos estruturais...`);
  const result = classify(aProducts, bProducts, args.yearFilter);

  if (!args.json) {
    console.log(`\n=== RESULTADO ===`);
    console.log(`Totais: A=${result.totals.aTotal} (${result.totals.aFiltered} filtrados), B=${result.totals.bTotal} (${result.totals.bFiltered} filtrados)`);
    console.log(`  ✓ BOTH:        ${result.counts.both}`);
    console.log(`  ← ONLY_A:      ${result.counts.onlyA} (só ${cA.name})`);
    console.log(`  → ONLY_B:      ${result.counts.onlyB} (só ${nameB})`);
    console.log(`  ? AMBIGUOUS_A: ${result.counts.ambiguousA}`);
    console.log(`  ? AMBIGUOUS_B: ${result.counts.ambiguousB}`);
  }

  // Output paths
  const sanitize = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const defaultBase = `.tmp_compare_${sanitize(cA.name)}_vs_${sanitize(nameB)}${args.yearFilter ? '_' + sanitize(args.yearFilter) : ''}`;
  const outJson = args.out || path.join(REPO_ROOT, `${defaultBase}.json`);
  const outMd = args.markdown || path.join(REPO_ROOT, `${defaultBase}.md`);

  // JSON
  const fullJson = {
    sourceA: { name: cA.name, shop: cA.shopify_domain, ...result.totals, totalLoaded: result.totals.aTotal },
    sourceB: { name: nameB, source: args.csv ? 'csv' : 'shopify', totalLoaded: result.totals.bTotal },
    yearFilter: args.yearFilter,
    counts: result.counts,
    byTeam: buildByTeamTable(result),
    both: result.both,
    onlyA: result.onlyA,
    onlyB: result.onlyB,
    ambiguousA: result.ambiguousA,
    ambiguousB: result.ambiguousB,
  };
  fs.writeFileSync(outJson, JSON.stringify(fullJson, null, 2));

  // Markdown
  const md = generateMarkdown(result, cA.name, nameB, args.yearFilter);
  fs.writeFileSync(outMd, md);

  if (!args.json) {
    console.log(`\n📋 JSON salvo em: ${outJson}`);
    console.log(`📄 Markdown salvo em: ${outMd}`);
  } else {
    console.log(JSON.stringify(fullJson, null, 2));
  }

  // LOG
  await appendExecutionLog({
    skill: 'compare-catalogs',
    client_a_id: cA.id,
    client_a_name: cA.name,
    source_b: args.csv ? `csv:${path.basename(args.csv)}` : `client:${nameB}`,
    year_filter: args.yearFilter,
    counts: result.counts,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); if (process.env.DEBUG) console.error(e.stack); process.exit(1); });
