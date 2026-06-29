// ============================================================
// SETUP — Execute no terminal antes de rodar o script:
//
//   npm init -y
//   npm install playwright
//   npx playwright install chromium
//   node scraper.js
//
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');

// ---------- CONFIGURAÇÃO ----------
const TARGET_URL = 'https://www.timpson.co.uk/autokeysonline/autokeys/findkey';
const API_URL = 'https://www.timpson.co.uk/autokeysonline/index/ReturnCarData';

const SELECTORS = {
  makeDropdown: '#autokeysMake',
  modelDropdown: '#autokeysModel',
  yearDropdown: '#autokeysYear',
  findCarBtn: '.ak-dropdown__form .ak-btn',
  resultContainer: '.ak-key',
  keyName: '.ak-key__type',
  keyPrice: '.ak-key__price',
  keyDescription: '.ak-key__description',
};

const OUTPUT_FILE = 'catalogo_raw.json';
const TIMEOUT_MS = 20_000;

// ---------- UTILITÁRIOS ----------
const humanDelay = () => new Promise(r => setTimeout(r, Math.random() * 1500 + 1000));

// Chama a API ReturnCarData diretamente do contexto da página (usa cookies do Cloudflare)
async function callAPI(page, payload) {
  return page.evaluate(async ({ url, body }) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }, { url: API_URL, body: payload });
}

// ---------- SCRIPT PRINCIPAL ----------
(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);

  // Carregar catálogo parcial se existir (retomar de crash)
  let catalogo = [];
  const processedMakes = new Set();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      catalogo = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      catalogo.forEach(m => processedMakes.add(m.marca));
      console.log(`[RESUME] ${catalogo.length} marca(s) já processadas. Retomando...`);
    } catch { /* arquivo corrompido, começar do zero */ }
  }

  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Aguardar Cloudflare resolver + dropdown de marcas carregar (sinal de que a página real carregou)
    await page.waitForSelector(SELECTORS.makeDropdown, { timeout: 60000 });
    await page.waitForFunction(
      sel => document.querySelector(sel)?.options.length > 2,
      SELECTORS.makeDropdown,
      { timeout: 60000 }
    );
    console.log('[OK] Página carregada (Cloudflare OK).');

    // Obter marcas direto do DOM (já populado pela própria página)
    const makes = await page.$$eval(`${SELECTORS.makeDropdown} option`, opts =>
      opts.filter(o => o.value && o.value !== '').map(o => o.value)
    );
    // Remover "Loading..." que tem value vazio — já filtrado acima
    console.log(`[INFO] ${makes.length} marcas encontradas.\n`);

    // Helper: garantir que estamos na página findkey com dropdowns carregados
    async function ensureFindkeyPage() {
      if (!page.url().includes('findkey')) {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
      await page.waitForSelector(SELECTORS.makeDropdown, { timeout: 30000 });
      await page.waitForFunction(
        sel => document.querySelector(sel)?.options.length > 2,
        SELECTORS.makeDropdown,
        { timeout: 30000 }
      );
    }

    for (const make of makes) {
      if (processedMakes.has(make)) {
        console.log(`[SKIP] ${make} (já processada)`);
        continue;
      }

      const marcaEntry = { marca: make, modelos: [] };
      console.log(`\n>> Marca: ${make}`);

      try {
        // Garantir página e selecionar marca
        await ensureFindkeyPage();
        await page.selectOption(SELECTORS.makeDropdown, make);
        await humanDelay();

        // Esperar modelos carregarem
        await page.waitForFunction(
          sel => {
            const dd = document.querySelector(sel);
            return dd && dd.options.length > 2;
          },
          SELECTORS.modelDropdown,
          { timeout: TIMEOUT_MS }
        );

        const models = await page.$$eval(`${SELECTORS.modelDropdown} option`, opts =>
          opts.filter(o => o.value && o.value !== '').map(o => o.value)
        );
        console.log(`   ${models.length} modelos.`);

        for (const model of models) {
          const modeloEntry = { modelo: model, anos: [] };

          try {
            // Garantir página, selecionar marca e modelo para obter lista de anos
            await ensureFindkeyPage();
            await page.selectOption(SELECTORS.makeDropdown, make);
            await humanDelay();
            await page.waitForFunction(
              sel => document.querySelector(sel)?.options.length > 2,
              SELECTORS.modelDropdown,
              { timeout: TIMEOUT_MS }
            );
            await page.selectOption(SELECTORS.modelDropdown, model);
            await humanDelay();
            await page.waitForFunction(
              sel => document.querySelector(sel)?.options.length > 2,
              SELECTORS.yearDropdown,
              { timeout: TIMEOUT_MS }
            );

            const years = await page.$$eval(`${SELECTORS.yearDropdown} option`, opts =>
              opts.filter(o => o.value && o.value !== '').map(o => o.value)
            );

            for (const year of years) {
              try {
                // SEMPRE re-selecionar make/model antes de cada ano
                // (dropdowns resetam ao voltar de keyfound)
                await ensureFindkeyPage();
                await page.selectOption(SELECTORS.makeDropdown, make);
                await humanDelay();
                await page.waitForFunction(
                  sel => document.querySelector(sel)?.options.length > 2,
                  SELECTORS.modelDropdown,
                  { timeout: TIMEOUT_MS }
                );
                await page.selectOption(SELECTORS.modelDropdown, model);
                await humanDelay();
                await page.waitForFunction(
                  sel => document.querySelector(sel)?.options.length > 2,
                  SELECTORS.yearDropdown,
                  { timeout: TIMEOUT_MS }
                );

                // Selecionar ano e submeter
                await page.selectOption(SELECTORS.yearDropdown, year);
                await humanDelay();
                await page.click(SELECTORS.findCarBtn);

                // Aguardar navegação para página de resultados
                await page.waitForURL('**/keyfound**', { timeout: TIMEOUT_MS });
                await page.waitForSelector('.ak-keys-container', { timeout: TIMEOUT_MS });

                // Extrair chaves
                const keys = await page.$$eval(SELECTORS.resultContainer, (els) =>
                  els.map(el => ({
                    tipo: el.querySelector('.ak-key__type')?.textContent.trim() ?? '',
                    descricao: el.querySelector('.ak-key__description')?.textContent.trim() ?? '',
                    preco: el.querySelector('.ak-key__price')?.textContent.trim() ?? '',
                    keyId: el.querySelector('a[data-keyid]')?.getAttribute('data-keyid') ?? '',
                    categoria: el.querySelector('a[data-name]')?.getAttribute('data-name') ?? '',
                  }))
                );

                const validKeys = keys.filter(k => k.preco);
                modeloEntry.anos.push({ ano: year, chaves: validKeys });
                console.log(`     ${year} → ${validKeys.length} chave(s)`);

                // (ensureFindkeyPage no próximo loop cuidará da navegação)
              } catch (err) {
                console.error(`     [ERRO] Ano ${year}: ${err.message}`);
                // Tentar voltar à página de busca para continuar
                try {
                  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
                  await ensureFindkeyPage();
                } catch {}
                continue;
              }
            }
          } catch (err) {
            console.error(`   [ERRO] Modelo ${model}: ${err.message}`);
            continue;
          }

          if (modeloEntry.anos.length > 0) {
            marcaEntry.modelos.push(modeloEntry);
          }
        }
      } catch (err) {
        console.error(`[ERRO] Marca ${make}: ${err.message}`);
      }

      catalogo.push(marcaEntry);

      // Salvamento progressivo após cada marca
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalogo, null, 2), 'utf-8');
      console.log(`[SAVE] ${catalogo.length} marca(s) salvas em ${OUTPUT_FILE}\n`);
    }
  } catch (err) {
    console.error(`[FATAL] ${err.message}`);
  } finally {
    await browser.close();
    console.log('\n[FIM] Browser encerrado.');
  }
})();
