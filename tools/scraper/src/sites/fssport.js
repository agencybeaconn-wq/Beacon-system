// ============================================================
// SCRAPER FS Sport (Nuvemshop) → JSON estruturado pra Medusa
//
//   node scraper_fssport.js
//
// Output: ./fssport-com-br/
//   ├── produtos.json   (mesmo schema do pedidoatacado-com)
//   ├── categorias.json
//   └── README.md
// ============================================================

const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

// ---------- CONFIG ----------
const STORE_URL = 'https://www.fssport.com.br'
const MAX_RETRIES = 3
const SLEEP_BETWEEN = 200 // ms entre requests

const host = new URL(STORE_URL).hostname.replace(/\./g, '-').replace(/^www-/, '')
const OUT_DIR = path.join(__dirname, host)
const PRODUCTS_FILE = path.join(OUT_DIR, 'produtos.json')
const CATEGORIES_FILE = path.join(OUT_DIR, 'categorias.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }) }

async function fetchWithRetry(url) {
  let lastErr
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: '*/*' },
      })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (err) {
      lastErr = err
      if (i < MAX_RETRIES) await sleep(1000 * 2 ** i)
    }
  }
  throw lastErr
}

function cleanImageUrl(src) {
  if (!src) return src
  // IMPORTANTE: a Nuvemshop só serve as imagens redimensionadas (com sufixo
  // -480-0, -640-0, -1024-1024). A URL "original" sem sufixo retorna 403.
  // Então normalizamos pra versão grande (-1024-1024) quando possível.
  // Se a URL já vem com um sufixo qualquer, mantemos. Se vier sem, adicionamos.
  if (/-\d+-\d+\.(webp|jpg|jpeg|png|gif|avif)(\?|$)/i.test(src)) {
    return src
  }
  return src.replace(/\.(webp|jpg|jpeg|png|gif|avif)(\?|$)/i, '-1024-1024.$1$2')
}

// ---------- STEP 1: PAGINATE PRODUCT LISTING ----------
async function fetchProductUrls() {
  const urls = []
  let page = 1

  while (true) {
    const url = `${STORE_URL}/produtos?page=${page}&results_only=true&ajax=true`
    const res = await fetchWithRetry(url)
    const html = await res.text()

    if (!html || html.trim().length < 50) break

    const $ = cheerio.load(html)
    const links = []

    // Nuvemshop product cards: <a> inside item-product or data-product-id
    $('a[href*="/produtos/"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && !href.includes('?') && !links.includes(href)) {
        links.push(href.startsWith('http') ? href : `${STORE_URL}${href}`)
      }
    })

    if (links.length === 0) break

    urls.push(...links)
    console.log(`  Página ${page}: ${links.length} links (total: ${urls.length})`)

    page++
    await sleep(SLEEP_BETWEEN)
  }

  // Dedupe
  return [...new Set(urls)]
}

// ---------- STEP 2: SCRAPE PRODUCT DETAIL ----------
async function scrapeProduct(url) {
  const res = await fetchWithRetry(url)
  const html = await res.text()
  const $ = cheerio.load(html)

  // Nessa loja (Nuvemshop tema Toluca), os blocos ld+json que aparecem na página
  // são TODOS de produtos relacionados, não do produto atual. Portanto:
  //   - título: H1 ou og:title (ambos batem com o produto correto)
  //   - descrição: meta[name="description"]
  //   - preço: .js-price-display / [data-product-price] do DOM
  //   - imagens: og:image + imgs do DOM que estão fora do bloco de relacionados
  const slug = new URL(url).pathname.replace(/^\/produtos\//, '').replace(/\/$/, '')
  const ogTitle = $('meta[property="og:title"]').attr('content') || ''
  const h1 = $('h1').first().text().trim()
  const title = h1 || ogTitle || ''
  const description = $('meta[name="description"]').attr('content') || ''

  // Price do DOM (ld+json dessa loja é sempre de relacionados)
  let priceValue = 0
  const priceText = $('.js-price-display, [data-product-price], .price-display').first().text().trim()
  if (priceText) {
    // Formato BR: "R$189,00" → 189.00
    const numeric = priceText.replace(/[^\d,]/g, '').replace(',', '.')
    const n = parseFloat(numeric)
    if (Number.isFinite(n)) priceValue = n
  }

  // Imagens — og:image primeiro (sempre correta), depois varredura escopada
  // do DOM FORA do bloco de produtos relacionados (.js-item-product).
  // Só aceita URLs que incluam /products/ (pasta de mídia do produto).
  const images = []
  const seenSrcs = new Set()
  const normImg = (src) => {
    if (!src) return null
    let s = src.split(',')[0].trim().split(' ')[0]
    if (s.startsWith('//')) s = 'https:' + s
    if (s.startsWith('http://')) s = 'https://' + s.slice('http://'.length)
    if (!s.includes('/products/')) return null
    if (s.startsWith('data:')) return null
    return cleanImageUrl(s)
  }
  const pushImg = (src, alt) => {
    const cleaned = normImg(src)
    if (!cleaned || seenSrcs.has(cleaned)) return
    seenSrcs.add(cleaned)
    images.push({
      source_id: images.length,
      src: cleaned,
      thumbnail: cleaned,
      alt: alt || title,
    })
  }

  // og:image é a miniatura oficial do produto atual
  pushImg($('meta[property="og:image"]').attr('content'), title)

  // Imagens adicionais no DOM — filtra relacionados e só aceita path de produto
  $('img[src*="mitiendanube"], img[data-src*="mitiendanube"]').each((_, el) => {
    const $el = $(el)
    if ($el.parents('.js-item-product').length > 0) return
    const src = $el.attr('data-src') || $el.attr('src')
    pushImg(src, $el.attr('alt'))
  })

  // Categories from breadcrumb
  const categories = []
  $('.breadcrumb a, nav[aria-label="breadcrumb"] a').each((_, el) => {
    const name = $(el).text().trim()
    const href = $(el).attr('href') || ''
    if (name && name !== 'Home' && name !== 'Início' && !href.includes('/produtos/')) {
      const catSlug = href.replace(/.*\//, '').replace(/\/$/, '') || name.toLowerCase().replace(/\s+/g, '-')
      categories.push({ source_id: 0, name, slug: catSlug })
    }
  })

  // Tags from ld+json or meta
  const tags = []
  const keywords = $('meta[name="keywords"]').attr('content')
  if (keywords) {
    keywords.split(',').forEach(t => {
      const tag = t.trim().toLowerCase().replace(/\s+/g, '-')
      if (tag) tags.push(tag)
    })
  }

  return {
    source_id: 0,
    handle: slug,
    title,
    type: 'simple',
    sku: null,
    description_html: description,
    short_description_html: '',
    permalink: url,
    status: 'published',
    in_stock: true,
    price: {
      amount: Math.round(priceValue * 100), // minor units
      decimal: priceValue.toFixed(2),
      currency: 'brl',
    },
    on_sale: false,
    images,
    categories,
    tags,
    attributes: [],
    variations: [],
  }
}

// ---------- MAIN ----------
;(async () => {
  ensureDir(OUT_DIR)
  console.log(`[INFO] Loja: ${STORE_URL}`)
  console.log(`[INFO] Output: ${OUT_DIR}\n`)

  // 1. Product URLs
  console.log('[INFO] Buscando lista de produtos...')
  const urls = await fetchProductUrls()
  console.log(`[OK] ${urls.length} URLs únicas.\n`)

  if (!urls.length) {
    console.log('[ERR] Nenhum produto encontrado. Abortando.')
    return
  }

  // 2. Scrape details
  console.log('[INFO] Scrapeando detalhes...')
  const produtos = []
  const allCategories = new Map()

  for (let i = 0; i < urls.length; i++) {
    try {
      const p = await scrapeProduct(urls[i])
      p.source_id = i + 1
      produtos.push(p)

      // Collect categories
      for (const c of p.categories) {
        if (!allCategories.has(c.slug)) allCategories.set(c.slug, c)
      }

      if ((i + 1) % 25 === 0) {
        console.log(`  ${i + 1}/${urls.length} produtos scrapeados`)
      }
    } catch (err) {
      console.log(`  [WARN] ${urls[i]}: ${err.message}`)
    }
    await sleep(SLEEP_BETWEEN)
  }

  console.log(`[OK] ${produtos.length} produtos scrapeados.\n`)

  // 3. Save
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(produtos, null, 2), 'utf-8')
  console.log(`[OK] → ${PRODUCTS_FILE}`)

  const cats = Array.from(allCategories.values())
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(cats, null, 2), 'utf-8')
  console.log(`[OK] → ${CATEGORIES_FILE}`)

  // 4. README
  const totalImgs = produtos.reduce((s, p) => s + p.images.length, 0)
  const readme = `# ${host} — FS Sport (Nuvemshop) scrape

Scraped on: ${new Date().toISOString()}
Source: ${STORE_URL}

## Stats

- **Produtos**: ${produtos.length}
- **Imagens**: ${totalImgs}
- **Categorias**: ${cats.length}

## Próximo passo

\`\`\`
cd ../Ecomm/lever-ecomm
npx medusa exec ./src/scripts/clear-products.ts
npx medusa exec ./src/scripts/import-products.ts "C:/Users/João Vithor/Documents/Projetos Lever/scraper/${host}/produtos.json"
\`\`\`
`
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf-8')

  console.log(`\n[FIM] ${produtos.length} produtos · ${totalImgs} imagens · ${cats.length} categorias.`)
})()
