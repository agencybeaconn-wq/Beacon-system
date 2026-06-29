// Auto-backup theme assets before PUT operations
// Allows rollback of any code-blocks modification
//
// Usage (before PUT):
//   import { backupAsset, restoreAsset } from './code-blocks-backup.mjs';
//   await backupAsset(shopFn, themeId, 'snippets/cart-drawer.liquid', clientName);
//   // ... do PUT
//
// Rollback:
//   await restoreAsset(shopFn, themeId, 'snippets/cart-drawer.liquid', clientName);

import fs from 'fs';
import path from 'path';

const LEVER_SYSTEM = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System';
const BACKUP_DIR = path.join(LEVER_SYSTEM, 'blocks/backups');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function backupPath(clientName, asset) {
  const safe = clientName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const file = asset.replace(/\//g, '__');
  const date = new Date().toISOString().slice(0, 10);
  return path.join(BACKUP_DIR, `${date}_${safe}_${file}.bak`);
}

// Download asset → save locally → return backup path
// shopFn: async (method, path) => { data: { asset: { value } } }
export async function backupAsset(shopFn, themeId, assetKey, clientName) {
  ensureDir(BACKUP_DIR);
  const r = await shopFn('GET', `/themes/${themeId}/assets.json?asset[key]=${assetKey}`);
  const content = r.data?.asset?.value;
  if (content === undefined) throw new Error(`Asset ${assetKey} not found`);

  const bp = backupPath(clientName, assetKey);
  fs.writeFileSync(bp, content);

  // Also log in blocks/backups/LOG.md
  const logPath = path.join(BACKUP_DIR, 'LOG.md');
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '# Backup Log\n\n| Date | Client | Asset | Backup |\n|---|---|---|---|\n');
  }
  const row = `| ${new Date().toISOString()} | ${clientName} | ${assetKey} | ${path.basename(bp)} |\n`;
  fs.appendFileSync(logPath, row);

  return bp;
}

// Restore asset from latest backup
export async function restoreAsset(shopFn, themeId, assetKey, clientName) {
  ensureDir(BACKUP_DIR);
  const safe = clientName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filePrefix = assetKey.replace(/\//g, '__');

  // Find latest backup matching clientName + asset
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.includes(`_${safe}_`) && f.endsWith(`${filePrefix}.bak`))
    .sort().reverse();

  if (files.length === 0) throw new Error(`No backup found for ${clientName}:${assetKey}`);

  const latest = path.join(BACKUP_DIR, files[0]);
  const content = fs.readFileSync(latest, 'utf8');

  // PUT the backup content back
  return await shopFn('PUT', `/themes/${themeId}/assets.json`, {
    asset: { key: assetKey, value: content }
  });
}

// List all backups for a client
export function listBackups(clientName) {
  ensureDir(BACKUP_DIR);
  const safe = clientName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.includes(`_${safe}_`))
    .sort().reverse();
}
