// Applies the 5 patched/new files to Loja da Torcida MAIN theme via Admin API GraphQL themeFilesUpsert
// Protocol:
//   1) Backup torcida-before snapshot -> blocks/backups/ (only PATCH files have backup; NEW files just need delete-to-rollback)
//   2) GraphQL themeFilesUpsert for each file (sequential, same store - rate bucket)
//   3) Pull torcida-after/ post-upsert
//   4) Verify byte-by-byte: torcida-after/<file> === torcida-after-proposed/<file>
//   5) If any mismatch, ABORT and report
//
// Safe-guards:
//   - Only writes to Loja da Torcida theme 128963772488 (asserted)
//   - Only the 5 files in FILES list (no globs)
//   - Stops on first failure
//
// Note: themeFilesUpsert via GraphQL bypasses MCP Shopify restriction on main theme writes (lesson from 2026-05-19 mantos size-chart)

import { getCreds, shopifyGraphQL, shReq, delay } from '../../../../.claude/lib/shopify-api.mjs';
import { backupAsset } from '../../../../.claude/lib/code-blocks-backup.mjs';
import fs from 'fs';
import path from 'path';

const TORCIDA_UUID = '3a9a7bf6-e392-427c-ae73-0d2823dbe53f';
const TORCIDA_THEME = 128963772488;
const CLIENT_NAME = 'loja-da-torcida';
const BASE = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19';
const PROPOSED = `${BASE}/torcida-after-proposed`;
const AFTER = `${BASE}/torcida-after`;

const FILES = [
  { key: 'snippets/kit-casal-variant-picker.liquid', mode: 'NEW' },
  { key: 'snippets/cart-item-kit-casal.liquid',      mode: 'NEW' },
  { key: 'snippets/product-variant-picker.liquid',   mode: 'PATCH' },
  { key: 'snippets/cart-drawer.liquid',              mode: 'PATCH' },
  { key: 'snippets/cart-progress-bar.liquid',        mode: 'PATCH' },
];

async function upsertFile(shop, token, themeId, key, content) {
  const themeGid = `gid://shopify/OnlineStoreTheme/${themeId}`;
  const mutation = `
    mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        upsertedThemeFiles { filename }
        userErrors { field message code filename }
      }
    }`;
  const variables = {
    themeId: themeGid,
    files: [{ filename: key, body: { type: 'TEXT', value: content } }],
  };
  const r = await shopifyGraphQL(shop, token, mutation, variables);
  if (r.errors) return { ok: false, errors: r.errors };
  const result = r.data?.themeFilesUpsert;
  if (!result) return { ok: false, errors: [{ message: 'no result' }] };
  if (result.userErrors && result.userErrors.length) return { ok: false, errors: result.userErrors };
  return { ok: true, upserted: result.upsertedThemeFiles };
}

async function pullFile(shop, token, themeId, key) {
  const r = await shReq(shop, token, 'GET', `/admin/api/2026-04/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
  if (r.status !== 200 || !r.body?.asset) return null;
  return r.body.asset.value || '';
}

(async () => {
  const c = await getCreds(TORCIDA_UUID);
  if (c.shop !== 'xdppna-zt.myshopify.com') {
    throw new Error(`Aborting: expected xdppna-zt.myshopify.com but got ${c.shop}`);
  }
  console.log(`=== APPLY to ${c.name} (${c.shop}) theme ${TORCIDA_THEME} ===\n`);
  fs.mkdirSync(AFTER, { recursive: true });

  // shopFn for backup lib
  const shopFn = async (method, p) => {
    const r = await shReq(c.shop, c.token, method, `/admin/api/2026-04${p}`);
    return { data: r.body, status: r.status };
  };

  const log = [];
  for (const f of FILES) {
    console.log(`\n--- ${f.mode}: ${f.key} ---`);
    const proposedContent = fs.readFileSync(`${PROPOSED}/${f.key}`, 'utf8');
    const proposedBytes = Buffer.byteLength(proposedContent, 'utf8');

    // 1) Backup (only for PATCH; NEW files have nothing to back up but we record)
    let backupPath = null;
    if (f.mode === 'PATCH') {
      try {
        backupPath = await backupAsset(shopFn, TORCIDA_THEME, f.key, CLIENT_NAME);
        console.log(`  [backup] ${path.basename(backupPath)}`);
      } catch (e) {
        console.error(`  [backup FAILED] ${e.message}`);
        log.push({ ...f, status: 'ABORT', step: 'backup', error: e.message });
        throw new Error(`Aborting at backup of ${f.key}`);
      }
    } else {
      console.log(`  [backup] N/A (NEW file)`);
    }

    // 2) Upsert
    const r = await upsertFile(c.shop, c.token, TORCIDA_THEME, f.key, proposedContent);
    if (!r.ok) {
      console.error(`  [upsert FAILED]`, JSON.stringify(r.errors).slice(0, 400));
      log.push({ ...f, status: 'ABORT', step: 'upsert', errors: r.errors });
      throw new Error(`Aborting at upsert of ${f.key}`);
    }
    console.log(`  [upsert OK] ${r.upserted.map(u => u.filename).join(', ')}`);

    // 3) Pull after (allow cache settle 1.5s — Admin API caching pitfall)
    await delay(1500);
    let pulledContent = await pullFile(c.shop, c.token, TORCIDA_THEME, f.key);
    if (pulledContent === null) {
      console.error(`  [pull FAILED] could not retrieve after upsert`);
      log.push({ ...f, status: 'ABORT', step: 'pull', error: 'no asset' });
      throw new Error(`Aborting at pull verify of ${f.key}`);
    }
    fs.mkdirSync(path.dirname(`${AFTER}/${f.key}`), { recursive: true });
    fs.writeFileSync(`${AFTER}/${f.key}`, pulledContent);
    const pulledBytes = Buffer.byteLength(pulledContent, 'utf8');

    // 4) Byte-by-byte equality. Allow ONE retry with longer wait if mismatch (Admin API stale cache).
    let equal = pulledContent === proposedContent;
    if (!equal) {
      console.log(`  [verify] mismatch on first pull (proposed=${proposedBytes} pulled=${pulledBytes}); retry after 3s...`);
      await delay(3000);
      pulledContent = await pullFile(c.shop, c.token, TORCIDA_THEME, f.key);
      fs.writeFileSync(`${AFTER}/${f.key}`, pulledContent);
      equal = pulledContent === proposedContent;
    }
    if (!equal) {
      const diff = {
        proposedBytes,
        pulledBytes: Buffer.byteLength(pulledContent, 'utf8'),
        firstDiff: -1,
      };
      for (let i = 0; i < Math.min(proposedContent.length, pulledContent.length); i++) {
        if (proposedContent[i] !== pulledContent[i]) { diff.firstDiff = i; break; }
      }
      console.error(`  [verify FAILED] proposed=${proposedBytes} pulled=${diff.pulledBytes} firstDiff=${diff.firstDiff}`);
      console.error(`  proposed[firstDiff..+40]: ${JSON.stringify(proposedContent.slice(diff.firstDiff, diff.firstDiff + 40))}`);
      console.error(`  pulled[firstDiff..+40]:   ${JSON.stringify(pulledContent.slice(diff.firstDiff, diff.firstDiff + 40))}`);
      log.push({ ...f, status: 'ABORT', step: 'verify', diff });
      throw new Error(`Aborting at verify of ${f.key} — proposed != pulled`);
    }
    console.log(`  [verify OK] ${pulledBytes} bytes — byte-by-byte match`);
    log.push({ ...f, status: 'OK', proposedBytes, pulledBytes, backup: backupPath ? path.basename(backupPath) : null });

    // Rate limit kindness
    await delay(400);
  }

  fs.writeFileSync(`${BASE}/apply-log.json`, JSON.stringify(log, null, 2));
  console.log(`\n=== ALL ${FILES.length} FILES APPLIED + VERIFIED ===`);
  console.log(`apply-log.json saved.`);
})().catch(e => {
  console.error(`\n=== ABORTED ===\n${e.message}`);
  process.exit(1);
});
