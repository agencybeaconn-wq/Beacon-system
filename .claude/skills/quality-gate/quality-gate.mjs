#!/usr/bin/env node
// quality-gate — radar rápido de qualidade de uma loja Shopify.
// 5 checks em paralelo (quando possível), < 20s tipicamente.
//
// Uso:
//   node quality-gate.mjs <clientIdOrName>          # print relatório
//   node quality-gate.mjs <clientIdOrName> --json   # JSON output

import { fetchClient, fetchPricing, supaRest } from '../../lib/supabase-rest.mjs';
import { shReq, shopifyGraphQL, nextPageUrl, delay, API_VERSION, paginate } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { calcExpectedPrice, categorize } from '../../lib/shopify-pricing.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Thresholds hardcoded v1 — podem ser sobrescritos via client_quality_config no DB
const THRESHOLDS = {
  priceVariance: 0.01,       // variante é "fora do padrão" se diff > 1%
  priceWarnRatio: 0.01,      // WARN se > 1% das variantes
  priceFailRatio: 0.05,      // FAIL se > 5%
  soldoutWarnRatio: 0.01,    // WARN se > 1% variantes esgotadas
  soldoutFailRatio: 0.05,    // FAIL se > 5%
  noImageWarnRatio: 0.005,   // WARN se > 0.5% produtos sem imagem
  noImageFailRatio: 0.02,    // FAIL se > 2%
  emptyCollWarn: 5,          // WARN se > 5 coleções vazias
  emptyCollFail: 10,         // FAIL se > 10
  minProductsPerCollection: 3,
  seoMissingWarnRatio: 0.10, // WARN se > 10% sem SEO
  seoMissingFailRatio: 0.30, // FAIL se > 30%
  duplicateWarn: 2,          // WARN se > 2 pares de duplicados
  duplicateFail: 5,
  uncategorizedWarnRatio: 0.05,
  uncategorizedFailRatio: 0.15,
  zeroPriceWarn: 1,          // qualquer variante com preço zero = WARN
  zeroPriceFail: 5,
};

// Coleções obrigatórias por idioma (pode ser override via client_quality_config.required_collections)
const REQUIRED_COLLECTIONS = {
  pt: ['Brasileirão', 'Copa do Mundo', 'Seleções', 'Premier League', 'La Liga', 'Serie A', 'Ligue 1', 'Bundesliga'],
  en: ['Brazilian League', 'World Cup', 'National Teams', 'Premier League', 'La Liga', 'Serie A'],
};

function parseArgs() {
  const args = { _: [], json: false, triggered_by: null, theme_id: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--json') args.json = true;
    else if (a.startsWith('--triggered-by=')) args.triggered_by = a.slice(15);
    else if (a.startsWith('--theme-id=')) args.theme_id = a.slice(11);
    else args._.push(a);
  }
  return args;
}

// Module-level override: quando setado, getMainThemeAsset e checkCheckoutLiquidLegacy
// miram esse tema em vez do role=main. Usado por --theme-id pra treino/preview.
let THEME_ID_OVERRIDE = null;

function verdict(ratio, warnT, failT) {
  if (ratio > failT) return 'FAIL';
  if (ratio > warnT) return 'WARN';
  return 'PASS';
}

function verdictCount(count, warnT, failT) {
  if (count > failT) return 'FAIL';
  if (count > warnT) return 'WARN';
  return 'PASS';
}

async function checkPrices(shop, token, pricing) {
  if (!pricing?.products || Object.keys(pricing.products).length === 0) {
    return { verdict: 'SKIP', label: 'Preços fora do padrão', detail: 'client_pricing vazio (pricing não configurado)' };
  }
  const products = await paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,variants`, 'products', 500);

  let categorized = 0;
  let divergent = 0;
  let totalVariants = 0;
  for (const p of products) {
    const cat = categorize(p.title);
    if (!cat) continue;
    categorized++;
    for (const v of (p.variants || [])) {
      totalVariants++;
      const expected = calcExpectedPrice(p.title, v, pricing);
      if (!expected || expected.price == null) continue;
      const current = parseFloat(v.price);
      if (current > 0 && Math.abs(current - expected.price) / expected.price > THRESHOLDS.priceVariance) {
        divergent++;
      }
    }
  }
  const ratio = totalVariants > 0 ? divergent / totalVariants : 0;
  return {
    verdict: verdict(ratio, THRESHOLDS.priceWarnRatio, THRESHOLDS.priceFailRatio),
    label: 'Preços fora do padrão',
    detail: `${divergent} variantes divergentes de ${totalVariants} (${(ratio * 100).toFixed(1)}%) em ${categorized} produtos categorizados`,
    divergent, totalVariants, categorized,
  };
}

async function checkSoldOut(shop, token) {
  const products = await paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,variants`, 'products', 500);
  let soldOut = 0;
  let total = 0;
  for (const p of products) {
    for (const v of (p.variants || [])) {
      total++;
      if ((v.inventory_quantity === 0 || v.inventory_quantity == null) && v.inventory_policy === 'deny') {
        soldOut++;
      }
    }
  }
  const ratio = total > 0 ? soldOut / total : 0;
  return {
    verdict: verdict(ratio, THRESHOLDS.soldoutWarnRatio, THRESHOLDS.soldoutFailRatio),
    label: 'Variantes esgotadas (inventory_policy=deny + qty=0)',
    detail: `${soldOut} de ${total} variantes esgotadas (${(ratio * 100).toFixed(1)}%)`,
    soldOut, total,
  };
}

async function checkNoImages(shop, token) {
  const products = await paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,images`, 'products', 500);
  const noImage = products.filter(p => !p.images || p.images.length === 0);
  const ratio = products.length > 0 ? noImage.length / products.length : 0;
  return {
    verdict: verdict(ratio, THRESHOLDS.noImageWarnRatio, THRESHOLDS.noImageFailRatio),
    label: 'Produtos sem imagem',
    detail: `${noImage.length} de ${products.length} produtos (${(ratio * 100).toFixed(1)}%)`,
    noImage: noImage.length,
    total: products.length,
    samples: noImage.slice(0, 5).map(p => p.title),
  };
}

async function checkEmptyCollections(shop, token) {
  // products_count só vem via count endpoint separado
  const [smart, custom] = await Promise.all([
    paginate(shop, token, `/admin/api/${API_VERSION}/smart_collections.json?limit=250`, 'smart_collections', 400),
    paginate(shop, token, `/admin/api/${API_VERSION}/custom_collections.json?limit=250`, 'custom_collections', 400),
  ]);
  const all = [...smart, ...custom];

  // Pra cada coleção, buscar products.json?collection_id=X&limit=N pra contar.
  // É caro (muitas calls), mas é o jeito certo. Limitamos a 50 em paralelo pra rate limit.
  const empty = [];
  for (let i = 0; i < all.length; i += 3) {
    const batch = all.slice(i, i + 3);
    await Promise.all(batch.map(async col => {
      const r = await shReq(shop, token, 'GET',
        `/admin/api/${API_VERSION}/products.json?collection_id=${col.id}&limit=${THRESHOLDS.minProductsPerCollection}&fields=id`);
      const count = (r.body?.products || []).length;
      if (count < THRESHOLDS.minProductsPerCollection) {
        empty.push({ title: col.title, count });
      }
    }));
    await delay(500);
  }

  return {
    verdict: verdictCount(empty.length, THRESHOLDS.emptyCollWarn, THRESHOLDS.emptyCollFail),
    label: 'Coleções vazias',
    detail: `${empty.length} de ${all.length} coleções com < ${THRESHOLDS.minProductsPerCollection} produtos`,
    emptyCount: empty.length,
    totalCount: all.length,
    samples: empty.slice(0, 10).map(c => `${c.title} (${c.count})`),
  };
}

async function checkSEO(shop, token) {
  // Nas versões novas da API, SEO está em product.seo { title, description } via GraphQL.
  // metafields_global_* foram deprecados.
  // Paginamos via GraphQL usando cursor.
  const query = `query($cursor: String) {
    products(first: 250, after: $cursor) {
      edges {
        cursor
        node { id seo { title description } }
      }
      pageInfo { hasNextPage }
    }
  }`;
  let cursor = null;
  let total = 0;
  let missing = 0;
  do {
    const r = await shopifyGraphQL(shop, token, query, { cursor });
    const edges = r.data?.products?.edges || [];
    for (const e of edges) {
      total++;
      const seo = e.node.seo;
      if (!seo?.title && !seo?.description) missing++;
    }
    if (r.data?.products?.pageInfo?.hasNextPage && edges.length) {
      cursor = edges[edges.length - 1].cursor;
    } else break;
    await delay(400);
  } while (cursor);

  const ratio = total > 0 ? missing / total : 0;
  return {
    verdict: verdict(ratio, THRESHOLDS.seoMissingWarnRatio, THRESHOLDS.seoMissingFailRatio),
    label: 'SEO (product.seo title/description)',
    detail: `${missing} de ${total} produtos sem SEO (${(ratio * 100).toFixed(1)}%)`,
    missing,
    total,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CHECKS NOVOS — v2 (9 checks adicionais)
// ═══════════════════════════════════════════════════════════════════════

// Check 6: Produtos duplicados (handle ou título idêntico)
async function checkDuplicateProducts(shop, token) {
  const products = await paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,handle,title`, 'products', 500);
  const handleMap = new Map();
  const titleMap = new Map();
  const duplicates = [];
  for (const p of products) {
    const h = p.handle?.toLowerCase();
    const t = p.title?.toLowerCase().trim();
    if (h && handleMap.has(h)) {
      duplicates.push(`handle="${p.handle}"`);
    } else if (h) handleMap.set(h, p.id);
    if (t && titleMap.has(t)) {
      duplicates.push(`title="${p.title}"`);
    } else if (t) titleMap.set(t, p.id);
  }
  return {
    verdict: verdictCount(duplicates.length, THRESHOLDS.duplicateWarn, THRESHOLDS.duplicateFail),
    label: 'Produtos duplicados (handle/título idêntico)',
    detail: `${duplicates.length} duplicatas em ${products.length} produtos`,
    samples: duplicates.slice(0, 5),
  };
}

// Check 7: Coleções obrigatórias faltando (configurável por cliente)
async function checkRequiredCollections(shop, token, language = 'pt', overrideList = null) {
  const required = overrideList && overrideList.length ? overrideList : (REQUIRED_COLLECTIONS[language] || REQUIRED_COLLECTIONS.pt);
  const [smart, custom] = await Promise.all([
    paginate(shop, token, `/admin/api/${API_VERSION}/smart_collections.json?limit=250&fields=id,title`, 'smart_collections', 400),
    paginate(shop, token, `/admin/api/${API_VERSION}/custom_collections.json?limit=250&fields=id,title`, 'custom_collections', 400),
  ]);
  const existing = new Set([...smart, ...custom].map(c => c.title?.toLowerCase().trim()));
  const missing = required.filter(r => !existing.has(r.toLowerCase().trim()));
  return {
    verdict: missing.length === 0 ? 'PASS' : missing.length > 3 ? 'FAIL' : 'WARN',
    label: `Coleções obrigatórias (${language.toUpperCase()})`,
    detail: `${missing.length}/${required.length} coleções obrigatórias faltando`,
    samples: missing.slice(0, 10),
  };
}

// Check 8: Menus com links quebrados
async function checkBrokenMenus(shop, token) {
  // Lista menus via GraphQL + valida targets via GraphQL (evita 403 em REST /pages.json
  // por falta de escopo read_content). GraphQL usa escopos read_online_store_pages etc.
  const COLLECTION_Q = `query($h: String!) { collectionByHandle(handle: $h) { id } }`;
  const PRODUCT_Q = `query($h: String!) { productByHandle(handle: $h) { id } }`;
  const PAGE_Q = `query($q: String!) { pages(first: 1, query: $q) { edges { node { id } } } }`;
  try {
    const r = await shopifyGraphQL(shop, token,
      '{ menus(first: 20) { edges { node { id title items { id title url type resourceId items { id title url type resourceId items { id title url type resourceId } } } } } } }');
    const menus = r.data?.menus?.edges?.map(e => e.node) || [];
    const broken = [];
    const cache = new Map();

    async function existsCheck(kind, handle) {
      const key = `${kind}:${handle}`;
      if (cache.has(key)) return cache.get(key);
      let ok = true;
      try {
        if (kind === 'collection') {
          const cr = await shopifyGraphQL(shop, token, COLLECTION_Q, { h: handle });
          ok = !!cr.data?.collectionByHandle;
        } else if (kind === 'product') {
          const pr = await shopifyGraphQL(shop, token, PRODUCT_Q, { h: handle });
          ok = !!pr.data?.productByHandle;
        } else if (kind === 'page') {
          const pgr = await shopifyGraphQL(shop, token, PAGE_Q, { q: `handle:${handle}` });
          ok = !!pgr.data?.pages?.edges?.[0];
        }
      } catch { ok = true; /* assume válido se API falha */ }
      cache.set(key, ok);
      return ok;
    }

    async function walkItems(items, parentPath) {
      for (const item of (items || [])) {
        const url = item.url || '';
        const path = parentPath ? `${parentPath} → ${item.title}` : item.title;
        // Skip tipos inofensivos
        if (item.type === 'FRONTPAGE' || item.type === 'SHOP_POLICY' || item.type === 'SEARCH') {
          // continue pra sub-items
        } else if (item.type === 'HTTP' && /^https?:\/\//.test(url)) {
          // external — skip
        } else if (url.startsWith('/')) {
          const m = url.match(/^\/(collections|pages|products)\/([^/?#]+)/);
          if (m) {
            const kind = m[1].replace(/s$/, '');
            if (['collection', 'product', 'page'].includes(kind)) {
              const ok = await existsCheck(kind, m[2]);
              if (!ok) broken.push(path + ' (' + url + ')');
            }
          }
        }
        if (item.items?.length) await walkItems(item.items, path);
      }
    }

    for (const menu of menus) {
      await walkItems(menu.items || [], menu.title);
    }

    return {
      verdict: broken.length === 0 ? 'PASS' : broken.length > 3 ? 'FAIL' : 'WARN',
      label: 'Menus com links quebrados',
      detail: `${broken.length} items de menu apontam pra recursos inexistentes`,
      samples: broken.slice(0, 5),
    };
  } catch (e) {
    return { verdict: 'SKIP', label: 'Menus com links quebrados', detail: `erro: ${e.message}` };
  }
}

// Check 9: Produtos sem categoria detectável (categorize() retorna null)
async function checkUncategorized(shop, token) {
  const products = await paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title`, 'products', 500);
  const uncategorized = products.filter(p => !categorize(p.title));
  const ratio = products.length > 0 ? uncategorized.length / products.length : 0;
  return {
    verdict: verdict(ratio, THRESHOLDS.uncategorizedWarnRatio, THRESHOLDS.uncategorizedFailRatio),
    label: 'Produtos sem categoria detectável',
    detail: `${uncategorized.length} de ${products.length} produtos (${(ratio * 100).toFixed(1)}%)`,
    samples: uncategorized.slice(0, 5).map(p => p.title),
  };
}

// Check 10: Variantes com preço zero ou null
async function checkZeroPrices(shop, token) {
  const products = await paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,variants`, 'products', 500);
  const zeros = [];
  for (const p of products) {
    for (const v of (p.variants || [])) {
      const price = parseFloat(v.price);
      if (!price || price === 0) {
        zeros.push(`${p.title} (${v.option1 || '-'})`);
        if (zeros.length >= 20) break;
      }
    }
    if (zeros.length >= 20) break;
  }
  return {
    verdict: verdictCount(zeros.length, THRESHOLDS.zeroPriceWarn, THRESHOLDS.zeroPriceFail),
    label: 'Variantes com preço zero/null',
    detail: `${zeros.length} variantes com price=0`,
    samples: zeros.slice(0, 5),
  };
}

// Check 11: Smart collections com rules vazias
async function checkEmptySmartRules(shop, token) {
  const smart = await paginate(shop, token,
    `/admin/api/${API_VERSION}/smart_collections.json?limit=250`, 'smart_collections', 400);
  const empty = smart.filter(c => !c.rules || c.rules.length === 0);
  return {
    verdict: empty.length === 0 ? 'PASS' : empty.length > 3 ? 'FAIL' : 'WARN',
    label: 'Smart collections sem regras',
    detail: `${empty.length} de ${smart.length} smart collections sem rules`,
    samples: empty.slice(0, 5).map(c => c.title),
  };
}

// Check 12: Pricing ausente no banco
async function checkMissingPricing(pricing) {
  const hasProducts = pricing?.products && Object.keys(pricing.products).length > 0;
  const hasTorcedor = pricing?.products?.torcedor;
  if (!hasProducts) {
    return {
      verdict: 'WARN',
      label: 'Pricing no banco (client_pricing)',
      detail: 'NENHUM pricing configurado — rode /update-prices pra popular',
    };
  }
  if (!hasTorcedor) {
    return {
      verdict: 'WARN',
      label: 'Pricing no banco (client_pricing)',
      detail: `${Object.keys(pricing.products).length} categorias mas sem 'torcedor' base — check 1 fica sem referência`,
    };
  }
  return {
    verdict: 'PASS',
    label: 'Pricing no banco (client_pricing)',
    detail: `${Object.keys(pricing.products).length} produtos + ${Object.keys(pricing.extras || {}).length} extras configurados`,
  };
}

// Check 13: Títulos com typo gramatical
// v5 ampliado: cobre Camisa/Camiseta/Agasalho/Jaqueta/Short/Moletom/Regata/Calça/Calção
// + detecta duplicação "Masculino Feminino" (típico de catalog mal categorizado)
async function checkTitleTypos(shop, token) {
  const products = await paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title`, 'products', 500);
  const PRODUCT_TYPES = '(camisa|camiseta|agasalho|jaqueta|short|moletom|regata|calça|calca|calção|calcao|polo|sungao|bermuda)';
  const reFeminino = new RegExp(`^${PRODUCT_TYPES}.*\\bFeminino\\b`, 'i');
  const reGenderDup = /(Masculino\s+Feminino|Feminino\s+Masculino)/i;
  const typos = products.filter(p => {
    const t = p.title || '';
    return reFeminino.test(t) || reGenderDup.test(t);
  });
  return {
    verdict: typos.length === 0 ? 'PASS' : typos.length > 5 ? 'FAIL' : 'WARN',
    label: 'Títulos com typo gramatical (Feminino/Masculino+Feminino)',
    detail: `${typos.length} produtos com "Feminino" incorreto OU duplicação Masculino+Feminino — rode /clean-titles`,
    samples: typos.slice(0, 5).map(p => p.title),
  };
}

// Check 14: Compare_at_price bizarro (promoção falsa)
async function checkCompareAtPrice(shop, token) {
  const products = await paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,variants`, 'products', 500);
  const bizarre = [];
  for (const p of products) {
    for (const v of (p.variants || [])) {
      const price = parseFloat(v.price);
      const compareAt = parseFloat(v.compare_at_price);
      if (compareAt > 0 && compareAt <= price) {
        bizarre.push(`${p.title} (${v.option1 || '-'}): ${compareAt} <= ${price}`);
        if (bizarre.length >= 20) break;
      }
    }
    if (bizarre.length >= 20) break;
  }
  return {
    verdict: bizarre.length === 0 ? 'PASS' : bizarre.length > 5 ? 'WARN' : 'PASS',
    label: 'Compare_at_price bizarro (promoção falsa)',
    detail: `${bizarre.length} variantes com compare_at <= price`,
    samples: bizarre.slice(0, 5),
  };
}

// Check 15: API version outdated — compara API_VERSION que o Lever usa com o latest
// conhecido na doc local. Se há gap > 1 versão, WARN. Se > 3 versões, FAIL.
async function checkApiVersion(shop, token) {
  // Tenta hit num endpoint da API_VERSION atual. Se der 404/406, a versão foi sunsetada.
  try {
    const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/shop.json?fields=id`);
    if (r.status === 404 || r.status === 406) {
      return {
        verdict: 'FAIL',
        label: 'API version outdated',
        detail: `API_VERSION=${API_VERSION} retornou ${r.status} — versão foi deprecada pela Shopify`,
        samples: [`Atualize API_VERSION em .claude/lib/shopify-api.mjs`],
      };
    }
    // 401/403 = credencial problema, não versão
    if (r.status >= 200 && r.status < 300) {
      return {
        verdict: 'PASS',
        label: 'API version outdated',
        detail: `API_VERSION=${API_VERSION} responde OK`,
      };
    }
    return {
      verdict: 'WARN',
      label: 'API version outdated',
      detail: `API_VERSION=${API_VERSION} retornou status ${r.status}`,
    };
  } catch (e) {
    return {
      verdict: 'WARN',
      label: 'API version outdated',
      detail: `Erro checando API version: ${e.message}`,
    };
  }
}

// Check 16: checkout.liquid legacy — Shopify vai deprecar checkout.liquid em 2025-26.
// Se o tema ativo tem layout/checkout.liquid, alerta.
async function checkCheckoutLiquidLegacy(shop, token) {
  try {
    let targetId = THEME_ID_OVERRIDE;
    if (!targetId) {
      const themes = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json?fields=id,role`);
      const main = (themes.body?.themes || []).find(t => t.role === 'main');
      if (!main) {
        return { verdict: 'SKIP', label: 'checkout.liquid legacy', detail: 'Nenhum tema main encontrado' };
      }
      targetId = main.id;
    }
    const asset = await shReq(shop, token, 'GET',
      `/admin/api/${API_VERSION}/themes/${targetId}/assets.json?asset[key]=layout/checkout.liquid`);
    if (asset.status === 200 && asset.body?.asset?.value) {
      return {
        verdict: 'WARN',
        label: 'checkout.liquid legacy',
        detail: `Tema main usa layout/checkout.liquid (deprecated em agosto 2026)`,
        samples: [
          'Migração: Checkout UI Extensions',
          'Doc: shopify-docs/pages/api/checkout-ui-extensions/',
        ],
      };
    }
    // 404 esperado = não tem checkout.liquid (bom sinal)
    return {
      verdict: 'PASS',
      label: 'checkout.liquid legacy',
      detail: 'Tema não usa checkout.liquid legacy',
    };
  } catch (e) {
    return {
      verdict: 'SKIP',
      label: 'checkout.liquid legacy',
      detail: `Erro: ${e.message}`,
    };
  }
}

// Check 17: webhooks reativos ausentes — verifica se o cliente tem webhooks essenciais
// registrados (products/update, orders/paid). Se não, WARN — Lever opera em modo polling.
async function checkWebhooksMissing(shop, token) {
  const ESSENTIAL = ['products/update', 'orders/paid'];
  try {
    const query = `query { webhookSubscriptions(first: 100) { edges { node { topic } } } }`;
    const r = await shopifyGraphQL(shop, token, query);
    const subs = (r.data?.webhookSubscriptions?.edges || []).map(e => e.node.topic.toLowerCase());
    const missing = ESSENTIAL.filter(e => !subs.some(s => s.includes(e.replace('/', '_'))));
    if (missing.length === 0) {
      return {
        verdict: 'PASS',
        label: 'Webhooks reativos',
        detail: `${subs.length} subscriptions ativas incluindo ${ESSENTIAL.join(', ')}`,
      };
    }
    return {
      verdict: 'WARN',
      label: 'Webhooks reativos',
      detail: `${missing.length} topics essenciais sem subscription`,
      samples: [
        ...missing.map(m => `Faltando: ${m}`),
        'Rode: node .claude/skills/shopify/shopify-watch.mjs watch <cliente>',
      ],
    };
  } catch (e) {
    return {
      verdict: 'SKIP',
      label: 'Webhooks reativos',
      detail: `Erro: ${e.message}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CHECKS v4 — Conversão / Onda 1 estudo conversao-vault (2026-05-19)
// 7 checks novos cruzando Mantos PH + Nike + CFS. 9 outros deferred ou cortados
// por custo-benefício — ver [[conversao-vault/padroes/quality-gate-checks-novos]]
// ═══════════════════════════════════════════════════════════════════════

// Helper: lê asset do tema main (settings_data.json, snippets/X.liquid, etc)
// Se THEME_ID_OVERRIDE estiver setado (via --theme-id), mira esse tema em vez do main.
async function getMainThemeAsset(shop, token, assetKey) {
  try {
    let targetId = THEME_ID_OVERRIDE;
    if (!targetId) {
      const themes = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json?fields=id,role`);
      const main = (themes.body?.themes || []).find(t => t.role === 'main');
      if (!main) return null;
      targetId = main.id;
    }
    const r = await shReq(shop, token, 'GET',
      `/admin/api/${API_VERSION}/themes/${targetId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`);
    if (r.status === 200 && r.body?.asset?.value) return r.body.asset.value;
    return null;
  } catch { return null; }
}

// Check 18: contact_source_consistency
// shop.email do Admin é DO DONO, não do atendimento. Tema/footer deve publicar email/wpp DIFERENTE.
// Se shop.email === email publicado → FAIL (memory feedback_contact_source).
async function checkContactSourceConsistency(shop, token) {
  try {
    const shopRes = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/shop.json?fields=email,phone`);
    const adminEmail = (shopRes.body?.shop?.email || '').toLowerCase().trim();
    if (!adminEmail) return { verdict: 'SKIP', label: 'Contato source consistency', detail: 'shop.email vazio' };

    const settings = await getMainThemeAsset(shop, token, 'config/settings_data.json');
    if (!settings) return { verdict: 'SKIP', label: 'Contato source consistency', detail: 'settings_data.json inacessível' };

    const parsed = JSON.parse(settings);
    const current = parsed.current || {};
    // procura qualquer campo de contato no tema
    const themeContactFields = [];
    const scan = (obj, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
          themeContactFields.push({ key: prefix + k, value: v.toLowerCase().trim() });
        } else if (typeof v === 'object') scan(v, prefix + k + '.');
      }
    };
    scan(current);

    const collisions = themeContactFields.filter(f => f.value === adminEmail);
    if (collisions.length > 0) {
      return {
        verdict: 'FAIL',
        label: 'Contato source consistency',
        detail: `Admin email "${adminEmail}" publicado em ${collisions.length} campo(s) do tema — deveria ser email de atendimento`,
        samples: collisions.slice(0, 3).map(c => c.key),
      };
    }
    return {
      verdict: 'PASS',
      label: 'Contato source consistency',
      detail: `Admin email (DONO) distinto do email publicado no tema (atendimento)`,
    };
  } catch (e) {
    return { verdict: 'SKIP', label: 'Contato source consistency', detail: `erro: ${e.message}` };
  }
}

// Check 20: troca_personalizado_declarada
// Procura página com handle relevante E texto que cubra troca de personalizado.
async function checkTrocaPersonalizadoDeclarada(shop, token) {
  try {
    const query = `query { pages(first: 50, query: "handle:troca* OR handle:politica*") {
      edges { node { handle title body } }
    } }`;
    const r = await shopifyGraphQL(shop, token, query);
    const pages = (r.data?.pages?.edges || []).map(e => e.node);
    if (pages.length === 0) {
      return { verdict: 'WARN', label: 'Troca de personalizado declarada', detail: 'Nenhuma página de política/troca encontrada' };
    }
    const KEYWORDS = ['personalizad', 'nome', 'número', 'numero', 'estampa'];
    const hasIt = pages.some(p => {
      const body = (p.body || '').toLowerCase();
      return KEYWORDS.some(k => body.includes(k));
    });
    if (hasIt) {
      return { verdict: 'PASS', label: 'Troca de personalizado declarada', detail: `Política cobre personalização em ${pages.length} página(s) encontrada(s)` };
    }
    return {
      verdict: 'WARN',
      label: 'Troca de personalizado declarada',
      detail: `${pages.length} página(s) de política mas nenhuma cita troca de personalizado — Nike NÃO faz isso = moat Lever`,
      samples: pages.slice(0, 3).map(p => p.title),
    };
  } catch (e) {
    return { verdict: 'SKIP', label: 'Troca de personalizado declarada', detail: `erro: ${e.message}` };
  }
}

// Check 21: whatsapp_atendimento_visivel
// Procura no settings_data.json por campos com wa.me ou whatsapp.
async function checkWhatsappAtendimentoVisivel(shop, token) {
  const settings = await getMainThemeAsset(shop, token, 'config/settings_data.json');
  if (!settings) return { verdict: 'SKIP', label: 'WhatsApp atendimento visível', detail: 'settings_data.json inacessível' };
  try {
    const parsed = JSON.parse(settings);
    const json = JSON.stringify(parsed.current || {});
    const hasWaMe = /wa\.me\/\d+/.test(json);
    const hasWhatsKey = /"(contact_whatsapp|social_whatsapp|whatsapp_(number|link|url|phone))"\s*:\s*"[^"]+"/.test(json);
    if (hasWaMe || hasWhatsKey) {
      return { verdict: 'PASS', label: 'WhatsApp atendimento visível', detail: 'Link wa.me ou campo whatsapp configurado no tema' };
    }
    return {
      verdict: 'WARN',
      label: 'WhatsApp atendimento visível',
      detail: 'Nenhum wa.me ou campo whatsapp encontrado em settings — Lever opera com WhatsApp humano <1h, deveria declarar',
    };
  } catch (e) {
    return { verdict: 'SKIP', label: 'WhatsApp atendimento visível', detail: `erro parse settings: ${e.message}` };
  }
}

// Check 25: tracking_page_presente
// Procura página /pages/rastreamento ou similar.
async function checkTrackingPagePresente(shop, token) {
  try {
    const query = `query { pages(first: 30, query: "handle:rastr* OR handle:tracking* OR handle:meu-pedido OR handle:track*") {
      edges { node { handle title } }
    } }`;
    const r = await shopifyGraphQL(shop, token, query);
    const pages = (r.data?.pages?.edges || []).map(e => e.node);
    if (pages.length > 0) {
      return {
        verdict: 'PASS',
        label: 'Página de rastreamento presente',
        detail: `${pages.length} página(s) de rastreio encontrada(s)`,
        samples: pages.slice(0, 3).map(p => `/pages/${p.handle}`),
      };
    }
    return {
      verdict: 'WARN',
      label: 'Página de rastreamento presente',
      detail: 'Nenhuma página /pages/rastreamento ou similar — cliente fica perdido pós-compra',
    };
  } catch (e) {
    return { verdict: 'SKIP', label: 'Página de rastreamento presente', detail: `erro: ${e.message}` };
  }
}

// Check 27: pix_badge_present_and_dynamic
// Snippet pix-badge.liquid existe no tema main? (PIX é argumento de fechamento BR #1.)
async function checkPixBadgePresent(shop, token) {
  const snippet = await getMainThemeAsset(shop, token, 'snippets/pix-badge.liquid');
  if (snippet) {
    const hasJsListener = /variantChange|addEventListener|variant:change/i.test(snippet);
    if (hasJsListener) {
      return {
        verdict: 'PASS',
        label: 'PIX badge presente e dinâmico',
        detail: 'snippets/pix-badge.liquid existe E reage a variantChange',
      };
    }
    return {
      verdict: 'WARN',
      label: 'PIX badge presente e dinâmico',
      detail: 'snippets/pix-badge.liquid existe mas NÃO tem listener variantChange — preço não recalcula',
    };
  }
  return {
    verdict: 'FAIL',
    label: 'PIX badge presente e dinâmico',
    detail: 'snippets/pix-badge.liquid AUSENTE — PIX é argumento de fechamento BR #1 (Mantos+Nike confirmam)',
    samples: ['Aplique via /code-blocks copiando de loja Lever que já tem (Lever-BR template)'],
  };
}

// Check 28: cart_drawer_bonus_banners_enabled
// Settings bonus_X_enabled ativos (frete, chaveiro, cupom — cascata Mantos)?
async function checkCartDrawerBonusBanners(shop, token) {
  const settings = await getMainThemeAsset(shop, token, 'config/settings_data.json');
  if (!settings) return { verdict: 'SKIP', label: 'Cart drawer bonus banners', detail: 'settings_data.json inacessível' };
  try {
    const parsed = JSON.parse(settings);
    const current = parsed.current || {};
    const bonusKeys = Object.keys(current).filter(k => /^bonus_\d+_enabled$/.test(k));
    if (bonusKeys.length === 0) {
      return {
        verdict: 'WARN',
        label: 'Cart drawer bonus banners',
        detail: 'Nenhum setting bonus_X_enabled encontrado — tema sem suporte a banners cascata',
      };
    }
    const enabled = bonusKeys.filter(k => current[k] === true);
    if (enabled.length === 0) {
      return {
        verdict: 'WARN',
        label: 'Cart drawer bonus banners',
        detail: `${bonusKeys.length} settings existem mas 0 ativos — cliente perde dopamina cascata (Mantos pattern)`,
      };
    }
    return {
      verdict: 'PASS',
      label: 'Cart drawer bonus banners',
      detail: `${enabled.length}/${bonusKeys.length} banners ativos`,
      samples: enabled,
    };
  } catch (e) {
    return { verdict: 'SKIP', label: 'Cart drawer bonus banners', detail: `erro parse: ${e.message}` };
  }
}

// Check 29: cartpanda_bypass_active
// SE cliente tem CartPanda conectado E cart-drawer tem cartxTriggerCheckout → PASS.
// SE CartPanda conectado MAS não tem bypass → WARN (perde 1 step do funil).
// SE CartPanda não conectado → SKIP.
async function checkCartPandaBypass(shop, token, clientRow) {
  if (clientRow?.cartpanda_status !== 'connected') {
    return { verdict: 'SKIP', label: 'CartPanda bypass ativo', detail: 'Cliente sem CartPanda conectado' };
  }
  const drawer = await getMainThemeAsset(shop, token, 'snippets/cart-drawer.liquid');
  if (!drawer) {
    return { verdict: 'SKIP', label: 'CartPanda bypass ativo', detail: 'cart-drawer.liquid não encontrado no tema' };
  }
  const hasBypass = /cartxTriggerCheckout|cartpanda.*checkout|window\.cartx/.test(drawer);
  if (hasBypass) {
    return {
      verdict: 'PASS',
      label: 'CartPanda bypass ativo',
      detail: 'cart-drawer tem trigger CartPanda direto — pula /cart (Mantos pattern, economiza 1 step)',
    };
  }
  return {
    verdict: 'WARN',
    label: 'CartPanda bypass ativo',
    detail: 'CartPanda conectado mas cart-drawer NÃO tem bypass — funil tem step extra desnecessário',
    samples: ['Aplicar snippet cartxCheckoutSnippet.liquid no cart-drawer'],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CHECKS v5 — Gaps detectados em treino Campo de Treinamento (2026-05-19)
// 3 checks novos que cobrem bugs reais que escaparam de v4
// ═══════════════════════════════════════════════════════════════════════

// Helper: lista keys de assets do tema-alvo filtrando por prefixos.
async function listThemeAssetKeys(shop, token, themeId, prefixes = ['snippets/', 'sections/', 'layout/']) {
  try {
    const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes/${themeId}/assets.json?fields=key`);
    if (r.status !== 200) return [];
    const all = (r.body?.assets || []).map(a => a.key);
    return all.filter(k => prefixes.some(p => k.startsWith(p)) && k.endsWith('.liquid'));
  } catch { return []; }
}

// Resolve themeId target (override de --theme-id ou main)
async function resolveTargetThemeId(shop, token) {
  if (THEME_ID_OVERRIDE) return THEME_ID_OVERRIDE;
  const themes = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json?fields=id,role`);
  return (themes.body?.themes || []).find(t => t.role === 'main')?.id || null;
}

// Check 25: theme_emojis_in_visible_text
// Scaneia snippets/sections/layout do tema procurando emoji em texto FORA de {% comment %}.
// Viola memory feedback_no_emojis_use_icons (regra inquebrável Lever — sempre SVG).
async function checkThemeEmojisInVisibleText(shop, token) {
  const themeId = await resolveTargetThemeId(shop, token);
  if (!themeId) return { verdict: 'SKIP', label: 'Emojis em texto visível (tema)', detail: 'tema-alvo não encontrado' };
  const keys = await listThemeAssetKeys(shop, token, themeId);
  if (keys.length === 0) return { verdict: 'SKIP', label: 'Emojis em texto visível (tema)', detail: 'sem assets liquid pra escanear' };
  // Range Unicode pra emojis comuns (Misc Symbols, Dingbats, Pictographs, Emoticons)
  const EMOJI_RE = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
  // Strip comments antes de testar (regex simples — não cobre nested)
  const stripComments = (src) => src
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const offenders = [];
  // Paralelo limitado pra não estourar rate limit
  for (let i = 0; i < keys.length; i += 5) {
    const batch = keys.slice(i, i + 5);
    await Promise.all(batch.map(async (key) => {
      const r = await shReq(shop, token, 'GET',
        `/admin/api/${API_VERSION}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
      const val = r.body?.asset?.value;
      if (!val) return;
      const stripped = stripComments(val);
      if (EMOJI_RE.test(stripped)) {
        // pega 1ª linha com emoji pra sample
        const line = stripped.split('\n').find(l => EMOJI_RE.test(l)) || '';
        offenders.push({ key, sample: line.slice(0, 80) });
      }
    }));
    await delay(300);
  }
  return {
    verdict: offenders.length === 0 ? 'PASS' : offenders.length > 3 ? 'FAIL' : 'WARN',
    label: 'Emojis em texto visível (tema)',
    detail: offenders.length === 0
      ? `0 emojis em ${keys.length} assets liquid escaneados`
      : `${offenders.length} arquivo(s) com emoji — viola regra inquebrável (sempre SVG via {% render 'icon-*' %})`,
    samples: offenders.slice(0, 5).map(o => `${o.key}: ${o.sample}`),
  };
}

// Check 26: scarcity_heuristic_fake
// Detecta snippets/scarcity-*.liquid usando heurística FAKE (variant.id / modulo / random)
// em vez de inventory_quantity REAL. CFS prova £24M faturamento com escassez REAL.
async function checkScarcityHeuristicFake(shop, token) {
  const themeId = await resolveTargetThemeId(shop, token);
  if (!themeId) return { verdict: 'SKIP', label: 'Scarcity heurística fake', detail: 'tema-alvo não encontrado' };
  const keys = await listThemeAssetKeys(shop, token, themeId, ['snippets/']);
  const scarcityKeys = keys.filter(k => /scarcity|stock|estoque|escassez/i.test(k));
  if (scarcityKeys.length === 0) return { verdict: 'SKIP', label: 'Scarcity heurística fake', detail: 'nenhum snippet de scarcity encontrado' };
  const FAKE_PATTERNS = [
    /variant\.id\s*\|\s*modulo/i,
    /variant\.id\s*\|\s*plus/i,
    /\|\s*random/i,
    /Math\.random/i,
    /\bnow\.seconds\b/i,
  ];
  const REAL_INVENTORY = /inventory_quantity|inventory_count/;
  const offenders = [];
  for (const key of scarcityKeys) {
    const r = await shReq(shop, token, 'GET',
      `/admin/api/${API_VERSION}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
    const val = r.body?.asset?.value || '';
    const usesFake = FAKE_PATTERNS.some(p => p.test(val));
    const usesReal = REAL_INVENTORY.test(val);
    if (usesFake && !usesReal) {
      offenders.push({ key, why: 'usa heurística fake sem inventory_quantity real' });
    } else if (usesFake && usesReal) {
      offenders.push({ key, why: 'mistura fake com real — limpar' });
    }
  }
  return {
    verdict: offenders.length === 0 ? 'PASS' : 'FAIL',
    label: 'Scarcity heurística fake (não usa inventory real)',
    detail: offenders.length === 0
      ? `${scarcityKeys.length} snippet(s) de scarcity OK (usam inventory real ou nenhum padrão fake)`
      : `${offenders.length} snippet(s) com escassez FAKE — CFS prova que mata long-term`,
    samples: offenders.map(o => `${o.key}: ${o.why}`),
  };
}

// Check 27: smart_collection_catchall_detection
// Smart collection com disjunctive=true + todas rules são not_contains = catch-all bug.
// Padrão recorrente memory feedback_sao_paulo_catchall_pattern.
async function checkSmartCollectionCatchall(shop, token) {
  const smart = await paginate(shop, token,
    `/admin/api/${API_VERSION}/smart_collections.json?limit=250&fields=id,title,handle,disjunctive,rules`,
    'smart_collections', 400);
  const catchall = smart.filter(c => {
    if (!c.disjunctive) return false; // só OR
    const rules = c.rules || [];
    if (rules.length === 0) return false; // outro check pega
    // todas rules são not_contains?
    return rules.every(r => r.relation === 'not_contains');
  });
  return {
    verdict: catchall.length === 0 ? 'PASS' : 'FAIL',
    label: 'Smart collections catch-all (disjunctive OR + only not_contains)',
    detail: catchall.length === 0
      ? `${smart.length} smart collections, nenhuma com bug catch-all`
      : `${catchall.length} smart collection(s) com OR + only not_contains = catch-all (vai mostrar TODOS produtos) — rode /audit-smart-collections`,
    samples: catchall.slice(0, 5).map(c => `${c.title} (handle=${c.handle})`),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Config loading (opcional — sobrescreve thresholds por cliente)
// ═══════════════════════════════════════════════════════════════════════
async function loadClientConfig(clientId) {
  try {
    const rows = await supaRest('GET', `/client_quality_config?client_id=eq.${clientId}&limit=1`);
    return rows?.[0] || null;
  } catch { return null; }
}

// Persiste run no Supabase (RLS bloqueia anon — precisa serviceRole)
async function saveRun(clientId, score, counts, results, elapsed, triggeredBy) {
  try {
    await supaRest('POST', '/client_quality_runs', [{
      client_id: clientId,
      score,
      counts,
      results,
      elapsed_seconds: elapsed,
      triggered_by: triggeredBy || 'manual',
    }], { serviceRole: true });
  } catch (e) {
    console.warn('⚠️  falhou salvar run no Supabase:', e.message);
  }
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node quality-gate.mjs <clientIdOrName> [--json]');
    process.exit(1);
  }

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  // Re-fetch agency_clients pra ter cartpanda_status (assertClientExists pode não trazer todos campos)
  try {
    const fullClient = await supaRest('GET', `/agency_clients?select=cartpanda_status,cartpanda_store_slug&id=eq.${client.id}&limit=1`);
    if (fullClient?.[0]) Object.assign(client, fullClient[0]);
  } catch {}

  // Override de tema (treino, preview, debug)
  if (args.theme_id) {
    THEME_ID_OVERRIDE = args.theme_id;
    if (!args.json) console.log(`  → mirando theme_id=${args.theme_id} (override do role=main)\n`);
  }

  const pricing = await fetchPricing(client.id);
  const clientConfig = await loadClientConfig(client.id);
  const language = client.shopify_domain?.includes('-en') ? 'en' : 'pt';

  if (!args.json) console.log(`\n=== Quality Gate: ${client.name} ===`);

  const t0 = Date.now();
  const shop = client.shopify_domain;
  const token = client.shopify_access_token;

  // Checks rodam em grupos paralelos pra respeitar rate limit (mesma loja, ~2 por vez)
  const [prices, soldout] = await Promise.all([
    checkPrices(shop, token, pricing),
    checkSoldOut(shop, token),
  ]);
  const [noImages, empty] = await Promise.all([
    checkNoImages(shop, token),
    checkEmptyCollections(shop, token),
  ]);
  const [seo, duplicates] = await Promise.all([
    checkSEO(shop, token),
    checkDuplicateProducts(shop, token),
  ]);
  const [requiredCol, uncategorized] = await Promise.all([
    checkRequiredCollections(shop, token, language, clientConfig?.required_collections),
    checkUncategorized(shop, token),
  ]);
  const [zeroPrices, emptyRules] = await Promise.all([
    checkZeroPrices(shop, token),
    checkEmptySmartRules(shop, token),
  ]);
  const [titleTypos, compareAt] = await Promise.all([
    checkTitleTypos(shop, token),
    checkCompareAtPrice(shop, token),
  ]);
  const [apiVersion, checkoutLegacy] = await Promise.all([
    checkApiVersion(shop, token),
    checkCheckoutLiquidLegacy(shop, token),
  ]);
  const webhooksMissing = await checkWebhooksMissing(shop, token);
  const brokenMenus = await checkBrokenMenus(shop, token);
  const missingPricing = await checkMissingPricing(pricing);

  // v4 — Conversão / Onda 1 (Mantos + Nike + CFS)
  const [contactConsistency, trocaPersonalizado] = await Promise.all([
    checkContactSourceConsistency(shop, token),
    checkTrocaPersonalizadoDeclarada(shop, token),
  ]);
  const [whatsappVisivel, trackingPage] = await Promise.all([
    checkWhatsappAtendimentoVisivel(shop, token),
    checkTrackingPagePresente(shop, token),
  ]);
  const [pixBadge, cartBonus] = await Promise.all([
    checkPixBadgePresent(shop, token),
    checkCartDrawerBonusBanners(shop, token),
  ]);
  const cartpandaBypass = await checkCartPandaBypass(shop, token, client);

  // v5 — Gaps de treino Campo de Treinamento (2026-05-19)
  const [themeEmojis, scarcityFake] = await Promise.all([
    checkThemeEmojisInVisibleText(shop, token),
    checkScarcityHeuristicFake(shop, token),
  ]);
  const smartCatchall = await checkSmartCollectionCatchall(shop, token);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const results = [
    prices, soldout, noImages, empty, seo,
    duplicates, requiredCol, brokenMenus, uncategorized,
    zeroPrices, emptyRules, missingPricing, titleTypos, compareAt,
    apiVersion, checkoutLegacy, webhooksMissing,
    // v4 — Conversão
    contactConsistency, trocaPersonalizado, whatsappVisivel,
    trackingPage, pixBadge, cartBonus, cartpandaBypass,
    // v5 — Gaps de treino
    themeEmojis, scarcityFake, smartCatchall,
  ];
  const counts = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0 };
  results.forEach(r => { counts[r.verdict] = (counts[r.verdict] || 0) + 1; });
  const score = Math.round((counts.PASS * 100 + counts.WARN * 50) / (results.length - counts.SKIP || 1));

  if (args.json) {
    console.log(JSON.stringify({
      client: client.name,
      clientId: client.id,
      shop: client.shopify_domain,
      ts: new Date().toISOString(),
      elapsedSeconds: parseFloat(elapsed),
      results,
      counts,
      score,
    }, null, 2));
  } else {
    const icons = { PASS: '✓', WARN: '⚠', FAIL: '✗', SKIP: '⊘' };
    results.forEach(r => {
      console.log(`${icons[r.verdict]} ${r.verdict.padEnd(4)} ${r.label}`);
      console.log(`    ${r.detail}`);
      if (r.samples?.length) {
        r.samples.forEach(s => console.log(`      · ${s}`));
      }
    });
    console.log(`\nScore: ${score}/100  (${counts.PASS} PASS, ${counts.WARN} WARN, ${counts.FAIL} FAIL, ${counts.SKIP} SKIP)`);
    console.log(`Elapsed: ${elapsed}s`);
  }

  await appendExecutionLog({
    skill: 'quality-gate',
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    score,
    counts,
    elapsed_seconds: parseFloat(elapsed),
  });

  // Persiste no Supabase (histórico pra dashboard)
  await saveRun(client.id, score, counts, results, parseFloat(elapsed), args.triggered_by || 'manual');

  // Exit code reflects verdict — útil pra usar como pre-flight em outros scripts
  if (counts.FAIL > 0) process.exit(2);
  if (counts.WARN > 0) process.exit(1);
  process.exit(0);
}

// Export das funções pra usar no run-weekly.mjs e outros
export {
  checkPrices, checkSoldOut, checkNoImages, checkEmptyCollections, checkSEO,
  checkDuplicateProducts, checkRequiredCollections, checkBrokenMenus, checkUncategorized,
  checkZeroPrices, checkEmptySmartRules, checkMissingPricing, checkTitleTypos, checkCompareAtPrice,
  checkApiVersion, checkCheckoutLiquidLegacy, checkWebhooksMissing,
  // v4 — Conversão
  checkContactSourceConsistency, checkTrocaPersonalizadoDeclarada,
  checkWhatsappAtendimentoVisivel, checkTrackingPagePresente,
  checkPixBadgePresent, checkCartDrawerBonusBanners, checkCartPandaBypass,
  getMainThemeAsset,
  // v5 — Gaps treino
  checkThemeEmojisInVisibleText, checkScarcityHeuristicFake, checkSmartCollectionCatchall,
  listThemeAssetKeys, resolveTargetThemeId,
  loadClientConfig, saveRun, THRESHOLDS, main as runQualityGate,
};

// Só roda main se for chamado diretamente (não quando importado)
import { fileURLToPath as _fileURLToPath } from 'url';
import { realpathSync as _realpathSync } from 'fs';
const _isMain = process.argv[1] && (() => {
  try {
    return _realpathSync(_fileURLToPath(import.meta.url)) === _realpathSync(process.argv[1]);
  } catch { return false; }
})();
if (_isMain) {
  main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(3); });
}
