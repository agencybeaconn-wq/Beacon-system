#!/usr/bin/env node
// clone-normalize-products — extrai produtos do alvo e normaliza pra formato Shopify.
//
// Output: _design/products.normalized.json  (array de products no formato Shopify-ready)
//
// Cada plataforma tem extractor próprio:
//   - shopify:      GET /products.json (já é Shopify-format)
//   - woocommerce:  GET /wp-json/wc/v3/products  (mapeia campos pra Shopify)
//   - magento:      GET /rest/V1/products?...    (mapeia)
//   - bigcommerce:  GET /api/storefront/v3/products
//   - custom/unknown: stub — scrape de PLP/PDP via Playwright (TODO)
//
// Uso:
//   node clone-normalize-products.mjs <slug>             # lê platform.json + source_url
//   node clone-normalize-products.mjs <slug> --limit 50  # cap em N produtos (default 100)
//   node clone-normalize-products.mjs <slug> --platform shopify --url https://exemplo.com

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const a = { slug: null, url: null, platform: null, limit: 100 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--url') a.url = argv[++i];
    else if (v === '--platform') a.platform = argv[++i];
    else if (v === '--limit') a.limit = parseInt(argv[++i]);
    else if (!v.startsWith('--')) a.slug = v;
  }
  return a;
}

async function safeFetch(url, opts = {}) {
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
  } catch { return null; }
}

// ============================================================
// EXTRACTORS — 1 por plataforma. Cada um retorna produtos no Shopify-format.
// ============================================================

async function extractShopify(rootUrl, limit) {
  // /products.json já é Shopify-format. Apenas faz paginação.
  const out = [];
  const pageSize = Math.min(250, limit);
  let page = 1;
  while (out.length < limit) {
    const u = `${rootUrl.replace(/\/$/, '')}/products.json?limit=${pageSize}&page=${page}`;
    const r = await safeFetch(u);
    if (!r || !r.ok) break;
    const j = await r.json();
    if (!j.products || !j.products.length) break;
    out.push(...j.products);
    if (j.products.length < pageSize) break;
    page++;
  }
  return out.slice(0, limit).map(p => normalizeShopifyProduct(p));
}

function normalizeShopifyProduct(p) {
  return {
    title: p.title,
    handle: p.handle,
    body_html: p.body_html || '',
    vendor: p.vendor || '',
    product_type: p.product_type || '',
    tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? p.tags.split(',').map(s => s.trim()) : []),
    options: (p.options || []).map(o => ({ name: o.name, position: o.position, values: o.values })),
    variants: (p.variants || []).map(v => ({
      title: v.title,
      sku: v.sku || '',
      price: v.price,
      compare_at_price: v.compare_at_price || null,
      option1: v.option1, option2: v.option2, option3: v.option3,
      inventory_quantity: v.inventory_quantity ?? 100,
      inventory_policy: v.inventory_policy || 'continue',
      requires_shipping: v.requires_shipping !== false,
      taxable: v.taxable !== false,
      weight: v.weight || 0,
      weight_unit: v.weight_unit || 'kg',
      image_id: v.image_id || null,
    })),
    images: (p.images || []).map(i => ({
      src: i.src,
      alt: i.alt || p.title,
      position: i.position,
      width: i.width, height: i.height,
    })),
    _source: { platform: 'shopify' },
  };
}

async function extractWoocommerce(rootUrl, limit) {
  // Tenta /wp-json/wc/v3/products. Se exigir auth, cai pro scrape de PLP.
  const out = [];
  const pageSize = Math.min(100, limit);
  let page = 1;
  while (out.length < limit) {
    const u = `${rootUrl.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=${pageSize}&page=${page}&status=publish`;
    const r = await safeFetch(u);
    if (!r || !r.ok) {
      console.log(`  [woo] /wp-json falhou (status ${r?.status}) — provavelmente exige consumer key. Skip.`);
      break;
    }
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    out.push(...j);
    if (j.length < pageSize) break;
    page++;
  }
  return out.slice(0, limit).map(p => normalizeWooProduct(p));
}

function normalizeWooProduct(p) {
  // Woo → Shopify mapping
  const attrs = p.attributes || [];
  const options = attrs.filter(a => a.variation).map((a, i) => ({
    name: a.name, position: i + 1, values: a.options || [],
  }));
  const variations = p.variations || [];
  const variants = (p.type === 'variable' ? variations : [{ _isDefault: true }]).map((v, idx) => ({
    title: v.attributes ? v.attributes.map(a => a.option).join(' / ') : 'Default Title',
    sku: v.sku || p.sku || '',
    price: String(v.price || p.price || '0.00'),
    compare_at_price: (v.regular_price && v.sale_price && v.regular_price !== v.sale_price) ? v.regular_price : null,
    option1: v.attributes?.[0]?.option || null,
    option2: v.attributes?.[1]?.option || null,
    option3: v.attributes?.[2]?.option || null,
    inventory_quantity: v.stock_quantity ?? p.stock_quantity ?? 100,
    inventory_policy: (v.backorders === 'no' ? 'deny' : 'continue'),
    weight: parseFloat(v.weight || p.weight || 0),
    weight_unit: 'kg',
  }));
  return {
    title: p.name,
    handle: p.slug,
    body_html: p.description || p.short_description || '',
    vendor: '',
    product_type: (p.categories?.[0]?.name) || '',
    tags: (p.tags || []).map(t => t.name),
    options,
    variants,
    images: (p.images || []).map((i, idx) => ({
      src: i.src, alt: i.alt || p.name, position: idx + 1,
    })),
    _source: { platform: 'woocommerce', wp_id: p.id },
  };
}

async function extractMagento(rootUrl, limit) {
  // /rest/V1/products geralmente é público mas exige header de auth pra full data.
  // Sem token, retorna only basic fields. Tenta best-effort.
  const u = `${rootUrl.replace(/\/$/, '')}/rest/V1/products?searchCriteria[pageSize]=${limit}`;
  const r = await safeFetch(u);
  if (!r || !r.ok) { console.log(`  [magento] /rest/V1 falhou — provavelmente exige token. Skip.`); return []; }
  const j = await r.json();
  return (j.items || []).slice(0, limit).map(normalizeMagentoProduct);
}

function normalizeMagentoProduct(p) {
  return {
    title: p.name,
    handle: p.url_key || (p.name || '').toLowerCase().replace(/\s+/g, '-'),
    body_html: p.custom_attributes?.find(a => a.attribute_code === 'description')?.value || '',
    vendor: '',
    product_type: p.type_id || '',
    tags: [],
    options: [],
    variants: [{
      title: 'Default Title',
      sku: p.sku,
      price: String(p.price || '0.00'),
      compare_at_price: null,
      inventory_quantity: 100,
      inventory_policy: 'continue',
    }],
    images: (p.media_gallery_entries || []).map((i, idx) => ({
      src: i.file ? `${p._mediaBase || ''}/catalog/product${i.file}` : '',
      alt: i.label || p.name,
      position: idx + 1,
    })),
    _source: { platform: 'magento', magento_id: p.id },
  };
}

async function extractBigcommerce(rootUrl, limit) {
  const u = `${rootUrl.replace(/\/$/, '')}/api/storefront/v3/products?limit=${limit}`;
  const r = await safeFetch(u);
  if (!r || !r.ok) { console.log(`  [bc] /api/storefront falhou. Skip.`); return []; }
  const j = await r.json();
  return (j.data || []).slice(0, limit).map(normalizeBcProduct);
}

function normalizeBcProduct(p) {
  return {
    title: p.name,
    handle: p.custom_url?.url?.replace(/^\/|\/$/g, '') || (p.name || '').toLowerCase().replace(/\s+/g, '-'),
    body_html: p.description || '',
    vendor: p.brand?.name || '',
    product_type: p.categories?.[0]?.name || '',
    tags: [],
    options: (p.options || []).map((o, i) => ({
      name: o.display_name, position: i + 1,
      values: (o.option_values || []).map(v => v.label),
    })),
    variants: (p.variants || []).map(v => ({
      title: (v.option_values || []).map(o => o.label).join(' / ') || 'Default Title',
      sku: v.sku || '',
      price: String(v.calculated_price || p.calculated_price || '0.00'),
      compare_at_price: v.sale_price && v.price && v.sale_price !== v.price ? String(v.price) : null,
      option1: v.option_values?.[0]?.label || null,
      option2: v.option_values?.[1]?.label || null,
      option3: v.option_values?.[2]?.label || null,
      inventory_quantity: v.inventory_level ?? 100,
      inventory_policy: 'continue',
    })),
    images: (p.images || []).map((i, idx) => ({
      src: i.url_standard || i.url_zoom, alt: i.description || p.name, position: idx + 1,
    })),
    _source: { platform: 'bigcommerce', bc_id: p.id },
  };
}

async function extractGenericScrape(rootUrl, limit) {
  // Fallback: extrai produtos visíveis na home via Playwright.
  // Heurística: procura cards de produto por padrões comuns (data-product-id, .product, etc).
  console.log(`  [generic] sem API conhecida — usando scrape Playwright (heurística limitada)`);
  let playwright;
  try { playwright = await import('playwright'); }
  catch { console.error(`  [generic] playwright não instalado — abortando`); return []; }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(rootUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  // Força lazy load
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(1500);

  const products = await page.evaluate(() => {
    const selectors = [
      '[data-product-id]', '.product', '.product-card', '.product-item',
      '[class*="product-card"]', '[class*="ProductCard"]', '[class*="product_card"]',
    ];
    const seen = new Set();
    const out = [];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const link = el.querySelector('a[href*="/product"], a[href*="/p/"]');
        const img = el.querySelector('img');
        const title = el.querySelector('[class*="title"], [class*="name"], h2, h3, h4')?.innerText?.trim();
        const price = el.querySelector('[class*="price"]')?.innerText?.trim();
        const href = link?.href;
        if (!title || !href || seen.has(href)) return;
        seen.add(href);
        out.push({ title, href, price, img: img?.src, alt: img?.alt });
      });
    }
    return out;
  });

  await browser.close();

  return products.slice(0, limit).map((p, idx) => ({
    title: p.title,
    handle: p.href.split('/').filter(Boolean).pop()?.split('?')[0] || `product-${idx + 1}`,
    body_html: '',
    vendor: '',
    product_type: '',
    tags: [],
    options: [],
    variants: [{
      title: 'Default Title',
      sku: '',
      price: (p.price || '').replace(/[^\d.,]/g, '').replace(',', '.') || '0.00',
      compare_at_price: null,
      inventory_quantity: 100,
      inventory_policy: 'continue',
    }],
    images: p.img ? [{ src: p.img, alt: p.alt || p.title, position: 1 }] : [],
    _source: { platform: 'generic-scrape', source_url: p.href },
  }));
}

const EXTRACTORS = {
  shopify: extractShopify,
  woocommerce: extractWoocommerce,
  magento: extractMagento,
  bigcommerce: extractBigcommerce,
  custom: extractGenericScrape,
  unknown: extractGenericScrape,
  wix: extractGenericScrape,
  squarespace: extractGenericScrape,
};

async function main() {
  const args = parseArgs();
  if (!args.slug) { console.error('Uso: node clone-normalize-products.mjs <slug> [--limit N] [--platform shopify] [--url URL]'); process.exit(1); }

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  const platformPath = path.join(workspace, '_design', 'platform.json');

  let platform = args.platform;
  let url = args.url;
  if (!platform && fs.existsSync(platformPath)) {
    const pj = JSON.parse(fs.readFileSync(platformPath, 'utf8'));
    platform = pj.platform;
    console.log(`  [meta] platform=${platform} (confidence=${pj.confidence})`);
  }
  if (!url && fs.existsSync(metaPath)) {
    const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    url = m.source_url;
  }
  if (!url) { console.error('Sem source_url'); process.exit(1); }
  if (!platform) { platform = 'unknown'; console.log(`  [meta] platform desconhecida — caindo pra generic-scrape`); }

  const extractor = EXTRACTORS[platform] || EXTRACTORS.unknown;
  console.log(`\n=== clone-normalize-products (${platform}) ===`);
  console.log(`  URL:    ${url}`);
  console.log(`  Limit:  ${args.limit}`);

  const products = await extractor(url, args.limit);
  console.log(`\n  ✓ ${products.length} produtos extraídos e normalizados`);

  const outPath = path.join(workspace, '_design', 'products.normalized.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    platform, source_url: url, count: products.length,
    extracted_at: new Date().toISOString(),
    products,
  }, null, 2), 'utf8');

  console.log(`  Gravado em ${path.relative(REPO_ROOT, outPath)}\n`);
  if (products.length > 0) {
    const sample = products[0];
    console.log(`  Sample: ${sample.title} (${sample.variants.length} variantes, ${sample.images.length} imagens)`);
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
