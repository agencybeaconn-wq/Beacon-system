#!/usr/bin/env node
// theme-draft-sync — sobe arquivos locais (themes/client-<id>/) pro DRAFT theme do cliente.
//
// Uso:
//   node theme-draft-sync.mjs <clientIdOrName>                 # DRY-RUN
//   node theme-draft-sync.mjs <clientIdOrName> --apply         # sobe diferenças
//   node theme-draft-sync.mjs <clientIdOrName> --only=path     # só 1 arquivo
//
// NOTA: só sobe arquivos que estão na allowlist (sections/, snippets/, assets/*.js|css|liquid, layout/).
// NUNCA sobrescreve templates/*.json (customização per-team) nem config/settings_data.json (settings do cliente).

import { fetchClient } from '../../lib/supabase-rest.mjs';
import { shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { appendExecutionLog } from '../../lib/validate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const ALLOWLIST_RE = [
  /^sections\/.*\.liquid$/,
  /^snippets\/.*\.liquid$/,
  /^assets\/.*\.(js|css|liquid)$/,
  /^layout\/.*\.liquid$/,
  /^config\/settings_schema\.json$/,
];
const BLOCKLIST_RE = [
  /^templates\//,
  /^config\/settings_data\.json$/,
  /^locales\//,
];

function isAllowlisted(key) {
  if (BLOCKLIST_RE.some(re => re.test(key))) return false;
  return ALLOWLIST_RE.some(re => re.test(key));
}

function parseArgs() {
  const args = { _: [], apply: false, only: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
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

function readContent(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node theme-draft-sync.mjs <clientIdOrName> [--apply] [--only=path]');
    process.exit(1);
  }

  const client = await fetchClient(clientArg);
  if (!client) { console.error('Cliente não encontrado'); process.exit(1); }

  const localDir = path.join(REPO_ROOT, `themes/client-${client.id.slice(0, 8)}`);
  const draftMetaPath = path.join(localDir, '.theme-draft.json');

  if (!fs.existsSync(draftMetaPath)) {
    console.error(`\n❌ Nenhum draft theme criado pra esse cliente ainda.`);
    console.error(`   Rode primeiro: node .claude/skills/lever-theme/theme-duplicate.mjs "${client.name}"`);
    process.exit(1);
  }

  const draftMeta = JSON.parse(fs.readFileSync(draftMetaPath, 'utf8'));
  const { draftThemeId } = draftMeta;
  const shop = client.shopify_domain;
  const token = client.shopify_access_token;

  console.log(`\n=== theme-draft-sync ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`Cliente: ${client.name}`);
  console.log(`Draft Theme: ${draftMeta.draftName} (id=${draftThemeId})`);

  // Arquivos locais (só da allowlist)
  const allLocal = walkDir(localDir);
  let candidates = allLocal.filter(f => isAllowlisted(f.key));
  if (args.only) candidates = candidates.filter(f => f.key === args.only);
  console.log(`\n${candidates.length} arquivos candidatos (allowlist)`);

  // Diff com o draft remoto
  console.log(`Comparando com draft...`);
  const toPush = [];
  let checked = 0;
  for (const f of candidates) {
    const q = `asset[key]=${encodeURIComponent(f.key)}`;
    const r = await shReq(shop, token, 'GET',
      `/admin/api/${API_VERSION}/themes/${draftThemeId}/assets.json?${q}`);
    const remote = r.body?.asset;
    const localContent = readContent(f.fullPath);
    const remoteContent = remote?.value != null ? remote.value.replace(/\r\n/g, '\n') : null;
    if (remoteContent === null) {
      toPush.push({ ...f, reason: 'novo' });
    } else if (localContent.trim() !== remoteContent.trim()) {
      toPush.push({ ...f, reason: 'diff' });
    }
    checked++;
    if (checked % 20 === 0) process.stdout.write(`\r  [${checked}/${candidates.length}]  `);
    await delay(400);
  }
  console.log('');

  console.log(`\n=== PREVIEW ===`);
  console.log(`A atualizar: ${toPush.length}`);
  toPush.slice(0, 20).forEach(f => console.log(`  ~ ${f.key} (${f.reason})`));
  if (toPush.length > 20) console.log(`  ...+${toPush.length - 20} arquivos`);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode novamente com --apply pra subir.`);
    return;
  }
  if (toPush.length === 0) { console.log('\nNada a sincronizar. ✓'); return; }

  console.log(`\nAplicando no draft...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < toPush.length; i++) {
    const f = toPush[i];
    try {
      const payload = { asset: { key: f.key, value: readContent(f.fullPath) } };
      const r = await shReq(shop, token, 'PUT',
        `/admin/api/${API_VERSION}/themes/${draftThemeId}/assets.json`, payload);
      if (r.status === 200) ok++;
      else fail++;
    } catch { fail++; }
    if ((i + 1) % 10 === 0 || i === toPush.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${toPush.length}] ok=${ok} fail=${fail}   `);
    }
    await delay(500);
  }
  console.log(`\n\n✓ ok=${ok} fail=${fail}`);
  console.log(`\nTestar no preview: ${draftMeta.previewUrl}`);

  await appendExecutionLog({
    skill: 'lever-theme',
    op: 'draft-sync',
    client_id: client.id,
    draft_theme_id: draftThemeId,
    files_pushed: ok,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
