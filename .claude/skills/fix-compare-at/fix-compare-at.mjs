#!/usr/bin/env node
// fix-compare-at — aplica/corrige compare_at_price em massa.
//
// Uso:
//   node fix-compare-at.mjs "Cliente" --pct=37 [--category=X] [--only-missing] [--force] [--apply]
//   node fix-compare-at.mjs "Cliente" --multiplier=1.6
//   node fix-compare-at.mjs "Cliente" --fixed=399.99
//   node fix-compare-at.mjs "Cliente" --auto (% médio dos existentes na categoria)

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { categorize } from '../../lib/shopify-pricing.mjs';
import { fetchClient } from '../../lib/supabase-rest.mjs';
import { shReq, nextPageUrl, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';

function parseArgs() {
  const args = { _: [], apply: false, pct: null, multiplier: null, fixed: null, auto: false, category: null, onlyMissing: true, force: false, onlyHandle: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--auto') args.auto = true;
    else if (a === '--force') { args.force = true; args.onlyMissing = false; }
    else if (a.startsWith('--pct=')) args.pct = parseFloat(a.slice(6));
    else if (a.startsWith('--multiplier=')) args.multiplier = parseFloat(a.slice(13));
    else if (a.startsWith('--fixed=')) args.fixed = parseFloat(a.slice(8));
    else if (a.startsWith('--category=')) args.category = a.slice(11);
    else if (a.startsWith('--only-handle=')) args.onlyHandle = a.slice(14).split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--no-only-missing') args.onlyMissing = false;
    else args._.push(a);
  }
  return args;
}

function roundTo99(n) { return Math.floor(n) + 0.99; }

function computeCompareAt(price, mode) {
  const p = parseFloat(price);
  if (!p || isNaN(p)) return null;
  if (mode.fixed != null) return mode.fixed;
  if (mode.multiplier != null) return roundTo99(p * mode.multiplier);
  if (mode.pct != null) return roundTo99(p / (1 - mode.pct / 100));
  return null;
}

async function fetchAllProducts(shop, token) {
  const all = [];
  let url = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,handle,variants`;
  while (url) {
    const r = await shReq(shop, token, 'GET', url);
    all.push(...(r.body.products || []));
    url = nextPageUrl(r.link);
    if (url) await delay(500);
  }
  return all;
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) { console.error('Uso: node fix-compare-at.mjs "Cliente" --pct=37|--multiplier=1.6|--fixed=399.99|--auto [--category=X] [--apply]'); process.exit(1); }

  const modes = [args.pct, args.multiplier, args.fixed, args.auto ? 1 : null].filter(x => x != null);
  if (modes.length !== 1) { console.error('Escolha UM modo: --pct | --multiplier | --fixed | --auto'); process.exit(1); }

  console.log(`\n=== fix-compare-at ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token);
  console.log(`${products.length} produtos carregados`);

  // Filtro por categoria
  let filtered = products;
  if (args.category) filtered = products.filter(p => categorize(p.title) === args.category);
  if (args.onlyHandle) filtered = filtered.filter(p => args.onlyHandle.includes(p.handle));
  console.log(`${filtered.length} após filtros`);

  // Modo --auto: descobre % médio de quem tem compare_at na categoria
  let mode = { pct: args.pct, multiplier: args.multiplier, fixed: args.fixed };
  if (args.auto) {
    const pcts = [];
    for (const p of filtered) {
      for (const v of (p.variants || [])) {
        if (v.compare_at_price && parseFloat(v.compare_at_price) > parseFloat(v.price)) {
          pcts.push((parseFloat(v.compare_at_price) - parseFloat(v.price)) / parseFloat(v.compare_at_price));
        }
      }
    }
    if (pcts.length === 0) { console.error('Nenhuma variante com compare_at pra inferir %. Use --pct explícito.'); process.exit(1); }
    const avgPct = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    mode = { pct: avgPct * 100 };
    console.log(`--auto: % médio = ${(avgPct * 100).toFixed(1)}%`);
  }

  // Constrói lista de updates
  const updates = [];
  for (const p of filtered) {
    for (const v of (p.variants || [])) {
      const hasCompareAt = v.compare_at_price && parseFloat(v.compare_at_price) > 0;
      if (args.onlyMissing && hasCompareAt && !args.force) continue;
      const newCompareAt = computeCompareAt(v.price, mode);
      if (newCompareAt == null) continue;
      if (hasCompareAt && Math.abs(parseFloat(v.compare_at_price) - newCompareAt) < 0.01 && !args.force) continue;
      updates.push({
        productId: p.id,
        productTitle: p.title,
        variantId: v.id,
        price: parseFloat(v.price),
        oldCompare: hasCompareAt ? parseFloat(v.compare_at_price) : null,
        newCompare: newCompareAt,
      });
    }
  }

  // Group by product
  const byProduct = {};
  for (const u of updates) (byProduct[u.productTitle] ||= []).push(u);
  console.log(`\n${updates.length} variantes em ${Object.keys(byProduct).length} produtos vão receber compare_at\n`);

  for (const [title, vs] of Object.entries(byProduct).slice(0, 15)) {
    const sample = vs[0];
    console.log(`  ${title.slice(0, 55).padEnd(57)} | R$${sample.price.toFixed(2).padEnd(8)} → de R$${sample.newCompare.toFixed(2)}  (${vs.length}v)`);
  }
  if (Object.keys(byProduct).length > 15) console.log(`  ... +${Object.keys(byProduct).length - 15} produtos`);

  printEstimate({ count: updates.length, opName: 'set compare_at_price', bulkOp: true, unit: 'variantes' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: updates.length, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra aplicar.`);
    return;
  }

  // Apply via productVariantsBulkUpdate GraphQL (igual bulk-fix-prices)
  const updatesByProduct = new Map();
  for (const u of updates) {
    if (!updatesByProduct.has(u.productId)) updatesByProduct.set(u.productId, []);
    updatesByProduct.get(u.productId).push({ id: `gid://shopify/ProductVariant/${u.variantId}`, compareAtPrice: u.newCompare.toFixed(2) });
  }

  let ok = 0, fail = 0, i = 0;
  for (const [productId, variants] of updatesByProduct) {
    i++;
    const mutation = `
      mutation upd($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          userErrors { message field }
        }
      }`;
    try {
      const r = await shReq(client.shopify_domain, client.shopify_access_token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
        query: mutation,
        variables: { productId: `gid://shopify/Product/${productId}`, variants }
      });
      const errs = r.body?.data?.productVariantsBulkUpdate?.userErrors || [];
      if (errs.length) { fail += variants.length; console.log(`  [${i}/${updatesByProduct.size}] ✗ ${errs.map(e => e.message).join(', ')}`); }
      else { ok += variants.length; process.stdout.write(`\r  [${i}/${updatesByProduct.size}] ok=${ok}   `); }
    } catch (e) {
      fail += variants.length;
      console.log(`  [${i}/${updatesByProduct.size}] error: ${e.message}`);
    }
    await delay(600);
  }
  console.log(`\n\nResultado: variantes ok=${ok} fail=${fail}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
