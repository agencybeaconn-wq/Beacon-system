// Importa custom collections + collects do scrape Lucky Fours pro MontRoyal.
// Read-only por default; passa --apply pra executar.
// Usa GraphQL (REST está com 403 Cloudflare nessa loja).

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreds, shopifyGraphQL, delay } from '../../lib/shopify-api.mjs';
import { fetchClient } from '../../lib/supabase-rest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const SKIP_HANDLES = new Set(['69', 'products', 'test']);
const apply = process.argv.includes('--apply');
const clientArg = process.argv.slice(2).find(a => !a.startsWith('--')) || 'MontRoyal';

function parseCSV(content) {
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQ) {
      if (c === '"' && content[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c === '\r') {}
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function loadRows(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const rows = parseCSV(raw).filter(r => r.length > 1 && r.some(x => x.trim()));
  const [header, ...data] = rows;
  return data.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

async function fetchAllProductIds(shop, token) {
  const map = {};
  let cursor = null;
  while (true) {
    const q = `query($c: String) {
      products(first: 250, after: $c) {
        pageInfo { hasNextPage endCursor }
        edges { node { id handle } }
      }
    }`;
    const r = await shopifyGraphQL(shop, token, q, { c: cursor });
    if (r.errors) throw new Error('GraphQL: ' + JSON.stringify(r.errors));
    for (const e of r.data.products.edges) map[e.node.handle] = e.node.id;
    if (!r.data.products.pageInfo.hasNextPage) break;
    cursor = r.data.products.pageInfo.endCursor;
    await delay(300);
  }
  return map;
}

async function fetchAllCollectionsByHandle(shop, token) {
  const map = {};
  let cursor = null;
  while (true) {
    const q = `query($c: String) {
      collections(first: 250, after: $c) {
        pageInfo { hasNextPage endCursor }
        edges { node { id handle ruleSet { rules { column } } } }
      }
    }`;
    const r = await shopifyGraphQL(shop, token, q, { c: cursor });
    if (r.errors) throw new Error('GraphQL: ' + JSON.stringify(r.errors));
    for (const e of r.data.collections.edges) {
      // só nos importam custom collections (sem ruleSet/rules)
      const isCustom = !e.node.ruleSet || !e.node.ruleSet.rules || e.node.ruleSet.rules.length === 0;
      map[e.node.handle] = { id: e.node.id, isCustom };
    }
    if (!r.data.collections.pageInfo.hasNextPage) break;
    cursor = r.data.collections.pageInfo.endCursor;
    await delay(300);
  }
  return map;
}

async function createCustomCollection(shop, token, c) {
  const q = `mutation($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id handle }
      userErrors { field message }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, q, {
    input: {
      handle: c.Handle,
      title: c.Title,
      descriptionHtml: c['Body HTML'] || '',
      sortOrder: 'MANUAL',
    },
  });
  const errs = r.data?.collectionCreate?.userErrors || [];
  if (errs.length) throw new Error(errs.map(e => e.message).join('; '));
  return r.data.collectionCreate.collection.id;
}

async function addProductsToCollection(shop, token, collectionId, productIds) {
  // GraphQL aceita até 250 por call
  const q = `mutation($id: ID!, $productIds: [ID!]!) {
    collectionAddProductsV2(id: $id, productIds: $productIds) {
      job { id done }
      userErrors { field message }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, q, { id: collectionId, productIds });
  const errs = r.data?.collectionAddProductsV2?.userErrors || [];
  if (errs.length) throw new Error(errs.map(e => e.message).join('; '));
  return r.data.collectionAddProductsV2.job;
}

async function reorderCollectionProducts(shop, token, collectionId, orderedProductIds) {
  // GraphQL collectionReorderProducts mantém o order manual
  const moves = orderedProductIds.map((pid, idx) => ({ id: pid, newPosition: String(idx) }));
  const q = `mutation($id: ID!, $moves: [MoveInput!]!) {
    collectionReorderProducts(id: $id, moves: $moves) {
      job { id }
      userErrors { field message }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, q, { id: collectionId, moves });
  const errs = r.data?.collectionReorderProducts?.userErrors || [];
  if (errs.length) throw new Error(errs.map(e => e.message).join('; '));
  return r.data.collectionReorderProducts.job;
}

async function main() {
  console.log(`\n=== import-collections ${apply ? '[APPLY]' : '[DRY-RUN]'} (cliente: ${clientArg}) ===\n`);

  const client = await fetchClient(clientArg);
  if (!client) throw new Error(`Cliente não encontrado: ${clientArg}`);
  const creds = await getCreds(client.id);
  console.log(`✓ Cliente: ${creds.name} (${creds.shop})`);

  const colls = loadRows(path.join(REPO_ROOT, 'clients/lucky-fours/collections.csv'));
  const collects = loadRows(path.join(REPO_ROOT, 'clients/lucky-fours/collects.csv'));

  const wanted = colls.filter(c => !SKIP_HANDLES.has(c.Handle));
  console.log(`\nColeções no CSV: ${colls.length} | filtradas: ${wanted.length} (skip ${[...SKIP_HANDLES].join(', ')})`);
  console.log(`Collects no CSV: ${collects.length}`);

  console.log(`\n→ Buscando produtos da loja...`);
  const productIdByHandle = await fetchAllProductIds(creds.shop, creds.token);
  console.log(`  ${Object.keys(productIdByHandle).length} produtos`);

  console.log(`→ Buscando coleções existentes...`);
  const existing = await fetchAllCollectionsByHandle(creds.shop, creds.token);
  console.log(`  ${Object.keys(existing).length} coleções já existem`);

  const toCreate = wanted.filter(c => !existing[c.Handle]);
  console.log(`\n→ Coleções a criar: ${toCreate.length}`);

  // Agrupar collects por collection handle (com ordem)
  const collectsByHandle = {};
  for (const co of collects) {
    const ch = co['Collection Handle'];
    if (SKIP_HANDLES.has(ch)) continue;
    const ph = co['Product Handle'];
    if (!productIdByHandle[ph]) continue; // produto não importado
    if (!collectsByHandle[ch]) collectsByHandle[ch] = [];
    collectsByHandle[ch].push({ pos: parseInt(co.Position) || 999, productId: productIdByHandle[ph], handle: ph });
  }
  for (const ch of Object.keys(collectsByHandle)) {
    collectsByHandle[ch].sort((a, b) => a.pos - b.pos);
  }
  const totalCollects = Object.values(collectsByHandle).reduce((s, a) => s + a.length, 0);
  console.log(`Collects válidos: ${totalCollects} em ${Object.keys(collectsByHandle).length} coleções`);

  if (!apply) {
    console.log(`\n[DRY-RUN] Sample 5 a criar: ${toCreate.slice(0, 5).map(c => c.Handle).join(', ')}`);
    console.log(`Sample collects:`);
    for (const ch of Object.keys(collectsByHandle).slice(0, 3)) {
      console.log(`  ${ch}: ${collectsByHandle[ch].length} produtos (${collectsByHandle[ch].slice(0, 3).map(p => p.handle).join(', ')}...)`);
    }
    console.log(`\nRode com --apply.`);
    return;
  }

  // 1) Criar custom collections
  console.log(`\n→ Criando coleções...`);
  for (const c of toCreate) {
    try {
      const id = await createCustomCollection(creds.shop, creds.token, c);
      existing[c.Handle] = { id, isCustom: true };
      console.log(`  + ${c.Handle} → ${id}`);
      await delay(400);
    } catch (e) {
      console.error(`  ✗ ${c.Handle}: ${e.message}`);
    }
  }

  // 2) Adic
