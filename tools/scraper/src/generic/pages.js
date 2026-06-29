// ============================================================
// SCRAPER DE PÁGINAS DE SERVIÇO — Timpson (Car/House Keys)
//
//   node scraper_pages.js
//
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');

const OUTPUT_FILE = 'servicos_raw.json';

const PAGES = [
  // CAR
  { url: 'https://www.timpson.co.uk/services/car-keys', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/audi', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/toyota', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/vauxhall', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/bmw', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/ford', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/volkswagen', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/mercedes', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/nissan', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/renault', categoria: 'CARRO' },
  { url: 'https://www.timpson.co.uk/services/car-keys/peugeot', categoria: 'CARRO' },
  // HOUSE
  { url: 'https://www.timpson.co.uk/services/key-cutting', categoria: 'CASA' },
  { url: 'https://www.timpson.co.uk/services/key-machines', categoria: 'CASA' },
  { url: 'https://www.timpson.co.uk/services/key-fobs', categoria: 'CASA' },
  { url: 'https://www.timpson.co.uk/services/services-garage-door-remotes', categoria: 'CASA' },
  { url: 'https://security.timpson.co.uk/', categoria: 'CASA' },
  { url: 'https://security.timpson.co.uk/locksmiths', categoria: 'CASA' },
  { url: 'https://security.timpson.co.uk/locksmiths/lock-change', categoria: 'CASA' },
  { url: 'https://security.timpson.co.uk/locksmiths/safe-opening', categoria: 'CASA' },
  { url: 'https://www.timpson.co.uk/business/security', categoria: 'CASA' },
  { url: 'https://www.timpson.co.uk/business/security/padlocks', categoria: 'CASA' },
  // AMBOS
  { url: 'https://www.timpson.co.uk/frequently-asked-key-questions', categoria: 'AMBOS' },
  { url: 'https://www.timpson.co.uk/keys-frequently-asked-questions', categoria: 'AMBOS' },
  { url: 'https://www.timpson.co.uk/services', categoria: 'AMBOS' },
];

const humanDelay = () => new Promise(r => setTimeout(r, Math.random() * 2000 + 1500));

async function extractPage(page) {
  return page.evaluate(() => {
    // Título
    const titulo = document.querySelector('h1')?.textContent.trim() ||
                   document.querySelector('title')?.textContent.trim() || '';

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

    // Conteúdo principal — pegar parágrafos, headers, listas
    const contentSelectors = [
      'main', '.page-content', '.content', '.cms-content',
      '.service-content', '#maincontent', 'article', '.container'
    ];

    let mainEl = null;
    for (const sel of contentSelectors) {
      mainEl = document.querySelector(sel);
      if (mainEl) break;
    }
    if (!mainEl) mainEl = document.body;

    // Extrair blocos de texto estruturados
    const blocos = [];
    const els = mainEl.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, .feature, .card, .block');
    els.forEach(el => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      if (text.length > 10 && text.length < 2000) {
        blocos.push({
          tag: el.tagName.toLowerCase(),
          texto: text,
        });
      }
    });

    // Imagens relevantes (não ícones)
    const imagens = [];
    const imgs = mainEl.querySelectorAll('img');
    imgs.forEach(img => {
      const src = img.src || img.dataset?.src || '';
      const alt = img.alt || '';
      const w = img.naturalWidth || img.width || 0;
      if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('svg') && w > 50) {
        imagens.push({ src, alt });
      }
    });

    // FAQs (accordion, details, etc)
    const faqs = [];
    const faqEls = document.querySelectorAll(
      '.faq, .accordion, details, [class*="faq"], [class*="question"], [class*="accordion"]'
    );
    faqEls.forEach(el => {
      const q = el.querySelector('summary, .question, h3, h4, button, [class*="title"]')?.textContent.trim() || '';
      const a = el.querySelector('.answer, .content, p, [class*="answer"], [class*="body"]')?.textContent.trim() || '';
      if (q) faqs.push({ pergunta: q, resposta: a });
    });

    // Links internos (sub-páginas)
    const links = [];
    const anchors = mainEl.querySelectorAll('a[href]');
    anchors.forEach(a => {
      const href = a.href;
      const text = a.textContent.trim();
      if (href.includes('timpson.co.uk') && text.length > 3 && text.length < 100) {
        links.push({ texto: text, url: href });
      }
    });

    // Preços
    const precos = [];
    const priceEls = mainEl.querySelectorAll('[class*="price"], [class*="cost"], .price');
    priceEls.forEach(el => {
      const text = el.textContent.trim();
      if (text.includes('£') || text.includes('from')) {
        precos.push(text);
      }
    });

    return { titulo, metaDesc, blocos, imagens, faqs, links, precos };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Carregar progresso anterior
  let resultados = [];
  const processedUrls = new Set();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      resultados = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      resultados.forEach(r => processedUrls.add(r.url));
      console.log(`[RESUME] ${resultados.length} página(s) já processadas.`);
    } catch {}
  }

  // Primeiro, passar pelo Cloudflare na página principal
  console.log('[INFO] Passando pelo Cloudflare...');
  try {
    await page.goto('https://www.timpson.co.uk/services', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    console.log('[OK] Cloudflare OK.\n');
  } catch (err) {
    console.log('[WARN] Cloudflare pode não ter resolvido:', err.message);
  }

  for (const entry of PAGES) {
    if (processedUrls.has(entry.url)) {
      console.log(`[SKIP] ${entry.url}`);
      continue;
    }

    console.log(`>> ${entry.categoria} | ${entry.url}`);

    try {
      await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // esperar JS renderizar
      await humanDelay();

      const dados = await extractPage(page);

      resultados.push({
        url: entry.url,
        categoria: entry.categoria,
        ...dados,
        scrapedAt: new Date().toISOString(),
      });

      console.log(`   ✓ "${dados.titulo}" — ${dados.blocos.length} blocos, ${dados.imagens.length} imgs, ${dados.faqs.length} FAQs`);

    } catch (err) {
      console.error(`   [ERRO] ${err.message}`);
      resultados.push({
        url: entry.url,
        categoria: entry.categoria,
        erro: err.message,
        scrapedAt: new Date().toISOString(),
      });
    }

    // Salvamento progressivo
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultados, null, 2), 'utf-8');
  }

  console.log(`\n[FIM] ${resultados.length} páginas processadas. Salvo em ${OUTPUT_FILE}`);
  await browser.close();
})();
