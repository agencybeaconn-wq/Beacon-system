// ============================================================
// SCRAPER Shopify Store → Shopify CSV Import
//
//   node scraper_shopify_store.js
//
// Output: ./shopify-store-<host>/
//   ├── produtos.csv           (CSV pronto pra Shopify Admin > Products > Import)
//   ├── produtos.json          (backup estruturado)
//   └── README.md
// ============================================================

const fs = require('fs');
const path = require('path');

// ---------- CONFIG ----------
const STORE_URL = 'https://spacesportsfut.com.br';
const DOWNLOAD_IMAGES = false;  // Shopify import usa as URLs originais
const LIMIT = 250;
const MAX_RETRIES = 3;

const host = new URL(STORE_URL).hostname.replace(/\./g, '-');
const OUT_DIR = path.join(__dirname, `shopify-store-${host}`);
const IMAGES_DIR = path.join(OUT_DIR, 'images');
const PRODUCTS_FILE = path.join(OUT_DIR, 'produtos.json');
const COLLECTIONS_FILE = path.join(OUT_DIR, 'colecoes.json');
const CSV_FILE = path.join(OUT_DIR, 'produtos.csv');

// CSV columns required by Shopify Admin > Products > Import
const CSV_COLUMNS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
  'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty',
  'Variant Inventory Policy', 'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price',
  'Variant Requires Shipping', 'Variant Taxable', 'Variant Barcode',
  'Image Src', 'Image Position', 'Image Alt Text',
  'Gift Card', 'SEO Title', 'SEO Description',
  'Google Shopping / Google Product Category', 'Google Shopping / Gender', 'Google Shopping / Age Group',
  'Google Shopping / MPN', 'Google Shopping / Condition', 'Google Shopping / Custom Product',
  'Variant Image', 'Variant Weight Unit', 'Variant Tax Code', 'Cost per item',
  'Included / Brazil', 'Price / Brazil', 'Compare At Price / Brazil',
  'Status',
];

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildShopifyCsvRows(products) {
  // Each product expands into multiple rows: one per variant + extra rows for additional images
  const rows = [];
  for (const p of products) {
    const tags = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
    const optNames = (p.options || []).map(o => o.name);
    const variants = p.variants || [];
    const images = p.images || [];

    // Decide max rows for this product = max(variants, images)
    const variantCount = variants.length || 1;
    const maxRows = Math.max(variantCount, images.length, 1);

    for (let i = 0; i < maxRows; i++) {
      const v = variants[i] || null;
      const img = images[i] || null;
      const isFirstRow = i === 0;

      const row = {
        'Handle': p.handle,
        // Only first row carries product-level fields
        'Title': isFirstRow ? p.title : '',
        'Body (HTML)': isFirstRow ? (p.body_html || '') : '',
        'Vendor': isFirstRow ? (p.vendor || '') : '',
        'Product Category': '',
        'Type': isFirstRow ? (p.product_type || '') : '',
        'Tags': isFirstRow ? tags : '',
        'Published': isFirstRow ? (p.published_at ? 'TRUE' : 'FALSE') : '',
        // Variant options
        'Option1 Name': isFirstRow && optNames[0] ? optNames[0] : '',
        'Option1 Value': v ? (v.option1 || '') : '',
        'Option2 Name': isFirstRow && optNames[1] ? optNames[1] : '',
        'Option2 Value': v ? (v.option2 || '') : '',
        'Option3 Name': isFirstRow && optNames[2] ? optNames[2] : '',
        'Option3 Value': v ? (v.option3 || '') : '',
        // Variant fields
        'Variant SKU': v ? (v.sku || '') : '',
        'Variant Grams': v ? (v.grams || 0) : '',
        'Variant Inventory Tracker': v ? 'shopify' : '',
        'Variant Inventory Qty': v ? (v.available ? 100 : 0) : '',
        'Variant Inventory Policy': v ? 'deny' : '',
        'Variant Fulfillment Service': v ? 'manual' : '',
        'Variant Price': v ? (v.price || '') : '',
        'Variant Compare At Price': v ? (v.compare_at_price || '') : '',
        'Variant Requires Shipping': v ? (v.requires_shipping !== false ? 'TRUE' : 'FALSE') : '',
        'Variant Taxable': v ? 'TRUE' : '',
        'Variant Barcode': v ? (v.barcode || '') : '',
        // Image
        'Image Src': img ? img.src : '',
        'Image Position': img ? (img.position || i + 1) : '',
        'Image Alt Text': img ? (img.alt || '') : '',
        // Defaults
        'Gift Card': isFirstRow ? 'FALSE' : '',
        'SEO Title': '',
        'SEO Description': '',
        'Google Shopping / Google Product Category': '',
        'Google Shopping / Gender': '',
        'Google Shopping / Age Group': '',
        'Google Shopping / MPN': '',
        'Google Shopping / Condition': '',
        'Google Shopping / Custom Product': '',
        'Variant Image': v && v.featured_image ? v.featured_image.src : '',
        'Variant Weight Unit': v ? 'g' : '',
        'Variant Tax Code': '',
        'Cost per item': '',
        'Included / Brazil': isFirstRow ? 'TRUE' : '',
        'Price / Brazil': '',
        'Compare At Price / Brazil': '',
        'Status': isFirstRow ? 'active' : '',
      };
      rows.push(row);
    }
  }
  return rows;
}

function rowsToCsv(rows) {
  const header = CSV_COLUMNS.join(',');
  const lines = [header];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map(col => csvEscape(row[col])).join(','));
  }
  return lines.join('\n');
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ---------- UTILS ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

async function fetchWithRetry(url) {
  let lastErr;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < MAX_RETRIES) await sleep(1000 * 2 ** i);
    }
  }
  throw lastErr;
}

async function downloadImage(url) {
  try {
    const u = new URL(url);
    const filename = u.pathname.split('/').filter(Boolean).pop();
    if (!filename) return null;
    const fp = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(fp)) return filename;
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    ensureDir(IMAGES_DIR);
    fs.writeFileSync(fp, Buffer.from(await res.arrayBuffer()));
    return filename;
  } catch { return null; }
}

// ---------- MAIN ----------
(async () => {
  ensureDir(OUT_DIR);
  console.log(`[INFO] Loja: ${STORE_URL}`);
  console.log(`[INFO] Output: ${OUT_DIR}\n`);

  // ===== 1. PRODUTOS =====
  console.log('[INFO] Buscando produtos...');
  const allProducts = [];
  let page = 1;
  while (true) {
    const url = `${STORE_URL}/products.json?limit=${LIMIT}&page=${page}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.log(`[ERR] Page ${page}: HTTP ${res.status}`);
      break;
    }
    const data = await res.json();
    const products = data.products || [];
    if (products.length === 0) break;

    allProducts.push(...products);
    console.log(`  Página ${page}: ${products.length} produtos (total: ${allProducts.length})`);

    if (products.length < LIMIT) break;
    page++;
    await sleep(300);
  }
  console.log(`[OK] ${allProducts.length} produtos.\n`);

  // ===== 2. ESTRUTURAR PRODUTOS =====
  console.log('[INFO] Estruturando produtos...');
  const structured = allProducts.map(p => ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    description_html: p.body_html || '',
    vendor: p.vendor,
    product_type: p.product_type,
    tags: p.tags || [],
    created_at: p.created_at,
    updated_at: p.updated_at,
    published_at: p.published_at,
    url: `${STORE_URL}/products/${p.handle}`,
    variants: (p.variants || []).map(v => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      price: v.price,
      compare_at_price: v.compare_at_price,
      available: v.available,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      grams: v.grams,
      requires_shipping: v.requires_shipping,
    })),
    options: (p.options || []).map(o => ({
      name: o.name,
      values: o.values,
    })),
    images: (p.images || []).map(img => ({
      id: img.id,
      src: img.src,
      alt: img.alt || '',
      width: img.width,
      height: img.height,
      position: img.position,
      variant_ids: img.variant_ids || [],
    })),
    image_count: (p.images || []).length,
    variant_count: (p.variants || []).length,
    min_price: Math.min(...(p.variants || []).map(v => parseFloat(v.price) || Infinity)),
    max_price: Math.max(...(p.variants || []).map(v => parseFloat(v.price) || 0)),
  }));

  // Save JSON backup using the RAW products (not structured) to preserve all fields for CSV generation
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(structured, null, 2), 'utf-8');

  // ===== 3. GENERATE SHOPIFY CSV =====
  console.log('\n[INFO] Gerando CSV pra import na Shopify...');
  const csvRows = buildShopifyCsvRows(allProducts.map(p => ({
    handle: p.handle,
    title: p.title,
    body_html: p.body_html || '',
    vendor: p.vendor || '',
    product_type: p.product_type || '',
    tags: p.tags || '',
    published_at: p.published_at,
    options: p.options || [],
    variants: p.variants || [],
    images: p.images || [],
  })));
  const csv = rowsToCsv(csvRows);
  fs.writeFileSync(CSV_FILE, csv, 'utf-8');
  console.log(`[OK] ${csvRows.length} linhas geradas → ${CSV_FILE}`);

  // ===== 4. README =====
  const totalImgs = structured.reduce((s, p) => s + p.image_count, 0);
  const totalVariants = structured.reduce((s, p) => s + p.variant_count, 0);

  const readme = `# ${host} — Shopify Store → CSV Import

Scraped on: ${new Date().toISOString()}
Source: ${STORE_URL}

## Stats

- **Produtos**: ${structured.length}
- **Variantes**: ${totalVariants}
- **Imagens**: ${totalImgs}
- **Linhas no CSV**: ${csvRows.length}

## Files

- \`produtos.csv\` — **Pronto para Shopify Admin > Products > Import**
- \`produtos.json\` — Backup estruturado (caso queira usar pra outra coisa)

## Como importar na Shopify

1. Vai na sua nova loja Shopify Admin
2. **Products** > **Import**
3. Faz upload do \`produtos.csv\`
4. Marca "Overwrite any current products that have the same handle" se quiser sobrescrever
5. Clica **Upload and continue** → confirma

A Shopify vai puxar as **imagens diretamente das URLs do CDN original** (cdn.shopify.com), então não precisa subir nenhuma imagem manualmente.

## Notas importantes

- O CSV inclui **todas as variantes** (tamanho, personalização, etc.)
- O CSV inclui **todas as imagens** de cada produto (uma linha extra por imagem além da primeira variante)
- **Estoque**: defini 100 unidades pra variantes \`available: true\` e 0 pras \`available: false\`. Ajusta na nova loja depois.
- **SKU**: copiado se existir; pode ficar vazio em algumas variantes.
- **Tags**: preservadas (incluindo \`personalizar-kit:*\` etc.).
- **Status**: todos os produtos importados como \`active\`. Mude pra \`draft\` se quiser revisar antes.

## Schema do CSV

Colunas geradas (formato oficial Shopify):

\`\`\`
${CSV_COLUMNS.join(', ')}
\`\`\`
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf-8');

  console.log(`\n[FIM] ${structured.length} produtos, ${totalVariants} variantes, ${totalImgs} imagens.`);
  console.log(`     → ${csvRows.length} linhas no CSV`);
  console.log(`     → ${CSV_FILE}`);
})();
