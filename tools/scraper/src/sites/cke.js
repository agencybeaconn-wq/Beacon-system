// ============================================================
// SCRAPER Car Keys Express — API JSON (sem Playwright!)
//
//   node scraper_cke.js
//
// ============================================================

const fs = require('fs');

const STORE_URL = 'https://store.carkeysexpress.com';
const OUTPUT_FILE = 'cke_produtos.json';

const humanDelay = () => new Promise(r => setTimeout(r, Math.random() * 500 + 300));

async function getBuildId() {
  const res = await fetch(STORE_URL + '/keys-and-remotes');
  const html = await res.text();
  const match = html.match(/"buildId":"([^"]+)"/);
  if (!match) throw new Error('buildId não encontrado');
  return match[1];
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

(async () => {
  console.log('[INFO] Obtendo buildId...');
  const buildId = await getBuildId();
  console.log(`[OK] buildId: ${buildId}\n`);

  const apiBase = `${STORE_URL}/_next/data/${buildId}/keys-and-remotes`;

  // Carregar progresso
  let allProducts = [];
  const processedMakes = new Set();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      allProducts = saved.produtos || [];
      (saved.processedMakes || []).forEach(m => processedMakes.add(m));
      console.log(`[RESUME] ${allProducts.length} produtos, ${processedMakes.size} marcas já processadas.\n`);
    } catch {}
  }

  // 1. Buscar marcas
  const makesData = await fetchJSON(`${apiBase}.json`);
  const makes = makesData.pageProps?.makes || [];
  console.log(`[OK] ${makes.length} marcas.\n`);

  for (const make of makes) {
    const makeName = make.name;
    if (processedMakes.has(makeName)) {
      console.log(`[SKIP] ${makeName}`);
      continue;
    }

    console.log(`\n>> Marca: ${makeName}`);

    try {
      // 2. Buscar modelos
      const modelsData = await fetchJSON(`${apiBase}/${encodeURIComponent(makeName)}.json`);
      if (!modelsData) { console.log('   [ERRO] Sem resposta'); continue; }

      const models = (modelsData.pageProps?.models || []).filter(m => m.product_count > 0);
      console.log(`   ${models.length} modelos (com produtos)`);

      for (const model of models) {
        const modelName = model.name;

        try {
          // 3. Buscar anos
          const yearsData = await fetchJSON(`${apiBase}/${encodeURIComponent(makeName)}/${encodeURIComponent(modelName)}.json`);
          if (!yearsData) continue;

          const years = (yearsData.pageProps?.years || []).filter(y => y.product_count > 0);

          for (const yearObj of years) {
            const year = yearObj.year;

            try {
              // 4. Buscar produtos
              const prodData = await fetchJSON(
                `${apiBase}/${encodeURIComponent(makeName)}/${encodeURIComponent(modelName)}/${year}.json`
              );
              if (!prodData) continue;

              const productList = prodData.pageProps?.productList || {};
              const products = productList.items || productList || [];
              const vehicleData = prodData.pageProps?.vehicleData || yearObj;

              for (const prod of products) {
                allProducts.push({
                  // Veículo
                  marca: makeName,
                  modelo: modelName,
                  ano: year,
                  // Produto
                  id: prod.id,
                  titulo: prod.title || '',
                  titulo_curto: prod.short_title || '',
                  subtitulo: prod.sub_title || '',
                  sku: prod.sku || '',
                  tipo: prod.type || '',
                  marca_produto: prod.brand || '',
                  // Preços
                  preco: prod.price,
                  preco_canada: prod.price_canada,
                  preco_pop: prod.price_pop,
                  // Fotos
                  fotos: prod.photo_urls || [],
                  thumbnails: prod.thumbnail_photo_urls || [],
                  foto_360: prod['360_photo'] || '',
                  // Specs
                  botoes: prod.button_count,
                  features: prod.features || [],
                  part_numbers: prod.part_numbers || [],
                  requer_corte: prod.requires_cutting,
                  requer_programacao: prod.requires_programming,
                  transponder_id: prod.transponder_id,
                  blade_id: prod.blade_id,
                  battery_id: prod.battery_id,
                  keyway_type: prod.keyway_type,
                  // Info
                  descricao: prod.description || '',
                  avisos: prod.warnings || [],
                  servico_corte: prod.cutting_service || null,
                  consumer_sellable: prod.consumer_sellable,
                  dispatch_exclusive: prod.dispatch_exclusive,
                  // Veículo info
                  veiculo_descricao: vehicleData.description || '',
                  max_chaves: vehicleData.key_max,
                  max_remotes: vehicleData.remote_max,
                  max_prox: vehicleData.prox_max,
                  pin_required: vehicleData.pin_required,
                });
              }

              if (products.length > 0) {
                console.log(`     ${modelName} ${year} → ${products.length}`);
              }

            } catch { continue; }
            await humanDelay();
          }
        } catch (err) {
          console.error(`   [ERRO] ${modelName}: ${err.message.substring(0, 60)}`);
          continue;
        }
      }

      processedMakes.add(makeName);
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
        processedMakes: [...processedMakes],
        totalProdutos: allProducts.length,
        produtos: allProducts,
      }, null, 2), 'utf-8');
      console.log(`   [SAVE] ${processedMakes.size} marcas, ${allProducts.length} produtos`);

    } catch (err) {
      console.error(`[ERRO] ${makeName}: ${err.message}`);
    }
  }

  console.log(`\n[FIM] ${allProducts.length} produtos de ${processedMakes.size} marcas.`);
})();
