#!/usr/bin/env node
// bulk-product-meta — atualiza metadados de produtos em massa.
// Modos: --vendor=X, --seo-auto, --product-type=X (combináveis num único bulk op).
//
// Uso:
//   node bulk-product-meta.mjs "<cliente>" --vendor="Loja X" --apply
//   node bulk-product-meta.mjs "<cliente>" --seo-auto --apply
//   node bulk-product-meta.mjs "<cliente>" --vendor="X" --seo-auto --apply
//   node bulk-product-meta.mjs "<cliente>" --seo-auto --store-name="X" --apply

import { paginate, API_VERSION } from '../../lib/shopify-api.mjs';
import { runBulkMutation } from '../../lib/shopify-bulk.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';

function parseArgs() {
  const args = {
    _: [], apply: false,
    vendor: null, seoAuto: false, storeName: null, productType: null,
  };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--seo-auto') args.seoAuto = true;
    else if (a.startsWith('--vendor=')) args.vendor = a.slice(9);
    else if (a.startsWith('--store-name=')) args.storeName = a.slice(13);
    else if (a.startsWith('--product-type=')) args.productType = a.slice(15);
    else args._.push(a);
  }
  if (!args.vendor && !args.seoAuto && !args.productType) {
    console.error('❌ Escolha pelo menos um modo: --vendor=X, --seo-auto, ou --product-type=X');
    process.exit(1);
  }
  return args;
}

const PRODUCT_UPDATE_MUT = `
mutation call($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id vendor productType seo { title description } }
    userErrors { field message }
  }
}`;

function buildSeoTitle(title, storeName) {
  const safeTitle = title || 'Produto';
  const full = `${safeTitle} | ${storeName}`;
  if (full.length <= 70) return full;
  const suffix = ` | ${storeName}`;
  const maxTitle = 70 - suffix.length - 3; // 3 = "..."
  // Fallback: se storeName sozinho já ultrapassa 70, só trunca o full sem preservar suffix
  if (maxTitle <= 0) return full.slice(0, 67) + '...';
  return `${safeTitle.slice(0, maxTitle).trimEnd()}... | ${storeName}`;
}

function buildSeoDescription(title) {
  const base = `Compre ${title} com frete grátis. Entrega rápida para todo o Brasil.`;
  if (base.length <= 160) return base;
  return base.slice(0, 157).trimEnd() + '...';
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node bulk-product-meta.mjs "<cliente>" [--vendor=X] [--seo-auto] [--product-type=X] [--apply]');
    process.exit(1);
  }

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const storeName = args.storeName || client.name;

  console.log(`\n=== bulk-product-meta ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`Cliente: ${client.name} (${client.shopify_domain})`);
  if (args.vendor) console.log(`Vendor alvo: "${args.vendor}"`);
  if (args.seoAuto) console.log(`SEO: store_name="${storeName}" (template Lever canônico)`);
  if (args.productType) console.log(`Product type: "${args.productType}"`);

  // FETCH — precisamos de title (pro SEO) e dos campos que podem estar diferentes
  console.log(`\nBuscando produtos...`);
  const fields = ['id', 'title'];
  if (args.vendor) fields.push('vendor');
  if (args.productType) fields.push('product_type');
  const products = await paginate(client.shopify_domain, client.shopify_access_token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=${fields.join(',')}`, 'products', 500);
  console.log(`  ${products.length} produtos`);

  // COMPUTE — monta input por produto
  const items = [];
  const stats = { vendorChange: 0, vendorSkip: 0, ptChange: 0, ptSkip: 0, seoApplied: 0 };
  for (const p of products) {
    const input = { id: `gid://shopify/Product/${p.id}` };
    let changed = false;

    if (args.vendor) {
      if ((p.vendor || '') !== args.vendor) {
        input.vendor = args.vendor;
        stats.vendorChange++; changed = true;
      } else stats.vendorSkip++;
    }
    if (args.productType) {
      if ((p.product_type || '') !== args.productType) {
        input.productType = args.productType;
        stats.ptChange++; changed = true;
      } else stats.ptSkip++;
    }
    if (args.seoAuto) {
      input.seo = {
        title: buildSeoTitle(p.title, storeName),
        description: buildSeoDescription(p.title),
      };
      stats.seoApplied++; changed = true;
    }
    if (changed) items.push({ input });
  }

  console.log(`\n=== PREVIEW ===`);
  if (args.vendor) console.log(`Vendor: ${stats.vendorChange} mudanças, ${stats.vendorSkip} já ok`);
  if (args.productType) console.log(`Product type: ${stats.ptChange} mudanças, ${stats.ptSkip} já ok`);
  if (args.seoAuto) console.log(`SEO: ${stats.seoApplied} produtos (sempre reescreve pra garantir padrão)`);
  console.log(`Total no bulk op: ${items.length}`);

  if (items.length === 0) { console.log(`\n✓ Nada pra fazer.`); return; }

  // Amostra 3 produtos
  console.log(`\nAmostra 3:`);
  for (const it of items.slice(0, 3)) {
    const p = products.find(x => `gid://shopify/Product/${x.id}` === it.input.id);
    console.log(`  ${p.title.slice(0, 60)}`);
    if (it.input.vendor) console.log(`    vendor: "${p.vendor || '(vazio)'}" → "${it.input.vendor}"`);
    if (it.input.productType) console.log(`    product_type: "${p.product_type || '(vazio)'}" → "${it.input.productType}"`);
    if (it.input.seo) {
      console.log(`    seo.title: ${it.input.seo.title}`);
      console.log(`    seo.desc:  ${it.input.seo.description}`);
    }
  }

  if (!args.apply) { console.log(`\n[DRY-RUN] Rode com --apply pra aplicar.`); return; }

  console.log(`\n=== EXECUTANDO [bulk op] ===`);
  const res = await runBulkMutation(
    client.shopify_domain, client.shopify_access_token, PRODUCT_UPDATE_MUT, items,
    {
      jsonlOpts: { wrap: 'none' },
      onStage: () => console.log('  ✓ staged upload criado'),
      onPoll: (op) => process.stdout.write(`\r  status=${op.status} objectCount=${op.objectCount || 0}   `),
      pollOpts: { interval: 3000, timeout: 25 * 60 * 1000 },
    }
  );
  console.log(`\n  ✓ bulk op completed: ${res.op.id}`);
  console.log(`\nResultado: ok=${res.ok} fail=${res.fail.length}`);
  if (res.fail.length) {
    console.log(`\nPrimeiros erros:`);
    res.fail.slice(0, 5).forEach(f => console.log(`  - ${JSON.stringify(f.errors).slice(0, 180)}`));
  }

  await appendExecutionLog({
    skill: 'bulk-product-meta',
    client_id: client.id, client_name: client.name, shop: client.shopify_domain,
    vendor: args.vendor || null, seo_auto: args.seoAuto, product_type: args.productType || null,
    store_name: storeName,
    affected: items.length, ok: res.ok, fail: res.fail.length,
    dry_run: false,
  });
}

main().catch(e => { console.error('\n❌ Erro:', e.message, e.stack); process.exit(1); });
