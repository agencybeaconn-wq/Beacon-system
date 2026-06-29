// Clona o tema MAIN de uma loja origem (sourceClient) pra um draft theme
// na loja destino (targetClient). Cross-shop (não funciona o duplicate nativo
// da Shopify entre shops diferentes).
//
// Uso: node theme-clone-cross-shop.mjs --from=Nord --to=MontRoyal [--name="..."]

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { fetchClient } from '../../lib/supabase-rest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=') || true];
}));

const fromArg = args.from;
const toArg = args.to;
const draftNameArg = args.name;

if (!fromArg || !toArg) {
  console.error('Uso: node theme-clone-cross-shop.mjs --from=<sourceClient> --to=<targetClient> [--name="..."]');
  process.exit(1);
}

async function pickMainTheme(shop, token) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json`);
  return (r.body.themes || []).find(t => t.role === 'main');
}

async function createDraftTheme(shop, token, name) {
  const r = await shReq(shop, token, 'POST', `/admin/api/${API_VERSION}/themes.json`, {
    theme: { name, role: 'unpublished' },
  });
  if (r.status !== 201) throw new Error(`createDraft: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
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
  const source = await fetchClient(fromArg);
  const target = await fetchClient(toArg);
  if (!source?.shopify_access_token) throw new Error(`Source ${fromArg} sem Shopify`);
  if (!target?.shopify_access_token) throw new Error(`Target ${toArg} sem Shopify`);

  console.log(`\n=== theme-clone-cross-shop ===`);
  console.log(`From: ${source.name} (${source.shopify_domain})`);
  console.log(`To:   ${target.name} (${target.shopify_domain})`);

  const sourceMain = await pickMainTheme(source.shopify_domain, source.shopify_access_token);
  if (!sourceMain) throw new Error('Source sem tema main');
  console.log(`\nTema source: ${sourceMain.name} (${sourceMain.id})`);

  const draftName = (draftNameArg || `${sourceMain.name} (copiado de ${source.name})`).slice(0, 50);
  console.log(`Criando draft "${draftName}" no target...`);
  const draft = await createDraftTheme(target.shopify_domain, target.shopify_access_token, draftName);
  console.log(`✓ Draft criado: id=${draft.id}`);

  console.log(`\nListando assets...`);
  const assets = await listAssets(source.shopify_domain, source.shopify_access_token, sourceMain.id);
  console.log(`${assets.length} assets a copiar`);

  let ok = 0, fail = 0, fails = [];
  for (let i = 0; i < assets.length; i++) {
    const keyOnly = assets[i];
    try {
      const full = await getAsset(source.shopify_domain, source.shopify_access_token, sourceMain.id, keyOnly.key);
      if (!full) { fail++; fails.push({ key: keyOnly.key, err: 'no source' }); continue; }
      const putRes = await putAsset(target.shopify_domain, target.shopify_access_token, draft.id, full);
      if (putRes?.status === 200 || putRes?.status === 201) ok++;
      else { fail++; fails.push({ key: keyOnly.key, err: `PUT ${putRes?.status} ${JSON.stringify(putRes?.body).slice(0, 80)}` }); }
    } catch (e) {
      fail++; fails.push({ key: keyOnly.key, err: e.message });
    }
    if ((i + 1) % 10 === 0 || i === assets.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${assets.length}] ok=${ok} fail=${fail}   `);
    }
    await delay(350);
  }
  console.log(`\n\nResultado: ${ok}/${assets.length} ok, ${fail} fail`);

  if (fails.length) {
    console.log(`\nFalhas (até 10):`);
    fails.slice(0, 10).forEach(f => console.log(`  ✗ ${f.key}: ${f.err}`));
  }

  const previewUrl = `https://${target.shopify_domain}/?preview_theme_id=${draft.id}`;
  console.log(`\n📋 DRAFT CRIADO`);
  console.log(`   Theme ID:   ${draft.id}`);
  console.log(`   Preview:    ${previewUrl}`);
  console.log(`   Admin:      https://${target.shopify_domain}/admin/themes/${draft.id}`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message, e.stack); process.exit(1); });

