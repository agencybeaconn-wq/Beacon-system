// STEP 3c — Cria as 40 variants 3GG/4GG masc via productVariantsBulkCreate
// 2 lotes de 20 (3GG primeiro, depois 4GG)
// Delay 600ms entre lotes (regra Lever: mesma loja + writes serializa)
//
// Pricing validado em step3b (0 mismatches em 100):
//   base 319.90
//   pers: Nenhum=0, Só Masculina=30, Só Feminina=30, Ambos=60
//   size_extra somado: 3GG=20, 4GG=30, P/M/G/GG=0, 2GG=10
//   compareAt = 450.00, inventoryPolicy = CONTINUE

import { getCreds, shopifyGraphQL, getGraphQLErrors, delay } from '../../../../.claude/lib/shopify-api.mjs';
import fs from 'fs';

const MANTOS_UUID = '053f7258-95f4-4ca9-81ad-4032b18829ba';
const PRODUCT_GID = 'gid://shopify/Product/8248726585539';
const LOG = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19/unlock-3gg-4gg-create-log.json';

const BASE = 319.90;
const COMPARE = '450.00';
const sizeExtra = { 'P': 0, 'M': 0, 'G': 0, 'GG': 0, '2GG': 10, '3GG': 20, '4GG': 30 };
const persExtra = { 'Nenhum': 0, 'Só Masculina': 30, 'Só Feminina': 30, 'Ambos': 60 };

const newMasc = ['3GG', '4GG'];
const fems = ['P', 'M', 'G', 'GG', '2GG'];
const persValues = ['Nenhum', 'Só Masculina', 'Só Feminina', 'Ambos'];

function planLot(masc) {
  const items = [];
  for (const f of fems) {
    for (const pers of persValues) {
      const price = (BASE + sizeExtra[masc] + sizeExtra[f] + persExtra[pers]).toFixed(2);
      items.push({
        optionValues: [
          { name: `${masc}/${f}`, optionName: 'Tamanho' },
          { name: pers, optionName: 'Personalização' },
        ],
        price,
        compareAtPrice: COMPARE,
        inventoryPolicy: 'CONTINUE',
      });
    }
  }
  return items;
}

const MUTATION = `
  mutation BulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkCreate(productId: $productId, variants: $variants) {
      productVariants {
        id
        title
        price
        compareAtPrice
        inventoryPolicy
        selectedOptions { name value }
      }
      userErrors { field message code }
    }
  }
`;

(async () => {
  const t0 = Date.now();
  const c = await getCreds(MANTOS_UUID);
  console.log(`Loja: ${c.name} (${c.shop})`);
  console.log(`Produto: ${PRODUCT_GID}`);

  const log = { lots: [], summary: {} };

  for (let i = 0; i < newMasc.length; i++) {
    const masc = newMasc[i];
    const variants = planLot(masc);
    console.log(`\n=== Lote ${i + 1}/2 — masc=${masc}  (${variants.length} variants) ===`);
    for (const v of variants) {
      console.log(`  ${v.optionValues[0].name.padEnd(7)} ${v.optionValues[1].name.padEnd(15)} price=${v.price}`);
    }

    const res = await shopifyGraphQL(c.shop, c.token, MUTATION, {
      productId: PRODUCT_GID,
      variants,
    });
    const userErrors = getGraphQLErrors(res, 'productVariantsBulkCreate');
    const created = res.data?.productVariantsBulkCreate?.productVariants || [];
    console.log(`\n  Criadas: ${created.length}`);
    console.log(`  userErrors: ${userErrors.length}`);
    if (userErrors.length) {
      console.error('  ERROS:', JSON.stringify(userErrors, null, 2));
    }
    log.lots.push({
      masc,
      requested: variants.length,
      created: created.length,
      userErrors,
      createdIds: created.map(v => v.id),
    });

    if (userErrors.length > 0) {
      console.error(`\nABORTAR — lote ${i + 1} teve ${userErrors.length} userErrors`);
      fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
      process.exit(1);
    }

    if (i < newMasc.length - 1) {
      console.log(`\n  delay 600ms antes do próximo lote...`);
      await delay(600);
    }
  }

  log.summary = {
    totalRequested: log.lots.reduce((a, x) => a + x.requested, 0),
    totalCreated: log.lots.reduce((a, x) => a + x.created, 0),
    elapsedMs: Date.now() - t0,
  };

  fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
  console.log(`\n=== RESUMO ===`);
  console.log(`Pedidas: ${log.summary.totalRequested}`);
  console.log(`Criadas: ${log.summary.totalCreated}`);
  console.log(`Tempo: ${log.summary.elapsedMs}ms`);
  console.log(`Log: ${LOG}`);

  if (log.summary.totalCreated !== 40) {
    console.error('ABORTAR — esperava 40 criadas');
    process.exit(2);
  }
  console.log('\nSTEP 3c OK — 40/40 variants criadas');
})();
