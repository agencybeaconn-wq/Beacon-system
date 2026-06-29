#!/usr/bin/env node
// scrape-competitor — coleta produtos de loja concorrente e importa pra Shopify do cliente.
//
// Uso:
//   node scrape-competitor.mjs <clientIdOrName> --url=<URL>                    # DRY-RUN
//   node scrape-competitor.mjs <clientIdOrName> --url=<URL> --apply             # cria coleção + productSet async
//   node scrape-competitor.mjs <clientIdOrName> --url=<URL> --limit=N           # limita N produtos (teste)
//   node scrape-competitor.mjs <clientIdOrName> --url=<URL> --collection-name=  # override do nome da coleção
//   node scrape-competitor.mjs <clientIdOrName> --url=<URL> --no-skip-existing  # re-importa mesmo se título existe
//
// Plataformas hoje: OpenCart. Adicionar: novo bloco em detectPlatform() + parsers.

import { fetchPricing } from '../../lib/supabase-rest.mjs';
import { shReq, shopifyGraphQL, nextPageUrl, delay, API_VERSION, productSet, pollProductOperation } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { categorize, calcExpectedPrice } from '../../lib/shopify-pricing.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const BRANDS = [
  'Nike', 'Adidas', 'Puma', 'Jordan', 'New Balance', 'Reebok', 'Kappa', 'Umbro', 'Joma',
  'Hummel', 'Castore', 'Macron', 'Mizuno', 'Under Armour', 'Asics', 'Fila', 'Champion',
  'Diadora', 'Erreà', 'Errea', 'Mitre', 'Le Coq Sportif', 'Lotto', 'Topper', 'Olympikus',
];

function parseArgs() {
  const args = { _: [], url: null, apply: false, collectionName: null, limit: null, skipExisting: true };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--no-skip-existing') args.skipExisting = false;
    else if (a.startsWith('--url=')) args.url = a.slice(6);
    else if (a.startsWith('--collection-name=')) args.collectionName = a.slice(18);
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8), 10);
    else args._.push(a);
  }
  return args;
}

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function cleanTitle(title) {
  let t = title;
  // Remove prefixos cross-listed da Futebol Religião ("Klubai Store - ", "Loja X - ")
  t = t.replace(/^\s*Loja [^-]+-\s*/i, '');
  t = t.replace(/^\s*[A-Z][a-zA-Z]+ Store\s*-\s*/, '');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const brandRe = new RegExp('\\b(' + BRANDS.map(esc).join('|') + ')\\b', 'gi');
  t = t.replace(brandRe, '');
  t = t.replace(/\boficial\b/gi, '');
  if (/^(camisa|camiseta)\b/i.test(t)) {
    t = t.replace(/\bFeminino\b/g, 'Feminina')
         .replace(/\bFEMININO\b/g, 'FEMININA')
         .replace(/\bfeminino\b/g, 'feminina');
  }
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\s+-\s+-\s+/g, ' - ').replace(/^\s*-\s*/, '').replace(/\s*-\s*$/, '');
  return t;
}

async function fetchHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return await r.text();
}

// ── Platform detector ──────────────────────────────────────────────────

function detectPlatform(html) {
  if (/index\.php\?route=product\/category|catalog\/view\/theme\/default|class="product-thumb"/.test(html)) return 'opencart';
  return null;
}

// ── OpenCart adapter ───────────────────────────────────────────────────

function ocExtractCollectionTitle(html) {
  // OpenCart: o título da coleção é o primeiro <h2> dentro de <div id="content">
  const contentBlock = html.match(/<div id="content"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentBlock) {
    const h2 = contentBlock[1].match(/<h2[^>]*>([^<]+)<\/h2>/i);
    if (h2 && h2[1].trim()) return h2[1].trim();
  }
  // Fallback: <title>
  const t = html.match(/<title>([^<]+)<\/title>/i);
  if (t && t[1].trim()) return t[1].replace(/\s*[-|]\s*Futebol Religi[ãa]o.*$/i, '').trim();
  return 'Coleção';
}

function ocExtractProductLinksFromList(html) {
  const links = new Set();
  // Cada card: <div class="product-thumb"> seguido por <div class="image"><a href="URL">
  const re = /<div class="product-thumb">[\s\S]*?<a href="(https?:\/\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    links.add(m[1]);
  }
  return [...links];
}

function ocExtractPaginationLinks(html, baseUrl) {
  const links = new Set();
  const m = html.match(/<ul class="pagination">([\s\S]*?)<\/ul>/i);
  if (!m) return [];
  const re = /href="([^"]*?[?&]page=\d+[^"]*)"/g;
  let mm;
  while ((mm = re.exec(m[1])) !== null) {
    let href = mm[1].replace(/&amp;/g, '&');
    if (!/^https?:/.test(href)) href = new URL(href, baseUrl).toString();
    links.add(href);
  }
  return [...links];
}

function ocParseProductPage(html, url) {
  // Título: og:title é mais confiável que h1 (h1 às vezes vira "Descrição do Produto")
  const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
  const titleTagH1 = html.match(/<h1[^>]*class="[^"]*title-product[^"]*"[^>]*>([^<]+)<\/h1>/i);
  const titleAttr = html.match(/<meta itemprop="name" content="([^"]+)"/i);
  const docTitle = html.match(/<title>([^<]+)<\/title>/i);
  let title = (ogTitle?.[1] || titleAttr?.[1] || titleTagH1?.[1] || docTitle?.[1] || '').trim();
  // Limpa sufixos do site
  title = title.replace(/\s*[-|]\s*Futebol Religi[ãa]o.*$/i, '').trim();

  // Tamanhos: pega o <select> que parece tamanho
  const sizes = [];
  const selRe = /<select[^>]*name="option\[\d+\]"[^>]*>([\s\S]*?)<\/select>/g;
  const sizeRegex = /^(P|PP|M|G|GG|EG|EGG|XS|S|L|XL|XXL|XXXL|2GG|3GG|4GG|GGG|GGGG|\d{2})$/i;
  let selM;
  while ((selM = selRe.exec(html)) !== null) {
    const inner = selM[1];
    const optRe = /<option [^>]*value="\d+"[^>]*>([\s\S]*?)<\/option>/g;
    let optM;
    const local = [];
    while ((optM = optRe.exec(inner)) !== null) {
      const val = optM[1].replace(/<[^>]+>/g, '').trim();
      if (val) local.push(val);
    }
    const matchCount = local.filter(s => sizeRegex.test(s)).length;
    if (local.length > 0 && matchCount >= Math.max(1, local.length / 2)) {
      sizes.push(...local.filter(s => sizeRegex.test(s)));
      break;
    }
  }

  // Imagens grandes (-900x900.jpg, padrão OpenCart cache)
  const images = new Set();
  const imgRe = /https?:\/\/[^"\s)]+-900x900\.(jpg|jpeg|png|webp)/gi;
  let imgM;
  while ((imgM = imgRe.exec(html)) !== null) {
    images.add(imgM[0]);
  }

  // Descrição
  let description = '';
  const dm = html.match(/<div class="tab-pane active" id="tab-description">([\s\S]*?)<\/div>\s*\n?\s*<div class="tab-pane"/);
  if (dm) {
    description = dm[1];
  } else {
    const dm2 = html.match(/<div class="tab-pane[^"]*" id="tab-description">([\s\S]*?)<\/div>/);
    if (dm2) description = dm2[1];
  }
  description = description.replace(/<h1[^>]*>[^<]*<\/h1>/gi, '').trim();

  return { sourceUrl: url, title, sizes, images: [...images], description };
}

// ── Shopify ops ────────────────────────────────────────────────────────

const COLLECTION_BY_HANDLE_QUERY = `
query ($handle: String!) {
  collectionByHandle(handle: $handle) { id title handle }
}`;

const COLLECTION_CREATE_MUT = `
mutation collectionCreate($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection { id title handle }
    userErrors { field message }
  }
}`;

async function ensureCollection(shop, token, name) {
  const handle = slugify(name);
  const q = await shopifyGraphQL(shop, token, COLLECTION_BY_HANDLE_QUERY, { handle });
  if (q.data?.collectionByHandle?.id) return q.data.collectionByHandle;
  const r = await shopifyGraphQL(shop, token, COLLECTION_CREATE_MUT, {
    input: { title: name, handle },
  });
  const errs = r.data?.collectionCreate?.userErrors || [];
  if (errs.length) throw new Error('collectionCreate: ' + JSON.stringify(errs));
  return r.data.collectionCreate.collection;
}

function buildProductSetInput(scraped, pricing, collectionId, sourceDomain) {
  const cleanedTitle = cleanTitle(scraped.title) || scraped.title;
  const sizes = (scraped.sizes && scraped.sizes.length) ? scraped.sizes : ['Único'];
  const variants = sizes.map(size => {
    const fakeVariant = { option1: size, price: 0 };
    const expected = calcExpectedPrice(cleanedTitle, fakeVariant, pricing);
    const price = expected?.price != null ? String(expected.price.toFixed(2)) : '199.99';
    return {
      optionValues: [{ optionName: 'Tamanho', name: size }],
      price,
    };
  });

  const files = (scraped.images || []).map(src => ({
    originalSource: src,
    contentType: 'IMAGE',
    alt: cleanedTitle,
  }));

  const cat = categorize(cleanedTitle);
  const productType =
    cat === 'camisa_retro' ? 'Camisa Retrô' :
    cat === 'camisa_jogador' ? 'Camisa Jogador' :
    cat === 'camisa_manga_longa' ? 'Camisa Manga Longa' :
    cat === 'conjunto_infantil' ? 'Conjunto Infantil' :
    cat === 'jaqueta' ? 'Jaqueta' :
    cat === 'moletom' ? 'Moletom' :
    cat === 'short' ? 'Short' :
    'Camisa';

  const tags = ['scraped'];
  if (sourceDomain) tags.push(`competitor:${sourceDomain}`);

  return {
    title: cleanedTitle,
    descriptionHtml: scraped.description || '',
    productType,
    vendor: '',
    tags,
    status: 'ACTIVE',
    productOptions: [{ name: 'Tamanho', values: sizes.map(name => ({ name })) }],
    variants,
    ...(files.length ? { files } : {}),
    ...(collectionId ? { collections: [collectionId] } : {}),
  };
}

async function fetchClientIndex(shop, token) {
  const set = new Set();
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,handle,title`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    for (const pr of (r.body.products || [])) {
      set.add(normalize(pr.handle));
      set.add(normalize(pr.title));
    }
    p = nextPageUrl(r.link);
    if (p) await delay(400);
  }
  return set;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  if (!args._[0] || !args.url) {
    console.error('Uso: node scrape-competitor.mjs <clientIdOrName> --url=<URL> [--apply] [--limit=N] [--collection-name=...] [--no-skip-existing]');
    process.exit(1);
  }

  console.log(`\n=== scrape-competitor ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);

  const client = await assertClientExists(args._[0]);
  await assertShopifyConnected(client);
  const pricing = await fetchPricing(client.id);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
  console.log(`  Pricing extras: ${Object.keys(pricing.extras || {}).join(', ') || '(nenhum)'}`);

  // 1. Index page
  console.log(`\nFetch ${args.url}`);
  const indexHtml = await fetchHtml(args.url);
  const platform = detectPlatform(indexHtml);
  if (platform !== 'opencart') {
    throw new Error(`Plataforma não suportada (detectada: ${platform || 'desconhecida'}). Hoje: opencart`);
  }
  console.log(`  Plataforma: ${platform}`);

  const collectionTitle = args.collectionName || ocExtractCollectionTitle(indexHtml);
  const sourceDomain = (() => {
    try { return new URL(args.url).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; }
  })();
  console.log(`  Coleção alvo: "${collectionTitle}"`);

  // 2. Páginas paginadas
  const pageUrls = ocExtractPaginationLinks(indexHtml, args.url);
  const allListPages = [args.url, ...pageUrls];
  console.log(`  Páginas de listagem: ${allListPages.length}`);

  // 3. Coleta links de produto
  const productUrls = new Set(ocExtractProductLinksFromList(indexHtml));
  for (const pu of allListPages.slice(1)) {
    await delay(500);
    try {
      const html = await fetchHtml(pu);
      ocExtractProductLinksFromList(html).forEach(u => productUrls.add(u));
    } catch (e) {
      console.error(`  ❌ pageList ${pu}: ${e.message}`);
    }
  }
  console.log(`  Produtos únicos: ${productUrls.size}`);

  let urls = [...productUrls];
  if (args.limit) {
    urls = urls.slice(0, args.limit);
    console.log(`  Limit aplicado: processando ${urls.length}`);
  }

  // 4. Scrape paralelo (concorrência 3)
  console.log(`\nColetando dados dos produtos...`);
  const scraped = [];
  const concurrency = 3;
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async u => {
      try {
        const html = await fetchHtml(u);
        return ocParseProductPage(html, u);
      } catch (e) {
        console.error(`  ❌ ${u}: ${e.message}`);
        return null;
      }
    }));
    scraped.push(...results.filter(Boolean));
    process.stdout.write(`\r  ${scraped.length}/${urls.length}   `);
    await delay(400);
  }
  console.log('');

  // 5. Dedupe vs cliente
  console.log(`\nVerificando duplicatas no cliente...`);
  const clientIndex = await fetchClientIndex(client.shopify_domain, client.shopify_access_token);
  console.log(`  ${clientIndex.size / 2} produtos no cliente (handles+titles indexados)`);
  const fresh = [];
  const dups = [];
  for (const s of scraped) {
    const cleaned = cleanTitle(s.title) || s.title;
    if (args.skipExisting && clientIndex.has(normalize(cleaned))) {
      dups.push(cleaned);
      continue;
    }
    fresh.push(s);
  }
  console.log(`  Fresh: ${fresh.length}, já existem: ${dups.length}`);

  // 6. Plano + categoria + preço
  const plan = fresh.map(s => {
    const cleaned = cleanTitle(s.title) || s.title;
    const cat = categorize(cleaned);
    const priceBySize = (s.sizes.length ? s.sizes : ['Único']).map(size => {
      const expected = calcExpectedPrice(cleaned, { option1: size }, pricing);
      return { size, price: expected?.price ?? null, breakdown: expected?.breakdown || [] };
    });
    return {
      sourceUrl: s.sourceUrl,
      origTitle: s.title,
      cleanTitle: cleaned,
      category: cat,
      sizes: s.sizes,
      images: s.images.length,
      priceBySize,
    };
  });

  const catStats = {};
  plan.forEach(p => { catStats[p.category || 'SKIP'] = (catStats[p.category || 'SKIP'] || 0) + 1; });
  const skipped = plan.filter(p => !p.category);

  console.log(`\n=== PREVIEW ===`);
  console.log(`Coleção destino: "${collectionTitle}"  (handle: ${slugify(collectionTitle)})`);
  console.log(`Total a importar: ${plan.length}`);
  console.log(`Por categoria:`);
  Object.entries(catStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  if (skipped.length) {
    console.log(`\n⚠️  ${skipped.length} produtos sem categoria detectada (irão como 'Camisa' default):`);
    skipped.slice(0, 3).forEach(p => console.log(`  - ${p.cleanTitle}`));
  }

  console.log(`\nAmostra (5 produtos):`);
  plan.slice(0, 5).forEach(p => {
    console.log(`  [${p.category || '?'}] ${p.cleanTitle}`);
    console.log(`    ← original: ${p.origTitle}`);
    const priceSummary = p.priceBySize.map(x => `${x.size}=R$${x.price?.toFixed(2) ?? '?'}`).join(', ');
    console.log(`    → ${p.images} imgs | preço: ${priceSummary}`);
  });

  if (dups.length > 0) {
    console.log(`\n${dups.length} duplicatas pulam (use --no-skip-existing pra forçar):`);
    dups.slice(0, 3).forEach(d => console.log(`  - ${d}`));
  }

  const planPath = path.join(__dirname, '.tmp_scrape_plan.json');
  fs.writeFileSync(planPath, JSON.stringify({
    client: client.name, url: args.url, sourceDomain,
    collectionTitle, totalScraped: scraped.length, fresh: fresh.length, dups: dups.length,
    plan, ts: new Date().toISOString(),
  }, null, 2));
  console.log(`\nPlano salvo em ${planPath}`);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode novamente com --apply para criar coleção + produtos.`);
    return;
  }

  if (fresh.length === 0) {
    console.log(`\nNada a importar. ✓`);
    return;
  }

  // 7. Coleção
  console.log(`\n=== ENSURE COLEÇÃO ===`);
  const collection = await ensureCollection(client.shopify_domain, client.shopify_access_token, collectionTitle);
  console.log(`  ${collection.title} → ${collection.id}`);

  // 8. productSet em lotes pequenos
  console.log(`\n=== IMPORTANDO ${fresh.length} PRODUTOS via productSet async ===`);
  let ok = 0, fail = 0;
  const errors = [];
  const dispatchBatch = 3;
  const started = [];

  for (let i = 0; i < fresh.length; i += dispatchBatch) {
    const batch = fresh.slice(i, i + dispatchBatch);
    await Promise.all(batch.map(async s => {
      const input = buildProductSetInput(s, pricing, collection.id, sourceDomain);
      try {
        const r = await productSet(
          client.shopify_domain,
          client.shopify_access_token,
          input,
          { synchronous: false }
        );
        if (r.userErrors?.length) {
          fail++;
          if (errors.length < 20) errors.push({ title: input.title, errs: r.userErrors });
          return;
        }
        const opId = r.productSetOperation?.id;
        if (opId) started.push({ title: input.title, opId });
        else { fail++; errors.push({ title: input.title, error: 'no operation id' }); }
      } catch (e) {
        fail++;
        if (errors.length < 20) errors.push({ title: s.title, error: e.message });
      }
    }));
    process.stdout.write(`\r  dispatched ${Math.min(i + dispatchBatch, fresh.length)}/${fresh.length}   `);
    await delay(700);
  }
  console.log('');

  console.log(`\n  ${started.length} operations dispatched, polling...`);
  for (let i = 0; i < started.length; i++) {
    const s = started[i];
    try {
      const op = await pollProductOperation(client.shopify_domain, client.shopify_access_token, s.opId, {
        interval: 2000, timeout: 3 * 60 * 1000,
      });
      if (op.status === 'COMPLETE' && !op.userErrors?.length) ok++;
      else { fail++; if (errors.length < 20) errors.push({ title: s.title, errs: op.userErrors || [{ message: op.status }] }); }
    } catch (e) {
      fail++;
      if (errors.length < 20) errors.push({ title: s.title, error: e.message });
    }
    process.stdout.write(`\r  polled ${i + 1}/${started.length} ok=${ok} fail=${fail}   `);
  }

  console.log(`\n\nResultado: ok=${ok} fail=${fail}`);
  if (errors.length) {
    console.log(`\nPrimeiros erros:`);
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.title}: ${JSON.stringify(e.errs || e.error).slice(0, 220)}`));
  }

  await appendExecutionLog({
    skill: 'scrape-competitor',
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    source_url: args.url,
    source_domain: sourceDomain,
    collection: collectionTitle,
    scraped: scraped.length,
    fresh: fresh.length,
    dups: dups.length,
    ok, fail,
    dry_run: false,
    mode: 'productSet-async',
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); console.error(e.stack); process.exit(1); });
