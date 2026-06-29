#!/usr/bin/env node
// theme-pull — baixa todos os assets de um tema Shopify usando Asset API + OAuth token.
// Alternativa ao `shopify theme pull` que não funciona com tokens OAuth (shpca_).
//
// Uso:
//   node theme-pull.mjs br              # baixa Template BR pra themes/lever-br/
//   node theme-pull.mjs en              # baixa Template EN pra themes/lever-en/
//   node theme-pull.mjs <clientId>      # baixa tema main de cliente custom

import { getCreds, shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const TEMPLATES = {
  br: {
    clientId: '5e836736-7411-42d8-b99e-bcad1e55919d',
    themeName: 'Tema Lever Atualizado 18/03',
    themeId: 160282804466,
    localPath: 'themes/lever-br',
  },
  en: {
    clientId: '17089519-4779-41bb-96ca-9791e0677cf8',
    themeName: 'Tema Lever Inglês Atualizado 23/03',
    themeId: 129577091130,
    localPath: 'themes/lever-en',
  },
};

async function pickTheme(shop, token, preferName, preferId) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json`);
  const themes = r.body?.themes || [];
  if (preferId) {
    const t = themes.find(x => x.id === preferId);
    if (t) return t;
  }
  if (preferName) {
    const t = themes.find(x => x.name === preferName);
    if (t) return t;
  }
  return themes.find(x => x.role === 'main') || themes[0];
}

async function listAssets(shop, token, themeId) {
  const r = await shReq(shop, token, 'GET',
    `/admin/api/${API_VERSION}/themes/${themeId}/assets.json`);
  return r.body?.assets || [];
}

async function downloadAsset(shop, token, themeId, assetKey, maxRetries = 3) {
  const q = `asset[key]=${encodeURIComponent(assetKey)}`;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const r = await shReq(shop, token, 'GET',
      `/admin/api/${API_VERSION}/themes/${themeId}/assets.json?${q}`);
    if (r.status === 200 && r.body?.asset) return r.body.asset;
    if (r.status === 429 || (r.status === 200 && !r.body?.asset)) {
      // Rate limit ou resposta vazia — backoff e retry
      if (attempt < maxRetries) {
        await delay(1000 * attempt);
        continue;
      }
    }
    return null;
  }
  return null;
}

function writeAsset(localDir, asset) {
  const filePath = path.join(localDir, asset.key);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (asset.attachment) {
    // Binary (images, fonts) — base64 encoded
    fs.writeFileSync(filePath, Buffer.from(asset.attachment, 'base64'));
  } else if (asset.value != null) {
    // Text (liquid, json, js, css)
    fs.writeFileSync(filePath, asset.value, 'utf8');
  } else {
    console.warn(`  ⚠  asset sem value/attachment: ${asset.key}`);
  }
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: node theme-pull.mjs <br|en|clientId>');
    process.exit(1);
  }

  let config;
  if (TEMPLATES[arg]) {
    config = TEMPLATES[arg];
  } else {
    // Custom client ID
    config = {
      clientId: arg,
      themeName: null,
      themeId: null,
      localPath: `themes/client-${arg.slice(0, 8)}`,
    };
  }

  console.log(`\n=== theme-pull ${arg} ===`);
  const creds = await getCreds(config.clientId);
  console.log(`✓ Cliente: ${creds.name} (${creds.shop})`);

  // Descobrir tema alvo
  const theme = await pickTheme(creds.shop, creds.token, config.themeName, config.themeId);
  if (!theme) { console.error('Nenhum tema encontrado'); process.exit(1); }
  console.log(`✓ Tema: ${theme.name} (id=${theme.id}, role=${theme.role})`);

  // Listar assets
  console.log(`\nListando assets...`);
  const assets = await listAssets(creds.shop, creds.token, theme.id);
  console.log(`  ${assets.length} assets encontrados`);

  // Download (serial pra evitar 429). Se arquivo já existe localmente e mode=retry-missing, pula.
  const localDir = path.join(REPO_ROOT, config.localPath);
  fs.mkdirSync(localDir, { recursive: true });

  const retryOnly = process.argv.includes('--retry-missing');
  if (retryOnly) {
    console.log(`\n[retry-missing] só baixa arquivos que não existem localmente`);
  }
  console.log(`\nBaixando pra ${config.localPath}/ ...`);

  let ok = 0, fail = 0, skipped = 0;
  const errors = [];
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const localFile = path.join(localDir, a.key);
    if (retryOnly && fs.existsSync(localFile) && fs.statSync(localFile).size > 0) {
      skipped++;
      continue;
    }
    try {
      const full = await downloadAsset(creds.shop, creds.token, theme.id, a.key);
      if (full) {
        writeAsset(localDir, full);
        ok++;
      } else {
        fail++;
        errors.push({ key: a.key, error: 'asset vazio após 3 retries' });
      }
    } catch (e) {
      fail++;
      errors.push({ key: a.key, error: e.message });
    }
    if ((i + 1) % 20 === 0 || i === assets.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${assets.length}] ok=${ok} fail=${fail} skip=${skipped}   `);
    }
    await delay(400); // throttle (aumentado de 200 pra 400)
  }

  console.log(`\n\n✓ Concluído: ok=${ok} fail=${fail}`);
  if (errors.length) {
    console.log('\nPrimeiros erros:');
    errors.slice(0, 5).forEach(e => console.log(`  - ${e.key}: ${e.error}`));
  }

  // Salva metadata
  const metaPath = path.join(localDir, '.theme-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    pulledAt: new Date().toISOString(),
    shop: creds.shop,
    themeId: theme.id,
    themeName: theme.name,
    themeRole: theme.role,
    assetCount: assets.length,
    downloadedOk: ok,
    downloadedFail: fail,
  }, null, 2));
  console.log(`\nMetadata: ${metaPath}`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
