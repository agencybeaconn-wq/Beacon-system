#!/usr/bin/env node
// clone-upload — sobe o tema clonado direto na Shopify via Asset API REST.
//
// Cria tema NOVO como 'unpublished' (preview only — nunca publica).
// Sobe arquivo por arquivo do workspace (skip _raw/_design/_preview/_dist).
//
// Modos de auth:
//   A) Por cliente cadastrado: --client "Nome Lucky Fours"
//      (resolve via Supabase — getCreds; pode bloquear se .env tem PUBLISHABLE_KEY
//       em vez de ANON_KEY — caso bloqueie, use modo B)
//   B) Direto: --shop <shop>.myshopify.com --token <shpat_xxx>
//
// Uso:
//   node clone-upload.mjs <slug> --client "<nome>"           # DRY-RUN
//   node clone-upload.mjs <slug> --client "<nome>" --apply   # sobe
//   node clone-upload.mjs <slug> --shop <shop> --token <t> --apply

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const SKIP_PREFIX = ['_raw', '_design', '_preview', '_dist', '.git', '.github', '.vscode', '.shopify', 'node_modules'];
const SKIP_FILES = new Set(['.clone-meta.json', '.gitignore', '.prettierrc.json', '.theme-check.yml', 'translation.yml', 'README.md', 'LICENSE.md', 'release-notes.md']);
const SKIP_EXT = new Set(['.zip', '.md.tmp']);

function parseArgs() {
  const args = { slug: null, client: null, shop: null, token: null, apply: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--client') args.client = argv[++i];
    else if (a === '--shop') args.shop = argv[++i];
    else if (a === '--token') args.token = argv[++i];
    else if (!a.startsWith('--')) args.slug = a;
  }
  return args;
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

function buildAssetPayload(entry) {
  const asset = { key: entry.key };
  if (isBinary(entry.fullPath)) {
    asset.attachment = fs.readFileSync(entry.fullPath).toString('base64');
  } else {
    asset.value = fs.readFileSync(entry.fullPath, 'utf8');
  }
  return { asset };
}

async function resolveCreds(args) {
  if (args.shop && args.token) {
    return { shop: args.shop, token: args.token, source: 'direct' };
  }
  if (!args.client) {
    throw new Error('Precisa de --client "<nome>" OU --shop + --token');
  }
  // Tenta via Supabase. Se falhar, mensagem clara.
  try {
    const { fetchClient } = await import('../../lib/supabase-rest.mjs');
    const c = await fetchClient(args.client);
    if (!c) throw new Error(`Cliente "${args.client}" não achado em agency_clients`);
    if (!c.shopify_access_token || !c.shopify_domain) {
      throw new Error(`Cliente "${c.name}" sem Shopify conectada (token/domain ausentes)`);
    }
    return { shop: c.shopify_domain, token: c.shopify_access_token, source: 'supabase', client: c };
  } catch (e) {
    throw new Error(`Resolver via Supabase falhou: ${e.message}\n  Workaround: use --shop <domain> --token <shpat_xxx>`);
  }
}

async function createTheme(shop, token, name) {
  const r = await shReq(shop, token, 'POST', `/admin/api/${API_VERSION}/themes.json`, {
    theme: { name, role: 'unpublished' },
  });
  if (r.status !== 201 && r.status !== 200) {
    throw new Error(`POST /themes.json -> ${r.status}: ${JSON.stringify(r.body).slice(0, 250)}`);
  }
  return r.body.theme;
}

async function main() {
  const args = parseArgs();
  console.log('\n=== clone-upload ===');

  if (!args.slug) {
    console.error('Uso: node clone-upload.mjs <slug> [--client "<nome>" | --shop <domain> --token <token>] [--apply]');
    process.exit(1);
  }

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  if (!fs.existsSync(metaPath)) {
    console.error(`Não achei ${metaPath}.`);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  // Resolver credenciais
  const creds = await resolveCreds(args);
  console.log(`  Target shop: ${creds.shop} (auth via ${creds.source})`);
  console.log(`  Theme name:  "${meta.theme_name}"`);

  // Listar arquivos
  const files = listThemeFiles(workspace);
  console.log(`\n  ${files.length} arquivos a enviar`);
  const sizeMB = files.reduce((s, f) => s + fs.statSync(f.fullPath).size, 0) / 1024 / 1024;
  console.log(`  Total: ${sizeMB.toFixed(2)} MB`);

  // Sample
  const sample = files.slice(0, 10).map(f => `    ${f.key}`);
  console.log(`\n  Amostra:\n${sample.join('\n')}${files.length > 10 ? `\n    ...+${files.length - 10} arquivos` : ''}`);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Nada foi enviado.`);
    console.log(`Rode com --apply pra subir como tema 'unpublished' na ${creds.shop}.\n`);
    return;
  }

  // CREATE theme
  console.log(`\n  → POST /themes.json (role=unpublished)...`);
  const theme = await createTheme(creds.shop, creds.token, meta.theme_name);
  console.log(`  ✓ theme criado: id=${theme.id}, name="${theme.name}"`);

  // PUT assets (sequencial com delay)
  console.log(`\n  Enviando ${files.length} arquivos...`);
  let ok = 0, fail = 0;
  const errors = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const payload = buildAssetPayload(f);
      const r = await shReq(creds.shop, creds.token, 'PUT',
        `/admin/api/${API_VERSION}/themes/${theme.id}/assets.json`, payload);
      if (r.status === 200) ok++;
      else {
        fail++;
        if (errors.length < 10) errors.push({ key: f.key, status: r.status, body: JSON.stringify(r.body).slice(0, 180) });
      }
    } catch (e) {
      fail++;
      if (errors.length < 10) errors.push({ key: f.key, error: e.message });
    }
    if ((i + 1) % 20 === 0 || i === files.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${files.length}] ok=${ok} fail=${fail}   `);
    }
    await delay(400);
  }
  console.log(`\n`);

  // Preview URL
  const previewUrl = `https://${creds.shop}?preview_theme_id=${theme.id}`;
  const editorUrl = `https://${creds.shop}/admin/themes/${theme.id}/editor`;

  console.log(`\n${'='.repeat(60)}`);
  if (fail === 0) {
    console.log(`✓ Tudo subiu (${ok}/${files.length})`);
  } else {
    console.log(`⚠ Subiu com ${fail} falhas (${ok}/${files.length})`);
    console.log(`Primeiros erros:`);
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.key}: ${JSON.stringify(e).slice(0, 200)}`));
  }
  console.log(`\n📌 Theme ID:  ${theme.id}`);
  console.log(`👁  Preview:   ${previewUrl}`);
  console.log(`✏  Editor:    ${editorUrl}`);
  console.log(`\nO tema está como UNPUBLISHED — nada visível no público até você publicar manualmente.`);

  // Update meta
  meta.phase = 'uploaded';
  meta.updated_at = new Date().toISOString();
  meta.upload = {
    shop: creds.shop,
    theme_id: theme.id,
    theme_name: theme.name,
    files_total: files.length,
    files_ok: ok,
    files_fail: fail,
    preview_url: previewUrl,
    editor_url: editorUrl,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
