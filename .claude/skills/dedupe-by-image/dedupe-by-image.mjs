#!/usr/bin/env node
// dedupe-by-image — agrupa produtos por similaridade de imagem (dHash + Hamming).
// Detecta camisas duplicadas com títulos diferentes (typo, reordering, idioma).

import { fetchClient } from '../../lib/supabase-rest.mjs';
import { shReq, nextPageUrl, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = path.join(__dirname, '.tmp_image_dedupe_plan.json');

function parseArgs() {
  const args = { _: [], apply: false, threshold: 6, concurrency: 10 };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--threshold=')) args.threshold = parseInt(a.slice(12), 10);
    else if (a.startsWith('--concurrency=')) args.concurrency = parseInt(a.slice(14), 10);
    else args._.push(a);
  }
  return args;
}

async function fetchAllProducts(shop, token) {
  const all = [];
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,handle,created_at,images`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    if (r.status !== 200) throw new Error(`Shopify ${r.status}`);
    all.push(...(r.body.products || []));
    p = nextPageUrl(r.link);
    if (p) await delay(400);
  }
  return all;
}

async function dHash(imageUrl) {
  // Resize 9x8 grayscale, depois compara adjacent pixels horizontais.
  // 8 linhas × 8 pares = 64 bits.
  const img = await Jimp.read(imageUrl);
  img.resize({ w: 9, h: 8 }).greyscale();
  const bits = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = img.getPixelColor(x, y);
      const right = img.getPixelColor(x + 1, y);
      // Jimp pixel color é AARRGGBB. Pra grayscale, R=G=B, então pegamos R.
      const lR = (left >>> 24) & 0xff;
      const rR = (right >>> 24) & 0xff;
      bits.push(lR > rR ? 1 : 0);
    }
  }
  // Converte 64 bits pra BigInt pra Hamming fácil
  let hash = 0n;
  for (const b of bits) hash = (hash << 1n) | BigInt(b);
  return hash;
}

function hamming(a, b) {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

async function processWithConcurrency(items, fn, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { results[i] = await fn(items[i], i); }
      catch (e) { results[i] = { error: e.message }; }
      done++;
      if (done % 50 === 0 || done === items.length) {
        process.stdout.write(`\r  [${done}/${items.length}]   `);
      }
    }
  }
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  console.log('');
  return results;
}

async function main() {
  const args = parseArgs();
  if (!args._[0]) { console.error('Uso: node dedupe-by-image.mjs <client> [--threshold=N] [--apply]'); process.exit(1); }

  const client = await fetchClient(args._[0]);
  if (!client) { console.error('Cliente não encontrado'); process.exit(1); }

  console.log(`\n=== dedupe-by-image ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`Cliente: ${client.name}`);
  console.log(`Threshold Hamming: ${args.threshold} (menor = mais estrito)`);

  console.log(`\nBuscando produtos...`);
  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token);
  console.log(`  ${products.length} produtos`);

  const withImage = products.filter(p => p.images && p.images.length > 0);
  console.log(`  ${withImage.length} com imagem (resto skipado)`);

  console.log(`\nDownload + hash (concurrency ${args.concurrency}):`);
  const hashes = await processWithConcurrency(
    withImage,
    async (p) => {
      try {
        const h = await dHash(p.images[0].src);
        return { product: p, hash: h, error: null };
      } catch (e) {
        return { product: p, hash: null, error: e.message };
      }
    },
    args.concurrency
  );

  const hashed = hashes.filter(h => h.hash !== null);
  const failed = hashes.filter(h => h.hash === null);
  console.log(`\n  ${hashed.length} hashed, ${failed.length} fail`);

  // Agrupa por similaridade
  console.log(`\nComparando ${hashed.length} hashes (${hashed.length * (hashed.length - 1) / 2} pares)...`);
  const used = new Set();
  const groups = [];
  for (let i = 0; i < hashed.length; i++) {
    if (used.has(i)) continue;
    const group = [hashed[i]];
    used.add(i);
    for (let j = i + 1; j < hashed.length; j++) {
      if (used.has(j)) continue;
      const d = hamming(hashed[i].hash, hashed[j].hash);
      if (d <= args.threshold) {
        group.push(hashed[j]);
        used.add(j);
      }
    }
    if (group.length > 1) groups.push(group);
  }

  // Ordena: keeper = mais antigo (menor created_at)
  for (const g of groups) {
    g.sort((a, b) => new Date(a.product.created_at) - new Date(b.product.created_at));
  }

  console.log(`\n=== PREVIEW ===`);
  console.log(`Grupos de duplicatas: ${groups.length}`);
  console.log(`Produtos que seriam deletados: ${groups.reduce((s, g) => s + g.length - 1, 0)}`);

  console.log(`\nAmostra (até 20 grupos):\n`);
  for (const g of groups.slice(0, 20)) {
    const keeper = g[0];
    console.log(`  Hash: ${keeper.hash.toString(16).padStart(16, '0')}`);
    console.log(`    ✓ KEEPER: [${keeper.product.id}] "${keeper.product.title}" (${keeper.product.created_at.slice(0, 10)}, ${keeper.product.images.length}img)`);
    for (const d of g.slice(1)) {
      const dist = hamming(keeper.hash, d.hash);
      console.log(`    ✗ DELETE: [${d.product.id}] "${d.product.title}" (${d.product.created_at.slice(0, 10)}, ${d.product.images.length}img) — Hamming=${dist}`);
    }
    console.log('');
  }
  if (groups.length > 20) console.log(`  ...+${groups.length - 20} grupos`);

  // Salva plan
  const plan = {
    client: client.name,
    threshold: args.threshold,
    timestamp: new Date().toISOString(),
    total_products: products.length,
    hashed: hashed.length,
    failed: failed.length,
    groups: groups.map(g => ({
      keeper: { id: g[0].product.id, title: g[0].product.title, hash: g[0].hash.toString(16) },
      duplicates: g.slice(1).map(d => ({
        id: d.product.id,
        title: d.product.title,
        hash: d.hash.toString(16),
        hamming: hamming(g[0].hash, d.hash)
      }))
    })),
    failed_samples: failed.slice(0, 10).map(f => ({ id: f.product.id, title: f.product.title, error: f.error }))
  };
  fs.writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2));
  console.log(`\n📋 Plan salvo em: ${PLAN_PATH}`);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Pra deletar, rode com --apply`);
    console.log(`Antes disso REVISE o plan — falso positivo deleta camisa boa.`);
    return;
  }

  // APPLY
  console.log(`\n=== APPLY ===`);
  const toDelete = groups.flatMap(g => g.slice(1).map(d => d.product));
  console.log(`Deletando ${toDelete.length} produtos...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < toDelete.length; i++) {
    const p = toDelete[i];
    try {
      const r = await shReq(
        client.shopify_domain, client.shopify_access_token,
        'DELETE', `/admin/api/${API_VERSION}/products/${p.id}.json`
      );
      if (r.status >= 200 && r.status < 300) ok++; else fail++;
    } catch { fail++; }
    if ((i + 1) % 10 === 0 || i === toDelete.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${toDelete.length}] ok=${ok} fail=${fail}  `);
    }
    await delay(400);
  }
  console.log(`\n\n✓ Deletados: ok=${ok} fail=${fail}`);
}

main().catch(e => { console.error(`\n❌ Erro: ${e.message}`); process.exit(1); });
