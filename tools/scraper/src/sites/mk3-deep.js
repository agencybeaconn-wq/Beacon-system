// ============================================================
// SCRAPER MK3.COM — Deep Product Data (entra em cada produto)
//
//   1. Chrome debug já deve estar aberto na porta 9222
//   2. node scraper_mk3_deep.js
//
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');

const INPUT_FILE = 'mk3_car_remotes.json';
const OUTPUT_FILE = 'mk3_deep.json';
const TIMEOUT_MS = 15_000;

const humanDelay = () => new Promise(r => setTimeout(r, Math.random() * 1500 + 800));

async function extractProductDetail(page) {
  return page.evaluate(() => {
    const txt = sel => document.querySelector(sel)?.textContent?.trim() || '';

    // Todas as imagens do produto
    const imagens = [];
    document.querySelectorAll('.picture img, .gallery img, .product-img img, .thumb-item img, [id*="thumb"] img').forEach(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazyloadsrc') || '';
      if (src && !imagens.includes(src)) {
        // Tentar pegar versão grande
        const large = img.getAttribute('data-defaultsize') || img.getAttribute('data-zoom-image') || src;
        imagens.push({ src: large, alt: img.alt || '' });
      }
    });
    // Também pegar do slider/swiper
    document.querySelectorAll('.swiper-slide img, .slider img').forEach(img => {
      const src = img.src || img.getAttribute('data-src') || '';
      if (src && !imagens.some(i => i.src === src)) {
        imagens.push({ src, alt: img.alt || '' });
      }
    });

    // Preço e preço antigo
    const preco = txt('.product-price .actual-price') || txt('[class*="price-value"]') || txt('[itemprop="price"]');
    const precoAntigo = txt('.product-price .old-price') || '';

    // Price Breaks (desconto por quantidade)
    const priceBreaks = [];
    document.querySelectorAll('.price-break-row, table tr, [class*="price-break"] tr').forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        priceBreaks.push({
          quantidade: cells[0]?.textContent.trim(),
          preco: cells[1]?.textContent.trim(),
        });
      }
    });

    // Categoria, Fabricante, Disponibilidade, SKU
    const infoFields = {};
    document.querySelectorAll('.additional-details .value, .product-specs .value, .attr-value').forEach(el => {
      const label = el.previousElementSibling?.textContent?.trim() || el.parentElement?.querySelector('.label, .name')?.textContent?.trim() || '';
      if (label) infoFields[label.replace(':', '')] = el.textContent.trim();
    });
    // Alternativa: pegar do overview
    const overviewItems = document.querySelectorAll('.overview .value, .product-essential .value');
    overviewItems.forEach(el => {
      const label = el.previousElementSibling?.textContent?.trim()?.replace(':', '') || '';
      if (label && !infoFields[label]) infoFields[label] = el.textContent.trim();
    });

    // Specifications (tabela de specs)
    const specs = {};
    document.querySelectorAll('.product-specs-box tr, .data-table tr, table.spec tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const key = cells[0].textContent.trim();
        const val = cells[1].textContent.trim();
        if (key && val) specs[key] = val;
      }
    });

    // Models/Fitments (tabela de compatibilidade)
    const modelos = [];
    let modelTable = null;
    document.querySelectorAll('table').forEach(t => {
      const headers = t.querySelectorAll('th');
      headers.forEach(h => {
        if (h.textContent.includes('Brand') || h.textContent.includes('Model')) modelTable = t;
      });
    });
    if (modelTable) {
      const headers = Array.from(modelTable.querySelectorAll('th')).map(h => h.textContent.trim());
      modelTable.querySelectorAll('tbody tr, tr:not(:first-child)').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length >= 2) {
          const obj = {};
          cells.forEach((c, i) => {
            if (headers[i]) obj[headers[i]] = c.textContent.trim();
          });
          if (Object.keys(obj).length > 0) modelos.push(obj);
        }
      });
    }

    // Full Description
    const descEl = document.querySelector('.full-description, .product-description, [itemprop="description"]');
    const fullDescription = descEl?.textContent?.trim() || '';
    const fullDescriptionHTML = descEl?.innerHTML || '';

    // SKU
    const sku = txt('.sku .value') || txt('[itemprop="sku"]') || '';

    // Peso
    const weight = txt('.product-weight .value') || '';

    // Nome completo
    const nome = txt('.product-name h1') || txt('h1') || '';

    // Categoria
    const categoria = txt('.product-breadcrumb a:last-of-type') || txt('.breadcrumb a:last-of-type') || '';

    // Fabricante
    const fabricante = txt('.manufacturers .value a') || infoFields['Manufacturer'] || '';

    // Estoque
    const estoque = txt('.availability .value') || txt('.stock .value') || '';

    return {
      nome, sku, preco, precoAntigo, categoria, fabricante, estoque, weight,
      imagens, specs, modelos, priceBreaks,
      fullDescription, fullDescriptionHTML,
      infoFields,
    };
  });
}

(async () => {
  // Conectar no Chrome debug
  console.log('[INFO] Conectando ao Chrome na porta 9222...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('mk3.com')) || context.pages()[0];
  console.log(`[OK] Conectado!\n`);
  page.setDefaultTimeout(TIMEOUT_MS);

  // Carregar lista de URLs dos produtos
  const listData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const allUrls = listData.produtos.map(p => ({ productId: p.productId, url: p.url, nome: p.nome }));
  console.log(`[INFO] ${allUrls.length} produtos para processar.\n`);

  // Carregar progresso anterior
  let results = [];
  const processedIds = new Set();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      results.forEach(r => processedIds.add(r.productId));
      console.log(`[RESUME] ${results.length} produtos já processados. Retomando...\n`);
    } catch {}
  }

  let errors = 0;
  for (let i = 0; i < allUrls.length; i++) {
    const { productId, url, nome } = allUrls[i];

    if (processedIds.has(productId)) continue;

    const progress = `[${results.length + 1}/${allUrls.length}]`;
    process.stdout.write(`${progress} ${nome.substring(0, 60)}...`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.product-name, h1, .product-essential', { timeout: TIMEOUT_MS });
      await page.waitForTimeout(1500);

      // Scroll pra carregar lazy images
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      const data = await extractProductDetail(page);
      results.push({ productId, url, ...data });

      const specCount = Object.keys(data.specs).length;
      const imgCount = data.imagens.length;
      const modelCount = data.modelos.length;
      console.log(` OK (${specCount} specs, ${imgCount} imgs, ${modelCount} fitments)`);

      errors = 0; // reset consecutive errors

    } catch (err) {
      console.log(` ERRO: ${err.message.substring(0, 80)}`);
      errors++;
      results.push({ productId, url, nome, erro: err.message });

      // Se muitos erros seguidos, pode ser Cloudflare
      if (errors >= 5) {
        console.log('\n[WARN] 5 erros seguidos. Esperando 30s (pode ser Cloudflare)...');
        await page.waitForTimeout(30000);
        errors = 0;
      }
    }

    // Salvamento progressivo a cada 10 produtos
    if (results.length % 10 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
    }

    await humanDelay();
  }

  // Salvamento final
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n[FIM] ${results.length} produtos processados. Salvo em ${OUTPUT_FILE}`);
})();
