#!/usr/bin/env node
// update-prices — aplica preços por categoria + extras na Shopify de um cliente.
//
// Uso:
//   node update-prices.mjs <clientIdOrName>                      # DRY-RUN (default)
//   node update-prices.mjs <clientIdOrName> --apply              # aplica via bulk op
//   node update-prices.mjs <clientIdOrName> --apply --legacy     # aplica via loop antigo
//   node update-prices.mjs <clientIdOrName> --limit=50           # processa só 50 (teste)
//
// Segue o PROTOCOL: VALIDATE → DRY-RUN → PREVIEW → (user confirma) → EXECUTE → LOG.
//
// Execução: por default usa Bulk Operations (1 call async pra N produtos, ~10x mais rápido).
// Fallback: --legacy usa loop GraphQL paralelo (concorrência 3, delay 500ms).

import { fetchClient, fetchPricing } from '../../lib/supabase-rest.mjs';
import { shReq, shopifyGraphQL, nextPageUrl, delay, API_VERSION, getGraphQLErrors } from '../../lib/shopify-api.mjs';
import { runBulkMutation } from '../../lib/shopify-bulk.mjs';
import { assertClientExists, assertShopifyConnected, assertPricingConfigured, appendExecutionLog } from '../../lib/validate.mjs';
import { calcExpectedPrice, categorize } from '../../lib/shopify-pricing.mjs';
import { writeCheckpoint, readCheckpoint, clearCheckpoint, installSigintHandler, hasCheckpoint } from '../../lib/checkpoint.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_NAME = 'update-prices';

function parseArgs() {
  const args = { _: [], apply: false, limit: Infinity, legacy: false, resume: false, status: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--legacy') args.legacy = true;
    else if (a === '--resume') args.resume = true;
    else if (a === '--status') args.status = true;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8)) || Infinity;
    else args._.push(a);
  }
  return args;
}

async function fetchAllProducts(shop, token, limit) {
  const all = [];
  let path = `/admin/api/${API_VERSION}/products.json?limit=250&status=active&fields=id,handle,title,variants`;
  while (path && all.length < limit) {
    const r = await shReq(shop, token, 'GET', path);
    if (r.status !== 200) throw new Error(`Shopify ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
    all.push(...(r.body.products || []));
    path = nextPageUrl(r.link);
    await delay(500);
  }
  return all.slice(0, limit);
}

const BULK_MUTATION = `mutation bulk($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    userErrors { field message }
  }
}`;

async function main() {
  const args = parseArgs();

  // --status: mostra progresso do checkpoint sem rodar
  if (args.status) {
    const ck = readCheckpoint(SKILL_NAME);
    if (!ck) {
      console.log('Nenhum checkpoint ativo pra update-prices.');
      return;
    }
    console.log('=== Checkpoint update-prices ===');
    console.log('  ts:', ck.ts);
    console.log('  cliente:', ck.data?.clientName || '?');
    console.log('  processedProducts:', ck.data?.processedIds?.length || 0);
    console.log('  totalProducts:', ck.data?.total || '?');
    console.log('  mode:', ck.data?.mode || '?');
    console.log('\nRode com --resume pra retomar.');
    return;
  }

  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node update-prices.mjs <clientIdOrName> [--apply] [--limit=N] [--resume] [--status]');
    process.exit(1);
  }

  console.log(`\n=== update-prices ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);

  // ── 1. VALIDATE ─────────────────────────────────────────────────────
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const pricing = await fetchPricing(client.id);
  assertPricingConfigured(pricing, ['torcedor']);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
  console.log(`✓ Pricing: ${Object.keys(pricing.products).length} produtos, ${Object.keys(pricing.extras).length} extras`);

  // ── 2. DRY-RUN ──────────────────────────────────────────────────────
  console.log(`\nBuscando produtos da Shopify...`);
  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token, args.limit);
  console.log(`  ${products.length} produtos carregados`);

  const changes = [];
  let varChangeCount = 0;
  const catStats = {};
  const skippedUncategorized = [];

  for (const p of products) {
    const cat = categorize(p.title);
    catStats[cat || 'SKIP'] = (catStats[cat || 'SKIP'] || 0) + 1;
    if (!cat) { skippedUncategorized.push(p.title); continue; }

    const varUpdates = [];
    for (const v of (p.variants || [])) {
      const expected = calcExpectedPrice(p.title, v, pricing);
      if (!expected || expected.price == null) continue;
      const currentPrice = parseFloat(v.price);
      if (Math.abs(currentPrice - expected.price) > 0.001) {
        varUpdates.push({
          variantId: v.id,
          option1: v.option1,
          option2: v.option2 || null,
          oldPrice: currentPrice.toFixed(2),
          newPrice: expected.price.toFixed(2),
          breakdown: expected.breakdown,
        });
        varChangeCount++;
      }
    }
    if (varUpdates.length) {
      changes.push({ productId: p.id, handle: p.handle, title: p.title, category: cat, variants: varUpdates });
    }
  }

  // ── 3. PREVIEW ──────────────────────────────────────────────────────
  console.log(`\n=== PREVIEW ===`);
  console.log(`Categorias detectadas:`);
  Object.entries(catStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nProdutos a alterar: ${changes.length}`);
  console.log(`Variantes a alterar: ${varChangeCount}`);
  console.log(`Produtos ignorados (sem categoria): ${skippedUncategorized.length}`);

  console.log(`\nAmostra (3 produtos):`);
  changes.slice(0, 3).forEach(c => {
    console.log(`\n  [${c.category}] ${c.title}`);
    c.variants.slice(0, 3).forEach(v => {
      console.log(`    ${v.option1}/${v.option2 || '-'}: ${v.oldPrice} → ${v.newPrice}  (${v.breakdown.join(' ')})`);
    });
    if (c.variants.length > 3) console.log(`    ...+${c.variants.length - 3} variantes`);
  });

  // Salva plano pra auditoria
  const planPath = path.join(__dirname, '.tmp_update_prices_plan.json');
  fs.writeFileSync(planPath, JSON.stringify({ client: client.name, mode: args.apply ? 'apply' : 'dry', changes, catStats, ts: new Date().toISOString() }, null, 2));
  console.log(`\nPlano salvo em ${planPath}`);

  const totalVariantsToUpdate = changes.reduce((s, c) => s + c.variants.length, 0);
  printEstimate({ count: totalVariantsToUpdate, opName: 'update prices via bulk', bulkOp: true, unit: 'variantes' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: totalVariantsToUpdate, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Revise o plano e rode novamente com --apply pra aplicar.`);
    return;
  }

  if (changes.length === 0) {
    console.log(`\nNada a fazer. ✓`);
    clearCheckpoint(SKILL_NAME);
    return;
  }

  // ── 4.5 CHECKPOINT — resume? ────────────────────────────────────────
  let processedIds = new Set();
  if (args.resume && hasCheckpoint(SKILL_NAME)) {
    const ck = readCheckpoint(SKILL_NAME);
    if (ck?.data?.clientId === client.id) {
      processedIds = new Set(ck.data.processedIds || []);
      console.log(`\n⏯  Resumindo de checkpoint: ${processedIds.size} produtos já processados`);
    } else {
      console.warn(`\n⚠ Checkpoint existe mas é de outro cliente (${ck?.data?.clientName}). Ignorando.`);
    }
  } else if (hasCheckpoint(SKILL_NAME)) {
    console.warn(`\n⚠ Checkpoint anterior existe. Rode com --resume pra retomar, ou ignore (vai refazer tudo).`);
  }

  const changesToProcess = changes.filter(c => !processedIds.has(c.productId));
  if (changesToProcess.length === 0) {
    console.log(`\nTodos os ${changes.length} produtos já foram processados no run anterior. ✓`);
    clearCheckpoint(SKILL_NAME);
    return;
  }

  // Install SIGINT handler — salva checkpoint antes de sair
  installSigintHandler(SKILL_NAME, () => ({
    clientId: client.id,
    clientName: client.name,
    processedIds: [...processedIds],
    total: changes.length,
    mode: args.legacy ? 'legacy' : 'bulk',
  }));

  // ── 5. EXECUTE ──────────────────────────────────────────────────────
  console.log(`\n=== EXECUTANDO ${args.legacy ? '[legacy loop]' : '[bulk op]'} ===`);
  if (changesToProcess.length < changes.length) {
    console.log(`Skipando ${changes.length - changesToProcess.length} produtos já processados`);
  }
  let ok = 0, fail = 0;
  const errors = [];

  if (args.legacy) {
    // Path legacy: loop paralelo GraphQL (3 concorrência, delay 500ms)
    const concurrency = 3;
    for (let i = 0; i < changesToProcess.length; i += concurrency) {
      const batch = changesToProcess.slice(i, i + concurrency);
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
          if (errs.length) {
            fail++;
            if (errors.length < 20) errors.push({ title: c.title, errs });
          } else {
            ok++;
            processedIds.add(c.productId);
          }
        } catch (e) {
          fail++;
          if (errors.length < 20) errors.push({ title: c.title, error: e.message });
        }
      }));
      // Checkpoint a cada 20 produtos processados
      if (processedIds.size % 20 === 0) {
        writeCheckpoint(SKILL_NAME, {
          clientId: client.id,
          clientName: client.name,
          processedIds: [...processedIds],
          total: changes.length,
          mode: 'legacy',
        });
      }
      if ((i + concurrency) % 60 === 0 || i + concurrency >= changesToProcess.length) {
        process.stdout.write(`\r[${Math.min(i + concurrency, changesToProcess.length)}/${changesToProcess.length}] ok=${ok} fail=${fail}   `);
      }
      await delay(500);
    }
  } else {
    // Path default: Bulk Operation (1 staged upload → N mutations processadas em background)
    const items = changesToProcess.map(c => ({
      productId: `gid://shopify/Product/${c.productId}`,
      variants: c.variants.map(v => ({
        id: `gid://shopify/ProductVariant/${v.variantId}`,
        price: v.newPrice,
      })),
    }));
    const totalVariantsInBatch = changesToProcess.reduce((s, c) => s + c.variants.length, 0);

    console.log(`Preparando bulk op com ${items.length} produtos (${totalVariantsInBatch} variantes)...`);
    try {
      const res = await runBulkMutation(
        client.shopify_domain,
        client.shopify_access_token,
        BULK_MUTATION,
        items,
        {
          jsonlOpts: { wrap: 'none' },
          onStage: () => console.log('  ✓ staged upload criado, enviando JSONL...'),
          onPoll: (op) => {
            process.stdout.write(`\r  status=${op.status} objectCount=${op.objectCount || 0}   `);
          },
          pollOpts: { interval: 3000, timeout: 20 * 60 * 1000 },
        }
      );
      console.log(`\n  ✓ bulk op completed: ${res.op.id}`);
      console.log(`  objectCount=${res.op.objectCount}  fileSize=${res.op.fileSize}`);
      ok = res.ok;
      fail = res.fail.length;
      // Em bulk op sucesso, marcar TODOS como processados
      for (const c of changesToProcess) processedIds.add(c.productId);
      for (const f of res.fail.slice(0, 20)) {
        errors.push({ line: f.line, errs: f.errors });
      }
    } catch (e) {
      console.error(`\n❌ Bulk operation falhou: ${e.message}`);
      console.log(`\n→ Tente novamente com --legacy pra usar o loop sequencial ou --resume.`);
      fail = changesToProcess.length;
      errors.push({ error: e.message });
      // Mantém checkpoint pro resume
      writeCheckpoint(SKILL_NAME, {
        clientId: client.id,
        clientName: client.name,
        processedIds: [...processedIds],
        total: changes.length,
        mode: 'bulk',
      });
    }
  }

  console.log(`\n\nResultado: ok=${ok} fail=${fail}`);

  // Clear checkpoint em sucesso (ou parcial mas sem falhas)
  if (fail === 0) {
    clearCheckpoint(SKILL_NAME);
  }
  if (errors.length) {
    console.log(`\nPrimeiros erros:`);
    errors.slice(0, 5).forEach(e => console.log(`  - ${JSON.stringify(e).slice(0, 200)}`));
  }

  // ── 6. LOG ──────────────────────────────────────────────────────────
  await appendExecutionLog({
    skill: 'update-prices',
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    affected_products: changes.length,
    affected_variants: varChangeCount,
    ok,
    fail,
    dry_run: false,
    user_confirmed: true,
    bulk_mode: !args.legacy,
  });
}

main().catch(e => {
  console.error(`\n❌ Erro:`, e.message);
  process.exit(1);
});
