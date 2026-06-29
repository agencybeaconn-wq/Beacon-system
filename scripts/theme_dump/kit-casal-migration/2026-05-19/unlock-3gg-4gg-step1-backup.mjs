// STEP 1 — Backup do snippet kit-casal-variant-picker.liquid LIVE
// do tema MAIN da Mantos PH (142261027011)
// Salva em blocks/backups/ com SHA-256 confirmado.

import { getCreds, shReq } from '../../../../.claude/lib/shopify-api.mjs';
import fs from 'fs';
import crypto from 'crypto';

const MANTOS_UUID = '053f7258-95f4-4ca9-81ad-4032b18829ba';
const MANTOS_THEME = 142261027011;
const ASSET_KEY = 'snippets/kit-casal-variant-picker.liquid';
const BACKUP_PATH = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/blocks/backups/2026-05-19_mantos-ph_kit-casal-variant-picker__pre-unlock-3gg-4gg.liquid';

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

(async () => {
  const t0 = Date.now();
  const c = await getCreds(MANTOS_UUID);
  console.log(`Loja: ${c.name} (${c.shop})`);
  console.log(`Tema MAIN: ${MANTOS_THEME}`);
  console.log(`Asset: ${ASSET_KEY}`);

  // Fetch LIVE
  const r = await shReq(
    c.shop,
    c.token,
    'GET',
    `/admin/api/2026-04/themes/${MANTOS_THEME}/assets.json?asset[key]=${encodeURIComponent(ASSET_KEY)}`
  );
  if (r.status !== 200 || !r.body?.asset) {
    console.error('ERRO fetch:', r.status, JSON.stringify(r.body).slice(0, 400));
    process.exit(1);
  }
  const liveContent = r.body.asset.value;
  const liveSize = Buffer.byteLength(liveContent, 'utf8');
  const liveSha = sha256(liveContent);
  console.log(`\n[LIVE] size=${liveSize} bytes  sha256=${liveSha}`);

  // Conferir linha 65 (deve ser a linha do disabled_masc)
  const lines = liveContent.split('\n');
  console.log(`\n[LINHA 65 LIVE]: ${JSON.stringify(lines[64])}`);
  console.log(`[LINHA 66 LIVE]: ${JSON.stringify(lines[65])}`);

  // Salvar backup
  fs.writeFileSync(BACKUP_PATH, liveContent);
  const localContent = fs.readFileSync(BACKUP_PATH, 'utf8');
  const localSha = sha256(localContent);
  const localSize = Buffer.byteLength(localContent, 'utf8');

  console.log(`\n[BACKUP] path=${BACKUP_PATH}`);
  console.log(`[BACKUP] size=${localSize} bytes  sha256=${localSha}`);

  const ok = (liveSha === localSha) && (liveSize === localSize);
  console.log(`\n[INTEGRIDADE] ${ok ? 'OK' : 'FALHA'}  match=${liveSha === localSha}  size=${liveSize === localSize}`);

  if (!ok) {
    console.error('ABORTAR: backup não bate com live');
    process.exit(2);
  }

  console.log(`\n[TEMPO] ${Date.now() - t0}ms`);
  console.log('STEP 1 OK');
})();
