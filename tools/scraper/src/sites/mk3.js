// ============================================================
// SCRAPER MK3.COM — Car Remotes (conecta no Chrome com debug remoto)
//
//   1. Abra o Chrome com:
//      "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\João Vithor\chrome-debug" https://www.mk3.com/en/car-remotes
//   2. Resolva o captcha manualmente
//   3. Rode: node scraper_mk3.js
//
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');

const TARGET_URL = 'https://www.mk3.com/en/car-remotes';
const OUTPUT_FILE = 'mk3_car_remotes.json';
const TIMEOUT_MS = 20_000;

const humanDelay = () => new Promise(r => setTimeout(r, Math.random() * 2000 + 1500));

async function extractProducts(page) {
  return page.evaluate(() => {
    const cards = document.querySelectorAll('.item-box .product-item, .item-box article, .product-grid .item-box');
    return Array.from(cards).map(card => {
      const img = card.querySelector('.picture img');
      let imageUrl = img?.src || img?.getAttribute('data-src') || img?.getAttribute('data-lazyloadsrc') || '';
      if (img?.srcset) {
        const srcsetParts = img.srcset.split(',').map(s => s.trim());
        const last = srcsetParts[srcsetParts.length - 1];
        if (last) imageUrl = last.split(' ')[0];
      }

      return {
        productId: card.getAttribute('data-productid') || '',
        nome: card.querySelector('.product-title a')?.textContent.trim() || '',
        url: card.querySelector('.product-title a')?.href || '',
        preco: card.querySelector('.prices .actual-price')?.textContent.trim() || '',
        precoAntigo: card.querySelector('.prices .old-price')?.textContent.trim() || '',
        imagem: imageUrl,
        imagemAlt: img?.alt || '',
        descricao: card.querySelector('.description')?.textContent.trim() || '',
        rating: card.querySelector('.rating div')?.style?.width || '',
        estoque: card.querySelector('.stock')?.textContent.trim() ||
                 card.querySelector('.availability')?.textContent.trim() || '',
        bestSeller: !!card.querySelector('.best-seller, .bestseller, [class*="best"], .ribbon, .label'),
      };
    });
  });
}

async function getTotalPages(page) {
  return page.evaluate(() => {
    const pagerLinks = document.querySelectorAll('.pager a[data-page], .pager li a');
    if (pagerLinks.length === 0) return 1;
    let max = 1;
    pagerLinks.forEach(a => {
      const num = parseInt(a.getAttribute('data-page') || a.textContent.trim());
      if (!isNaN(num) && num > max) max = num;
    });
    return max;
  });
}

(async () => {
  // Conectar no Chrome já aberto (com Cloudflare resolvido)
  console.log('[INFO] Conectando ao Chrome na porta 9222...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  const pages = context.pages();
  let page = pages.find(p => p.url().includes('mk3.com')) || pages[0];

  if (!page) {
    console.error('[ERRO] Nenhuma aba do MK3 encontrada. Abra o site no Chrome primeiro.');
    process.exit(1);
  }

  console.log(`[OK] Conectado! Aba: ${page.url()}\n`);
  page.setDefaultTimeout(TIMEOUT_MS);

  // Carregar progresso anterior
  let allProducts = [];
  let startPage = 1;
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      allProducts = saved.produtos || [];
      startPage = (saved.ultimaPagina || 0) + 1;
      console.log(`[RESUME] ${allProducts.length} produtos já extraídos. Retomando da página ${startPage}.`);
    } catch {}
  }

  try {
    // Navegar pra primeira página
    if (!page.url().includes('car-remotes')) {
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForSelector('.item-box, .product-item', { timeout: 30000 });
    await page.waitForTimeout(3000);

    const totalPages = await getTotalPages(page);
    console.log(`[INFO] Total de páginas: ${totalPages}\n`);

    // Se resumindo, navegar até a página correta clicando
    if (startPage > 1) {
      console.log(`[RESUME] Navegando até página ${startPage}...`);
      for (let skip = 2; skip <= startPage; skip++) {
        const nextBtn = await page.$('.pager .next-page a, .pager a.next-page');
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    }

    for (let pg = startPage; pg <= totalPages; pg++) {
      console.log(`>> Página ${pg}/${totalPages}`);

      try {
        await page.waitForSelector('.item-box, .product-item', { timeout: TIMEOUT_MS });
        await page.waitForTimeout(2000);

        // Scroll pra carregar lazy images
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        // Pegar o primeiro productId pra verificar se a página realmente mudou
        const firstId = await page.$eval('.item-box .product-item, .item-box article',
          el => el.getAttribute('data-productid')).catch(() => '');

        const products = await extractProducts(page);

        // Deduplicar contra o que já temos
        const existingIds = new Set(allProducts.map(p => p.productId));
        const newProducts = products.filter(p => p.productId && !existingIds.has(p.productId));
        allProducts.push(...newProducts);

        console.log(`   ${newProducts.length} novos (${products.length} na página, total único: ${allProducts.length})`);

        // Salvamento progressivo
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
          ultimaPagina: pg,
          totalPaginas: totalPages,
          produtos: allProducts,
        }, null, 2), 'utf-8');

        // Clicar no botão "próxima página" via AJAX nativo do site
        if (pg < totalPages) {
          const nextBtn = await page.$('.pager .next-page a, .pager a.next-page, .pager a[data-page="' + (pg + 1) + '"]');
          if (nextBtn) {
            await nextBtn.click();
            // Esperar o conteúdo AJAX atualizar (novo primeiro produto)
            await page.waitForTimeout(2000);
            try {
              await page.waitForFunction(
                (oldId) => {
                  const el = document.querySelector('.item-box .product-item, .item-box article');
                  return el && el.getAttribute('data-productid') !== oldId;
                },
                firstId,
                { timeout: 10000 }
              );
            } catch {
              // Se não mudou, esperar mais um pouco
              await page.waitForTimeout(3000);
            }
          } else {
            console.log('   [WARN] Botão próxima página não encontrado');
            break;
          }
        }

        await humanDelay();

      } catch (err) {
        console.error(`   [ERRO] Página ${pg}: ${err.message}`);
        continue;
      }
    }

    console.log(`\n[FIM] ${allProducts.length} produtos únicos extraídos de ${totalPages} páginas.`);
    console.log(`Salvo em ${OUTPUT_FILE}`);

  } catch (err) {
    console.error(`[FATAL] ${err.message}`);
  }

  // NÃO fecha o browser (é o Chrome do usuário)
  browser.disconnect();
})();
