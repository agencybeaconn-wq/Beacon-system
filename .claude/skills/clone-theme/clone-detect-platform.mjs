#!/usr/bin/env node
// clone-detect-platform — detecta a plataforma de e-commerce de origem.
//
// Estratégia em 4 camadas (do mais barato/rápido pro mais caro):
//   1. HTTP headers (X-Powered-By, Server, set-cookie)
//   2. <meta name="generator">
//   3. Endpoints conhecidos (/products.json, /wp-json/wc/v3/, /rest/V1/, etc)
//   4. Heurísticas no HTML (classes CSS, __NEXT_DATA__, window.Shopify)
//
// Retorna confidence score 0..1 pra cada match. Plataforma vencedora é a de
// maior score. Output em _design/platform.json — usado por clone-normalize.
//
// Uso:
//   node clone-detect-platform.mjs <slug>                 # lê source_url do .clone-meta.json
//   node clone-detect-platform.mjs <slug> --url <url>     # override

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const a = { slug: null, url: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--url') a.url = argv[++i];
    else if (!v.startsWith('--')) a.slug = v;
  }
  return a;
}

const SIGNALS = {
  shopify: {
    headers: [
      { name: 'x-shopify-stage', weight: 1.0 },
      { name: 'x-sorting-hat-podid', weight: 0.9 },
      { name: 'x-shopid', weight: 0.95 },
    ],
    cookies: [/_shopify_y/i, /_secure_session_id/i],
    metaGenerator: [/shopify/i],
    endpoints: [
      { path: '/products.json?limit=1', weight: 0.9, expect: 'products' },
      { path: '/collections.json?limit=1', weight: 0.7, expect: 'collections' },
    ],
    htmlSignals: [
      /window\.Shopify\s*=/, /cdn\.shopify\.com/, /data-shopify/,
      /class="[^"]*shopify-section/, /Shopify\.theme/,
    ],
  },
  woocommerce: {
    headers: [
      { name: 'x-litespeed-cache', weight: 0.4 }, // muito Woo usa LiteSpeed
    ],
    cookies: [/wp-wpml/i, /woocommerce_/i, /wordpress_logged_in/i],
    metaGenerator: [/woocommerce/i, /wordpress/i],
    endpoints: [
      { path: '/wp-json/wc/v3/products?per_page=1', weight: 1.0, expect: 'array' },
      { path: '/wp-json/wp/v2/', weight: 0.6, expect: 'namespace' },
      { path: '/?wc-ajax=get_refreshed_fragments', weight: 0.5, expect: 'fragments' },
    ],
    htmlSignals: [
      /class="[^"]*woocommerce/, /class="[^"]*wp-/, /wc-add-to-cart/,
      /<link[^>]+wp-content\/plugins/, /var wc_/,
    ],
  },
  magento: {
    headers: [
      { name: 'x-magento-cache-debug', weight: 1.0 },
      { name: 'x-magento-tags', weight: 0.9 },
    ],
    cookies: [/X-Magento-Vary/i, /PHPSESSID/i],
    metaGenerator: [/magento/i],
    endpoints: [
      { path: '/rest/V1/products?searchCriteria[pageSize]=1', weight: 1.0, expect: 'items' },
      { path: '/rest/default/V1/store/storeConfigs', weight: 0.8, expect: 'array' },
    ],
    htmlSignals: [
      /Magento_/, /mage-init/, /data-mage-init/, /window\.checkoutConfig/,
    ],
  },
  bigcommerce: {
    headers: [
      { name: 'x-bc-apigw-client-id', weight: 1.0 },
      { name: 'x-bcsi-account', weight: 0.95 },
    ],
    cookies: [/SHOP_SESSION_TOKEN/i, /XSRF-TOKEN/i],
    endpoints: [
      { path: '/api/storefront/v3/products?limit=1', weight: 1.0, expect: 'array' },
    ],
    htmlSignals: [
      /cdn11\.bigcommerce\.com/, /window\.BCData/, /class="[^"]*productView/,
    ],
  },
  wix: {
    headers: [
      { name: 'x-wix-request-id', weight: 1.0 },
    ],
    cookies: [/svSession/i, /XSRF-TOKEN/i, /wixSession/i],
    metaGenerator: [/wix\.com/i],
    htmlSignals: [
      /static\.wixstatic\.com/, /wix-thunderbolt/, /__WIX_RUNTIME__/,
    ],
  },
  squarespace: {
    headers: [],
    cookies: [/SS_MID/i, /CRUMB/i],
    metaGenerator: [/squarespace/i],
    htmlSignals: [
      /static\.squarespace\.com/, /window\.Static/, /Squarespace\.afterBodyLoad/,
    ],
  },
  nextjs: {
    htmlSignals: [
      /__NEXT_DATA__/, /__next/, /id="__next"/, /_next\/static/,
    ],
    note: 'Framework, não plataforma. Marca como custom + hint de hidratação.',
  },
  nuxtjs: {
    htmlSignals: [
      /__NUXT__/, /_nuxt\/static/, /id="__nuxt"/,
    ],
    note: 'Framework, não plataforma. Marca como custom + hint de hidratação.',
  },
};

async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), ...opts });
    return r;
  } catch (e) {
    return null;
  }
}

async function detectViaHttp(rootUrl) {
  const r = await safeFetch(rootUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeverCloneDetector/1.0)' },
  });
  if (!r) return { html: '', headers: {}, status: 0 };
  const html = await r.text();
  const headers = {};
  r.headers.forEach((v, k) => headers[k.toLowerCase()] = v);
  return { html, headers, status: r.status };
}

function scoreFromHeaders(platformDef, headers) {
  let score = 0;
  const hits = [];
  for (const h of (platformDef.headers || [])) {
    if (headers[h.name.toLowerCase()] != null) {
      score += h.weight;
      hits.push(`header:${h.name}`);
    }
  }
  const setCookie = headers['set-cookie'] || '';
  for (const re of (platformDef.cookies || [])) {
    if (re.test(setCookie)) { score += 0.5; hits.push(`cookie:${re}`); }
  }
  return { score, hits };
}

function scoreFromMeta(platformDef, html) {
  const m = html.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i);
  if (!m) return { score: 0, hits: [] };
  const content = m[1];
  let score = 0;
  const hits = [];
  for (const re of (platformDef.metaGenerator || [])) {
    if (re.test(content)) { score += 0.8; hits.push(`meta-generator:${content.slice(0,50)}`); }
  }
  return { score, hits };
}

function scoreFromHtml(platformDef, html) {
  let score = 0;
  const hits = [];
  for (const re of (platformDef.htmlSignals || [])) {
    if (re.test(html)) { score += 0.3; hits.push(`html:${re.source.slice(0, 40)}`); }
  }
  return { score, hits };
}

async function scoreFromEndpoints(platformDef, rootUrl) {
  if (!platformDef.endpoints) return { score: 0, hits: [] };
  let score = 0;
  const hits = [];
  for (const ep of platformDef.endpoints) {
    const url = rootUrl.replace(/\/$/, '') + ep.path;
    const r = await safeFetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r || !r.ok) continue;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) continue;
    try {
      const j = await r.json();
      if (Array.isArray(j) || j[ep.expect] != null) {
        score += ep.weight;
        hits.push(`endpoint:${ep.path}`);
      }
    } catch {}
  }
  return { score, hits };
}

async function detectPlatform(rootUrl) {
  console.log(`  [detect] sondando ${rootUrl}`);
  const { html, headers, status } = await detectViaHttp(rootUrl);
  if (!status) return { platform: 'unknown', confidence: 0, signals: [], html_length: 0, reason: 'fetch falhou' };

  const results = [];
  for (const [name, def] of Object.entries(SIGNALS)) {
    const h = scoreFromHeaders(def, headers);
    const m = scoreFromMeta(def, html);
    const s = scoreFromHtml(def, html);
    const e = await scoreFromEndpoints(def, rootUrl);
    const total = h.score + m.score + s.score + e.score;
    results.push({
      platform: name,
      score: total,
      signals: [...h.hits, ...m.hits, ...s.hits, ...e.hits],
      note: def.note,
    });
  }
  results.sort((a, b) => b.score - a.score);
  const top = results[0];

  // Frameworks (nextjs/nuxtjs) NÃO são plataformas — viram hint de hidratação
  let platform = top.platform;
  let hydrationFramework = null;
  if (['nextjs', 'nuxtjs'].includes(platform) && results[1] && results[1].score > 0.5) {
    hydrationFramework = platform;
    platform = results[1].platform;
  } else if (['nextjs', 'nuxtjs'].includes(platform)) {
    hydrationFramework = platform;
    platform = 'custom';
  }

  const confidence = Math.min(1, top.score / 2.5); // normaliza: 2.5+ = 100%
  return {
    platform: confidence < 0.2 ? 'unknown' : platform,
    confidence: Number(confidence.toFixed(2)),
    hydration_framework: hydrationFramework,
    signals: top.signals,
    all_scores: results.map(r => ({ platform: r.platform, score: Number(r.score.toFixed(2)) })),
    html_length: html.length,
    http_status: status,
  };
}

async function main() {
  const args = parseArgs();
  if (!args.slug && !args.url) {
    console.error('Uso: node clone-detect-platform.mjs <slug> [--url <url>]');
    process.exit(1);
  }
  const workspace = args.slug ? path.join(REPO_ROOT, 'themes', 'clones', args.slug) : null;
  let url = args.url;
  if (!url && workspace && fs.existsSync(path.join(workspace, '.clone-meta.json'))) {
    const meta = JSON.parse(fs.readFileSync(path.join(workspace, '.clone-meta.json'), 'utf8'));
    url = meta.source_url;
  }
  if (!url) { console.error('Forneça --url <url> ou um <slug> com source_url no .clone-meta.json'); process.exit(1); }

  console.log(`\n=== clone-detect-platform ===`);
  const result = await detectPlatform(url);
  console.log(`\n  Platform:      ${result.platform}`);
  console.log(`  Confidence:    ${result.confidence}`);
  if (result.hydration_framework) console.log(`  Framework:     ${result.hydration_framework} (precisa hidratação JS forçada)`);
  console.log(`  Top signals:   ${result.signals.slice(0, 5).join(', ') || 'nenhum'}`);
  console.log(`  All scores:    ${result.all_scores.slice(0, 5).map(s => `${s.platform}=${s.score}`).join(', ')}`);

  if (workspace) {
    const designDir = path.join(workspace, '_design');
    fs.mkdirSync(designDir, { recursive: true });
    fs.writeFileSync(path.join(designDir, 'platform.json'), JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n  ✓ Gravado em ${path.relative(REPO_ROOT, path.join(designDir, 'platform.json'))}`);
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
