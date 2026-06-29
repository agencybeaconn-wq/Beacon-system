#!/usr/bin/env node
// bulk-deploy-products — Deploy 1000+ produtos em ~5 min via bulkOperationRunMutation + productSet
//
// Usa a API moderna da Shopify (2026-04):
//   1. stagedUploadsCreate → URL pré-assinada
//   2. Upload JSONL (1 linha = 1 productSet input)
//   3. bulkOperationRunMutation → Shopify processa server-side
//   4. Poll até COMPLETED
//
// Uso:
//   node bulk-deploy-products.mjs "Cliente Destino"                          # dry-run
//   node bulk-deploy-products.mjs "Cliente Destino" --apply                  # executa
//   node bulk-deploy-products.mjs "Cliente Destino" --apply --source="EN"    # usa template EN
//   node bulk-deploy-products.mjs "Cliente Destino" --apply --source-id=UUID # source custom

import { getCreds, shReq, shopifyGraphQL, nextPageUrl, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { fetchClient } from '../../lib/supabase-rest.mjs';
import https from 'https';
import fs from 'fs';

// Template IDs
const TEMPLATES = {
  BR: '5e836736-7411-42d8-b99e-bcad1e55919d',
  EN: '17089519-4779-41bb-96ca-9791e0677cf8',
};

// ---- Args ----
function parseArgs() {
  const args = { name: null, apply: false, source: 'BR', sourceId: null, publish: true, concurrency: 10 };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--no-publish') args.publish = false;
    else if (a === '--publish') args.publish = true;
    else if (a.startsWith('--source=')) args.source = a.slice(9).toUpperCase();
    else if (a.startsWith('--source-id=')) args.sourceId = a.slice(12);
    else if (a.startsWith('--concurrency=')) args.concurrency = parseInt(a.slice(14), 10) || 10;
    else if (!a.startsWith('--')) args.name = a;
  }
  return args;
}

// ---- Publish products in parallel (10 concurrent default) ----
// Workaround pra apps sem write_publications scope: REST PUT published:true funciona com write_products.
// Rate-limit aware via shReq retry automático em 429.
async function publishProductsParallel(shop, token, productIds, concurrency = 10) {
  const start = Date.now();
  const queue = productIds.slice();
  let ok = 0, fail = 0, processed = 0;
  const total = productIds.length;

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id == null) break;
      try {
        const r = await shReq(shop, token, 'PUT',
          `/admin/api/${API_VERSION}/products/${id}.json`,
          { product: { id, published: true } });
        if (r.status === 200 && r.body?.product?.published_at) ok++;
        else fail++;
      } catch {
        fail++;
      }
      processed++;
      if (processed % 100 === 0) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        process.stdout.write(`\r  ${processed}/${total} publicados (ok=${ok} fail=${fail})  ${elapsed}s    `);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
  console.log('');
  return { ok, fail, ms: Date.now() - start };
}

// ---- Fetch all products (paginated) ----
async function fetchAllProducts(shop, token, fieldsOnly = false) {
  const products = [];
  const fields = fieldsOnly ? '&fields=id,handle' : '';
  let path = `/admin/api/${API_VERSION}/products.json?limit=250${fields}`;
  while (path) {
    const res = await shReq(shop, token, 'GET', path);
    products.push(...(res.body?.products || []));
    path = nextPageUrl(res.link);
    if (path) await delay(500);
  }
  return products;
}

// ---- Build productSet JSONL input ----
function buildProductSetInput(p) {
  const input = {
    title: p.title,
    handle: p.handle,
    descriptionHtml: p.body_html || '',
    vendor: p.vendor || '',
    productType: p.product_type || '',
    tags: (p.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    status: 'ACTIVE',
  };

  if (p.variants?.length) {
    input.productOptions = (p.options || []).map(o => ({
      name: o.name,
      values: (o.values || []).map(v => ({ name: v }))
    }));

    input.variants = p.variants.map(v => {
      const variant = {
        optionValues: [],
        price: parseFloat(v.price) || 0,
        inventoryPolicy: 'CONTINUE',
        inventoryItem: { tracked: false },
      };
      if (v.compare_at_price && parseFloat(v.compare_at_price) > parseFloat(v.price)) {
        variant.compareAtPrice = parseFloat(v.compare_at_price);
      }
      if (v.sku) variant.sku = v.sku;
      if (v.option1 && p.options?.[0]) variant.optionValues.push({ optionName: p.options[0].name, name: v.option1 });
      if (v.option2 && p.options?.[1]) variant.optionValues.push({ optionName: p.options[1].name, name: v.option2 });
      if (v.option3 && p.options?.[2]) variant.optionValues.push({ optionName: p.options[2].name, name: v.option3 });
      return variant;
    });
  }

  if (p.images?.length) {
    input.files = p.images.map(img => ({
      originalSource: img.src,
      alt: img.alt || '',
      contentType: 'IMAGE',
    }));
  }

  return { input };
}

// ---- stagedUploadsCreate ----
async function createStagedUpload(shop, token) {
  const res = await shopifyGraphQL(shop, token, `
    mutation {
      stagedUploadsCreate(input: [{
        resource: BULK_MUTATION_VARIABLES
        filename: "products.jsonl"
        mimeType: "text/jsonl"
        httpMethod: POST
      }]) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { message field }
      }
    }
  `);
  const target = res?.data?.stagedUploadsCreate?.stagedTargets?.[0];
  const errors = res?.data?.stagedUploadsCreate?.userErrors || [];
  if (errors.length) throw new Error('stagedUploadsCreate: ' + errors.map(e => e.message).join(', '));
  if (!target) throw new Error('No staged target: ' + JSON.stringify(res));
  return target;
}

// ---- Upload JSONL ----
function uploadToStaged(target, jsonlContent) {
  return new Promise((resolve, reject) => {
    const url = new URL(target.url);
    const boundary = '----FormBoundary' + Date.now();
    const parts = [];
    for (const param of target.parameters) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${param.name}"\r\n\r\n${param.value}`);
    }
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="products.jsonl"\r\nContent-Type: text/jsonl\r\n\r\n${jsonlContent}`);
    parts.push(`--${boundary}--`);
    const body = parts.join('\r\n');

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode < 400) resolve(b);
        else reject(new Error(`Upload ${res.statusCode}: ${b.slice(0, 300)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---- bulkOperationRunMutation ----
async function runBulkMutation(shop, token, stagedUploadPath) {
  const mutation = `
    mutation productSet($input: ProductSetInput!) {
      productSet(input: $input, synchronous: true) {
        product { id handle }
        userErrors { field message code }
      }
    }
  `;
  const res = await shopifyGraphQL(shop, token, `
    mutation($mutation: String!, $stagedUploadPath: String!) {
      bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
        bulkOperation { id status }
        userErrors { message field }
      }
    }
  `, { mutation, stagedUploadPath });
  const errors = res?.data?.bulkOperationRunMutation?.userErrors || [];
  if (errors.length) throw new Error('bulkOperationRunMutation: ' + errors.map(e => e.message).join(', '));
  return res?.data?.bulkOperationRunMutation?.bulkOperation;
}

// ---- Poll ----
async function pollBulkOperation(shop, token, operationId) {
  while (true) {
    const res = await shopifyGraphQL(shop, token, `{
      node(id: "${operationId}") {
        ... on BulkOperation { id status errorCode objectCount url fileSize }
      }
    }`);
    const op = res?.data?.node;
    const pct = op?.objectCount ? ` (${op.objectCount} objects)` : '';
    process.stdout.write(`\r  ${op?.status || '?'}${pct}    `);
    if (op?.status === 'COMPLETED') { console.log(''); return op; }
    if (op?.status === 'FAILED') throw new Error('FAILED: ' + (op?.errorCode || 'unknown'));
    if (op?.status === 'CANCELED') throw new Error('CANCELED');
    await delay(5000);
  }
}

// ---- Download results ----
async function downloadResults(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

// ---- Main ----
async function main() {
  const args = parseArgs();
  if (!args.name) {
    console.error('Uso: node bulk-deploy-products.mjs "Nome do Cliente" [--apply] [--source=BR|EN] [--source-id=UUID]');
    process.exit(1);
  }

  const startTime = Date.now();
  console.log(`\n=== bulk-deploy-products ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===\n`);

  // Resolve client
  const client = await fetchClient(args.name);
  if (!client) { console.error('Cliente nao encontrado: ' + args.name); process.exit(1); }
  console.log(`Destino: ${client.name} (${client.shopify_domain})`);

  // Resolve source
  const sourceId = args.sourceId || TEMPLATES[args.source];
  if (!sourceId) { console.error('Template nao encontrado: ' + args.source); process.exit(1); }
  const src = await getCreds(sourceId);
  const dst = await getCreds(client.id);
  console.log(`Fonte:   ${src.name} (${src.shop})\n`);

  // Fetch existing
  console.log('Buscando produtos existentes no destino...');
  const existingProds = await fetchAllProducts(dst.shop, dst.token, true);
  const existingHandles = new Set(existingProds.map(p => p.handle));
  console.log(`  ${existingHandles.size} produtos existentes\n`);

  // Fetch source
  console.log('Buscando produtos do template...');
  const srcProducts = await fetchAllProducts(src.shop, src.token);
  console.log(`  ${srcProducts.length} produtos no template\n`);

  // Deduplicate
  const seen = new Set();
  const toCreate = srcProducts.filter(p => {
    if (existingHandles.has(p.handle)) return false;
    if (seen.has(p.handle)) return false;
    seen.add(p.handle);
    return true;
  });

  console.log(`A criar: ${toCreate.length} (pulando ${srcProducts.length - toCreate.length} existentes/dupes)\n`);

  if (toCreate.length === 0) {
    console.log('Nada a criar — loja ja tem todos os produtos do template.');
    return;
  }

  if (!args.apply) {
    console.log('[DRY-RUN] Rode com --apply pra executar.');
    console.log(`\nAmostra (primeiros 5):`);
    toCreate.slice(0, 5).forEach(p => console.log(`  - ${p.title} (${p.variants?.length || 0} vars, ${p.images?.length || 0} imgs)`));
    return;
  }

  // Build JSONL
  console.log('Gerando JSONL...');
  const jsonlLines = toCreate.map(p => JSON.stringify(buildProductSetInput(p)));
  const jsonlContent = jsonlLines.join('\n');
  const tmpPath = `/tmp/bulk-deploy-${client.id.slice(0, 8)}.jsonl`;
  fs.writeFileSync(tmpPath, jsonlContent);
  console.log(`  ${jsonlLines.length} linhas, ${(Buffer.byteLength(jsonlContent) / 1024 / 1024).toFixed(1)}MB → ${tmpPath}\n`);

  // Staged upload
  console.log('Criando staged upload...');
  const target = await createStagedUpload(dst.shop, dst.token);

  console.log('Fazendo upload do JSONL...');
  await uploadToStaged(target, jsonlContent);
  const stagedPath = target.parameters.find(p => p.name === 'key')?.value;
  console.log(`  Upload completo\n`);

  // Bulk mutation
  console.log('Iniciando bulk operation...');
  const bulkOp = await runBulkMutation(dst.shop, dst.token, stagedPath);
  console.log(`  ID: ${bulkOp.id}\n`);

  console.log('Aguardando conclusao...');
  const result = await pollBulkOperation(dst.shop, dst.token, bulkOp.id);

  // Results — extract created IDs pra publish paralelo
  let created = 0, errors = 0;
  const createdGids = [];
  if (result.url) {
    const data = await downloadResults(result.url);
    const lines = data.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const pid = obj.data?.productSet?.product?.id;
        if (pid) { created++; createdGids.push(pid); }
        if (obj.data?.productSet?.userErrors?.length) errors++;
      } catch {}
    }
  }

  const createTimeSec = Math.round((Date.now() - startTime) / 1000);

  // Publish paralelo — workaround pro productSet não aceitar publications sem write_publications scope
  let publishStats = null;
  if (args.publish && created > 0) {
    console.log(`\nPublicando ${created} produtos no Online Store (${args.concurrency} paralelos)...`);
    // productSet retorna gid://shopify/Product/123 — extrai só o número pro REST PUT
    const numericIds = createdGids
      .map(gid => { const m = (gid || '').match(/\/Product\/(\d+)/); return m ? m[1] : null; })
      .filter(Boolean);
    publishStats = await publishProductsParallel(dst.shop, dst.token, numericIds, args.concurrency);
    console.log(`  ✓ Publicados: ${publishStats.ok} | Fails: ${publishStats.fail} | Tempo: ${(publishStats.ms / 1000).toFixed(0)}s`);
  } else if (!args.publish) {
    console.log('\n(skip publish — rode com --publish ou sem --no-publish)');
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n========== RELATORIO ==========`);
  console.log(`Submetidos:     ${toCreate.length}`);
  console.log(`Criados:        ${created}`);
  console.log(`Erros create:   ${errors}`);
  if (publishStats) {
    console.log(`Publicados:     ${publishStats.ok}/${createdGids.length}`);
    console.log(`Publish fails:  ${publishStats.fail}`);
  }
  console.log(`Ja existiam:    ${srcProducts.length - toCreate.length}`);
  console.log(`Tempo create:   ${createTimeSec}s`);
  if (publishStats) console.log(`Tempo publish:  ${(publishStats.ms / 1000).toFixed(0)}s`);
  console.log(`Tempo TOTAL:    ${totalTime}s (${Math.round(totalTime / 60)}min)`);
  console.log(`Velocidade:     ${Math.round(toCreate.length / (totalTime / 60))} produtos/min`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
