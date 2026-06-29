#!/usr/bin/env node
// Sync targeted: envia apenas arquivos específicos via shopify-admin-proxy
// Uso: node _sync-targeted.mjs <slug> --client-id <uuid> --theme-id <id> --files "a/b.css,c/d.liquid"

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const a = { slug: null, clientId: null, themeId: null, files: [] };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--client-id') a.clientId = argv[++i];
    else if (v === '--theme-id') a.themeId = argv[++i];
    else if (v === '--files') a.files = argv[++i].split(',').map(s => s.trim());
    else if (!v.startsWith('--')) a.slug = v;
  }
  return a;
}

function loadEnv() {
  const env = {};
  fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  });
  return env;
}

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

async function main() {
  const args = parseArgs();
  if (!args.slug || !args.clientId || !args.themeId || args.files.length === 0) {
    console.error('Uso: node _sync-targeted.mjs <slug> --client-id <uuid> --theme-id <id> --files "a,b,c"');
    process.exit(1);
  }
  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  const env = loadEnv();
  console.log(`\n=== sync-targeted (${args.files.length} arquivos) ===`);
  for (const rel of args.files) {
    const full = path.join(workspace, rel);
    if (!fs.existsSync(full)) {
      console.log(`  SKIP ${rel} (não existe)`);
      continue;
    }
    const value = fs.readFileSync(full, 'utf8');
    const r = await proxy(env, {
      clientId: args.clientId,
      resource: 'themes',
      method: 'put_asset',
      resourceId: args.themeId,
      payload: { asset: { key: rel.replace(/\\/g, '/'), value } },
    });
    const ok = r.status === 200 || r.status === 201;
    console.log(`  ${ok ? 'OK ' : 'FAIL'} [${r.status}] ${rel}${ok ? '' : ' — ' + JSON.stringify(r.body).slice(0, 200)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
