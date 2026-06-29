#!/usr/bin/env node
// theme-duplicate — cria uma cópia DRAFT do tema main de um cliente dentro do próprio shop.
//
// Por que: editar o tema main do cliente = editar PRODUÇÃO. Queremos editar uma cópia draft
// (unpublished), testar via preview URL, e só aí publicar como main.
//
// Uso:
//   node theme-duplicate.mjs <clientIdOrName>
//
// Retorna:
//   - draftThemeId (salvo em .theme-draft.json no root do projeto pra ser lido por outros scripts)
//   - previewUrl (aberto no browser se --open)
//
// NOTA: A Shopify Admin API não tem endpoint nativo de "duplicate theme".
// Implementação: cria um tema unpublished + copia todos os assets via Asset API.

import { fetchClient } from '../../lib/supabase-rest.mjs';
import { shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { appendExecutionLog } from '../../lib/validate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

async function pickMainTheme(shop, token) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json`);
  return (r.body?.themes || []).find(t => t.role === 'main');
}

async function createDraftTheme(shop, token, name) {
  const r = await shReq(shop, token, 'POST', `/admin/api/${API_VERSION}/themes.json`, {
    theme: { name, role: 'unpublished' },
  });
  if (r.status !== 201) {
    throw new Error(`Falha ao criar draft theme: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  return r.body?.theme;
}

async function listAssets(shop, token, themeId) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes/${themeId}/assets.json`);
  return r.body?.assets || [];
}

async function getAsset(shop, token, themeId, key) {
  const q = `asset[key]=${encodeURIComponent(key)}`;
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes/${themeId}/assets.json?${q}`);
  return r.body?.asset || null;
}

async function putAsset(shop, token, themeId, asset) {
  const payload = { asset: { key: asset.key } };
  if (asset.attachment) payload.asset.attachment = asset.attachment;
  else if (asset.value != null) payload.asset.value = asset.value;
  else return null;
  return shReq(shop, token, 'PUT', `/admin/api/${API_VERSION}/themes/${themeId}/assets.json`, payload);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: node theme-duplicate.mjs <clientIdOrName>');
    process.exit(1);
  }

  const client = await fetchClient(arg);
  if (!client?.shopify_access_token) { console.error('Cliente sem Shopify'); process.exit(1); }
  const shop = client.shopify_domain;
  const token = client.shopify_access_token;

  console.log(`\n=== theme-duplicate ${client.name} ===`);

  // 1. Identifica tema main
  const mainTheme = await pickMainTheme(shop, token);
  if (!mainTheme) { console.error('Cliente sem tema main'); process.exit(1); }
  console.log(`Tema main: ${mainTheme.name} (id=${mainTheme.id})`);

  // 2. Cria draft theme
  const fullName = `Draft ${new Date().toISOString().slice(0, 10)} (${mainTheme.name})`;
  const draftName = fullName.length > 50 ? fullName.slice(0, 47) + '...' : fullName;
  console.log(`\nCriando draft theme: "${draftName}"...`);
  const draft = await createDraftTheme(shop, token, draftName);
  console.log(`✓ Draft criado: id=${draft.id}`);

  // 3. Lista assets do main
  console.log(`\nListando assets do main...`);
  const assets = await listAssets(shop, token, mainTheme.id);
  console.log(`${assets.length} assets a copiar`);

  // 4. Copia cada asset: GET do main → PUT no draft
  console.log(`\nCopiando assets...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < assets.length; i++) {
    const keyOnly = assets[i];
    try {
      const full = await getAsset(shop, token, mainTheme.id, keyOnly.key);
      if (full) {
        const putRes = await putAsset(shop, token, draft.id, full);
        if (putRes?.status === 200) ok++;
        else fail++;
      } else fail++;
    } catch { fail++; }
    if ((i + 1) % 20 === 0 || i === assets.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${assets.length}] ok=${ok} fail=${fail}   `);
    }
    await delay(400);
  }
  console.log(`\n\n✓ Cópia concluída: ${ok}/${assets.length}`);

  // 5. Preview URL
  const previewUrl = `https://${shop}/?preview_theme_id=${draft.id}`;

  // 6. Salva metadata pra outros scripts consumirem
  const metaFile = path.join(REPO_ROOT, `themes/client-${client.id.slice(0, 8)}/.theme-draft.json`);
  fs.mkdirSync(path.dirname(metaFile), { recursive: true });
  fs.writeFileSync(metaFile, JSON.stringify({
    clientId: client.id,
    clientName: client.name,
    shop,
    mainThemeId: mainTheme.id,
    draftThemeId: draft.id,
    draftName: draft.name,
    createdAt: new Date().toISOString(),
    previewUrl,
    assetsTotal: assets.length,
    assetsCopied: ok,
  }, null, 2));

  console.log(`\n📋 DRAFT CRIADO COM SUCESSO`);
  console.log(`\n   Nome:       ${draft.name}`);
  console.log(`   Theme ID:   ${draft.id}`);
  console.log(`   Preview:    ${previewUrl}`);
  console.log(`\nPróximos passos:`);
  console.log(`   1. Edite arquivos em themes/client-${client.id.slice(0, 8)}/`);
  console.log(`   2. node .claude/skills/lever-theme/theme-draft-sync.mjs "${client.name}"   # sobe edições pro draft`);
  console.log(`   3. Testa no browser: ${previewUrl}`);
  console.log(`   4. node .claude/skills/lever-theme/theme-publish.mjs "${client.name}"      # publica draft como main`);

  await appendExecutionLog({
    skill: 'lever-theme',
    op: 'duplicate',
    client_id: client.id,
    client_name: client.name,
    draft_theme_id: draft.id,
    assets_copied: ok,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
