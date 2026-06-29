#!/usr/bin/env node
// batch-images — gerencia imagens de produtos em massa.
//
// Operações:
//   --reorder=template|alphabetical — reordena imagens do produto
//   --replace-from=handle-modelo --targets=h1,h2 — copia imagens de um produto pra outros
//   --dedupe-images — remove imagens duplicadas (mesma src)
//   --category=X — filtra target por categoria

import fs from 'fs';
import path from 'path';
import { fetchPricing } from '../../lib/supabase-rest.mjs';
import { shReq, nextPageUrl, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';
import { categorize } from '../../lib/shopify-pricing.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';

function parseArgs() {
  const args = { _: [], apply: false, reorder: null, replaceFrom: null, targets: null, dedupeImages: false, category: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--dedupe-images') args.dedupeImages = true;
    else if (a.startsWith('--reorder=')) args.reorder = a.slice(10);
    else if (a.startsWith('--replace-from=')) args.replaceFrom = a.slice(15);
    else if (a.startsWith('--targets=')) args.targets = a.slice(10).split(',').map(s => s.trim()).filter(Boolean);
    else if (a.startsWith('--category=')) args.category = a.slice(11);
    else args._.push(a);
  }
  return args;
}

async function fetchAllProducts(shop, token) {
  const all = [];
  let url = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,handle,images`;
  while (url) {
    const r = await shReq(shop, token, 'GET', url);
    all.push(...(r.body.products || []));
    url = nextPageUrl(r.link);
    if (url) await delay(500);
  }
  return all;
}

// Heurística pra classificar a "função" da imagem por nome do arquivo
function classifyImage(src) {
  const name = (src || '').toLowerCase();
  if (/front|frente|principal|_1\.|_01\./.test(name)) return 'frente';
  if (/back|costa|_2\.|_02\./.test(name)) return 'costas';
  if (/detail|detalhe|zoom|close|_3\.|_03\./.test(name)) return 'detalhe';
  if (/model|modelo|pessoa|lifestyle|_4\.|_05\./.test(name)) return 'modelo';
  return 'outro';
}

const TEMPLATE_ORDER = ['frente', 'costas', 'detalhe', 'modelo', 'outro'];

function reorderByTemplate(images) {
  return [...images].sort((a, b) => {
    const ka = TEMPLATE_ORDER.indexOf(classifyImage(a.src));
    const kb = TEMPLATE_ORDER.indexOf(classifyImage(b.src));
    return ka - kb;
  });
}

function reorderAlpha(images) {
  return [...images].sort((a, b) => (a.src || '').localeCompare(b.src || ''));
}

async function reorderProductImages(shop, token, productId, newOrder) {
  // Shopify: productReorderImages mutation
  const moves = newOrder.map((img, i) => ({ id: `gid://shopify/MediaImage/${img.id}`, newPosition: String(i) }));
  const mutation = `
    mutation reorder($id: ID!, $moves: [MoveInput!]!) {
      productReorderMedia(id: $id, moves: $moves) {
        job { id }
        mediaUserErrors { message }
      }
    }`;
  const r = await shReq(shop, token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
    query: mutation,
    variables: { id: `gid://shopify/Product/${productId}`, moves }
  });
  return r.body?.data?.productReorderMedia;
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) { console.error('Uso: node batch-images.mjs "Cliente" [--reorder=template|alphabetical | --replace-from=h --targets=h1,h2 | --dedupe-images] [--category=X] [--apply]'); process.exit(1); }

  console.log(`\n=== batch-images ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name}`);

  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token);
  console.log(`${products.length} produtos carregados`);

  // Filtro
  let targets = products;
  if (args.category) targets = products.filter(p => categorize(p.title) === args.category);
  if (args.targets) targets = products.filter(p => args.targets.includes(p.handle));

  console.log(`${targets.length} produtos target\n`);

  // Backup antes de mexer
  const backupPath = path.join(process.cwd(), `.tmp_images_backup_${client.id}_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(targets.map(p => ({ id: p.id, handle: p.handle, images: p.images })), null, 2));
  console.log(`Backup: ${backupPath}\n`);

  // REORDER
  if (args.reorder) {
    const fn = args.reorder === 'template' ? reorderByTemplate : reorderAlpha;
    const plans = [];
    for (const p of targets) {
      if (!p.images || p.images.length <= 1) continue;
      const current = p.images;
      const reordered = fn(current);
      const changed = current.some((img, i) => reordered[i].id !== img.id);
      if (changed) plans.push({ product: p, current, reordered });
    }
    console.log(`${plans.length} produtos precisam reordenar imagens\n`);
    for (const plan of plans.slice(0, 10)) {
      console.log(`  ${plan.product.title.slice(0, 55).padEnd(57)} | ${plan.current.length} imgs`);
    }
    printEstimate({ count: plans.length, opName: 'reorder product images', rateLimitMs: 600, unit: 'produtos' });
    const cost1 = parseCostFlags(process.argv);
    if (abortIfTooLarge({ count: plans.length, expected: cost1.expected, force: cost1.forceLarge })) process.exit(2);

    if (!args.apply) { console.log('\n[DRY-RUN] Rode --apply pra aplicar.'); return; }

    let ok = 0, fail = 0;
    for (let i = 0; i < plans.length; i++) {
      try {
        const res = await reorderProductImages(client.shopify_domain, client.shopify_access_token, plans[i].product.id, plans[i].reordered);
        if (res?.mediaUserErrors?.length) { fail++; console.log(`  [${i+1}/${plans.length}] ${plans[i].product.handle}: ${res.mediaUserErrors.map(e => e.message).join(', ')}`); }
        else { ok++; process.stdout.write(`\r  [${i+1}/${plans.length}] ok=${ok}   `); }
      } catch (e) { fail++; console.log(`  [${i+1}/${plans.length}] ${plans[i].product.handle}: ${e.message}`); }
      await delay(600);
    }
    console.log(`\n\nReorder: ok=${ok} fail=${fail}`);
    return;
  }

  // REPLACE FROM
  if (args.replaceFrom) {
    const source = products.find(p => p.handle === args.replaceFrom);
    if (!source) { console.error(`Modelo não encontrado: ${args.replaceFrom}`); process.exit(1); }
    console.log(`Modelo: ${source.title} (${source.images?.length} imagens)\n`);

    const targetsToReplace = targets.filter(t => t.id !== source.id);
    console.log(`${targetsToReplace.length} produtos receberão as imagens do modelo\n`);
    for (const t of targetsToReplace.slice(0, 10)) console.log(`  ${t.title.slice(0, 55).padEnd(57)} | tem ${t.images?.length || 0} imgs → vai receber ${source.images?.length || 0}`);

    printEstimate({ count: targetsToReplace.length, opName: 'replace images from model (delete + recreate)', rateLimitMs: 600, unit: 'produtos' });
    const cost2 = parseCostFlags(process.argv);
    if (abortIfTooLarge({ count: targetsToReplace.length, expected: cost2.expected, force: cost2.forceLarge })) process.exit(2);

    if (!args.apply) { console.log('\n[DRY-RUN] Rode --apply. Vai DELETAR imagens atuais e adicionar as do modelo.'); return; }

    let ok = 0, fail = 0;
    for (let i = 0; i < targetsToReplace.length; i++) {
      const t = targetsToReplace[i];
      try {
        // 1. Delete todas imagens atuais
        if (t.images?.length) {
          const delMutation = `
            mutation del($productId: ID!, $mediaIds: [ID!]!) {
              productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
                deletedMediaIds mediaUserErrors { message }
              }
            }`;
          await shReq(client.shopify_domain, client.shopify_access_token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
            query: delMutation,
            variables: { productId: `gid://shopify/Product/${t.id}`, mediaIds: t.images.map(img => `gid://shopify/MediaImage/${img.id}`) }
          });
          await delay(800);
        }
        // 2. Add imagens do modelo
        const createMutation = `
          mutation cre($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
              media { id } mediaUserErrors { message }
            }
          }`;
        const media = (source.images || []).map(img => ({ originalSource: img.src, alt: img.alt || t.title, mediaContentType: 'IMAGE' }));
        const r = await shReq(client.shopify_domain, client.shopify_access_token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
          query: createMutation,
          variables: { productId: `gid://shopify/Product/${t.id}`, media }
        });
        const errs = r.body?.data?.productCreateMedia?.mediaUserErrors || [];
        if (errs.length) { fail++; console.log(`  [${i+1}/${targetsToReplace.length}] ${t.handle}: ${errs.map(e => e.message).join(', ')}`); }
        else { ok++; process.stdout.write(`\r  [${i+1}/${targetsToReplace.length}] ok=${ok}   `); }
      } catch (e) { fail++; console.log(`  [${i+1}/${targetsToReplace.length}] ${t.handle}: ${e.message}`); }
      await delay(800);
    }
    console.log(`\n\nReplace: ok=${ok} fail=${fail}`);
    return;
  }

  // DEDUPE
  if (args.dedupeImages) {
    const plans = [];
    for (const p of targets) {
      const seen = new Set();
      const dups = [];
      for (const img of (p.images || [])) {
        const key = img.src?.split('?')[0];
        if (seen.has(key)) dups.push(img);
        else seen.add(key);
      }
      if (dups.length) plans.push({ product: p, dups });
    }
    const totalDups = plans.reduce((s, p) => s + p.dups.length, 0);
    console.log(`${plans.length} produtos com imagens duplicadas (total ${totalDups} dups)\n`);
    for (const plan of plans.slice(0, 10)) console.log(`  ${plan.product.title.slice(0, 55).padEnd(57)} | ${plan.dups.length} dups`);

    printEstimate({ count: totalDups, opName: 'delete duplicate images', rateLimitMs: 600, unit: 'imagens' });
    const cost3 = parseCostFlags(process.argv);
    if (abortIfTooLarge({ count: totalDups, expected: cost3.expected, force: cost3.forceLarge })) process.exit(2);

    if (!args.apply) { console.log('\n[DRY-RUN] Rode --apply pra deletar dups.'); return; }

    let ok = 0, fail = 0;
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      try {
        const mutation = `
          mutation del($productId: ID!, $mediaIds: [ID!]!) {
            productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
              deletedMediaIds mediaUserErrors { message }
            }
          }`;
        const r = await shReq(client.shopify_domain, client.shopify_access_token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
          query: mutation,
          variables: { productId: `gid://shopify/Product/${plan.product.id}`, mediaIds: plan.dups.map(d => `gid://shopify/MediaImage/${d.id}`) }
        });
        const errs = r.body?.data?.productDeleteMedia?.mediaUserErrors || [];
        if (errs.length) { fail++; console.log(`  [${i+1}/${plans.length}] ${plan.product.handle}: ${errs.map(e => e.message).join(', ')}`); }
        else { ok++; process.stdout.write(`\r  [${i+1}/${plans.length}] ok=${ok}   `); }
      } catch (e) { fail++; console.log(`  [${i+1}/${plans.length}] ${plan.product.handle}: ${e.message}`); }
      await delay(600);
    }
    console.log(`\n\nDedupe: ok=${ok} fail=${fail}`);
    return;
  }

  console.error('Escolha uma operação: --reorder=... | --replace-from=... | --dedupe-images');
  process.exit(1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
