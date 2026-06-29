#!/usr/bin/env node
// bulk-fix-prices — audita + corrige discrepâncias entre client_pricing e Shopify.
//
// Diferença de update-prices: esse compara preço ATUAL vs pricing e só corrige os divergentes.
// Na prática, os 2 scripts fazem quase a mesma coisa (comparam current vs expected e aplicam
// se diferente), então esse é um alias semântico pra "auditar e corrigir". Usa mesma lib.
//
// Uso:
//   node bulk-fix-prices.mjs <clientIdOrName>                   # DRY-RUN
//   node bulk-fix-prices.mjs <clientIdOrName> --apply           # corrige
//   node bulk-fix-prices.mjs <clientIdOrName> --variance=0.05   # threshold 5% (default 1%)

import { fetchClient, fetchPricing } from '../../lib/supabase-rest.mjs';
import { shReq, shopifyGraphQL, nextPageUrl, delay, API_VERSION, getGraphQLErrors } from '../../lib/shopify-api.mjs';
import { runBulkMutation } from '../../lib/shopify-bulk.mjs';
import { assertClientExists, assertShopifyConnected, assertPricingConfigured, appendExecutionLog } from '../../lib/validate.mjs';
import { calcExpectedPrice, categorize } from '../../lib/shopify-pricing.mjs';
import { writeCheckpoint, readCheckpoint, clearCheckpoint, installSigintHandler, hasCheckpoint } from '../../lib/checkpoint.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_NAME = 'bulk-fix-prices';

function parseArgs() {
  const args = { _: [], apply: false, variance: 0.01, legacy: false, resume: false, status: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--legacy') args.legacy = true;
    else if (a === '--resume') args.resume = true;
    else if (a === '--status') args.status = true;
    else if (a.startsWith('--variance=')) args.variance = parseFloat(a.slice(11)) || 0.01;
    else args._.push(a);
  }
  return args;
}

const BULK_MUTATION = `mutation bulk($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    userErrors { field message }
  }
}`;

async function fetchAllProducts(shop, token) {
  const all = [];
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&status=active&fields=id,handle,title,variants`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    all.push(...(r.body.products || []));
    p = nextPageUrl(r.link);
    await delay(500);
  }
  return all;
}

async function main() {
  const args = parseArgs();

  if (args.status) {
    const ck = readCheckpoint(SKILL_NAME);
    if (!ck) { console.log('Nenhum checkpoint ativo pra bulk-fix-prices.'); return; }
    console.log('=== Checkpoint bulk-fix-prices ===');
    console.log('  ts:', ck.ts);
    console.log('  cliente:', ck.data?.clientName || '?');
    console.log('  processedProducts:', ck.data?.processedIds?.length || 0);
    console.log('  total:', ck.data?.total || '?');
    console.log('\nRode com --resume pra retomar.');
    return;
  }

  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node bulk-fix-prices.mjs <clientIdOrName> [--apply] [--variance=0.01] [--resume] [--status]');
    process.exit(1);
  }

  console.log(`\n=== bulk-fix-prices ${args.apply ? '[APPLY]' : '[DRY-RUN]'} variance=${args.variance*100}% ===`);

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const pricing = await fetchPricing(client.id);
  // Aceita schema legacy (torcedor) ou v7 (camisa_torcedor)
  if (!pricing?.products?.torcedor && !pricing?.products?.camisa_torcedor) {
    assertPricingConfigured(pricing, ['torcedor']);
  }
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token);
  console.log(`  ${products.length} produtos`);

  const divergent = [];
  let varCount = 0;
  const catStats = {};
  let unpriced = 0;  // produtos categorizados mas sem pricing configurado

  for (const p of products) {
    const cat = categorize(p.title);
    catStats[cat || 'SKIP'] = (catStats[cat || 'SKIP'] || 0) + 1;
    if (!cat) continue;

    const vars = [];
    for (const v of (p.variants || [])) {
      const expected = calcExpectedPrice(p.title, v, pricing);
      if (!expected) continue;
      if (expected.price == null) { unpriced++; continue; }
      const current = parseFloat(v.price);
      const absDiff = Math.abs(current - expected.price);
      const relDiff = expected.price > 0 ? absDiff / expected.price : 0;
      if (absDiff > 0.001 && relDiff > args.variance) {
        vars.push({
          variantId: v.id,
          option1: v.option1,
          option2: v.option2 || null,
          oldPrice: current.toFixed(2),
          newPrice: expected.price.toFixed(2),
          diff: (current - expected.price).toFixed(2),
          breakdown: expected.breakdown,
        });
        varCount++;
      }
    }
    if (vars.length) divergent.push({ productId: p.id, handle: p.handle, title: p.title, category: cat, variants: vars });
  }

  console.log(`\n=== PREVIEW ===`);
  Object.entries(catStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nProdutos divergentes (acima de ${args.variance*100}%): ${divergent.length}`);
  console.log(`Variantes divergentes: ${varCount}`);
  if (unpriced > 0) console.log(`⚠️  ${unpriced} variantes sem pricing no banco`);

  console.log(`\nAmostra (5):`);
  divergent.slice(0, 5).forEach(c => {
    console.log(`\n  [${c.category}] ${c.title}`);
    c.variants.slice(0, 3).forEach(v => console.log(`    ${v.option1}/${v.option2 || '-'}: ${v.oldPrice} → ${v.newPrice}  (diff ${v.diff})`));
  });

  const planPath = path.join(__dirname, '.tmp_bulk_fix_plan.json');
  fs.writeFileSync(planPath, JSON.stringify({ client: client.name, variance: args.variance, divergent, catStats, ts: new Date().toISOString() }, null, 2));
  console.log(`\nPlano salvo em ${planPath}`);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode novamente com --apply pra corrigir.`);
    return;
  }
  if (divergent.length === 0) {
    console.log(`\nNada a corrigir. ✓`);
    clearCheckpoint(SKILL_NAME);
    return;
  }

  // Checkpoint + resume
  let processedIds = new Set();
  if (args.resume && hasCheckpoint(SKILL_NAME)) {
    const ck = readCheckpoint(SKILL_NAME);
    if (ck?.data?.clientId === client.id) {
      processedIds = new Set(ck.data.processedIds || []);
      console.log(`\n⏯  Resumindo de checkpoint: ${processedIds.size} produtos já processados`);
    }
  } else if (hasCheckpoint(SKILL_NAME)) {
    console.warn(`\n⚠ Checkpoint anterior existe. Rode com --resume pra retomar.`);
  }

  const divergentToProcess = divergent.filter(c => !processedIds.has(c.productId));
  if (divergentToProcess.length === 0) {
    console.log(`\nTodos já processados. ✓`);
    clearCheckpoint(SKILL_NAME);
    return;
  }

  installSigintHandler(SKILL_NAME, () => ({
    clientId: client.id,
    clientName: client.name,
    processedIds: [...processedIds],
    total: divergent.length,
    mode: args.legacy ? 'legacy' : 'bulk',
  }));

  // EXECUTE
  console.log(`\n=== EXECUTANDO ${args.legacy ? '[legacy]' : '[bulk op]'} ===`);
  let ok = 0, fail = 0;

  if (args.legacy) {
    const concurrency = 3;
    for (let i = 0; i < divergentToProcess.length; i += concurrency) {
      const batch = divergentToProcess.slice(i, i + concurrency);
      await Promise.all(batch.map(async c => {
        const variants = c.variants.map(v => ({
          id: `gid://shopify/ProductVariant/${v.variantId}`,
          price: v.newPrice,
        }));
        try {
          const r = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, BULK_MUTATION, {
            productId: `gid://shopify/Product/${c.productId}`,
            variants,
          });
          const errs = getGraphQLErrors(r, 'productVariantsBulkUpdate');
          if (errs.length) fail++;
          else { ok++; processedIds.add(c.productId); }
        } catch (e) { fail++; }
      }));
      if (processedIds.size % 20 === 0) {
        writeCheckpoint(SKILL_NAME, {
          clientId: client.id,
          clientName: client.name,
          processedIds: [...processedIds],
          total: divergent.length,
          mode: 'legacy',
        });
      }
      if ((i + concurrency) % 60 === 0 || i + concurrency >= divergentToProcess.length) {
        process.stdout.write(`\r[${Math.min(i + concurrency, divergentToProcess.length)}/${divergentToProcess.length}] ok=${ok} fail=${fail}   `);
      }
      await delay(500);
    }
  } else {
    const items = divergentToProcess.map(c => ({
      productId: `gid://shopify/Product/${c.productId}`,
      variants: c.variants.map(v => ({
        id: `gid://shopify/ProductVariant/${v.variantId}`,
        price: v.newPrice,
      })),
    }));
    try {
      const res = await runBulkMutation(
        client.shopify_domain,
        client.shopify_access_token,
        BULK_MUTATION,
        items,
        {
          jsonlOpts: { wrap: 'none' },
          onStage: () => console.log('  ✓ staged upload criado'),
          onPoll: (op) => process.stdout.write(`\r  status=${op.status} objectCount=${op.objectCount || 0}   `),
          pollOpts: { interval: 3000, timeout: 20 * 60 * 1000 },
        }
      );
      console.log(`\n  ✓ bulk op completed: ${res.op.id}`);
      ok = res.ok;
      fail = res.fail.length;
      for (const c of divergentToProcess) processedIds.add(c.productId);
    } catch (e) {
      console.error(`\n❌ Bulk op falhou: ${e.message}\n→ Tente --legacy ou --resume.`);
      fail = divergentToProcess.length;
      writeCheckpoint(SKILL_NAME, {
        clientId: client.id,
        clientName: client.name,
        processedIds: [...processedIds],
        total: divergent.length,
        mode: 'bulk',
      });
    }
  }

  console.log(`\n\nResultado: ok=${ok} fail=${fail}`);
  if (fail === 0) clearCheckpoint(SKILL_NAME);

  await appendExecutionLog({
    skill: 'bulk-fix-prices',
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    variance: args.variance,
    divergent_products: divergent.length,
    divergent_variants: varCount,
    ok, fail,
    dry_run: false,
    bulk_mode: !args.legacy,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
