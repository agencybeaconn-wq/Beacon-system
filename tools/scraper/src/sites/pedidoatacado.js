// ============================================================
// SCRAPER Pedido Atacado (WooCommerce Store API) → JSON estruturado
//
//   node scraper_pedidoatacado.js
//
// Output: ./pedidoatacado-com/
//   ├── produtos.json   (estrutura pronta pra importar no Medusa)
//   ├── categorias.json (árvore de categorias)
//   └── README.md
// ============================================================

const fs = require('fs')
const path = require('path')

// ---------- CONFIG ----------
const STORE_URL = 'https://pedidoatacado.com'
const PER_PAGE = 100
const MAX_RETRIES = 3
const SLEEP_BETWEEN_PAGES = 300
const FETCH_VARIATIONS = true // type=variable → hit /products?include=<ids>

const host = new URL(STORE_URL).hostname.replace(/\./g, '-')
const OUT_DIR = path.join(__dirname, host)
const PRODUCTS_FILE = path.join(OUT_DIR, 'produtos.json')
const CATEGORIES_FILE = path.join(OUT_DIR, 'categorias.json')
const README_FILE = path.join(OUT_DIR, 'README.md')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}

async function fetchWithRetry(url) {
  let lastErr
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      })
      if (res.status === 429 || res.status >= 500)
        throw new Error(`HTTP ${res.status}`)
      return res
    } catch (err) {
      lastErr = err
      if (i < MAX_RETRIES) await sleep(1000 * 2 ** i)
    }
  }
  throw lastErr
}

// Price comes in minor units (e.g. "13500" = R$ 135,00)
function formatPrice(priceObj) {
  if (!priceObj) return null
  const minor = parseInt(priceObj.price, 10)
  const decimals = priceObj.currency_minor_unit ?? 2
  return {
    amount: minor, // minor units — Medusa preferred
    decimal: (minor / Math.pow(10, decimals)).toFixed(decimals),
    currency: (priceObj.currency_code || 'BRL').toLowerCase(),
  }
}

// Remove 430x430 / 800x800 suffixes so we store the full-size URL
function cleanImageUrl(src) {
  if (!src) return src
  return src.replace(/-\d{2,4}x\d{2,4}(?=\.[a-z]+(\?|$))/i, '')
}

function normalizeProduct(p, variations = []) {
  const price = formatPrice(p.prices)
  return {
    source_id: p.id,
    handle: p.slug,
    title: p.name,
    type: p.type, // simple | variable
    sku: p.sku || null,
    description_html: p.description || '',
    short_description_html: p.short_description || '',
    permalink: p.permalink,
    status: p.is_purchasable ? 'published' : 'draft',
    in_stock: p.is_in_stock,
    price,
    on_sale: p.on_sale,
    images: (p.images || []).map((img) => ({
      source_id: img.id,
      src: cleanImageUrl(img.src),
      thumbnail: img.thumbnail,
      alt: img.alt || img.name || '',
    })),
    categories: (p.categories || []).map((c) => ({
      source_id: c.id,
      name: c.name,
      slug: c.slug,
    })),
    tags: (p.tags || []).map((t) => t.slug),
    attributes: (p.attributes || []).map((a) => ({
      name: a.name,
      taxonomy: a.taxonomy,
      terms: (a.terms || []).map((t) => ({ name: t.name, slug: t.slug })),
    })),
    variations: variations.map((v) => ({
      source_id: v.id,
      sku: v.sku || null,
      price: formatPrice(v.prices),
      in_stock: v.is_in_stock,
      attributes: (v.attributes || []).map((a) => ({
        name: a.name,
        value: a.value,
      })),
      image: v.images && v.images[0] ? cleanImageUrl(v.images[0].src) : null,
    })),
  }
}

// ---------- MAIN ----------
;(async () => {
  ensureDir(OUT_DIR)
  console.log(`[INFO] Loja: ${STORE_URL}`)
  console.log(`[INFO] Output: ${OUT_DIR}\n`)

  // ===== 1. CATEGORIAS =====
  console.log('[INFO] Buscando categorias...')
  const categorias = []
  {
    let page = 1
    while (true) {
      const url = `${STORE_URL}/wp-json/wc/store/v1/products/categories?per_page=${PER_PAGE}&page=${page}`
      const res = await fetchWithRetry(url)
      if (!res.ok) {
        console.log(`[ERR] Categorias page ${page}: HTTP ${res.status}`)
        break
      }
      const batch = await res.json()
      if (!Array.isArray(batch) || batch.length === 0) break
      categorias.push(...batch)
      console.log(
        `  Página ${page}: ${batch.length} categorias (total: ${categorias.length})`
      )
      if (batch.length < PER_PAGE) break
      page++
      await sleep(SLEEP_BETWEEN_PAGES)
    }
  }
  fs.writeFileSync(
    CATEGORIES_FILE,
    JSON.stringify(categorias, null, 2),
    'utf-8'
  )
  console.log(`[OK] ${categorias.length} categorias → ${CATEGORIES_FILE}\n`)

  // ===== 2. PRODUTOS =====
  console.log('[INFO] Buscando produtos...')
  const allRaw = []
  {
    let page = 1
    while (true) {
      const url = `${STORE_URL}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`
      const res = await fetchWithRetry(url)
      if (!res.ok) {
        console.log(`[ERR] Produtos page ${page}: HTTP ${res.status}`)
        break
      }
      const batch = await res.json()
      if (!Array.isArray(batch) || batch.length === 0) break
      allRaw.push(...batch)
      console.log(
        `  Página ${page}: ${batch.length} produtos (total: ${allRaw.length})`
      )
      if (batch.length < PER_PAGE) break
      page++
      await sleep(SLEEP_BETWEEN_PAGES)
    }
  }
  console.log(`[OK] ${allRaw.length} produtos brutos.\n`)

  // ===== 3. VARIAÇÕES (para type=variable) =====
  let variationsByProduct = {}
  if (FETCH_VARIATIONS) {
    const variableProducts = allRaw.filter(
      (p) => p.type === 'variable' && Array.isArray(p.variations) && p.variations.length
    )
    console.log(`[INFO] ${variableProducts.length} produtos com variações.`)

    for (let i = 0; i < variableProducts.length; i++) {
      const p = variableProducts[i]
      const ids = p.variations.map((v) => v.id).join(',')
      const url = `${STORE_URL}/wp-json/wc/store/v1/products?include=${ids}&per_page=${p.variations.length}`
      try {
        const res = await fetchWithRetry(url)
        if (res.ok) {
          const batch = await res.json()
          variationsByProduct[p.id] = batch
          if ((i + 1) % 20 === 0)
            console.log(`  Variations: ${i + 1}/${variableProducts.length}`)
        }
      } catch (err) {
        console.log(`  [WARN] ${p.slug}: ${err.message}`)
      }
      await sleep(100)
    }
    console.log('[OK] Variações coletadas.\n')
  }

  // ===== 4. NORMALIZAR =====
  console.log('[INFO] Normalizando produtos...')
  const produtos = allRaw.map((p) =>
    normalizeProduct(p, variationsByProduct[p.id] || [])
  )
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(produtos, null, 2), 'utf-8')
  console.log(`[OK] ${produtos.length} produtos → ${PRODUCTS_FILE}\n`)

  // ===== 5. README =====
  const totalImgs = produtos.reduce((s, p) => s + p.images.length, 0)
  const totalVariations = produtos.reduce(
    (s, p) => s + p.variations.length,
    0
  )
  const readme = `# ${host} — Pedido Atacado scrape

Scraped on: ${new Date().toISOString()}
Source: ${STORE_URL}

## Stats

- **Produtos**: ${produtos.length}
- **Variações**: ${totalVariations}
- **Imagens**: ${totalImgs}
- **Categorias**: ${categorias.length}

## Files

- \`produtos.json\` — lista normalizada (entrada do importador Medusa)
- \`categorias.json\` — árvore crua de categorias Woo

## Schema resumido (produtos.json)

Cada produto:
\`\`\`
{
  source_id, handle, title, type, sku, description_html,
  status, in_stock, on_sale,
  price: { amount (minor), decimal, currency },
  images: [{ src, alt }],
  categories: [{ source_id, name, slug }],
  tags: [slug],
  attributes: [{ name, taxonomy, terms[] }],
  variations: [{ source_id, sku, price, attributes[], image }]
}
\`\`\`

## Próximo passo

Dentro do repo do backend Medusa (\`lever-ecomm\`):

\`\`\`
npx medusa exec ./src/scripts/import-products.ts
\`\`\`
`
  fs.writeFileSync(README_FILE, readme, 'utf-8')

  console.log(
    `[FIM] ${produtos.length} produtos · ${totalVariations} variações · ${totalImgs} imagens.`
  )
})()
