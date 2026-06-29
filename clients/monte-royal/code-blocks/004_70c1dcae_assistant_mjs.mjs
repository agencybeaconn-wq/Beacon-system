// Importa custom collections + collects do scrape Lucky Fours pro MontRoyal.
// Read-only por default; passa --apply pra executar.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreds, shReq, delay } from '../../lib/shopify-api.mjs';
import { fetchClient } from '../../lib/supabase-rest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const SKIP_HANDLES = new Set(['69', 'products', 'test']);

const apply = process.argv.includes('--apply');
const clientArg = process.argv.find(a => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]) || 'MontRoyal';

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

async function main() {
  console.log(`\n=== import-collections ${apply ? '[APPLY]' : '[DRY-RUN]'} (cliente: ${clientArg}) ===\n`);

  const client = await fetchClient(clientArg);
  if (!client) throw new Error(`Cliente não encontrado: ${clientArg}`);
  const creds = await getCreds(client.id);
  console.log(`✓ Cliente: ${creds.name} (${creds.shop})`);

  const colls = loadRows(path.join(REPO_ROOT, 'clients/lucky-fours/collections.csv'));
  const collects = loadRows(path.join(REPO_ROOT, 'clients/lucky-fours/collects.csv'));

  const wanted = colls.filter(c => !SKIP_HANDLES.has(c.Handle));
  console.log(`\nColeções no CSV: ${colls.length} | filtradas: ${wanted.length} (skip ${colls.length - wanted.length}: ${[...SKIP_HANDLES].join(', ')})`);
  console.log(`Collects no CSV: ${collects.length}`);

  // 1) Buscar produtos da loja pra mapear handle -> id
  console.log(`\n→ Buscando produtos da loja pra mapear handles...`);
  const handleToId = {};
  let pageInfo = null, page = 0;
  let pathReq = `/products.json?limit=250&fields=id,handle`;
  while (true) {
    const r = await shReq(creds.shop, creds.token, 'GET', pathReq);
    for (const p of r.body.products || []) handleToId[p.handle] = p.id;
    page++;
    const next = r.headers?.link?.match(/<([^>]+)>;\s*rel="next"/);
    if (!next) break;
    const u = new URL(next[1]);
    pathReq = `/products.json?${u.searchParams.toString()}`;
    await delay(300);
  }
  console.log(`  ${Object.keys(handleToId).length} produtos na loja, ${page} página(s)`);

  // 2) Buscar custom collections existentes pra evitar duplicar
  console.log(`\n→ Buscando custom collections existentes...`);
  const existing = {};
  let cpath = `/custom_collections.json?limit=250&fields=id,handle`;
  while (true) {
    const r = await shReq(creds.shop, creds.token, 'GET', cpath);
    for (const c of r.body.custom_collections || []) existing[c.handle] = c.id;
    const next = r.headers?.link?.match(/<([^>]+)>;\s*rel="next"/);
    if (!next) break;
    const u = new URL(next[1]);
    cpath = `/custom_collections.json?${u.searchParams.toString()}`;
    await delay(300);
  }
  console.log(`  ${Object.keys(existing).length} custom collections já na loja`);

  // 3) Criar collections faltantes
  const toCreate = wanted.filter(c => !existing[c.Handle]);
  console.log(`\n→ Coleções a criar: ${toCreate.length} (já existem: ${wanted.length - toCreate.length})`);

  if (!apply) {
    console.log(`\n[DRY-RUN] Sample 5 a criar: ${toCreate.slice(0, 5).map(c => c.Handle).join(', ')}`);
    const validCollects = collects.filter(co =>
      !SKIP_HANDLES.has(co['Collection Handle']) &&
      handleToId[co['Product Handle']]
    );
    console.log(`Collects válidos pra criar: ${validCollects.length} (de ${collects.length})`);
    console.log(`\nRode com --apply.`);
    return;
  }

  for (const c of toCreate) {
    try {
      const r = await shReq(creds.shop, creds.token, 'POST', '/custom_collections.json', {
        custom_collection: {
          handle: c.Handle,
          title: c.Title,
          body_html: c['Body HTML'] || '',
          sort_order: c['Sort Order'] || 'manual',
          published: (c.Published || 'TRUE').toUpperCase() === 'TRUE',
        },
      });
      const id = r.body.custom_collection?.id;
      if (id) {
        existing[c.Handle] = id;
        console.log(`  + ${c.Handle} (${c.Title}) → ${id}`);
      } else {
        console.warn(`  ! ${c.Handle}: sem id retornado`, r.body);
      }
      await delay(400);
    } catch (e) {
      console.error(`  ✗ ${c.Handle}: ${e.message}`);
    }
  }

  // 4) Criar collects (produto ↔ coleção)
  const validCollects = collects.filter(co =>
    !SKIP_HANDLES.has(co['Collection Handle']) &&
    existing[co['Collection Handle']] &&
    handleToId[co['Product Handle']]
  );
  const skippedNoProduct = collects.filter(co =>
    !SKIP_HANDLES.has(co['Collection Handle']) &&
    !handleToId[co['Product Handle']]
  );

  console.log(`\n→ Collects a criar: ${validCollects.length}`);
  if (skippedNoProduct.length) console.log(`  (${skippedNoProduct.length} skip — produto não existe na loja)`);

  let okCollects = 0, failCollects = 0;
  for (const co of validCollects) {
    try {
      await shReq(creds.shop, creds.token, 'POST', '/collects.json', {
        collect: {
          collection_id: existing[co['Collection Handle']],
          product_id: handleToId[co['Product Handle']],
          position: parseInt(co.Position) || 1,
        },
      });
      okCollects++;
      if (okCollects % 25 === 0) console.log(`    ${okCollects}/${validCollects.length}...`);
      await delay(180);
    } catch (e) {
      failCollects++;
      if (!e.message.includes('already exists')) {
        console.error(`  ✗ ${co['Collection Handle']} ↔ ${co['Product Handle']}: ${e.message.slice(0, 100)}`);
      }
    }
  }

  console.log(`\nResultado collects: ok=${okCollects} fail=${failCollects}`);
  console.log(`\n✓ Importação de coleções concluída.`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

