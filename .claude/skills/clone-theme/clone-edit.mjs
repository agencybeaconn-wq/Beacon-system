#!/usr/bin/env node
// clone-edit — atualiza um tema EXISTENTE na Shopify (não cria novo)
// usando edge function shopify-admin-proxy (resolve token server-side).
//
// Modo de auth: clientId do agency_clients (resolvido via Supabase no servidor).
// Não precisa de ANON_KEY local, JWT do user, nem Shopify CLI auth.
//
// Uso:
//   node clone-edit.mjs <slug> --client-id <uuid> --theme-id <id> [--apply]

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const SKIP_PREFIX = ['_raw', '_design', '_preview', '_dist', '.git', '.github', '.vscode', '.shopify', 'node_modules'];
const SKIP_FILES = new Set(['.clone-meta.json', '.gitignore', '.prettierrc.json', '.theme-check.yml', 'translation.yml', 'README.md', 'LICENSE.md', 'release-notes.md']);
const SKIP_EXT = new Set(['.zip', '.md.tmp']);

function parseArgs() {
  const args = { slug: null, clientId: null, themeId: null, apply: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--client-id') args.clientId = argv[++i];
    else if (a === '--theme-id') args.themeId = argv[++i];
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

function isBinary(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.mp4', '.webm', '.mp3', '.wav', '.pdf'].includes(ext);
}

function listThemeFiles(workspace) {
  const files = [];
  function walk(absDir, relDir) {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (relDir === '' && SKIP_PREFIX.includes(entry.name)) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) continue;
      const full = path.join(absDir, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else files.push({ key: rel, fullPath: full });
    }
  }
  walk(workspace, '');
  return files;
}

function buildAsset(entry) {
  const asset = { key: entry.key };
  if (isBinary(entry.fullPath)) {
    asset.attachment = fs.readFileSync(entry.fullPath).toString('base64');
  } else {
    asset.value = fs.readFileSync(entry.fullPath, 'utf8');
  }
  return { asset };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function proxy(env, body) {
  const supa = new URL(env.VITE_SUPABASE_URL);
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  return new Promise((res, rej) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: supa.hostname,
      path: '/functions/v1/shopify-admin-proxy',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, r => {
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => {
        try { res({ status: r.statusCode, body: JSON.parse(b) }); }
        catch { res({ status: r.statusCode, body: b }); }
      });
    });
    req.on('error', rej);
    req.write(payload);
    req.end();
  });
}

async function putAsset(env, clientId, themeId, fileEntry, retries = 2) {
  const payload = buildAsset(fileEntry);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await proxy(env, {
        clientId,
        resource: 'themes',
        method: 'put_asset',
        resourceId: themeId,
        payload,
      });
      if (r.status === 200 || r.status === 201) return { ok: true };
      if (r.status === 429 || r.status >= 500) {
        if (attempt < retries) { await delay(1500 * (attempt + 1)); continue; }
      }
      return { ok: false, status: r.status, body: JSON.stringify(r.body).slice(0, 250) };
    } catch (e) {
      if (attempt < retries) { await delay(1500); continue; }
      return { ok: false, error: e.message };
    }
  }
}

async function main() {
  const args = parseArgs();
  console.log('\n=== clone-edit ===');

  if (!args.slug || !args.clientId || !args.themeId) {
    console.error('Uso: node clone-edit.mjs <slug> --client-id <uuid> --theme-id <id> [--apply]');
    process.exit(1);
  }

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  if (!fs.existsSync(metaPath)) {
    console.error(`Não achei ${metaPath}.`);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const env = loadEnv();

  const files = listThemeFiles(workspace);
  const sizeMB = files.reduce((s, f) => s + fs.statSync(f.fullPath).size, 0) / 1024 / 1024;
  console.log(`  Slug:      ${args.slug}`);
  console.log(`  Theme ID:  ${args.themeId}`);
  console.log(`  Client ID: ${args.clientId}`);
  console.log(`  Arquivos:  ${files.length} (${sizeMB.toFixed(2)} MB)\n`);

  if (!args.apply) {
    console.log('Amostra (primeiros 8):');
    files.slice(0, 8).forEach(f => console.log(`  ${f.key}`));
    console.log(`  ... +${files.length - 8} arquivos`);
    console.log('\n[DRY-RUN] Rode com --apply pra sobrescrever os assets no tema existente.');
    return;
  }

  console.log(`Enviando via shopify-admin-proxy → put_asset...`);
  let ok = 0, fail = 0;
  const errors = [];
  const start = Date.now();

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const r = await putAsset(env, args.clientId, args.themeId, f);
    if (r.ok) ok++;
    else {
      fail++;
      if (errors.length < 10) errors.push({ key: f.key, ...r });
    }
    if ((i + 1) % 10 === 0 || i === files.length - 1) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(0);
      process.stdout.write(`\r  [${i + 1}/${files.length}] ok=${ok} fail=${fail}  (${elapsed}s)   `);
    }
    await delay(400);
  }
  console.log(`\n`);

  // Resolve shop pra preview URL: lista themes via proxy e pega de meta de Shopify.
  // Não tem como descobrir shop via edge function (ela só responde JSON da Shopify).
  // Caminho confiável: descobrir via `resource: shop`.
  let shop = meta.shop;
  try {
    const shopInfo = await proxy(env, { clientId: args.clientId, resource: 'shop', method: 'list' });
    const detected = shopInfo.body?.data?.shop?.myshopify_domain || shopInfo.body?.data?.shop?.domain;
    if (detected) shop = detected;
  } catch { /* mantém meta.shop como fallback */ }

  console.log(`${'='.repeat(60)}`);
  if (fail === 0) {
    console.log(`✓ Todos os ${ok} arquivos atualizados`);
  } else {
    console.log(`⚠ ${ok}/${files.length} ok, ${fail} falhas`);
    console.log('Primeiros erros:');
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.key}: ${JSON.stringify(e).slice(0, 200)}`));
  }
  console.log(`\n👁  Preview:  https://${shop}?preview_theme_id=${args.themeId}`);
  console.log(`✏  Editor:   https://${shop}/admin/themes/${args.themeId}/editor`);

  meta.last_edit = {
    at: new Date().toISOString(),
    theme_id: args.themeId,
    files_total: files.length,
    files_ok: ok,
    files_fail: fail,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
