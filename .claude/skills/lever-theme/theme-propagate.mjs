#!/usr/bin/env node
// theme-propagate — aplica tema local dev (BR ou EN) em cliente específico.
// Usa allowlist rígida — NUNCA sobrescreve customizações per-team (templates/, settings_data, locales).
//
// Uso:
//   node theme-propagate.mjs <clientIdOrName>                 # DRY-RUN (lista diff)
//   node theme-propagate.mjs <clientIdOrName> --apply         # APLICA
//   node theme-propagate.mjs <clientIdOrName> --side=en       # usa EN em vez de BR
//   node theme-propagate.mjs <clientIdOrName> --only=sections/header.liquid  # 1 arquivo

import { shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { fetchClient } from '../../lib/supabase-rest.mjs';
import { appendExecutionLog } from '../../lib/validate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BR_DIR = path.join(REPO_ROOT, 'themes/lever-br');
const EN_DIR = path.join(REPO_ROOT, 'themes/lever-en');

// ALLOWLIST: só esses arquivos são copiados do dev pro cliente
const ALLOWLIST_RE = [
  /^sections\/.*\.liquid$/,       // sections Liquid
  /^snippets\/.*\.liquid$/,       // snippets Liquid
  /^assets\/.*\.(js|css|liquid)$/, // assets de código (não imagens)
  /^layout\/.*\.liquid$/,         // layout
  /^config\/settings_schema\.json$/, // só o schema, não data
];

// BLOCKLIST (redundante, mas explícito): nunca copia
const BLOCKLIST_RE = [
  /^templates\//,                  // customizações per-team
  /^config\/settings_data\.json$/, // valores do customizer do cliente
  /^locales\//,                    // i18n específico
  /^assets\/.*\.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|otf|mp4|webm)$/, // binários
];

function parseArgs() {
  const args = { _: [], apply: false, side: 'br', only: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--side=')) args.side = a.slice(7);
    else if (a.startsWith('--only=')) args.only = a.slice(7);
    else args._.push(a);
  }
  return args;
}

function walkDir(dir, base = '') {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const item of fs.readdirSync(dir)) {
    if (item.startsWith('.')) continue;
    const full = path.join(dir, item);
    const rel = base ? `${base}/${item}` : item;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) entries.push(...walkDir(full, rel));
    else entries.push({ key: rel, fullPath: full });
  }
  return entries;
}

function isAllowlisted(key) {
  if (BLOCKLIST_RE.some(re => re.test(key))) return false;
  return ALLOWLIST_RE.some(re => re.test(key));
}

function readContent(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node theme-propagate.mjs <clientIdOrName> [--apply] [--side=br|en] [--only=path]');
    process.exit(1);
  }

  console.log(`\n=== theme-propagate ${args.apply ? '[APPLY]' : '[DRY-RUN]'} side=${args.side} ===`);

  const client = await fetchClient(clientArg);
  if (!client) { console.error(`Cliente "${clientArg}" não encontrado`); process.exit(1); }
  if (!client.shopify_access_token) { console.error(`Cliente "${client.name}" sem Shopify conectada`); process.exit(1); }
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  // Pega tema main do cliente
  const themesRes = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
    `/admin/api/${API_VERSION}/themes.json`);
  const mainTheme = (themesRes.body?.themes || []).find(t => t.role === 'main');
  if (!mainTheme) { console.error('Cliente sem tema main'); process.exit(1); }
  console.log(`✓ Tema cliente: ${mainTheme.name} (id=${mainTheme.id})`);

  // Lê arquivos locais
  const localDir = args.side === 'en' ? EN_DIR : BR_DIR;
  if (!fs.existsSync(localDir)) {
    console.error(`Pasta ${localDir} não existe. Rode theme-pull.mjs primeiro.`);
    process.exit(1);
  }
  const allLocal = walkDir(localDir);
  let candidates = allLocal.filter(f => isAllowlisted(f.key));
  if (args.only) candidates = candidates.filter(f => f.key === args.only);
  console.log(`✓ ${candidates.length} arquivos candidatos (allowlist)`);

  // Compara conteúdo com remoto — só lista os que mudariam
  console.log(`\nComparando com tema do cliente...`);
  const toPush = [];
  const unchanged = [];
  let checked = 0;
  for (const f of candidates) {
    const q = `asset[key]=${encodeURIComponent(f.key)}`;
    const r = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
      `/admin/api/${API_VERSION}/themes/${mainTheme.id}/assets.json?${q}`);
    const remoteAsset = r.body?.asset;
    const localContent = readContent(f.fullPath);
    const remoteContent = remoteAsset?.value != null ? remoteAsset.value.replace(/\r\n/g, '\n') : null;
    if (remoteContent === null) {
      toPush.push({ ...f, reason: 'novo arquivo (não existia no cliente)' });
    } else if (localContent.trim() !== remoteContent.trim()) {
      toPush.push({ ...f, reason: 'conteúdo diferente' });
    } else {
      unchanged.push(f.key);
    }
    checked++;
    if (checked % 20 === 0) process.stdout.write(`\r  [${checked}/${candidates.length}]  `);
    await delay(400);
  }
  console.log('');

  console.log(`\n=== PREVIEW ===`);
  console.log(`Inalterados: ${unchanged.length}`);
  console.log(`A atualizar: ${toPush.length}`);
  if (toPush.length) {
    console.log('\n' + toPush.slice(0, 20).map(f => `  ~ ${f.key}  (${f.reason})`).join('\n'));
    if (toPush.length > 20) console.log(`  ...+${toPush.length - 20} arquivos`);
  }

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra aplicar no tema do cliente.`);
    console.log(`⚠️  IMPORTANTE: esta operação modifica o tema EM PRODUÇÃO do cliente.`);
    console.log(`   Sempre teste no tema dev antes (push-dev br + teste na testeloja).`);
    return;
  }

  if (toPush.length === 0) { console.log('\nNada a propagar. ✓'); return; }

  // EXECUTE
  console.log(`\nAplicando ${toPush.length} arquivos em ${client.name}...`);
  let ok = 0, fail = 0;
  const errors = [];
  const pushedFiles = []; // track pra rollback hint em partial failure
  let firstFailureAt = -1;
  for (let i = 0; i < toPush.length; i++) {
    const f = toPush[i];
    try {
      const payload = { asset: { key: f.key, value: readContent(f.fullPath) } };
      const r = await shReq(client.shopify_domain, client.shopify_access_token, 'PUT',
        `/admin/api/${API_VERSION}/themes/${mainTheme.id}/assets.json`, payload);
      if (r.status === 200) {
        ok++;
        pushedFiles.push(f.key);
      } else {
        fail++;
        if (firstFailureAt < 0) firstFailureAt = i;
        if (errors.length < 10) errors.push({ key: f.key, status: r.status, body: JSON.stringify(r.body).slice(0, 150) });
      }
    } catch (e) {
      fail++;
      if (firstFailureAt < 0) firstFailureAt = i;
      if (errors.length < 10) errors.push({ key: f.key, error: e.message });
    }
    if ((i + 1) % 10 === 0 || i === toPush.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${toPush.length}] ok=${ok} fail=${fail}   `);
    }
    await delay(500);
  }

  console.log(`\n\n✓ Concluído: ok=${ok} fail=${fail}`);
  if (errors.length) {
    console.log('\nPrimeiros erros:');
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.key}: ${JSON.stringify(e).slice(0, 200)}`));
  }

  // Partial failure: printa rollback hint
  if (fail > 0 && pushedFiles.length > 0) {
    console.log(`\n⚠ PARTIAL FAILURE: ${pushedFiles.length} arquivos foram aplicados antes da falha.`);
    console.log(`   Arquivos pushados (manter ou reverter manualmente via theme admin):`);
    pushedFiles.slice(0, 20).forEach(k => console.log(`     - ${k}`));
    if (pushedFiles.length > 20) console.log(`     ...+${pushedFiles.length - 20} arquivos`);
    console.log(`\n   Pra reverter: restaure esses arquivos do tema backup ou rode theme-pull-client + git reset.`);
    // Salva lista em arquivo pra referência
    const rollbackLog = path.join(__dirname, `.rollback-theme-propagate-${client.id.slice(0, 8)}-${Date.now()}.json`);
    fs.writeFileSync(rollbackLog, JSON.stringify({
      client: client.name,
      shop: client.shopify_domain,
      themeId: mainTheme.id,
      side: args.side,
      pushedFiles,
      failedAt: firstFailureAt,
      errors,
      ts: new Date().toISOString(),
    }, null, 2));
    console.log(`   Detalhes em ${rollbackLog}`);
  }

  await appendExecutionLog({
    skill: 'lever-theme',
    op: 'propagate',
    client_id: client.id,
    client_name: client.name,
    side: args.side,
    files_total: toPush.length,
    ok, fail,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
