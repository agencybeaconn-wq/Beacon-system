// Lever DW — enriquecedor de line_items Shopify
//
// Pega title/variant_title/vendor/properties[] e devolve:
//   { team, team_country, category, season, season_year, model,
//     is_personalized, personalization_name, personalization_number,
//     has_patches, patches_count, patch_titles,
//     size, is_plus_size, pairing_id, is_attached, attached_to }
//
// Filosofia: regex + lookup tables. Não é ML. Quando título mudar de padrão,
// ajustar regras aqui. Versionar via DW_ENRICH_VERSION (incrementar quando
// regra mudar, pra re-enriquecer histórico se necessário).

export const DW_ENRICH_VERSION = '1.0.0';

// ============================================================================
// TIMES — lista expansível. Cobre brasileiros + grandes europeus + seleções.
// Match case-insensitive contra title. Ordem: específico antes de genérico.
// team_country: ISO2 do país do clube/seleção.
// ============================================================================

const TEAMS = [
  // Seleções (vão pra categoria "Seleção" mesmo que regex de retrô bata)
  { match: /\bbrasil\b|sele[çc][ãa]o brasileira|cbf\b/i, team: 'Brasil', country: 'BR', isNational: true },
  { match: /\bargentina\b|sele[çc][ãa]o argentina/i, team: 'Argentina', country: 'AR', isNational: true },
  { match: /\bportugal\b/i, team: 'Portugal', country: 'PT', isNational: true },
  { match: /\bespanha\b|spain\b/i, team: 'Espanha', country: 'ES', isNational: true },
  { match: /\bfran[çc]a\b|france\b/i, team: 'França', country: 'FR', isNational: true },
  { match: /\balemanha\b|germany\b/i, team: 'Alemanha', country: 'DE', isNational: true },
  { match: /\bit[áa]lia\b|italy\b/i, team: 'Itália', country: 'IT', isNational: true },
  { match: /\binglaterra\b|england\b/i, team: 'Inglaterra', country: 'EN', isNational: true },
  { match: /\bholanda\b|netherlands\b/i, team: 'Holanda', country: 'NL', isNational: true },
  { match: /\buruguai\b|uruguay\b/i, team: 'Uruguai', country: 'UY', isNational: true },
  { match: /\bcolombia\b|col[ôo]mbia\b/i, team: 'Colômbia', country: 'CO', isNational: true },
  { match: /\bcroacia\b|cro[áa]cia\b|croatia\b/i, team: 'Croácia', country: 'HR', isNational: true },
  { match: /\bm[ée]xico\b|mexico\b/i, team: 'México', country: 'MX', isNational: true },
  { match: /\bjap[ãa]o\b|japan\b/i, team: 'Japão', country: 'JP', isNational: true },

  // Brasileiros — Série A + tradicionais
  { match: /\bflamengo\b|\bmengo\b|\bmengão\b/i, team: 'Flamengo', country: 'BR' },
  { match: /\bcorinthians\b|\btim[ãa]o\b/i, team: 'Corinthians', country: 'BR' },
  { match: /\bpalmeiras\b|verd[ãa]o/i, team: 'Palmeiras', country: 'BR' },
  { match: /\bs[ãa]o paulo\b|\bspfc\b|\btricolor paulista/i, team: 'São Paulo', country: 'BR' },
  { match: /\bsantos\b|peixe\b/i, team: 'Santos', country: 'BR' },
  { match: /\bvasco\b|gigante da colina/i, team: 'Vasco', country: 'BR' },
  { match: /\bcruzeiro\b|raposa\b/i, team: 'Cruzeiro', country: 'BR' },
  { match: /\batletico mineiro\b|atl[ée]tico mineiro\b|\bgalo\b/i, team: 'Atlético Mineiro', country: 'BR' },
  { match: /\bgremio\b|gr[êe]mio\b/i, team: 'Grêmio', country: 'BR' },
  { match: /\binternacional\b|colorado\b/i, team: 'Internacional', country: 'BR' },
  { match: /\bfluminense\b|tricolor carioca/i, team: 'Fluminense', country: 'BR' },
  { match: /\bbotafogo\b|\bfogao\b|fog[ãa]o\b|glorioso/i, team: 'Botafogo', country: 'BR' },
  { match: /\bbahia\b/i, team: 'Bahia', country: 'BR' },
  { match: /\bsport\b/i, team: 'Sport Recife', country: 'BR' },
  { match: /\bfortaleza\b/i, team: 'Fortaleza', country: 'BR' },
  { match: /\bceara\b|cear[áa]\b/i, team: 'Ceará', country: 'BR' },
  { match: /\bvitoria\b|vit[óo]ria\b/i, team: 'Vitória', country: 'BR' },
  { match: /\bathletico paranaense\b|athletico-pr/i, team: 'Athletico-PR', country: 'BR' },
  { match: /\bcoritiba\b/i, team: 'Coritiba', country: 'BR' },
  { match: /\bjuventude\b/i, team: 'Juventude', country: 'BR' },
  { match: /\bgoias\b|goi[áa]s\b/i, team: 'Goiás', country: 'BR' },

  // Europa — top clubes
  { match: /\breal madrid\b|merengue/i, team: 'Real Madrid', country: 'ES' },
  { match: /\bbarcelona\b|barça|bar[çc]a/i, team: 'Barcelona', country: 'ES' },
  { match: /\batletico de madrid\b|atl[ée]tico de madrid\b|atletico madrid/i, team: 'Atlético Madrid', country: 'ES' },
  { match: /\bsevilla\b/i, team: 'Sevilla', country: 'ES' },
  { match: /\bvalencia\b/i, team: 'Valencia', country: 'ES' },
  { match: /\bmanchester united\b|man utd\b|man united\b|\bmufc\b/i, team: 'Manchester United', country: 'EN' },
  { match: /\bmanchester city\b|man city\b|\bmcfc\b/i, team: 'Manchester City', country: 'EN' },
  { match: /\bliverpool\b/i, team: 'Liverpool', country: 'EN' },
  { match: /\bchelsea\b/i, team: 'Chelsea', country: 'EN' },
  { match: /\barsenal\b/i, team: 'Arsenal', country: 'EN' },
  { match: /\btottenham\b|spurs\b/i, team: 'Tottenham', country: 'EN' },
  { match: /\bbayern\b|munich\b|m[üu]nchen\b/i, team: 'Bayern Munich', country: 'DE' },
  { match: /\bborussia dortmund\b|\bbvb\b/i, team: 'Borussia Dortmund', country: 'DE' },
  { match: /\bjuventus\b|\bjuve\b/i, team: 'Juventus', country: 'IT' },
  { match: /\bmilan\b/i, team: 'Milan', country: 'IT' },
  { match: /\binter de milao\b|inter de mil[ãa]o\b|inter milan\b/i, team: 'Inter Milan', country: 'IT' },
  { match: /\bnapoli\b/i, team: 'Napoli', country: 'IT' },
  { match: /\broma\b/i, team: 'Roma', country: 'IT' },
  { match: /\bpsg\b|paris saint/i, team: 'PSG', country: 'FR' },
  { match: /\bmonaco\b/i, team: 'Monaco', country: 'FR' },
  { match: /\bporto\b/i, team: 'Porto', country: 'PT' },
  { match: /\bbenfica\b/i, team: 'Benfica', country: 'PT' },
  { match: /\bsporting\b/i, team: 'Sporting', country: 'PT' },
  { match: /\bajax\b/i, team: 'Ajax', country: 'NL' },
  { match: /\bboca juniors\b|\bboca\b/i, team: 'Boca Juniors', country: 'AR' },
  { match: /\briver plate\b|river\b/i, team: 'River Plate', country: 'AR' },
];

// ============================================================================
// CATEGORIA — palavras-chave no título
// ============================================================================

function detectCategory(title, isNationalTeam) {
  const t = title.toLowerCase();
  if (/\b(patch|meia|mei[ãa]o|short|cal[çc]a|bon[ée]|cachecol|toalha|jaqueta|moletom|caneca|chaveiro|p[ôo]ster|caderno|copo|adesivo)\b/.test(t)) return 'Acessório';
  if (/\bpolo\b|\bcorta-vento\b|jaqueta de treino|camisa de treino|treino\b/.test(t)) return 'Treino';
  if (/\binfantil\b|\bkids?\b|crian[çc]a|juvenil/.test(t)) return 'Infantil';
  if (/\bg3\b|\bg4\b|\b5gg\b|plus size\b|plus-size\b/.test(t)) return 'Plus size';
  if (isNationalTeam) return 'Seleção';
  if (/\bretr[ôo]\b|vers[ãa]o retr[ôo]|retro version/.test(t)) return 'Retrô';
  // Padrão: camisa de clube sem indicação = Atual
  if (/\bcamisa\b|\bcamiseta\b|jersey\b|shirt\b/.test(t)) return 'Atual';
  return null;
}

// Plus size detection a partir do tamanho (variant_title)
function detectPlusSize(size, title) {
  if (!size && !title) return false;
  const s = (size || '') + ' ' + (title || '');
  return /\bg[2-9]\b|\b[2-9]gg\b|\bxgg\b|plus size\b/i.test(s);
}

// ============================================================================
// TEMPORADA / ANO — regex "93/94", "2024/25", "2026", "84-85"
// ============================================================================

function detectSeason(title) {
  // Padrão "YYYY/YY" ou "YY/YY"
  const fullRange = title.match(/\b(19|20)(\d{2})\s*[\/\-]\s*(\d{2})\b/);
  if (fullRange) {
    const year = parseInt(fullRange[1] + fullRange[2]);
    return { season: `${fullRange[2]}/${fullRange[3]}`, season_year: year };
  }
  const shortRange = title.match(/\b(\d{2})\s*[\/\-]\s*(\d{2})\b/);
  if (shortRange) {
    const yy = parseInt(shortRange[1]);
    const century = yy <= 30 ? 2000 : 1900;
    const year = century + yy;
    return { season: `${shortRange[1]}/${shortRange[2]}`, season_year: year };
  }
  // Ano único: "2026", "2024"
  const singleYear = title.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (singleYear) {
    const year = parseInt(singleYear[1]);
    return { season: String(year), season_year: year };
  }
  return { season: null, season_year: null };
}

// ============================================================================
// MODELO — Titular / Reserva / Goleiro / Terceiro / Treino
// ============================================================================

function detectModel(title, variant_title) {
  const t = (title + ' ' + (variant_title || '')).toLowerCase();
  if (/\btitular\b|\bhome\b|\bi\b(?!\s*[ivx])/.test(t)) return 'Titular';
  if (/\breserva\b|\baway\b|\bii\b/.test(t)) return 'Reserva';
  if (/\bterceiro\b|\bthird\b|\biii\b/.test(t)) return 'Terceiro';
  if (/\bgoleiro\b|\bgoalkeeper\b|\bgk\b/.test(t)) return 'Goleiro';
  if (/\btreino\b|\btraining\b/.test(t)) return 'Treino';
  if (/\bedi[çc][ãa]o especial\b|special edition/.test(t)) return 'Especial';
  return null;
}

// ============================================================================
// TAMANHO — extrai do variant_title "G / Personalizar" → "G"
// ============================================================================

function detectSize(variant_title) {
  if (!variant_title) return null;
  // Pega a primeira parte antes de "/"
  const firstPart = variant_title.split('/')[0].trim();
  // Aceita: P, M, G, GG, GGG, G3, G4, 5GG, XS, S, L, XL, XXL, 10 anos, 12 anos
  if (/^(p|m|g|gg|ggg|g[1-9]|[1-9]gg|xs|s|l|xl|xxl|xxxl)$/i.test(firstPart)) return firstPart.toUpperCase();
  if (/^\d{1,2}\s*anos$/i.test(firstPart)) return firstPart;
  if (firstPart.length <= 6) return firstPart; // fallback curto
  return null;
}

// ============================================================================
// PROPERTIES — extrai personalização e patches do array properties[]
// ============================================================================

function parseProperties(properties) {
  const out = {
    is_personalized: false,
    personalization_name: null,
    personalization_number: null,
    has_patches: false,
    patches_count: 0,
    patch_titles: [],
    pairing_id: null,
    is_attached: false,
    attached_to: null,
  };
  if (!Array.isArray(properties)) return out;

  for (const p of properties) {
    const name = (p.name || '').toLowerCase().trim();
    const value = (p.value || '').toString().trim();
    if (!value) continue;

    if (name === 'nome' || name === 'name') {
      out.personalization_name = value;
      out.is_personalized = true;
    } else if (name === 'número' || name === 'numero' || name === 'number') {
      out.personalization_number = value;
      out.is_personalized = true;
    } else if (name === 'patches' || name === 'patch') {
      out.has_patches = true;
      out.patches_count += value.split(/[,;]|\s+e\s+/).filter(Boolean).length;
      out.patch_titles.push(value);
    } else if (name === '_pairing_id' || name === 'pairing_id') {
      out.pairing_id = value;
    } else if (name === '_attached_to' || name === 'attached_to') {
      out.attached_to = value;
      out.is_attached = true;
    }
  }
  return out;
}

// ============================================================================
// API principal
// ============================================================================

/**
 * Enriquece um line_item da Shopify.
 * @param {object} lineItem - linha do orders.json (Shopify)
 * @returns {object} - campos enriquecidos pra dw_order_items
 */
export function enrichLineItem(lineItem) {
  const title = lineItem.title || lineItem.name || '';
  const variant_title = lineItem.variant_title || null;
  const properties = lineItem.properties || [];

  // 1. Time
  let team = null, team_country = null, isNational = false;
  for (const t of TEAMS) {
    if (t.match.test(title)) {
      team = t.team;
      team_country = t.country;
      isNational = !!t.isNational;
      break;
    }
  }

  // 2. Categoria
  const category = detectCategory(title, isNational);

  // 3. Temporada
  const { season, season_year } = detectSeason(title);

  // 4. Modelo
  const model = detectModel(title, variant_title);

  // 5. Tamanho
  const size = detectSize(variant_title);
  const is_plus_size = detectPlusSize(size, title);

  // 6. Properties (personalização + patches + pairing)
  const props = parseProperties(properties);

  // Plus size override de categoria (se G3+ explícito)
  let finalCategory = category;
  if (is_plus_size && category !== 'Acessório') finalCategory = 'Plus size';

  return {
    team,
    team_country,
    category: finalCategory,
    season,
    season_year,
    model,
    size,
    is_plus_size,
    ...props,
  };
}

/**
 * Calcula a faixa de ticket pra um pedido.
 * @param {number} total - total_price BRL (ou na moeda da loja — fica consistente intra-loja)
 * @returns {string}
 */
export function ticketBand(total) {
  const t = parseFloat(total);
  if (isNaN(t)) return null;
  if (t < 100) return '<100';
  if (t < 300) return '100-300';
  if (t < 500) return '300-500';
  if (t < 1000) return '500-1000';
  return '1000+';
}

/**
 * Hash determinístico de email pra cross-store dedup.
 * Usa SHA-256(lower(trim(email))) → hex.
 */
import crypto from 'crypto';
export function hashEmail(email) {
  if (!email) return null;
  const normalized = String(email).toLowerCase().trim();
  if (!normalized || !normalized.includes('@')) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function hashPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D+/g, '');
  if (digits.length < 8) return null;
  return crypto.createHash('sha256').update(digits).digest('hex');
}

/**
 * Detecta canal de origem do pedido a partir de source_name + UTMs + referring_site.
 */
export function detectChannel({ source_name, referring_site, landing_site, note_attributes }) {
  // UTM no landing_site
  if (landing_site) {
    const lower = landing_site.toLowerCase();
    if (/utm_source=facebook|utm_source=meta|utm_source=ig|utm_source=instagram|fbclid/.test(lower)) return 'meta';
    if (/utm_source=google|gclid/.test(lower)) return 'google';
    if (/utm_source=tiktok|ttclid/.test(lower)) return 'tiktok';
    if (/utm_source=email|utm_medium=email/.test(lower)) return 'email';
  }
  if (referring_site) {
    const r = referring_site.toLowerCase();
    if (/facebook\.com|instagram\.com|l\.facebook|l\.instagram/.test(r)) return 'meta';
    if (/google\./.test(r)) return 'google';
    if (/tiktok\.com/.test(r)) return 'tiktok';
    if (/youtube/.test(r)) return 'youtube';
  }
  if (source_name === 'web') return 'direct';
  if (source_name === 'pos') return 'pos';
  if (source_name === 'shopify_draft_order') return 'manual';
  return 'unknown';
}

/**
 * Extrai UTMs de landing_site URL.
 */
export function extractUTMs(landing_site) {
  const out = { utm_source: null, utm_medium: null, utm_campaign: null };
  if (!landing_site) return out;
  try {
    const u = new URL(landing_site, 'https://example.com');
    out.utm_source = u.searchParams.get('utm_source');
    out.utm_medium = u.searchParams.get('utm_medium');
    out.utm_campaign = u.searchParams.get('utm_campaign');
  } catch {}
  return out;
}
