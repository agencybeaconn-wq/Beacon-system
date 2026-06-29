#!/usr/bin/env node
// theme-push — sobe assets locais pro tema de uma loja via Asset API.
//
// IMPORTANTE: Por default só aceita push pra lojas DE DESENVOLVIMENTO (BR ou EN).
// Pra push em cliente (propagate), use a skill /lever-theme propagate <cliente>
// que tem allowlist + diff + confirm.
//
// Uso:
//   node theme-push.mjs br                    # DRY-RUN (lista o que vai subir)
//   node theme-push.mjs br --apply            # sobe pra testeloja-9899
//   node theme-push.mjs en --apply            # sobe pra loja EN dev
//   node theme-push.mjs br --only=sections/header.liquid --apply  # 1 arquivo só

import { getCreds, shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { appendExecutionLog } from '../../lib/validate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const TEMPLATES = {
  br: {
    clientId: '5e836736-7411-42d8-b99e-bcad1e55919d',
    themeId: 160282804466,
    localPath: 'themes/lever-br',
  },
  en: {
    clientId: '17089519-4779-41bb-96ca-9791e0677cf8',
    themeId: 129577091130,
    localPath: 'themes/lever-en',
  },
};

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
    if (item.startsWith('.')) continue; // skip .theme-meta.json, .shopify/
    const full = path.join(dir, item);
    const rel = base ? `${base}/${item}` : item;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push(...walkDir(full, rel));
    } else {
      entries.push({ key: rel, fullPath: full });
    }
  }
  return entries;
}

function isBinary(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.mp4', '.webm', '.mp3', '.wav', '.pdf'].includes(ext);
}

function buildAssetPayload(entry) {
  const asset = { key: entry.key };
  if (isBinary(entry.fullPath)) {
    asset.attachment = fs.readFileSync(entry.fullPath).toString('base64');
  } else {
    asset.value = fs.readFileSync(entry.fullPath, 'utf8');
  }
  return { asset };
}

async function main() {
  const args = parseArgs();
  const target = args._[0];

  if (!target || !TEMPLATES[target]) {
    console.error('Uso: node theme-push.mjs <br|en> [--apply] [--only=path]');
    console.error('IMPORTANTE: só aceita targets "br" e "en" — para cliente use /lever-theme propagate');
    process.exit(1);
  }

  const config = TEMPLATES[target];
  console.log(`\n=== theme-push ${target} ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);

  const creds = await getCreds(config.clientId);
  console.log(`✓ Target: ${creds.shop} (loja DEV)`);

  // Descobre themeId do metadata se não hardcoded
  const localDir = path.join(REPO_ROOT, config.localPath);
  const metaPath = path.join(localDir, '.theme-meta.json');
  let themeId = config.themeId;
  if (!themeId && fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    themeId = meta.themeId;
    console.log(`✓ Theme ID do meta: ${themeId} (${meta.themeName})`);
  }
  if (!themeId) {
    console.error('Theme ID desconhecido. Rode `theme-pull.mjs ' + target + '` primeiro.');
    process.exit(1);
  }

  // Lista arquivos locais
  const allFiles = walkDir(localDir);
  let filesToPush = allFiles;
  if (args.only) {
    filesToPush = allFiles.filter(f => f.key === args.only);
    if (!filesToPush.length) {
      console.error(`Arquivo "${args.only}" não encontrado em ${config.localPath}/`);
      process.exit(1);
    }
  }
  console.log(`\n${filesToPush.length} arquivos a enviar`);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Amostra (10):`);
    filesToPush.slice(0, 10).forEach(f => console.log(`  - ${f.key}`));
    if (filesToPush.length > 10) console.log(`  ...+${filesToPush.length - 10} arquivos`);
    console.log(`\nRode novamente com --apply pra subir.`);
    return;
  }

  // EXECUTE
  console.log(`\nEnviando...`);
  let ok = 0, fail = 0;
  const errors = [];
  for (let i = 0; i < filesToPush.length; i++) {
    const f = filesToPush[i];
    try {
      const payload = buildAssetPayload(f);
      const r = await shReq(creds.shop, creds.token, 'PUT',
        `/admin/api/${API_VERSION}/themes/${themeId}/assets.json`, payload);
      if (r.status === 200) ok++;
      else {
        fail++;
        if (errors.length < 10) errors.push({ key: f.key, status: r.status, body: JSON.stringify(r.body).slice(0, 150) });
      }
    } catch (e) {
      fail++;
      if (errors.length < 10) errors.push({ key: f.key, error: e.message });
    }
    if ((i + 1) % 10 === 0 || i === filesToPush.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${filesToPush.length}] ok=${ok} fail=${fail}   `);
    }
    await delay(400);
  }

  console.log(`\n\n✓ Concluído: ok=${ok} fail=${fail}`);
  if (errors.length) {
    console.log('\nPrimeiros erros:');
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.key}: ${JSON.stringify(e).slice(0, 200)}`));
  }

  await appendExecutionLog({
    skill: 'lever-theme',
    op: 'push-dev',
    target,
    shop: creds.shop,
    theme_id: themeId,
    files_total: filesToPush.length,
    ok, fail,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
