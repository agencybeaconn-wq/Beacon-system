// ============================================================
// DOWNLOAD IMAGES (Playwright) — baixa imagens via Chromium real
// pra contornar o bot-management da Cloudflare do Nuvemshop.
//
// Estratégia:
//   1. Abre Chromium, navega em fssport.com.br pra estabelecer sessão
//      (cookies, challenge JS da Cloudflare se houver)
//   2. Usa context.request.get() pra cada imagem — compartilha cookies
//      do browser, TLS fingerprint real
//   3. Idempotente: pula arquivos que já existem
//   4. Reescreve produtos.json pra apontar pros paths locais
//
//   node download_images_playwright.js [caminho/produtos.json]
// ============================================================

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const INPUT = process.argv[2]
  || path.join(__dirname, 'fssport-com-br', 'produtos.json')

const OUTPUT_DIR = path.resolve(
  __dirname,
  '..',
  'Ecomm',
  'lever-ecomm-storefront',
  'public',
  'images',
  'products'
)
const URL_PREFIX = '/images/products'
const COOKIE_SOURCE_URL = 'https://www.fssport.com.br/'

// Concorrência alta é possível porque o browser já fez o handshake Cloudflare
const CONCURRENCY = 10
const MAX_RETRIES = 3
const SLEEP_RETRY = 1500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function extFromUrl(url) {
  const m = url.match(/\.(webp|jpg|jpeg|png|gif|avif)(?:\?|$)/i)
  return m ? m[1].toLowerCase() : 'jpg'
}

function localFilenameFor(handle, index, url) {
  const ext = extFromUrl(url)
  return `${handle}-${index}.${ext}`
}

async function runQueue(tasks, concurrency, onProgress) {
  let next = 0
  let done = 0
  const total = tasks.length
  const results = new Array(total)

  async function worker() {
    while (next < total) {
      const i = next++
      try {
        results[i] = await tasks[i]()
      } catch (err) {
        results[i] = { error: err.message || String(err) }
      }
      done++
      if (onProgress && done % 50 === 0) onProgress(done, total)
    }
  }

  const workers = Array.from({ length: concurrency }, worker)
  await Promise.all(workers)
  if (onProgress) onProgress(done, total)
  return results
}

;(async () => {
  console.log('[pw] Lendo:', INPUT)
  if (!fs.existsSync(INPUT)) {
    console.error('[pw] Arquivo não encontrado.')
    process.exit(1)
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const produtos = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
  console.log(`[pw] ${produtos.length} produtos. Destino: ${OUTPUT_DIR}`)

  console.log('[pw] Lançando Chromium...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  })

  // Navegar pra página real da loja pra estabelecer cookies + passar challenge CF
  console.log('[pw] Navegando na loja pra estabelecer sessão...')
  const page = await context.newPage()
  await page.goto(COOKIE_SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
  // Dá tempo pro JS da Cloudflare rodar
  await sleep(3000)
  const cookies = await context.cookies()
  const cfCookie = cookies.find((c) => c.name === '__cf_bm')
  console.log(
    `[pw] Sessão OK. ${cookies.length} cookies. __cf_bm: ${cfCookie ? 'presente' : 'AUSENTE'}`
  )
  await page.close()

  // Monta tarefas
  const mapping = []
  const tasks = []
  for (let pIdx = 0; pIdx < produtos.length; pIdx++) {
    const p = produtos[pIdx]
    if (!p.handle || !Array.isArray(p.images)) continue
    for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
      const img = p.images[imgIdx]
      const url = img && img.src
      if (!url || !/^https?:\/\//.test(url)) continue
      if (url.startsWith(URL_PREFIX)) continue
      const filename = localFilenameFor(p.handle, imgIdx, url)
      const destPath = path.join(OUTPUT_DIR, filename)
      const localUrl = `${URL_PREFIX}/${filename}`
      mapping.push({ pIdx, imgIdx, url, localUrl, destPath })

      tasks.push(async () => {
        // Idempotente: pula se já existe com tamanho razoável
        try {
          const st = fs.statSync(destPath)
          if (st.size > 100) return { skipped: true, bytes: st.size }
        } catch {}

        let lastErr
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const res = await context.request.get(url, {
              headers: {
                Referer: COOKIE_SOURCE_URL,
                Accept: 'image/webp,image/avif,image/apng,image/*,*/*;q=0.8',
              },
              timeout: 30000,
            })
            const status = res.status()
            if (status === 403 || status === 401 || status === 429) {
              // Re-navega pra revalidar a sessão, só faz isso uma vez
              if (attempt === 0) {
                try {
                  const p2 = await context.newPage()
                  await p2.goto(COOKIE_SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
                  await sleep(1500)
                  await p2.close()
                } catch {}
              }
              throw new Error(`HTTP ${status}`)
            }
            if (!res.ok()) throw new Error(`HTTP ${status}`)
            const body = await res.body()
            if (body.length < 100) throw new Error(`body muito pequeno (${body.length}b)`)
            fs.writeFileSync(destPath, body)
            return { downloaded: true, bytes: body.length }
          } catch (err) {
            lastErr = err
            if (attempt === MAX_RETRIES) throw err
            await sleep(SLEEP_RETRY * Math.pow(1.5, attempt))
          }
        }
        throw lastErr
      })
    }
  }

  console.log(`[pw] ${tasks.length} imagens na fila (paralelismo: ${CONCURRENCY}).`)
  const results = await runQueue(tasks, CONCURRENCY, (done, total) => {
    console.log(`  ${done}/${total} processadas`)
  })

  // Relatório + atualização do produtos.json
  let okCount = 0
  let skipCount = 0
  let errCount = 0
  for (let i = 0; i < mapping.length; i++) {
    const m = mapping[i]
    const r = results[i]
    if (r && r.error) {
      errCount++
      continue
    }
    if (r && r.skipped) skipCount++
    else okCount++

    const p = produtos[m.pIdx]
    const img = p.images[m.imgIdx]
    img.src = m.localUrl
    if (img.thumbnail) img.thumbnail = m.localUrl
  }

  // Remove imagens que falharam
  for (const p of produtos) {
    if (Array.isArray(p.images)) {
      p.images = p.images.filter(
        (img) => img && typeof img.src === 'string' && img.src.startsWith(URL_PREFIX)
      )
    }
  }

  fs.writeFileSync(INPUT, JSON.stringify(produtos, null, 2), 'utf-8')

  console.log('')
  console.log('[pw] FIM.')
  console.log(`  baixadas: ${okCount}`)
  console.log(`  puladas (já existiam): ${skipCount}`)
  console.log(`  falharam: ${errCount}`)
  console.log(`  produtos.json atualizado.`)

  await context.close()
  await browser.close()
})().catch(async (err) => {
  console.error('[pw] ERRO FATAL:', err.message || err)
  process.exit(1)
})
