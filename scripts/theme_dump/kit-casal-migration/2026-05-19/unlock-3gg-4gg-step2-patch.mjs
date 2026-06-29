// STEP 2 — Patch + PUT do snippet kit-casal-variant-picker.liquid
// Mantos PH tema MAIN 142261027011
// Único mudança: linha 65 — disabled_masc = '3GG,4GG' -> ''

import { getCreds, shReq } from '../../../../.claude/lib/shopify-api.mjs';
import fs from 'fs';
import crypto from 'crypto';

const MANTOS_UUID = '053f7258-95f4-4ca9-81ad-4032b18829ba';
const MANTOS_THEME = 142261027011;
const ASSET_KEY = 'snippets/kit-casal-variant-picker.liquid';
const BACKUP_PATH = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/blocks/backups/2026-05-19_mantos-ph_kit-casal-variant-picker__pre-unlock-3gg-4gg.liquid';
const PATCHED_PATH = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19/mantos-after-unlock-3gg-4gg__kit-casal-variant-picker.liquid';

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

(async () => {
  const t0 = Date.now();

  // 1) Carrega backup
  const original = fs.readFileSync(BACKUP_PATH, 'utf8');
  const origSha = sha256(original);
  const origSize = Buffer.byteLength(original, 'utf8');
  console.log(`[BACKUP] size=${origSize}  sha256=${origSha}`);

  // 2) Aplica patch — linha 65 (índice 64)
  const lines = original.split('\n');
  const lineBefore = lines[64];
  const expectedBefore = "    assign disabled_masc = '3GG,4GG' | split: ','";
  if (lineBefore !== expectedBefore) {
    console.error(`ABORTAR: linha 65 não bate.`);
    console.error(`  esperado: ${JSON.stringify(expectedBefore)}`);
    console.error(`  atual:    ${JSON.stringify(lineBefore)}`);
    process.exit(2);
  }
  const newLine = "    assign disabled_masc = '' | split: ','";
  lines[64] = newLine;
  console.log(`\n[PATCH] linha 65`);
  console.log(`  ANTES:  ${JSON.stringify(lineBefore)}`);
  console.log(`  DEPOIS: ${JSON.stringify(newLine)}`);

  const patched = lines.join('\n');
  const patchedSha = sha256(patched);
  const patchedSize = Buffer.byteLength(patched, 'utf8');
  console.log(`\n[PATCHED] size=${patchedSize}  sha256=${patchedSha}`);

  // 3) Diff sanity check: nenhuma outra linha mudou
  const origLines = original.split('\n');
  const patLines = patched.split('\n');
  let diffCount = 0;
  for (let i = 0; i < Math.max(origLines.length, patLines.length); i++) {
    if (origLines[i] !== patLines[i]) {
      diffCount++;
      console.log(`  diff linha ${i + 1}: ${JSON.stringify(origLines[i])} -> ${JSON.stringify(patLines[i])}`);
    }
  }
  if (diffCount !== 1) {
    console.error(`ABORTAR: esperava 1 diff, achei ${diffCount}`);
    process.exit(2);
  }

  fs.writeFileSync(PATCHED_PATH, patched);
  console.log(`[PATCHED FILE] ${PATCHED_PATH}`);

  // 4) PUT no Shopify
  const c = await getCreds(MANTOS_UUID);
  console.log(`\nLoja: ${c.name} (${c.shop})`);
  console.log(`Tema: ${MANTOS_THEME}`);
  console.log(`PUT ${ASSET_KEY}...`);

  const putRes = await shReq(
    c.shop,
    c.token,
    'PUT',
    `/admin/api/2026-04/themes/${MANTOS_THEME}/assets.json`,
    { asset: { key: ASSET_KEY, value: patched } }
  );
  console.log(`PUT status=${putRes.status}`);
  if (putRes.status !== 200 && putRes.status !== 201) {
    console.error('ERRO PUT:', JSON.stringify(putRes.body).slice(0, 500));
    process.exit(3);
  }

  // 5) Re-fetch e conferir SHA — Shopify pode ter cache stale, tentar 2x se preciso
  let liveAfter, liveSha, liveSize;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const getRes = await shReq(
      c.shop,
      c.token,
      'GET',
      `/admin/api/2026-04/themes/${MANTOS_THEME}/assets.json?asset[key]=${encodeURIComponent(ASSET_KEY)}`
    );
    if (getRes.status !== 200 || !getRes.body?.asset) {
      console.error('ERRO re-fetch:', getRes.status, JSON.stringify(getRes.body).slice(0, 400));
      process.exit(4);
    }
    liveAfter = getRes.body.asset.value;
    liveSha = sha256(liveAfter);
    liveSize = Buffer.byteLength(liveAfter, 'utf8');
    console.log(`\n[VERIFY tentativa ${attempt}] size=${liveSize}  sha256=${liveSha}`);
    if (liveSha === patchedSha) break;
    if (attempt < 3) {
      console.log('  cache stale, aguardando 1500ms...');
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  const ok = liveSha === patchedSha;
  console.log(`\n[VERIFY FINAL] ${ok ? 'OK' : 'FALHA'}  match=${liveSha === patchedSha}`);

  if (!ok) {
    console.error('ABORTAR: SHA pós-PUT não bate com patched');
    process.exit(5);
  }

  // 6) Conferir conteúdo da linha 65 no live final
  const liveLines = liveAfter.split('\n');
  console.log(`\n[LINE 65 LIVE PÓS-PUT]: ${JSON.stringify(liveLines[64])}`);

  console.log(`\n[TEMPO] ${Date.now() - t0}ms`);
  console.log('STEP 2 OK');
})();
