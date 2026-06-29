#!/usr/bin/env node
// import-from-csv — importa produtos de um CSV Shopify-export pra um cliente Shopify.
//
// Diferente de import-missing.mjs (que compara 2 lojas Shopify), esse aceita CSV
// como fonte. Pricing é aplicado automaticamente via client_pricing do cliente alvo.
//
// Uso:
//   node import-from-csv.mjs <clienteAlvo> --csv=path/produtos.csv [--handles=handles.json] [--apply]
//
// Flags:
//   --csv=path              CSV no formato Shopify export (Handle, Title, Body, etc)
//   --handles=path.json     JSON com { items: [{handle, title, ...}] } — só importa estes
//   --apply                 Aplica de verdade (default: dry-run)
//   --limit=N               Limita número de produtos (útil pra testes)
//   --resume                Retoma checkpoint
//   --status                Mostra progresso do checkpoint
//   --concurrency=N         Dispatch simultâneo de productSet (default: 5)
//
// Background-safe: checkpoint após cada produto, SIGINT, --resume, --status.
//
// Fluxo:
// 1. Lê CSV, agrupa por handle (CSV tem múltiplas linhas por produto)
// 2. Se --handles=path.json, filtra só os handles dessa lista
// 3. Pra cada produto: converte pra ProductSetInput + aplica pricing do cliente
// 4. Dispatch via productSet async, polla operação
// 5. Salva checkpoint a cada 5 produtos

import { productSet, pollProductOperation } from '../../lib/shopify-api.mjs';
import { fetchPricing } from '../../lib/supabase-rest.mjs';
import { assertClientExists, assertShopifyConnected, assertPricingConfigured, appendExecutionLog } from '../../lib/validate.mjs';
import { calcExpectedPrice, categorize } from '../../lib/shopify-pricing.mjs';
import { writeCheckpoint, readCheckpoint, clearCheckpoint, installSigintHandler, hasCheckpoint } from '../../lib/checkpoint.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SKILL_NAME = 'import-from-csv';

function parseArgs() {
  const args = { _: [], csv: null, handles: null, apply: false, limit: null, resume: false, status: false, concurrency: 5, asis: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--resume') args.resume = true;
    else if (a === '--status') args.status = true;
    else if (a === '--asis') args.asis = true;
    else if (a.startsWith('--csv=')) args.csv = a.slice(6);
    else if (a.startsWith('--handles=')) args.handles = a.slice(10);
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8)) || null;
    else if (a.startsWith('--concurrency=')) args.concurrency = parseInt(a.slice(14)) || 5;
    else args._.push(a);
  }
  return args;
}

// ── CSV parser (quoted + newlines inside quotes) ────────────────────────
function parseCSV(content) {
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQ) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

/**
 * Lê CSV no formato Shopify export e agrupa por handle.
 * Retorna Map<handle, { handle, title, body_html, vendor, ..., variants: [], images: [], options: [] }>.
 */
function loadCsvProducts(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);
  const header = rows[0];
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });

  const products = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const handle = r[idx['Handle']];
    if (!handle) continue;
    if (!products.has(handle)) {
      products.set(handle, {
        handle,
        title: r[idx['Title']] || '',
        body_html: r[idx['Body (HTML)']] || '',
        vendor: r[idx['Vendor']] || '',
        product_type: r[idx['Type']] || '',
        tags: r[idx['Tags']] || '',
        status: r[idx['Status']] || 'active',
        options: [], // [{ name, values: Set }]
        variants: [],
        images: [],
        _imageSet: new Set(),
      });
    }
    const p = products.get(handle);
    // Primeira linha costuma ter title/body/vendor; linhas extras podem ter só variant/image
    if (r[idx['Title']] && !p.title) p.title = r[idx['Title']];
    if (r[idx['Body (HTML)']] && !p.body_html) p.body_html = r[idx['Body (HTML)']];
    if (r[idx['Vendor']] && !p.vendor) p.vendor = r[idx['Vendor']];
    if (r[idx['Type']] && !p.product_type) p.product_type = r[idx['Type']];
    if (r[idx['Tags']] && !p.tags) p.tags = r[idx['Tags']];

    // Options: Shopify CSV só coloca `Option N Name` na PRIMEIRA linha do produto.
    // Linhas subsequentes só têm Value. Aceitamos Value mesmo sem Name e assumimos
    // que o Name da primeira linha é o canônico.
    for (let j = 1; j <= 3; j++) {
      const optName = r[idx[`Option${j} Name`]];
      const optValue = r[idx[`Option${j} Value`]];
      if (optName) {
        // Primeira linha do produto (ou atualização de name)
        let opt = p.options[j - 1];
        if (!opt) {
          opt = { name: optName, position: j, values: new Set() };
          p.options[j - 1] = opt;
        }
        if (optValue) opt.values.add(optValue);
      } else if (optValue && p.options[j - 1]) {
        // Linha subsequente: só Value, usa o Name canônico
        p.options[j - 1].values.add(optValue);
      }
    }

    // Variants
    const opt1 = r[idx['Option1 Value']];
    const opt2 = r[idx['Option2 Value']];
    const opt3 = r[idx['Option3 Value']];
    const price = r[idx['Variant Price']];
    const sku = r[idx['Variant SKU']];
    const compareAt = r[idx['Variant Compare At Price']];
    const barcode = r[idx['Variant Barcode']];
    if (opt1 && price) {
      p.variants.push({
        option1: opt1,
        option2: opt2 || null,
        option3: opt3 || null,
        price: price,
        compareAtPrice: compareAt || null,
        sku: sku || null,
        barcode: barcode || null,
      });
    }
    // Image
    const img = r[idx['Image Src']];
    const imgAlt = r[idx['Image Alt Text']];
    if (img && !p._imageSet.has(img)) {
      p._imageSet.add(img);
      p.images.push({ src: img, alt: imgAlt || '' });
    }
  }

  // Cleanup
  return [...products.values()].map(p => {
    delete p._imageSet;
    p.options = p.options.filter(Boolean).map(o => ({
      name: o.name,
      position: o.position,
      values: [...o.values],
    }));
    return p;
  });
}

/**
 * Converte produto do CSV em ProductSetInput (formato GraphQL mutation productSet).
 * Aplica pricing do cliente alvo via calcExpectedPrice.
 */
function buildProductSetInput(csvProduct, pricing) {
  const productOptions = csvProduct.options.map(o => ({
    name: o.name,
    position: o.position,
    values: o.values.map(v => ({ name: v })),
  }));

  const variants = csvProduct.variants.map(v => {
    // Tenta aplicar pricing do cliente
    const expected = calcExpectedPrice(csvProduct.title, v, pricing);
    const finalPrice = expected?.price != null
      ? String(expected.price.toFixed(2))
      : (v.price || '0');
    const optValues = [];
    if (v.option1 && csvProduct.options[0]) {
      optValues.push({ optionName: csvProduct.options[0].name, name: v.option1 });
    }
    if (v.option2 && csvProduct.options[1]) {
      optValues.push({ optionName: csvProduct.options[1].name, name: v.option2 });
    }
    if (v.option3 && csvProduct.options[2]) {
      optValues.push({ optionName: csvProduct.options[2].name, name: v.option3 });
    }
    return {
      optionValues: optValues,
      price: finalPrice,
      ...(v.sku ? { sku: v.sku } : {}),
      ...(v.barcode ? { barcode: v.barcode } : {}),
      ...(v.compareAtPrice ? { compareAtPrice: String(v.compareAtPrice) } : {}),
    };
  });

  const files = csvProduct.images.map(img => ({
    originalSource: img.src,
    contentType: 'IMAGE',
    alt: img.alt || csvProduct.title,
  }));

  return {
    title: csvProduct.title,
    handle: csvProduct.handle,
    descriptionHtml: csvProduct.body_html || '',
    productType: csvProduct.product_type || '',
    vendor: csvProduct.vendor || '',
    tags: csvProduct.tags ? csvProduct.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    status: 'ACTIVE',
    productOptions,
    variants,
    ...(files.length ? { files } : {}),
  };
}

async function main() {
  const args = parseArgs();

  if (args.status) {
    const ck = readCheckpoint(SKILL_NAME);
    if (!ck) { console.log('Nenhum checkpoint ativo pra import-from-csv.'); return; }
    console.log('=== Checkpoint import-from-csv ===');
    console.log('  ts:', ck.ts);
    console.log('  cliente:', ck.data?.clientName || '?');
    console.log('  csv:', ck.data?.csv || '?');
    console.log('  imported:', ck.data?.imported?.length || 0, '/', ck.data?.total || '?');
    console.log('  failed:', ck.data?.failed?.length || 0);
    return;
  }

  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node import-from-csv.mjs <cliente> --csv=path [--handles=handles.json] [--apply] [--limit=N] [--resume] [--status] [--concurrency=N]');
    process.exit(1);
  }
  if (!args.csv) {
    console.error('❌ --csv=path é obrigatório');
    process.exit(1);
  }

  console.log(`\n=== import-from-csv ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);

  // VALIDATE
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  let pricing;
  if (args.asis) {
    pricing = { products: {}, extras: {}, info: {} };
    console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
    console.log(`✓ Pricing: --asis (preserva preços do CSV)`);
  } else {
    pricing = await fetchPricing(client.id);
    assertPricingConfigured(pricing, ['torcedor']);
    console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
    console.log(`✓ Pricing: ${Object.keys(pricing.products).length} produtos + ${Object.keys(pricing.extras).length} extras`);
  }

  // Load CSV
  const csvPath = path.isAbsolute(args.csv) ? args.csv : path.join(REPO_ROOT, args.csv);
  if (!fs.existsSync(csvPath)) throw new Error(`CSV não encontrado: ${csvPath}`);
  console.log(`\nLendo CSV: ${csvPath}`);
  const allCsvProducts = loadCsvProducts(csvPath);
  console.log(`  ${allCsvProducts.length} produtos no CSV (agrupados por handle)`);

  // Filter by handles list (if provided)
  let toImport = allCsvProducts;
  if (args.handles) {
    const handlesPath = path.isAbsolute(args.handles) ? args.handles : path.join(REPO_ROOT, args.handles);
    const handlesData = JSON.parse(fs.readFileSync(handlesPath, 'utf8'));
    const handleSet = new Set((handlesData.items || []).map(h => h.handle));
    console.log(`\n✓ Lista de handles: ${handleSet.size} produtos específicos (${args.handles})`);
    toImport = allCsvProducts.filter(p => handleSet.has(p.handle));
    console.log(`  ${toImport.length} encontrados no CSV`);
  }

  if (args.limit && toImport.length > args.limit) {
    toImport = toImport.slice(0, args.limit);
    console.log(`  Limitado a ${args.limit} produtos (--limit)`);
  }

  // Preview
  console.log(`\n=== PREVIEW ===`);
  console.log(`Produtos a importar: ${toImport.length}`);
  if (toImport.length === 0) {
    console.log(`Nada a fazer.`);
    clearCheckpoint(SKILL_NAME);
    return;
  }

  console.log(`\nAmostra (5):`);
  for (const p of toImport.slice(0, 5)) {
    const cat = categorize(p.title);
    const expected = p.variants[0] ? calcExpectedPrice(p.title, p.variants[0], pricing) : null;
    console.log(`  • ${p.title}`);
    console.log(`    category=${cat || 'null'} | price=R$${expected?.price?.toFixed(2) || '?'} | variants=${p.variants.length} | images=${p.images.length}`);
  }
  if (toImport.length > 5) console.log(`  ...+${toImport.length - 5}`);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra importar.`);
    return;
  }

  // Checkpoint + resume
  let imported = new Set();
  let failed = [];
  if (args.resume && hasCheckpoint(SKILL_NAME)) {
    const ck = readCheckpoint(SKILL_NAME);
    if (ck?.data?.clientId === client.id && ck?.data?.csv === path.basename(csvPath)) {
      imported = new Set(ck.data.imported || []);
      failed = ck.data.failed || [];
      console.log(`\n⏯  Resumindo: ${imported.size} já importados, ${failed.length} falhas`);
    }
  } else if (hasCheckpoint(SKILL_NAME)) {
    console.warn(`\n⚠ Checkpoint anterior existe. Rode com --resume pra retomar.`);
  }

  const pending = toImport.filter(p => !imported.has(p.handle));
  console.log(`\nTotal: ${toImport.length} | Já importados: ${imported.size} | Pendentes: ${pending.length}`);

  if (pending.length === 0) {
    console.log(`Nada a importar. ✓`);
    clearCheckpoint(SKILL_NAME);
    return;
  }

  // SIGINT handler
  installSigintHandler(SKILL_NAME, () => ({
    clientId: client.id,
    clientName: client.name,
    csv: path.basename(csvPath),
    imported: [...imported],
    failed,
    total: toImport.length,
  }));

  // EXECUTE
  console.log(`\n=== IMPORTANDO via productSet async (concurrency=${args.concurrency}) ===`);
  let ok = 0, fail = 0;

  // Dispatch em batches pro controle de concorrência
  for (let i = 0; i < pending.length; i += args.concurrency) {
    const batch = pending.slice(i, i + args.concurrency);

    // Dispatch paralelo
    const dispatched = [];
    await Promise.all(batch.map(async cp => {
      try {
        const input = buildProductSetInput(cp, pricing);
        const r = await productSet(client.shopify_domain, client.shopify_access_token, input, { synchronous: false });
        if (r.userErrors?.length) {
          fail++;
          failed.push({ handle: cp.handle, title: cp.title, errors: r.userErrors });
          return;
        }
        const opId = r.productSetOperation?.id;
        if (!opId) {
          fail++;
          failed.push({ handle: cp.handle, title: cp.title, error: 'sem operation id' });
          return;
        }
        dispatched.push({ product: cp, opId });
      } catch (e) {
        fail++;
        failed.push({ handle: cp.handle, title: cp.title, error: e.message });
      }
    }));

    // Poll de cada operation
    await Promise.all(dispatched.map(async d => {
      try {
        const op = await pollProductOperation(client.shopify_domain, client.shopify_access_token, d.opId, {
          interval: 2000,
          timeout: 3 * 60 * 1000,
        });
        if (op.status === 'COMPLETE' && !op.userErrors?.length) {
          ok++;
          imported.add(d.product.handle);
        } else {
          fail++;
          failed.push({ handle: d.product.handle, title: d.product.title, errors: op.userErrors || [{ message: op.status }] });
        }
      } catch (e) {
        fail++;
        failed.push({ handle: d.product.handle, title: d.product.title, error: e.message });
      }
    }));

    // Checkpoint a cada batch
    writeCheckpoint(SKILL_NAME, {
      clientId: client.id,
      clientName: client.name,
      csv: path.basename(csvPath),
      imported: [...imported],
      failed,
      total: toImport.length,
    });

    process.stdout.write(`\r  [${Math.min(i + args.concurrency, pending.length)}/${pending.length}] ok=${ok} fail=${fail}   `);
  }

  console.log(`\n\nResultado: ok=${ok} fail=${fail}`);

  if (failed.length > 0) {
    console.log(`\nPrimeiras falhas:`);
    for (const f of failed.slice(0, 10)) {
      console.log(`  - ${f.title}: ${JSON.stringify(f.errors || f.error).slice(0, 200)}`);
    }
    const failPath = path.join(REPO_ROOT, `.tmp_import_from_csv_failed_${client.id.slice(0, 8)}.json`);
    fs.writeFileSync(failPath, JSON.stringify(failed, null, 2));
    console.log(`\nFalhas detalhadas em: ${failPath}`);
  }

  if (fail === 0) clearCheckpoint(SKILL_NAME);

  await appendExecutionLog({
    skill: SKILL_NAME,
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    csv: path.basename(csvPath),
    handles_filter: args.handles || null,
    requested: toImport.length,
    ok, fail,
    dry_run: false,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); if (process.env.DEBUG) console.error(e.stack); process.exit(1); });
