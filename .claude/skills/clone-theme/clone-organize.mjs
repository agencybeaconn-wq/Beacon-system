#!/usr/bin/env node
// clone-organize — replica organização de produtos em coleções entre 2 sites.
//
// Lê _design/lf-structure.json (gerado por scrape público com collections + members)
// e adiciona produtos correspondentes (mesmo handle) nas mesmas coleções no destino.
//
// Mantém produtos existentes — só ADICIONA collects faltantes. Idempotente.
//
// Uso:
//   node clone-organize.mjs <slug> --client-id <uuid> [--apply]

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Coleções que faz sentido replicar entre sites (estruturais, não promocionais)
const STRUCTURAL_COLLECTIONS = ['products', 'mens-watches', 'womens-watches', 'automatic-watches', 'quartz-watches', 'sport-watches', 'watch-accessories', 'watches'];

function parseArgs() {
  const args = { slug: null, clientId: null, apply: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--client-id') args.clientId = argv[++i];
    else if (!a.startsWith('--')) args.slug = a;
  }
  return args;
}

function loadEnv() {
  const env = {};
  fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
  return env;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function proxy(env, body) {
  const supa = new URL(env.VITE_SUPABASE_URL);
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const payload = JSON.stringify(body);
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: supa.hostname,
      path: '/functions/v1/shopify-admin-proxy',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key, 'Content-Length': Buffer.byteLength(payload) },
    }, r => {
      let b = ''; r.on('data', c => b += c);
      r.on('end', () => { try { res({ status: r.statusCode, body: JSON.parse(b) }); } catch { res({ status: r.statusCode, body: b }); } });
    });
    req.on('error', rej);
    req.write(payload); req.end();
  });
}

async function main() {
  const args = parseArgs();
  console.log('\n=== clone-organize ===');
  if (!args.slug || !args.clientId) {
    console.error('Uso: node clone-organize.mjs <slug> --client-id <uuid> [--apply]');
    process.exit(1);
  }

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  const lfStructPath = path.join(workspace, '_design', 'lf-structure.json');
  if (!fs.existsSync(lfStructPath)) {
    console.error(`Não achei ${lfStructPath}. Rode o fetch do alvo antes.`);
    process.exit(1);
  }
  const lf = JSON.parse(fs.readFileSync(lfStructPath, 'utf8'));
  const env = loadEnv();

  console.log(`  Source (alvo): ${Object.keys(lf.products).length} produtos, ${lf.collections.length} coleções`);
  console.log(`  Destino: clientId=${args.clientId}\n`);

  // 1. Fetch produtos da Mont Royal (handle → id)
  console.log('Buscando produtos do destino...');
  const mrProdResp = await proxy(env, { clientId: args.clientId, resource: 'products', method: 'list_all', params: { fields: 'id,handle,status' } });
  const mrProducts = mrProdResp.body?.data || [];
  const mrByHandle = Object.fromEntries(mrProducts.map(p => [p.handle, { id: p.id, status: p.status }]));
  console.log(`  ${mrProducts.length} produtos (${mrProducts.filter(p=>p.status==='active').length} ativos)`);

  // 2. Fetch coleções da Mont Royal (handle → id)
  console.log('\nBuscando coleções do destino...');
  const ccResp = await proxy(env, { clientId: args.clientId, resource: 'custom_collections', method: 'list_all' });
  const scResp = await proxy(env, { clientId: args.clientId, resource: 'smart_collections', method: 'list_all' });
  const cc = ccResp.body?.data || [];
  const sc = scResp.body?.data || [];
  const colByHandle = {};
  for (const c of cc) colByHandle[c.handle] = { id: c.id, type: 'custom', title: c.title };
  for (const c of sc) colByHandle[c.handle] = { id: c.id, type: 'smart', title: c.title };
  console.log(`  ${cc.length} custom + ${sc.length} smart`);

  // 3. Criar coleção 'products' se não existir
  if (!colByHandle['products']) {
    console.log(`\nCriando coleção 'products' (All Watches) no destino...`);
    if (args.apply) {
      const r = await proxy(env, {
        clientId: args.clientId,
        resource: 'custom_collections',
        method: 'create',
        payload: { custom_collection: { handle: 'products', title: 'Products', published: true, published_scope: 'global' } },
      });
      const created = r.body?.data?.custom_collection;
      if (created) {
        colByHandle['products'] = { id: created.id, type: 'custom', title: created.title };
        console.log(`  ✓ Criada id=${created.id}`);
      } else {
        console.log(`  ✗ Falhou: ${JSON.stringify(r.body).slice(0, 200)}`);
      }
    } else {
      console.log(`  [DRY-RUN] criaria coleção 'products'`);
      colByHandle['products'] = { id: 'PLACEHOLDER', type: 'custom', title: 'Products' };
    }
  }

  // 4. Pra cada coleção estrutural, sincroniza membros
  console.log(`\nSincronizando ${STRUCTURAL_COLLECTIONS.length} coleções estruturais...\n`);
  const plan = [];

  for (const colHandle of STRUCTURAL_COLLECTIONS) {
    const lfMembers = lf.collection_members?.[colHandle] || [];
    const mrCol = colByHandle[colHandle];
    if (!mrCol) {
      console.log(`  [skip] ${colHandle} — não existe no destino`);
      continue;
    }
    if (mrCol.type === 'smart') {
      console.log(`  [skip] ${colHandle} — smart collection (membros vêm de regras)`);
      continue;
    }

    // Lista produtos atuais nessa coleção MR
    let mrCurrent = [];
    if (mrCol.id !== 'PLACEHOLDER') {
      const r = await proxy(env, {
        clientId: args.clientId,
        resource: 'products',
        method: 'list_all',
        params: { collection_id: mrCol.id, fields: 'id,handle' },
      });
      mrCurrent = (r.body?.data || []).map(p => p.handle);
    }

    // Calcula que handles faltam
    const missing = lfMembers.filter(h => {
      if (mrCurrent.includes(h)) return false;
      if (!mrByHandle[h]) return false; // produto não existe na MR (handle não bate)
      return true;
    });
    const notFound = lfMembers.filter(h => !mrByHandle[h]);

    console.log(`  ${colHandle.padEnd(22)} LF=${lfMembers.length}  MR_atual=${mrCurrent.length}  +adicionar=${missing.length}  not_found=${notFound.length}`);
    if (notFound.length && notFound.length < 5) {
      notFound.forEach(h => console.log(`    ✗ handle ausente na MR: ${h}`));
    }

    if (missing.length > 0) {
      plan.push({ collection: colHandle, collection_id: mrCol.id, handles_to_add: missing });
    }
  }

  console.log(`\n=== Resumo do plano ===`);
  const total = plan.reduce((s, p) => s + p.handles_to_add.length, 0);
  console.log(`  Coleções afetadas: ${plan.length}`);
  console.log(`  Collects a criar: ${total}`);
  plan.forEach(p => console.log(`    ${p.collection.padEnd(22)} +${p.handles_to_add.length}`));

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra aplicar os ${total} collects.`);
    fs.writeFileSync(path.join(workspace, '_design', 'organize-plan.json'), JSON.stringify(plan, null, 2));
    return;
  }

  // 5. APPLY — criar collects
  console.log(`\nAplicando ${total} collects...`);
  let ok = 0, fail = 0;
  const errors = [];
  for (const p of plan) {
    if (p.collection_id === 'PLACEHOLDER') continue;
    for (const handle of p.handles_to_add) {
      const productId = mrByHandle[handle]?.id;
      if (!productId) continue;
      const r = await proxy(env, {
        clientId: args.clientId,
        resource: 'collects',
        method: 'create',
        payload: { collect: { product_id: productId, collection_id: p.collection_id } },
      });
      if (r.status === 201 || r.status === 200 || r.body?.data?.collect) ok++;
      else {
        fail++;
        if (errors.length < 10) errors.push({ handle, collection: p.collection, status: r.status, body: JSON.stringify(r.body).slice(0, 200) });
      }
      await delay(350);
    }
    process.stdout.write(`\r  ok=${ok} fail=${fail}   `);
  }
  console.log('\n');
  if (errors.length) {
    console.log('Erros (primeiros 5):');
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.handle} → ${e.collection}: ${e.status} ${e.body}`));
  }

  fs.writeFileSync(path.join(workspace, '_design', 'organize-result.json'), JSON.stringify({ plan, ok, fail, errors, ran_at: new Date().toISOString() }, null, 2));
  console.log(`\n✓ Concluído: ${ok}/${total} collects criados`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
