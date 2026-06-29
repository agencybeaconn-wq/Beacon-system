// STEP 3b — Detecta padrão REAL de preços nas 100 variants atuais
// pra extrapolar corretamente pra 3GG e 4GG.

import { getCreds, shopifyGraphQL } from '../../../../.claude/lib/shopify-api.mjs';
import fs from 'fs';

const MANTOS_UUID = '053f7258-95f4-4ca9-81ad-4032b18829ba';
const PRODUCT_GID = 'gid://shopify/Product/8248726585539';
const OUT_TABLE = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19/unlock-3gg-4gg-pricing-table.json';

const QUERY = `
  query($id: ID!) {
    product(id: $id) {
      variants(first: 250) {
        edges { node { id title price compareAtPrice inventoryPolicy selectedOptions { name value } } }
      }
    }
  }
`;

const SIZE_ORDER = ['P', 'M', 'G', 'GG', '2GG', '3GG', '4GG'];

(async () => {
  const c = await getCreds(MANTOS_UUID);
  const r = await shopifyGraphQL(c.shop, c.token, QUERY, { id: PRODUCT_GID });
  if (r.errors) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); }
  const edges = r.data.product.variants.edges;

  // Matriz: pers -> matriz size_masc × size_fem -> price
  const byPers = {};
  for (const e of edges) {
    const opts = {};
    for (const so of e.node.selectedOptions) opts[so.name] = so.value;
    const tam = opts['Tamanho'];
    const pers = opts['Personalização'];
    const [m, f] = tam.split('/');
    if (!byPers[pers]) byPers[pers] = {};
    if (!byPers[pers][m]) byPers[pers][m] = {};
    byPers[pers][m][f] = { price: parseFloat(e.node.price), compareAt: e.node.compareAtPrice, inventoryPolicy: e.node.inventoryPolicy };
  }

  // Print matriz Nenhum
  for (const pers of Object.keys(byPers)) {
    console.log(`\n=== Personalização: ${pers} ===`);
    const sizes = ['P', 'M', 'G', 'GG', '2GG'];
    process.stdout.write('       ');
    for (const f of sizes) process.stdout.write(`  ${f.padStart(5)}`);
    console.log('');
    for (const m of sizes) {
      process.stdout.write(`  ${m.padStart(4)} `);
      for (const f of sizes) {
        const v = byPers[pers]?.[m]?.[f];
        process.stdout.write(`  ${v ? v.price.toFixed(2).padStart(5) : '  -  '}`);
      }
      console.log('');
    }
  }

  // Detectar regra
  // Hipótese: price = base + MAX(masc_extra, fem_extra) + pers_extra
  // ou       price = base + masc_extra + fem_extra + pers_extra
  // Testando: P/P (extras 0,0) e 2GG/2GG (extras 10,10):
  //   se SOMA: 319.90 + 0 = 319.90 ; 319.90 + 20 = 339.90 ✓
  //   se MAX:  319.90 + 0 = 319.90 ; 319.90 + 10 = 329.90 ✗
  // P/2GG (extras 0,10): SOMA -> 329.90 ✓ ; MAX -> 329.90 ✓ (mesmo)
  // G/GG (extras 0,0): SOMA -> 319.90 ✓
  // Conclusão preliminar: BASE=319.90, sizeExtra: P/M/G/GG=0, 2GG=10 (somado por lado)

  const BASE_NENHUM = byPers['Nenhum']?.['P']?.['P']?.price;
  console.log(`\n[REGRA DETECTADA]`);
  console.log(`  base Nenhum + P/P = ${BASE_NENHUM}`);

  // Calcular acréscimos pers
  const persExtraDetected = {};
  for (const pers of Object.keys(byPers)) {
    const v = byPers[pers]?.['P']?.['P']?.price;
    persExtraDetected[pers] = v - BASE_NENHUM;
  }
  console.log(`  pers_extra:`, persExtraDetected);

  // Calcular acréscimos size — usar coluna P, variando masc
  console.log(`  size_extra (testando fixar f=P, variar m):`);
  for (const m of ['P', 'M', 'G', 'GG', '2GG']) {
    const v = byPers['Nenhum']?.[m]?.['P']?.price;
    console.log(`    ${m}/P : ${v} -> extra=${v - BASE_NENHUM}`);
  }
  console.log(`  (testando fixar m=P, variar f):`);
  for (const f of ['P', 'M', 'G', 'GG', '2GG']) {
    const v = byPers['Nenhum']?.['P']?.[f]?.price;
    console.log(`    P/${f} : ${v} -> extra=${v - BASE_NENHUM}`);
  }

  // Validar SOMA regra cruzando todas 100 atuais
  const sizeExtra = { 'P': 0, 'M': 0, 'G': 0, 'GG': 0, '2GG': 10, '3GG': 20, '4GG': 30 };
  let mismatches = 0;
  for (const pers of Object.keys(byPers)) {
    for (const m of Object.keys(byPers[pers])) {
      for (const f of Object.keys(byPers[pers][m])) {
        const real = byPers[pers][m][f].price;
        const calc = BASE_NENHUM + sizeExtra[m] + sizeExtra[f] + persExtraDetected[pers];
        if (Math.abs(real - calc) > 0.001) {
          mismatches++;
          if (mismatches <= 10) console.log(`  MISMATCH ${pers} ${m}/${f}: real=${real} calc=${calc.toFixed(2)}`);
        }
      }
    }
  }
  console.log(`\n[VALIDAÇÃO] mismatches=${mismatches}/100`);

  // Coletar compareAt
  const compareAts = new Set();
  const invPolicies = new Set();
  for (const e of edges) {
    compareAts.add(e.node.compareAtPrice);
    invPolicies.add(e.node.inventoryPolicy);
  }
  console.log(`compareAtPrices distintos: ${[...compareAts].join(', ')}`);
  console.log(`inventoryPolicies distintas: ${[...invPolicies].join(', ')}`);

  // Salvar
  fs.writeFileSync(OUT_TABLE, JSON.stringify({
    base: BASE_NENHUM,
    persExtra: persExtraDetected,
    sizeExtra,
    compareAt: [...compareAts][0],
    inventoryPolicy: [...invPolicies][0],
    persOptions: Object.keys(byPers),
    mismatches,
  }, null, 2));
  console.log(`\nSalvo em ${OUT_TABLE}`);
})();
