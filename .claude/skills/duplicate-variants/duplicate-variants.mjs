#!/usr/bin/env node
// duplicate-variants — copia set de variantes de um produto modelo pra outros produtos.
//
// Uso:
//   node duplicate-variants.mjs "Cliente" --source=handle-modelo --targets=h1,h2,h3 [--apply]
//   node duplicate-variants.mjs "Cliente" --source=handle-modelo --all-missing [--apply]
//   node duplicate-variants.mjs "Cliente" --source=handle-modelo --category=camisa_torcedor [--apply]

import { fetchPricing } from '../../lib/supabase-rest.mjs';
import { shReq, nextPageUrl, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';
import { categorize, calcExpectedPrice } from '../../lib/shopify-pricing.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';

function parseArgs() {
  const args = { _: [], apply: false, source: null, targets: null, allMissing: false, category: null, dryRun: true };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') { args.apply = true; args.dryRun = false; }
    else if (a === '--all-missing') args.allMissing = true;
    else if (a.startsWith('--source=')) args.source = a.slice(9);
    else if (a.startsWith('--targets=')) args.targets = a.slice(10).split(',').map(s => s.trim()).filter(Boolean);
    else if (a.startsWith('--category=')) args.category = a.slice(11);
    else args._.push(a);
  }
  return args;
}

async function fetchAllProducts(shop, token) {
  const all = [];
  let url = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,handle,options,variants`;
  while (url) {
    const r = await shReq(shop, token, 'GET', url);
    all.push(...(r.body.products || []));
    url = nextPageUrl(r.link);
    if (url) await delay(500);
  }
  return all;
}

function variantKey(v) {
  return [v.option1 || '', v.option2 || '', v.option3 || ''].join('|');
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg || !args.source) {
    console.error('Uso: node duplicate-variants.mjs "Cliente" --source=handle [--targets=h1,h2 | --all-missing | --category=X] [--apply]');
    process.exit(1);
  }

  console.log(`\n=== duplicate-variants ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const pricing = await fetchPricing(client.id);
  console.log(`✓ Cliente: ${client.name}`);

  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token);
  const source = products.find(p => p.handle === args.source);
  if (!source) { console.error(`Produto modelo não encontrado: ${args.source}`); process.exit(1); }
  console.log(`✓ Modelo: ${source.title} (${source.variants?.length} variantes, options: ${source.options?.map(o => o.name).join(', ')})`);

  // Determina targets
  let targets = [];
  if (args.targets) {
    targets = products.filter(p => args.targets.includes(p.handle));
  } else if (args.allMissing) {
    // Produtos com apenas 1 variante (default), excluindo o source
    targets = products.filter(p => p.id !== source.id && (p.variants?.length || 0) <= 1);
  } else if (args.category) {
    targets = products.filter(p => p.id !== source.id && categorize(p.title) === args.category);
  }
  if (targets.length === 0) { console.error('Nenhum target encontrado.'); process.exit(1); }
  console.log(`${targets.length} produtos target\n`);

  // Pra cada target, calcula variantes faltantes
  const plans = [];
  for (const target of targets) {
    const existingKeys = new Set((target.variants || []).map(variantKey));
    const missing = [];
    for (const sv of source.variants || []) {
      const key = variantKey(sv);
      if (existingKeys.has(key)) continue;
      const expected = calcExpectedPrice(target.title, sv, pricing);
      const price = expected?.price != null ? expected.price.toFixed(2) : sv.price;
      missing.push({
        option1: sv.option1, option2: sv.option2, option3: sv.option3,
        price: String(price),
        compareAtPrice: sv.compare_at_price ? String(sv.compare_at_price) : null,
      });
    }
    if (missing.length) plans.push({ target, missing });
  }

  console.log(`${plans.length} produtos com variantes faltantes (total ${plans.reduce((s, p) => s + p.missing.length, 0)} variantes a criar)\n`);
  for (const p of plans.slice(0, 10)) {
    console.log(`  ${p.target.title.slice(0, 55).padEnd(57)} | +${p.missing.length} variantes`);
  }
  if (plans.length > 10) console.log(`  ... +${plans.length - 10}`);

  const totalVariants = plans.reduce((s, p) => s + p.missing.length, 0);
  printEstimate({ count: totalVariants, opName: 'create variants via productVariantsBulkCreate', rateLimitMs: 600, unit: 'variantes' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: totalVariants, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) { console.log('\n[DRY-RUN] Rode com --apply pra criar as variantes.'); return; }

  // Apply via productVariantsBulkCreate mutation
  let ok = 0, fail = 0;
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const variants = plan.missing.map(m => ({
      price: m.price,
      compareAtPrice: m.compareAtPrice,
      optionValues: [
        m.option1 && source.options[0] ? { optionName: source.options[0].name, name: m.option1 } : null,
        m.option2 && source.options[1] ? { optionName: source.options[1].name, name: m.option2 } : null,
        m.option3 && source.options[2] ? { optionName: source.options[2].name, name: m.option3 } : null,
      ].filter(Boolean),
    }));
    const mutation = `
      mutation create($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          userErrors { message field }
        }
      }`;
    try {
      const r = await shReq(client.shopify_domain, client.shopify_access_token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
        query: mutation,
        variables: { productId: `gid://shopify/Product/${plan.target.id}`, variants }
      });
      const errs = r.body?.data?.productVariantsBulkCreate?.userErrors || [];
      if (errs.length) { fail += variants.length; console.log(`  [${i+1}/${plans.length}] ${plan.target.handle}: ${errs.map(e => e.message).join(', ')}`); }
      else { ok += variants.length; process.stdout.write(`\r  [${i+1}/${plans.length}] ok=${ok}   `); }
    } catch (e) {
      fail += variants.length;
      console.log(`  [${i+1}/${plans.length}] ${plan.target.handle}: ${e.message}`);
    }
    await delay(600);
  }
  console.log(`\n\nResultado: variantes ok=${ok} fail=${fail}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
