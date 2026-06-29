// STEP 4b — Smoke test v2 (corrige inspeção da PDP)
// Markup real do picker:
//   <input type="radio" id="kit-tam-masc-3GG-..." name="kit-tam-masc-ui" value="3GG" ... [disabled]>
//   <label for="kit-tam-masc-3GG-..." [class="is-soldout"]>3GG<span class="kit-extra-price">+R$ 20</span></label>

import https from 'https';

const PDP_URL = 'https://mantosdoph.com.br/products/kit-casal-camisa-brasil-home-26-27-nike-torcedor?cb=' + Date.now();

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Lever Smoke Test)',
        'Accept': 'text/html',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : `https://${u.hostname}${res.headers.location}`;
        resolve(fetchUrl(next));
        return;
      }
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const t0 = Date.now();
  const pdp = await fetchUrl(PDP_URL);
  console.log(`PDP HTTP ${pdp.status} (${pdp.body.length} bytes)\n`);
  if (pdp.status !== 200) {
    console.error('FAIL — PDP não 200');
    process.exit(2);
  }
  const html = pdp.body;

  // Markers core
  const markers = [
    'data-kit-section',
    'data-kit-mode',
    'Tamanho Masculino',
    'Tamanho Feminino',
    'Personalizar camisa masculina',
    'Personalizar camisa feminina',
    'kit-tam-masc-ui',
    'kit-tam-fem-ui',
  ];
  console.log(`Markers:`);
  let markersOk = true;
  for (const m of markers) {
    const has = html.includes(m);
    if (!has) markersOk = false;
    console.log(`  ${has ? '✓' : '✗'} ${m}`);
  }

  // Inspeciona cada size masc/fem buscando o input radio dele
  // <input type="radio" id="..." name="kit-tam-masc-ui" value="3GG" ... [disabled]>
  function inspect(side, size) {
    // Procura o input radio dele
    const re = new RegExp(`<input[^>]+name=["']kit-tam-${side}-ui["'][^>]+value=["']${size}["'][^>]*>`, 'i');
    const inputMatch = html.match(re);
    if (!inputMatch) return { found: false };
    const tag = inputMatch[0];
    const isDisabled = /\bdisabled\b/.test(tag);
    const hasClassDisabled = /class=["']disabled["']/.test(tag);

    // Procura o label correspondente -> o id do input é único, parecido com kit-tam-masc-3GG-...
    const idMatch = tag.match(/\bid=["']([^"']+)["']/);
    let labelClassSoldout = null;
    if (idMatch) {
      const labelRe = new RegExp(`<label[^>]+for=["']${idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
      const labelMatch = html.match(labelRe);
      if (labelMatch) {
        labelClassSoldout = /class=["'][^"']*is-soldout/.test(labelMatch[0]);
      }
    }
    return {
      found: true,
      tag: tag.slice(0, 220),
      isDisabled,
      hasClassDisabled,
      labelClassSoldout,
    };
  }

  const sizesToTest = ['P', 'M', 'G', 'GG', '2GG', '3GG', '4GG'];
  console.log(`\nMasc:`);
  const mascResults = {};
  for (const s of sizesToTest) {
    const r = inspect('masc', s);
    mascResults[s] = r;
    console.log(`  ${s.padEnd(4)} found=${r.found}  disabled=${r.isDisabled}  classDisabled=${r.hasClassDisabled}  labelSoldout=${r.labelClassSoldout}`);
  }
  console.log(`\nFem:`);
  const femResults = {};
  for (const s of sizesToTest) {
    const r = inspect('fem', s);
    femResults[s] = r;
    console.log(`  ${s.padEnd(4)} found=${r.found}  disabled=${r.isDisabled}  classDisabled=${r.hasClassDisabled}  labelSoldout=${r.labelClassSoldout}`);
  }

  // Critério: masc 3GG/4GG NÃO devem estar disabled nem ter label soldout
  const m3 = mascResults['3GG'];
  const m4 = mascResults['4GG'];
  const f3 = femResults['3GG'];
  const f4 = femResults['4GG'];

  const mascUnlocked =
    m3.found && !m3.isDisabled && !m3.labelClassSoldout &&
    m4.found && !m4.isDisabled && !m4.labelClassSoldout;

  const femStillLocked =
    f3.found && (f3.isDisabled || f3.labelClassSoldout) &&
    f4.found && (f4.isDisabled || f4.labelClassSoldout);

  console.log(`\n=== CRITÉRIOS ===`);
  console.log(`Markers core: ${markersOk ? 'OK' : 'FAIL'}`);
  console.log(`Masc 3GG/4GG DESBLOQUEADOS: ${mascUnlocked ? 'OK' : 'FAIL'}`);
  console.log(`Fem 3GG/4GG ainda bloqueados: ${femStillLocked ? 'OK' : 'FAIL'}`);
  const allOk = markersOk && mascUnlocked && femStillLocked;

  console.log(`\nTempo: ${Date.now() - t0}ms`);
  console.log(`\n=== RESULTADO FINAL: ${allOk ? 'PASS' : 'FAIL'} ===`);
  if (!allOk) process.exit(1);
})();
