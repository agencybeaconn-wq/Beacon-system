#!/usr/bin/env node
// import-missing — compara catálogo do cliente com template e importa os faltantes.
//
// Uso:
//   node import-missing.mjs <clientIdOrName>                            # DRY-RUN (lista)
//   node import-missing.mjs <clientIdOrName> --template=<templateId>    # template custom
//   node import-missing.mjs <clientIdOrName> --apply                    # importa via productSet async
//   node import-missing.mjs <clientIdOrName> --apply --full              # delega pra deploy-store (pipeline completo)
//
// Templates conhecidos (default = BR se cliente tem shopify_domain terminando em .com.br, senão EN):
//   BR: 5e836736-7411-42d8-b99e-bcad1e55919d (testeloja-9899)
//   EN: 17089519-4779-41bb-96ca-9791e0677cf8 (loja-de-estruturacao-e-desenvolvimento-en)
//
// --apply padrão: usa mutation productSet (GraphQL, async) — 1 call por produto com
//   title, descriptionHtml, productType, vendor, tags, productOptions, variants (com preço
//   calculado pelo pricing do cliente) e images (via files.originalSource).
// --apply --full: delega pra skill deploy-store (pipeline completo com metafields).

import { fetchClient, fetchPricing } from '../../lib/supabase-rest.mjs';
import { shReq, nextPageUrl, delay, API_VERSION, getCreds, productSet, getProductOperation, pollProductOperation } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { categorize, calcExpectedPrice } from '../../lib/shopify-pricing.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATE_BR = '5e836736-7411-42d8-b99e-bcad1e55919d';
const TEMPLATE_EN = '17089519-4779-41bb-96ca-9791e0677cf8';

function parseArgs() {
  const args = { _: [], apply: false, template: null, full: false, onlyHandle: null, handles: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--full') args.full = true;
    else if (a.startsWith('--template=')) args.template = a.slice(11);
    else if (a.startsWith('--only-handle=')) args.onlyHandle = a.slice(14);
    else if (a.startsWith('--handles=')) args.handles = new Set(a.slice(10).split(',').map(s => s.trim()).filter(Boolean));
    else if (a.startsWith('--handles-file=')) {
      const list = JSON.parse(fs.readFileSync(a.slice(15), 'utf8'));
      args.handles = new Set(list);
    }
    else args._.push(a);
  }
  return args;
}

// Normalização fuzzy pra comparar títulos/handles (remove acentos, espaços, traços, case)
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function fetchAllProducts(shop, token) {
  const all = [];
  // Campos completos pra permitir cópia via productSet se apply estiver ativo
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,handle,title,body_html,vendor,product_type,tags,status,options,variants,images`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    all.push(...(r.body.products || []));
    p = nextPageUrl(r.link);
    await delay(500);
  }
  return all;
}

/**
 * Converte um produto do template (REST shape) para ProductSetInput (GraphQL shape).
 * Aplica pricing do cliente via calcExpectedPrice.
 */
function buildProductSetInput(templateProduct, pricing) {
  const options = (templateProduct.options || []).map((o, i) => ({
    name: o.name,
    position: i + 1,
    values: (o.values || []).map(v => ({ name: v })),
  }));

  const variants = (templateProduct.variants || []).map(v => {
    const expected = calcExpectedPrice(templateProduct.title, v, pricing);
    const price = expected?.price != null ? String(expected.price.toFixed(2)) : String(v.price || '0');
    const optValues = [];
    ['option1', 'option2', 'option3'].forEach((k, idx) => {
      if (v[k] && templateProduct.options?.[idx]) {
        optValues.push({ optionName: templateProduct.options[idx].name, name: v[k] });
      }
    });
    return {
      optionValues: optValues,
      price,
      ...(v.sku ? { sku: v.sku } : {}),
      ...(v.barcode ? { barcode: v.barcode } : {}),
      ...(v.compare_at_price ? { compareAtPrice: String(v.compare_at_price) } : {}),
    };
  });

  const files = (templateProduct.images || []).map(img => ({
    originalSource: img.src,
    contentType: 'IMAGE',
    alt: img.alt || templateProduct.title,
  }));

  return {
    title: templateProduct.title,
    handle: templateProduct.handle,
    descriptionHtml: templateProduct.body_html || '',
    productType: templateProduct.product_type || '',
    vendor: templateProduct.vendor || '',
    tags: templateProduct.tags ? templateProduct.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    status: 'ACTIVE',
    productOptions: options,
    variants,
    ...(files.length ? { files } : {}),
  };
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node import-missing.mjs <clientIdOrName> [--template=<id>] [--apply]');
    process.exit(1);
  }

  console.log(`\n=== import-missing ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const pricing = await fetchPricing(client.id);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  // Determina template — estratégia em cascata, preferindo sinais explícitos
  function detectTemplate(c) {
    const name = (c.name || '').toLowerCase();
    const dom = (c.shopify_domain || '').toLowerCase();
    // Sinais explícitos PT-BR
    if (/\b(br|brasil|brazilian|brasileir)\b/i.test(name)) return { id: TEMPLATE_BR, reason: 'nome menciona BR/Brasil' };
    if (dom.endsWith('.com.br') || dom.endsWith('.br')) return { id: TEMPLATE_BR, reason: 'domínio .br' };
    // Sinais explícitos EN
    if (/\b(en|english|international|global)\b/i.test(name)) return { id: TEMPLATE_EN, reason: 'nome menciona EN/English' };
    if (dom.includes('-en.') || dom.endsWith('.en')) return { id: TEMPLATE_EN, reason: 'domínio contém -en' };
    return null;
  }
  let templateId = args.template;
  if (!templateId) {
    const detected = detectTemplate(client);
    if (!detected) {
      console.error(`\n❌ Não consigo detectar o template automaticamente pra "${client.name}" (${client.shopify_domain}).`);
      console.error(`   Rode novamente com --template=<UUID>:`);
      console.error(`     BR: ${TEMPLATE_BR}`);
      console.error(`     EN: ${TEMPLATE_EN}`);
      process.exit(1);
    }
    templateId = detected.id;
    console.log(`  (template detectado: ${detected.id === TEMPLATE_BR ? 'BR' : 'EN'} — ${detected.reason})`);
  }
  const template = await getCreds(templateId);
  console.log(`✓ Template: ${template.name} (${template.shop})`);

  console.log(`\nBuscando produtos das 2 lojas em paralelo (lojas diferentes = safe)...`);
  const [clientProducts, templateProducts] = await Promise.all([
    fetchAllProducts(client.shopify_domain, client.shopify_access_token),
    fetchAllProducts(template.shop, template.token),
  ]);
  console.log(`  Cliente: ${clientProducts.length} produtos`);
  console.log(`  Template: ${templateProducts.length} produtos`);

  // Indexa cliente por handle normalizado
  const clientIndex = new Set();
  for (const p of clientProducts) {
    clientIndex.add(normalize(p.handle));
    clientIndex.add(normalize(p.title));
  }

  // Identifica faltantes
  const missing = [];
  const catStats = {};
  for (const tp of templateProducts) {
    // Filtros: --only-handle (single) ou --handles (set)
    if (args.onlyHandle && tp.handle !== args.onlyHandle) continue;
    if (args.handles && !args.handles.has(tp.handle)) continue;
    const byHandle = clientIndex.has(normalize(tp.handle));
    const byTitle = clientIndex.has(normalize(tp.title));
    if (byHandle || byTitle) continue;
    const cat = categorize(tp.title);
    catStats[cat || 'SKIP'] = (catStats[cat || 'SKIP'] || 0) + 1;
    // Quando --handles é usado, o user já curou a lista — não filtra por SKIP
    if (!cat && !args.handles) continue;

    // Calcula preço esperado (usa a primeira variante)
    const firstVariant = tp.variants?.[0] || {};
    const expected = calcExpectedPrice(tp.title, firstVariant, pricing);
    missing.push({
      templateProductId: tp.id,
      handle: tp.handle,
      title: tp.title,
      category: cat,
      variants: tp.variants?.length || 0,
      images: tp.images?.length || 0,
      expectedPrice: expected?.price ?? null,
      priceBreakdown: expected?.breakdown || [],
    });
  }

  console.log(`\n=== PREVIEW ===`);
  console.log(`Faltantes por categoria:`);
  Object.entries(catStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nTotal produtos a importar: ${missing.length}`);

  const byCategory = {};
  missing.forEach(m => { (byCategory[m.category] ||= []).push(m); });

  console.log(`\nAmostra (5 produtos):`);
  missing.slice(0, 5).forEach(m => {
    console.log(`  [${m.category}] ${m.title}`);
    console.log(`    → ${m.variants} variantes, ${m.images} imagens, preço esperado: R$${m.expectedPrice?.toFixed(2) ?? '?'} (${m.priceBreakdown.join(' ')})`);
  });

  const planPath = path.join(__dirname, '.tmp_import_missing_plan.json');
  fs.writeFileSync(planPath, JSON.stringify({
    client: client.name,
    template: template.name,
    missing,
    catStats,
    byCategoryCount: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.length])),
    ts: new Date().toISOString(),
  }, null, 2));
  console.log(`\nPlano salvo em ${planPath}`);

  printEstimate({ count: missing.length, opName: 'import via productSet (async)', rateLimitMs: 600, unit: 'produtos' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: missing.length, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode novamente com --apply pra importar via productSet.`);
    console.log(`Pra pipeline completo (com metafields, SEO, publishing), use --apply --full (delega pra deploy-store).`);
    return;
  }

  if (args.full) {
    console.log(`\n⚠️  --full ativo: delegando pra skill /deploy-store (pipeline completo).`);
    console.log(`   Invoque: /deploy-store ${client.name} step=products`);
    return;
  }

  if (missing.length === 0) {
    console.log(`\nNada a importar. ✓`);
    return;
  }

  // ── 5. EXECUTE ──────────────────────────────────────────────────────
  console.log(`\n=== IMPORTANDO via productSet async ===`);
  // Index dos template products pra buscar rapidamente pelo id
  const templateById = new Map(templateProducts.map(p => [p.id, p]));

  let ok = 0, fail = 0;
  const errors = [];
  const started = [];

  // Dispara em lotes pequenos pra não sobrecarregar o shop (async ainda conta no rate limit de dispatch)
  const dispatchBatch = 5;
  for (let i = 0; i < missing.length; i += dispatchBatch) {
    const batch = missing.slice(i, i + dispatchBatch);
    await Promise.all(batch.map(async m => {
      const tp = templateById.get(m.templateProductId);
      if (!tp) { fail++; errors.push({ title: m.title, error: 'template product not found' }); return; }
      const input = buildProductSetInput(tp, pricing);
      try {
        const r = await productSet(
          client.shopify_domain,
          client.shopify_access_token,
          input,
          { synchronous: false }
        );
        if (r.userErrors?.length) {
          fail++;
          if (errors.length < 20) errors.push({ title: m.title, errs: r.userErrors });
          return;
        }
        const opId = r.productSetOperation?.id;
        if (opId) started.push({ title: m.title, opId });
        else { fail++; errors.push({ title: m.title, error: 'no operation id' }); }
      } catch (e) {
        fail++;
        if (errors.length < 20) errors.push({ title: m.title, error: e.message });
      }
    }));
    process.stdout.write(`\r  dispatched ${Math.min(i + dispatchBatch, missing.length)}/${missing.length}   `);
    await delay(600);
  }

  console.log(`\n\n  ${started.length} operations dispatched, aguardando conclusão...`);

  // Polla cada operation
  for (let i = 0; i < started.length; i++) {
    const s = started[i];
    try {
      const op = await pollProductOperation(client.shopify_domain, client.shopify_access_token, s.opId, {
        interval: 2000,
        timeout: 2 * 60 * 1000,
      });
      if (op.status === 'COMPLETE' && !op.userErrors?.length) ok++;
      else {
        fail++;
        if (errors.length < 20) errors.push({ title: s.title, errs: op.userErrors || [{ message: op.status }] });
      }
    } catch (e) {
      fail++;
      if (errors.length < 20) errors.push({ title: s.title, error: e.message });
    }
    process.stdout.write(`\r  polled ${i + 1}/${started.length} ok=${ok} fail=${fail}   `);
  }

  console.log(`\n\nResultado: ok=${ok} fail=${fail}`);
  if (errors.length) {
    console.log(`\nPrimeiros erros:`);
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.title}: ${JSON.stringify(e.errs || e.error).slice(0, 200)}`));
  }

  // POST-IMPORT DEDUPE — feedback_import_duplicates: importações DEVEM checar duplicatas
  // CSV Shopify pode criar 75x duplicados; productSet também pode duplicar se title bate com produto pré-existente.
  if (ok > 0) {
    console.log(`\n=== POST-IMPORT DEDUPE ===`);
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const execp = promisify((await import('child_process')).exec);
    try {
      const cmd = `node ".claude/skills/dedupe-products/dedupe-products.mjs" "${client.name}" --by=title --apply`;
      console.log(`  Rodando: ${cmd}`);
      const { stdout } = await execp(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      const dedupeMatch = stdout.match(/removed=(\d+)/i) || stdout.match(/dedupados? (\d+)/i);
      console.log(`  ${dedupeMatch ? `Dedupados: ${dedupeMatch[1]}` : 'Dedupe rodou (ver output completo no log)'}`);
    } catch (e) {
      console.log(`  ⚠ Dedupe falhou (não bloqueia): ${e.message.slice(0, 150)}`);
    }
  }

  await appendExecutionLog({
    skill: 'import-missing',
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    template: template.name,
    missing: missing.length,
    ok, fail,
    dry_run: false,
    mode: 'productSet-async',
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
