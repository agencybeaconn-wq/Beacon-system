// STEP 4 — Smoke test
// 1) re-query produto -> 140 variants
// 2) spot-check 3 variants:
//    3GG/P + Nenhum         = 339.90
//    4GG/2GG + Ambos        = 419.90
//    3GG/GG + Só Masculina  = 369.90
// 3) fetch PDP storefront -> confirmar 3GG/4GG masc NÃO riscado, fem CONTINUA riscado

import { getCreds, shopifyGraphQL } from '../../../../.claude/lib/shopify-api.mjs';
import https from 'https';

const MANTOS_UUID = '053f7258-95f4-4ca9-81ad-4032b18829ba';
const PRODUCT_GID = 'gid://shopify/Product/8248726585539';
const PDP_URL = 'https://mantosdoph.com.br/products/kit-casal-camisa-brasil-home-26-27-nike-torcedor';

const QUERY = `
  query($id: ID!) {
    product(id: $id) {
      title
      handle
      options { name values }
      variants(first: 250) {
        edges { node { id title price compareAtPrice selectedOptions { name value } } }
      }
    }
  }
`;

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
      // segue redirect simples
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : `https://${u.hostname}${res.headers.location}`;
        resolve(fetchUrl(next));
        return;
      }
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const t0 = Date.now();
  const c = await getCreds(MANTOS_UUID);
  console.log(`Loja: ${c.name}`);
  console.log(`Produto: ${PRODUCT_GID}\n`);

  // 1) re-query
  const r = await shopifyGraphQL(c.shop, c.token, QUERY, { id: PRODUCT_GID });
  if (r.errors) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); }
  const p = r.data.product;
  const total = p.variants.edges.length;
  console.log(`[#1 variants total] ${total} ${total === 140 ? '✓' : '✗ esperava 140'}`);
  const tamOpt = p.options.find(o => o.name === 'Tamanho');
  console.log(`Tamanho values (${tamOpt.values.length}): ${tamOpt.values.join(', ')}`);

  const has3GG_masc = tamOpt.values.some(v => v.startsWith('3GG/'));
  const has4GG_masc = tamOpt.values.some(v => v.startsWith('4GG/'));
  console.log(`Tem 3GG/ no Tamanho: ${has3GG_masc ? 'sim ✓' : 'não ✗'}`);
  console.log(`Tem 4GG/ no Tamanho: ${has4GG_masc ? 'sim ✓' : 'não ✗'}`);

  // 2) spot-check 3 variants
  const target = {
    '3GG/P__Nenhum': '339.90',
    '4GG/2GG__Ambos': '419.90',
    '3GG/GG__Só Masculina': '369.90',
  };
  const found = {};
  for (const e of p.variants.edges) {
    const opts = {};
    for (const so of e.node.selectedOptions) opts[so.name] = so.value;
    const k = `${opts['Tamanho']}__${opts['Personalização']}`;
    if (target[k]) found[k] = { price: e.node.price, compareAt: e.node.compareAtPrice };
  }
  console.log(`\n[#2 spot-check]`);
  let spotOk = true;
  for (const k of Object.keys(target)) {
    const got = found[k];
    const ok = got && got.price === target[k] && got.compareAt === '450.00';
    if (!ok) spotOk = false;
    console.log(`  ${k.padEnd(35)} esperado=${target[k]} compare=450.00  got=${got?.price ?? 'MISSING'} compare=${got?.compareAt ?? '-'}  ${ok ? '✓' : '✗'}`);
  }

  // 3) fetch PDP
  console.log(`\n[#3 storefront PDP] ${PDP_URL}`);
  const pdp = await fetchUrl(PDP_URL);
  console.log(`  HTTP ${pdp.status} (${pdp.body.length} bytes)`);
  if (pdp.status !== 200) {
    console.error('  PDP não retornou 200 — investigar');
    process.exit(2);
  }

  // O picker injeta divs com data-size="X" e classe is-soldout pros riscados
  // Pelo código do snippet: o button tem disabled + classe is-soldout quando size está em disabled_masc/fem
  // Procurar markers:
  //   data-kit-section
  //   data-kit-mode
  //   Tamanho Masculino
  //   Tamanho Feminino
  // E pros tamanhos: contar quantos botões 3GG/4GG aparecem com classe is-soldout vs sem
  const html = pdp.body;
  const markers = [
    'data-kit-section',
    'data-kit-mode',
    'Tamanho Masculino',
    'Tamanho Feminino',
    'Personalizar camisa masculina',
    'Personalizar camisa feminina',
  ];
  console.log(`\n  Markers:`);
  for (const m of markers) {
    const has = html.includes(m);
    console.log(`    ${has ? '✓' : '✗'} ${m}`);
  }

  // Inspeção dos botões masc 3GG/4GG vs fem 3GG/4GG
  // No snippet, os botões são gerados em loop sobre sizes_masc/sizes_fem com:
  //   <button ... data-side="masc" data-size="3GG" class="... {% if disabled_masc contains size %}is-soldout{% endif %}" {% if disabled_masc contains size %}disabled{% endif %}>
  function inspect(side, size) {
    const re = new RegExp(`data-side=["']${side}["'][^>]*data-size=["']${size}["'][^>]*>|data-size=["']${size}["'][^>]*data-side=["']${side}["'][^>]*>`, 'gi');
    const m = html.match(re);
    if (!m) return { found: 0, soldout: 0, disabled: 0 };
    const soldout = m.filter(x => x.includes('is-soldout')).length;
    const disabled = m.filter(x => /\bdisabled\b/.test(x)).length;
    return { found: m.length, soldout, disabled, sample: m[0]?.slice(0, 200) };
  }
  const masc3GG = inspect('masc', '3GG');
  const masc4GG = inspect('masc', '4GG');
  const fem3GG  = inspect('fem',  '3GG');
  const fem4GG  = inspect('fem',  '4GG');
  console.log(`\n  Botões picker (data-side + data-size):`);
  console.log(`    masc 3GG: found=${masc3GG.found} soldout=${masc3GG.soldout} disabled=${masc3GG.disabled}`);
  console.log(`    masc 4GG: found=${masc4GG.found} soldout=${masc4GG.soldout} disabled=${masc4GG.disabled}`);
  console.log(`    fem  3GG: found=${fem3GG.found}  soldout=${fem3GG.soldout}  disabled=${fem3GG.disabled}`);
  console.log(`    fem  4GG: found=${fem4GG.found}  soldout=${fem4GG.soldout}  disabled=${fem4GG.disabled}`);

  // CRITÉRIO: masc 3GG/4GG NÃO devem estar soldout/disabled. fem 3GG/4GG DEVEM estar soldout/disabled.
  const expectedMascUnlock = (masc3GG.soldout === 0 && masc3GG.disabled === 0 && masc3GG.found > 0)
                           && (masc4GG.soldout === 0 && masc4GG.disabled === 0 && masc4GG.found > 0);
  const expectedFemLock = (fem3GG.soldout > 0) && (fem4GG.soldout > 0);
  console.log(`\n  masc 3GG/4GG DESBLOQUEADOS: ${expectedMascUnlock ? '✓' : '✗'}`);
  console.log(`  fem  3GG/4GG ainda bloqueados: ${expectedFemLock ? '✓' : '✗'}`);

  const allOk = total === 140 && has3GG_masc && has4GG_masc && spotOk && expectedMascUnlock && expectedFemLock;
  console.log(`\n[TEMPO] ${Date.now() - t0}ms`);
  console.log(`\n=== RESULTADO FINAL: ${allOk ? 'PASS' : 'FAIL'} ===`);
})();
