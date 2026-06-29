#!/usr/bin/env node
// theme-pull-client — baixa o tema main de um CLIENTE específico (não template).
// Diferença pra theme-pull.mjs br/en:
//   - theme-pull: baixa tema template BR ou EN pra themes/lever-br ou themes/lever-en (versionado)
//   - theme-pull-client: baixa tema do cliente pra themes/client-<id-prefix>/ (gitignored, temporário)
//
// Uso:
//   node theme-pull-client.mjs <clientIdOrName>

import { fetchClient } from '../../lib/supabase-rest.mjs';
import { shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

async function pickMainTheme(shop, token) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json`);
  return (r.body?.themes || []).find(t => t.role === 'main');
}

async function downloadAsset(shop, token, themeId, assetKey, retries = 3) {
  const q = `asset[key]=${encodeURIComponent(assetKey)}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const r = await shReq(shop, token, 'GET',
      `/admin/api/${API_VERSION}/themes/${themeId}/assets.json?${q}`);
    if (r.status === 200 && r.body?.asset) return r.body.asset;
    if (attempt < retries) await delay(1000 * attempt);
  }
  return null;
}

function writeAsset(localDir, asset) {
  const filePath = path.join(localDir, asset.key);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (asset.attachment) fs.writeFileSync(filePath, Buffer.from(asset.attachment, 'base64'));
  else if (asset.value != null) fs.writeFileSync(filePath, asset.value, 'utf8');
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: node theme-pull-client.mjs <clientIdOrName>');
    process.exit(1);
  }

  const client = await fetchClient(arg);
  if (!client?.shopify_access_token) {
    console.error(`Cliente "${arg}" não encontrado ou sem Shopify conectada`);
    process.exit(1);
  }

  const shop = client.shopify_domain;
  const token = client.shopify_access_token;
  console.log(`\n=== theme-pull-client ${client.name} ===`);
  console.log(`Shop: ${shop}`);

  // Pega tema main
  const mainTheme = await pickMainTheme(shop, token);
  if (!mainTheme) { console.error('Cliente sem tema main'); process.exit(1); }
  console.log(`Tema main: ${mainTheme.name} (id=${mainTheme.id})`);

  // Lista assets
  const listRes = await shReq(shop, token, 'GET',
    `/admin/api/${API_VERSION}/themes/${mainTheme.id}/assets.json`);
  const assets = listRes.body?.assets || [];
  console.log(`${assets.length} assets encontrados\n`);

  // Pasta local: themes/client-<first-8-chars-of-uuid>/
  const idPrefix = client.id.slice(0, 8);
  const localDir = path.join(REPO_ROOT, `themes/client-${idPrefix}`);
  fs.mkdirSync(localDir, { recursive: true });

  let ok = 0, fail = 0;
  const errors = [];
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    try {
      const full = await downloadAsset(shop, token, mainTheme.id, a.key);
      if (full) { writeAsset(localDir, full); ok++; }
      else { fail++; if (errors.length < 10) errors.push(a.key); }
    } catch (e) {
      fail++;
      if (errors.length < 10) errors.push(`${a.key}: ${e.message}`);
    }
    if ((i + 1) % 20 === 0 || i === assets.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${assets.length}] ok=${ok} fail=${fail}   `);
    }
    await delay(400);
  }

  console.log(`\n\n✓ Baixado: ${ok}/${assets.length}`);
  if (fail > 0) console.log(`⚠️  ${fail} falhas (pode rerodar)`);

  // Metadata
  fs.writeFileSync(path.join(localDir, '.theme-meta.json'), JSON.stringify({
    clientId: client.id,
    clientName: client.name,
    shop,
    themeId: mainTheme.id,
    themeName: mainTheme.name,
    pulledAt: new Date().toISOString(),
    assetCount: assets.length,
    downloadedOk: ok,
  }, null, 2));
  console.log(`\nLocalPath: themes/client-${idPrefix}/`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
