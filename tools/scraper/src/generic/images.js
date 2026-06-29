// ============================================================
// DOWNLOAD IMAGES — baixa todas as imagens do produtos.json
// pra storefront/public/images/products/, contornando o
// bloqueio de hotlink do CDN Nuvemshop via cookie de sessão.
//
// Depois, reescreve produtos.json pra apontar pros paths locais.
//
//   node download_images.js [caminho/produtos.json]
//
// Idempotente: pula arquivos que já existem com tamanho > 0.
// ============================================================

const fs = require('fs')
const path = require('path')

const INPUT = process.argv[2]
  || path.join(__dirname, 'fssport-com-br', 'produtos.json')

// Destino: public/ do storefront da Lever
const OUTPUT_DIR = path.resolve(
  __dirname,
  '..',
  'Ecomm',
  'lever-ecomm-storefront',
  'public',
  'images',
  'products'
)
// Prefixo das URLs públicas servidas pelo Next
const URL_PREFIX = '/images/products'

// Loja-fonte pra pegar cookie Cloudflare (__cf_bm)
const COOKIE_SOURCE_URL = 'https://www.fssport.com.br/'
// __cf_bm vive até 30 min mas o Cloudflare pode invalidar antes por bot-score;
// renovar agressivo e também toda vez que um download falhar com 403/401.
const COOKIE_REFRESH_EVERY_MS = 5 * 60 * 1000
// Também renova quando acumular esse número de falhas seguidas
const FAILURES_BEFORE_REFRESH = 3

// Paralelismo e retry — conservador pra não ser bloqueado pelo bot-management
const CONCURRENCY = 3
const MAX_RETRIES = 5
const SLEEP_RETRY = 2000
const DELAY_BETWEEN_REQUESTS_MS = 150

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let sessionCookie = ''
let sessionExpires = 0
let consecutiveFailures = 0
let refreshInFlight = null

async function refreshCookie() {
  // Dedup: se já tem um refresh rodando, aguarda ele
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await fetch(COOKIE_SOURCE_URL, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
      })
      const set = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/)
      const cookies = set
        .map((c) => c.split(';')[0].trim())
        .filter(Boolean)
        .join('; ')
      sessionCookie = cookies
      sessionExpires = Date.now() + COOKIE_REFRESH_EVERY_MS
      consecutiveFailures = 0
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function ensureCookie() {
  if (!sessionCookie || Date.now() > sessionExpires) {
    await refreshCookie()
  }
}

function extFromUrl(url) {
  const m = url.match(/\.(webp|jpg|jpeg|png|gif|avif)(?:\?|$)/i)
  return m ? m[1].toLowerCase() : 'jpg'
}

function localFilenameFor(handle, index, url) {
  const ext = extFromUrl(url)
  // handle já é slug seguro. index de 0..N. Sufixo evita colisão de produtos com mesma imagem.
  return `${handle}-${index}.${ext}`
}

async function downloadOne(url, destPath) {
  let lastErr
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await ensureCookie()
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept': 'image/webp,image/avif,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Referer': COOKIE_SOURCE_URL,
          'Cookie': sessionCookie,
        },
      })
      if (res.status === 403 || res.status === 401 || res.status === 429) {
        consecutiveFailures++
        // força refresh se acumulou falhas OU na primeira 403
        if (consecutiveFailures >= FAILURES_BEFORE_REFRESH || attempt === 0) {
          sessionExpires = 0
          await refreshCookie()
        }
        throw new Error(`HTTP ${res.status}`)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 100) throw new Error(`body muito pequeno (${buf.length}b)`)
      fs.writeFileSync(destPath, buf)
      consecutiveFailures = 0
      if (DELAY_BETWEEN_REQUESTS_MS > 0) await sleep(DELAY_BETWEEN_REQUESTS_MS)
      return buf.length
    } catch (err) {
      lastErr = err
      if (attempt === MAX_RETRIES) throw err
      // backoff exponencial, maior em status de rate-limit
      await sleep(SLEEP_RETRY * Math.pow(1.8, attempt))
    }
  }
  throw lastErr || new Error('unreachable')
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
      if (onProgress && done % 25 === 0) onProgress(done, total)
    }
  }

  const workers = Array.from({ length: concurrency }, worker)
  await Promise.all(workers)
  if (onProgress) onProgress(done, total)
  return results
}

;(async () => {
  console.log('[download] Lendo:', INPUT)
  if (!fs.existsSync(INPUT)) {
    console.error('[download] Arquivo não encontrado.')
    process.exit(1)
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const produtos = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
  console.log(`[download] ${produtos.length} produtos. Destino: ${OUTPUT_DIR}`)

  console.log('[download] Obtendo cookie Cloudflare...')
  await refreshCookie()
  if (!sessionCookie) {
    console.error('[download] Não consegui cookie. Abortando.')
    process.exit(1)
  }
  console.log(`[download] Cookie ok (${sessionCookie.length} chars).`)

  // Monta tarefas
  const tasks = []
  const mapping = [] // [{pIdx, imgIdx, url, localUrl, destPath}]
  for (let pIdx = 0; pIdx < produtos.length; pIdx++) {
    const p = produtos[pIdx]
    if (!p.handle || !Array.isArray(p.images)) continue
    for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
      const img = p.images[imgIdx]
      const url = img && img.src
      if (!url || !/^https?:\/\//.test(url)) continue
      // Skip se já aponta pro nosso storage
      if (url.startsWith(URL_PREFIX)) continue
      const filename = localFilenameFor(p.handle, imgIdx, url)
      const destPath = path.join(OUTPUT_DIR, filename)
      const localUrl = `${URL_PREFIX}/${filename}`
      mapping.push({ pIdx, imgIdx, url, localUrl, destPath })
      tasks.push(async () => {
        // Idempotente
        try {
          const st = fs.statSync(destPath)
          if (st.size > 100) return { skipped: true, bytes: st.size }
        } catch {}
        const bytes = await downloadOne(url, destPath)
        return { downloaded: true, bytes }
      })
    }
  }

  console.log(`[download] ${tasks.length} imagens na fila (paralelismo: ${CONCURRENCY}).`)
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
      // mantém URL original (ou poderia remover) — deixa pro import filtrar
      continue
    }
    if (r && r.skipped) skipCount++
    else okCount++

    const p = produtos[m.pIdx]
    const img = p.images[m.imgIdx]
    img.src = m.localUrl
    if (img.thumbnail) img.thumbnail = m.localUrl
  }

  // Remove imagens que falharam (URL externa que não vai funcionar)
  for (const p of produtos) {
    if (Array.isArray(p.images)) {
      p.images = p.images.filter(
        (img) => img && typeof img.src === 'string' && img.src.startsWith(URL_PREFIX)
      )
    }
  }

  fs.writeFileSync(INPUT, JSON.stringify(produtos, null, 2), 'utf-8')

  console.log('')
  console.log('[download] FIM.')
  console.log(`  baixadas: ${okCount}`)
  console.log(`  puladas (já existiam): ${skipCount}`)
  console.log(`  falharam: ${errCount}`)
  console.log(`  produtos.json atualizado com URLs locais.`)
})().catch((err) => {
  console.error('[download] ERRO FATAL:', err.message || err)
  process.exit(1)
})
