#!/usr/bin/env node
// dedupe-products — detecta + remove produtos duplicados na Shopify.
// Estratégia default: keep oldest (menor id) + delete os outros.
// Background-safe: checkpoint + SIGINT + --resume + --status.

import { shReq, shopifyGraphQL, nextPageUrl, delay, API_VERSION, getGraphQLErrors } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { writeCheckpoint, readCheckpoint, clearCheckpoint, installSigintHandler, hasCheckpoint } from '../../lib/checkpoint.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_NAME = 'dedupe-products';
const LOG_DIR = path.resolve(__dirname, '..', '..', 'logs');

function parseArgs() {
  const args = { _: [], apply: false, by: 'handle', resume: false, status: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--resume') args.resume = true;
    else if (a === '--status') args.status = true;
    else if (a.startsWith('--by=')) args.by = a.slice(5);
    else args._.push(a);
  }
  if (!['handle', 'title', 'both'].includes(args.by)) {
    console.error(`--by= deve ser handle|title|both (recebido: ${args.by})`);
    process.exit(1);
  }
  return args;
}

function normalizeTitle(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchAllProducts(shop, token) {
  const all = [];
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,handle,title,created_at,updated_at,status,variants,images`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    if (r.status !== 200) throw new Error(`Shopify ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
    all.push(...(r.body.products || []));
    p = nextPageUrl(r.link);
    if (p) await delay(400);
  }
  return all;
}

function groupDuplicates(products, mode) {
  const groups = new Map(); // key → [products...]
  for (const p of products) {
    let key;
    if (mode === 'handle') key = p.handle || `NO_HANDLE_${p.id}`;
    else if (mode === 'title') key = normalizeTitle(p.title);
    else if (mode === 'both') key = `${p.handle || ''}|${normalizeTitle(p.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const dupGroups = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    // Ordena por id crescente (menor id = mais antigo)
    list.sort((a, b) => a.id - b.id);
    const keeper = list[0];
    const toDelete = list.slice(1);
    dupGroups.push({ key, keeper, toDelete });
  }
  return dupGroups;
}

const PRODUCT_DELETE_MUTATION = `mutation productDelete($input: ProductDeleteInput!) {
  productDelete(input: $input) {
    deletedProductId
    userErrors { field message }
  }
}`;

async function main() {
  const args = parseArgs();

  if (args.status) {
    const ck = readCheckpoint(SKILL_NAME);
    if (!ck) { console.log('Nenhum checkpoint ativo pra dedupe-products.'); return; }
    console.log('=== Checkpoint dedupe-products ===');
    console.log('  ts:', ck.ts);
    console.log('  cliente:', ck.data?.clientName || '?');
    console.log('  deleted:', ck.data?.deletedIds?.length || 0, '/', ck.data?.totalToDelete || '?');
    console.log('  mode:', ck.data?.mode || '?');
    console.log('\nRode com --resume pra retomar.');
    return;
  }

  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node dedupe-products.mjs <clientIdOrName> [--apply] [--by=handle|title|both] [--resume] [--status]');
    process.exit(1);
  }

  console.log(`\n=== dedupe-products ${args.apply ? '[APPLY]' : '[DRY-RUN]'} (by=${args.by}) ===`);

  // VALIDATE
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  // FETCH
  console.log(`\nBuscando todos os produtos...`);
  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token);
  console.log(`  ${products.length} produtos carregados`);

  // DETECT
  const dupGroups = groupDuplicates(products, args.by);
  const totalToDelete = dupGroups.reduce((s, g) => s + g.toDelete.length, 0);

  // PREVIEW
  console.log(`\n=== PREVIEW ===`);
  console.log(`Grupos de duplicatas detectados: ${dupGroups.length}`);
  console.log(`Produtos que seriam deletados: ${totalToDelete}`);
  console.log(`Produtos que permanecem (keepers): ${dupGroups.length}`);
  console.log();

  if (dupGroups.length === 0) {
    console.log('✓ Nenhuma duplicata encontrada. Nada a fazer.');
    clearCheckpoint(SKILL_NAME);
    return;
  }

  console.log(`Amostra (até 10 grupos):`);
  for (const g of dupGroups.slice(0, 10)) {
    console.log(`\n  Key: "${g.key.slice(0, 80)}"`);
    console.log(`    ✓ KEEPER: [${g.keeper.id}] "${g.keeper.title}" (${g.keeper.variants?.length || 0}v, ${g.keeper.images?.length || 0}img, criado ${g.keeper.created_at?.slice(0, 10)})`);
    for (const p of g.toDelete) {
      console.log(`    ✗ DELETE: [${p.id}] "${p.title}" (${p.variants?.length || 0}v, ${p.images?.length || 0}img, criado ${p.created_at?.slice(0, 10)})`);
    }
  }
  if (dupGroups.length > 10) console.log(`\n  ...+${dupGroups.length - 10} grupos`);

  // Salva plano
  const planPath = path.join(__dirname, '.tmp_dedupe_plan.json');
  fs.writeFileSync(planPath, JSON.stringify({
    client: client.name, by: args.by, dupGroups, totalToDelete, ts: new Date().toISOString(),
  }, null, 2));
  console.log(`\nPlano salvo em ${planPath}`);

  // Estimate de custo + circuit-breaker
  printEstimate({ count: totalToDelete, opName: 'delete duplicates', rateLimitMs: 600, unit: 'produtos' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: totalToDelete, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra deletar as duplicatas.`);
    console.log(`Lembrete: keeper = produto mais antigo (menor id) de cada grupo.`);
    return;
  }

  // CHECKPOINT + resume
  let deletedIds = new Set();
  if (args.resume && hasCheckpoint(SKILL_NAME)) {
    const ck = readCheckpoint(SKILL_NAME);
    if (ck?.data?.clientId === client.id) {
      deletedIds = new Set(ck.data.deletedIds || []);
      console.log(`\n⏯  Resumindo: ${deletedIds.size} produtos já deletados`);
    }
  } else if (hasCheckpoint(SKILL_NAME)) {
    console.warn(`\n⚠ Checkpoint anterior existe. Rode com --resume pra retomar.`);
  }

  // BACKUP: salva JSONL dos produtos que serão deletados
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const backupPath = path.join(LOG_DIR, `dedupe-backup-${client.id.slice(0, 8)}-${Date.now()}.jsonl`);
  const backupLines = [];
  for (const g of dupGroups) {
    for (const p of g.toDelete) {
      if (deletedIds.has(p.id)) continue;
      backupLines.push(JSON.stringify(p));
    }
  }
  fs.writeFileSync(backupPath, backupLines.join('\n') + '\n');
  console.log(`\n💾 Backup salvo em ${backupPath}`);

  // SIGINT handler
  installSigintHandler(SKILL_NAME, () => ({
    clientId: client.id,
    clientName: client.name,
    deletedIds: [...deletedIds],
    totalToDelete,
    mode: args.by,
  }));

  // DELETE
  console.log(`\n=== EXECUTANDO DELETE ===`);
  let ok = 0, fail = 0;
  const errors = [];
  const allToDelete = dupGroups.flatMap(g => g.toDelete.filter(p => !deletedIds.has(p.id)));

  for (let i = 0; i < allToDelete.length; i++) {
    const p = allToDelete[i];
    try {
      const r = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, PRODUCT_DELETE_MUTATION, {
        input: { id: `gid://shopify/Product/${p.id}` },
      });
      const errs = getGraphQLErrors(r, 'productDelete');
      if (errs.length) {
        fail++;
        if (errors.length < 20) errors.push({ id: p.id, title: p.title, errs });
      } else {
        ok++;
        deletedIds.add(p.id);
      }
    } catch (e) {
      fail++;
      if (errors.length < 20) errors.push({ id: p.id, title: p.title, error: e.message });
    }

    // Checkpoint a cada 10 produtos
    if (deletedIds.size % 10 === 0) {
      writeCheckpoint(SKILL_NAME, {
        clientId: client.id,
        clientName: client.name,
        deletedIds: [...deletedIds],
        totalToDelete,
        mode: args.by,
      });
    }
    process.stdout.write(`\r  [${i + 1}/${allToDelete.length}] ok=${ok} fail=${fail}   `);
    await delay(500);
  }

  console.log(`\n\nResultado: ok=${ok} fail=${fail}`);
  if (errors.length) {
    console.log(`\nPrimeiros erros:`);
    errors.slice(0, 5).forEach(e => console.log(`  - [${e.id}] ${e.title}: ${JSON.stringify(e.errs || e.error).slice(0, 200)}`));
  }

  if (fail === 0) clearCheckpoint(SKILL_NAME);

  // LOG
  await appendExecutionLog({
    skill: SKILL_NAME,
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    mode: args.by,
    groups_detected: dupGroups.length,
    products_to_delete: totalToDelete,
    ok, fail,
    dry_run: false,
    backup_path: backupPath,
  });

  console.log(`\n✓ Concluído. Restore manual: baixe ${backupPath} e recrie via Shopify Admin se necessário.`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
