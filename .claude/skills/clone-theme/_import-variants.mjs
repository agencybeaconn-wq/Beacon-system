#!/usr/bin/env node
// AÇÃO G: scrape variants do LF + importa pra Mont Royal todas as variants faltantes
// Inclui imagens originais + setInventoryPolicy CONTINUE + tracked false (available)

import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const CLIENT_ID = 'd9e577c9-2189-42d1-8bba-ee456008dcbb';

function loadEnv() {
  const env = {};
  fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
  return env;
}

const env = loadEnv();
const SUPA = new URL(env.VITE_SUPABASE_URL);
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

function proxy(body) {
  return new Promise((res, rej) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: SUPA.hostname,
      path: '/functions/v1/shopify-admin-proxy',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Length': Buffer.byteLength(payload) },
    }, r => { let b=''; r.on('data',c=>b+=c); r.on('end',()=>{ try { res(JSON.parse(b)); } catch { res(b); } }); });
    req.on('error', rej); req.write(payload); req.end();
  });
}

function gql(query, variables) {
  return proxy({ clientId: CLIENT_ID, resource: 'products', method: 'graphql', payload: { query, variables } });
}

async function fetchLFProduct(handle) {
  try {
    const r = await fetch('https://luckyfours.com/products/' + handle + '.json');
    if (!r.ok) return null;
    const j = await r.json();
    return j.product;
  } catch { return null; }
}

async function getMRProduct(handle) {
  const q = `{ productByHandle(handle: "${handle}") { id title variants(first: 60) { edges { node { id title } } } } }`;
  const r = await gql(q);
  return r.data && r.data.productByHandle;
}

async function listAllMRProducts() {
  const all = [];
  let cursor = null;
  while (true) {
    const q = `{ products(first: 100${cursor ? `, after: "${cursor}"` : ''}) { edges { cursor node { handle } } pageInfo { hasNextPage endCursor } } }`;
    const r = await gql(q);
    r.data.products.edges.forEach(e => all.push(e.node.handle));
    if (!r.data.products.pageInfo.hasNextPage) break;
    cursor = r.data.products.pageInfo.endCursor;
  }
  return all;
}

async function createVariants(productId, variants) {
  return gql(
    'mutation($pid:ID!,$vars:[ProductVariantsBulkInput!]!){productVariantsBulkCreate(productId:$pid,variants:$vars){productVariants{id title}userErrors{message}}}',
    { pid: productId, vars: variants }
  );
}

async function createMedia(productId, originalSource, alt) {
  return gql(
    'mutation($pid:ID!,$m:[CreateMediaInput!]!){productCreateMedia(productId:$pid,media:$m){media{...on MediaImage{id}}mediaUserErrors{message}}}',
    { pid: productId, m: [{ originalSource, alt, mediaContentType: 'IMAGE' }] }
  );
}

async function attachMediaToVariant(productId, variantId, mediaId) {
  return gql(
    'mutation($pid:ID!,$vm:[ProductVariantAppendMediaInput!]!){productVariantAppendMedia(productId:$pid,variantMedia:$vm){userErrors{message}}}',
    { pid: productId, vm: [{ variantId, mediaIds: [mediaId] }] }
  );
}

async function setVariantAvailable(productId, variantId) {
  // inventoryPolicy CONTINUE
  await gql(
    'mutation($pid:ID!,$vars:[ProductVariantsBulkInput!]!){productVariantsBulkUpdate(productId:$pid,variants:$vars){userErrors{message}}}',
    { pid: productId, vars: [{ id: variantId, inventoryPolicy: 'CONTINUE' }] }
  );
  // tracked false
  const q = `{ productVariant(id: "${variantId}") { inventoryItem { id } } }`;
  const r = await gql(q);
  const iid = r.data && r.data.productVariant && r.data.productVariant.inventoryItem && r.data.productVariant.inventoryItem.id;
  if (iid) {
    await gql(
      'mutation($id:ID!,$input:InventoryItemInput!){inventoryItemUpdate(id:$id,input:$input){userErrors{message}}}',
      { id: iid, input: { tracked: false } }
    );
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processProduct(handle, logFile) {
  const lf = await fetchLFProduct(handle);
  if (!lf) { fs.appendFileSync(logFile, `${handle}: NO LF MATCH\n`); return { created: 0, errors: 0, skipped: true }; }
  const mr = await getMRProduct(handle);
  if (!mr) { fs.appendFileSync(logFile, `${handle}: NO MR\n`); return { created: 0, errors: 0, skipped: true }; }

  const mrTitles = new Set(mr.variants.edges.map(e => e.node.title.toLowerCase()));
  const missing = lf.variants.filter(v => !mrTitles.has((v.title || v.option1 || '').toLowerCase()));
  if (missing.length === 0) { fs.appendFileSync(logFile, `${handle}: nothing to import\n`); return { created: 0, errors: 0, skipped: true }; }

  fs.appendFileSync(logFile, `\n=== ${handle} (${missing.length} variants) ===\n`);
  const imgById = {};
  (lf.images || []).forEach(i => imgById[i.id] = i.src);

  // Cria todas variants em batch
  const newVariants = missing.map(v => ({
    optionValues: [{ optionName: lf.options[0]?.name || 'Color', name: v.title || v.option1 || 'Default' }],
    price: v.price,
    compareAtPrice: v.compare_at_price || undefined,
  }));

  const createRes = await createVariants(mr.id, newVariants);
  const created = createRes.data && createRes.data.productVariantsBulkCreate;
  const errs = (created && created.userErrors) || [];
  if (errs.length > 0) {
    fs.appendFileSync(logFile, ` userErrors: ${JSON.stringify(errs)}\n`);
    return { created: 0, errors: errs.length, skipped: false };
  }
  const createdVariants = (created && created.productVariants) || [];
  await sleep(300);

  let mediaCount = 0;
  for (let i = 0; i < missing.length; i++) {
    const lfV = missing[i];
    const mrV = createdVariants.find(c => c.title.toLowerCase() === (lfV.title || lfV.option1 || '').toLowerCase());
    if (!mrV) continue;
    // setInventoryPolicy CONTINUE + tracked false
    try { await setVariantAvailable(mr.id, mrV.id); } catch (e) { fs.appendFileSync(logFile, `  ${mrV.title} avail err: ${e.message}\n`); }
    await sleep(200);
    // Image
    const imgSrc = imgById[lfV.image_id];
    if (imgSrc) {
      const cm = await createMedia(mr.id, imgSrc, mrV.title);
      const mid = cm.data && cm.data.productCreateMedia && cm.data.productCreateMedia.media && cm.data.productCreateMedia.media[0] && cm.data.productCreateMedia.media[0].id;
      if (mid) {
        await sleep(1200);
        const att = await attachMediaToVariant(mr.id, mrV.id, mid);
        if (att.data && att.data.productVariantAppendMedia && att.data.productVariantAppendMedia.userErrors && att.data.productVariantAppendMedia.userErrors.length) {
          fs.appendFileSync(logFile, `  ${mrV.title} attach err: ${JSON.stringify(att.data.productVariantAppendMedia.userErrors)}\n`);
        } else {
          mediaCount++;
        }
      }
    }
    await sleep(300);
    fs.appendFileSync(logFile, `  ${mrV.title} OK\n`);
  }

  return { created: createdVariants.length, errors: 0, skipped: false, media: mediaCount };
}

async function main() {
  const handles = await listAllMRProducts();
  console.log('Total products:', handles.length);
  const logFile = path.join(REPO_ROOT, '.import-variants.log');
  fs.writeFileSync(logFile, `=== Import variants ${new Date().toISOString()} ===\nProducts: ${handles.length}\n\n`);
  let totalCreated = 0, totalErrors = 0, totalMedia = 0, processed = 0;
  for (const h of handles) {
    processed++;
    try {
      const r = await processProduct(h, logFile);
      totalCreated += r.created || 0;
      totalErrors += r.errors || 0;
      totalMedia += r.media || 0;
      const status = r.skipped ? 'skip' : `+${r.created || 0}v +${r.media || 0}img`;
      process.stdout.write(`\r[${processed}/${handles.length}] ${h.slice(0, 30).padEnd(30)} ${status}                          `);
    } catch (e) {
      fs.appendFileSync(logFile, `${h}: EXCEPTION ${e.message}\n`);
      totalErrors++;
    }
    await sleep(400);
  }
  console.log(`\n\nDONE. Variants created: ${totalCreated}, media: ${totalMedia}, errors: ${totalErrors}`);
  fs.appendFileSync(logFile, `\n=== SUMMARY: ${totalCreated} variants / ${totalMedia} images / ${totalErrors} errors ===\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
