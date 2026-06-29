// Pull JGS Sports (source) + Mega Mantos (destination) Kit Casal files
// Saves .LIVE snapshots for both into this folder
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const envText = readFileSync('c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).filter(l => !l.startsWith('#')).map(l => {
  const i = l.indexOf('=');
  return [l.slice(0, i), l.slice(i+1).replace(/^["']|["']$/g, '')];
}));
const SUPA = env.VITE_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_KEY;
async function supa(p) { const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } }); return r.json(); }

const SRC_NAME = 'JGS Sports';
const DST_NAME = 'Mega mantos';
const SRC_THEME = 157841686758;
const DST_THEME = 181847916655;

const FILES = [
  'snippets/kit-casal-variant-picker.liquid',  // NEW in dest
  'snippets/cart-item-kit-casal.liquid',       // NEW in dest
  'snippets/product-variant-picker.liquid',    // PATCH
  'snippets/cart-progress-bar.liquid',         // PATCH
  'snippets/cart-drawer.liquid',               // PATCH
];

async function loadClient(name) {
  const [c] = await supa(`agency_clients?select=shopify_domain,shopify_access_token&name=eq.${encodeURIComponent(name)}`);
  if (!c?.shopify_access_token) throw new Error(`no token for ${name}`);
  return c;
}

async function getAsset(domain, token, themeId, key) {
  const r = await fetch(`https://${domain}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  if (r.status === 404) return null;
  const j = await r.json();
  return j.asset?.value ?? null;
}

const src = await loadClient(SRC_NAME);
const dst = await loadClient(DST_NAME);

const outDir = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/mega-mantos-kit-casal';
mkdirSync(outDir, { recursive: true });

const report = [];
for (const file of FILES) {
  const safe = file.replace(/\//g, '__');
  const srcContent = await getAsset(src.shopify_domain, src.shopify_access_token, SRC_THEME, file);
  const dstContent = await getAsset(dst.shopify_domain, dst.shopify_access_token, DST_THEME, file);
  if (srcContent !== null) writeFileSync(path.join(outDir, `JGS_${safe}.LIVE`), srcContent);
  if (dstContent !== null) writeFileSync(path.join(outDir, `MM_${safe}.LIVE`), dstContent);
  report.push({
    file,
    src: srcContent ? `${srcContent.length} chars, ${srcContent.split('\n').length} lines` : 'NOT FOUND',
    dst: dstContent ? `${dstContent.length} chars, ${dstContent.split('\n').length} lines` : 'NOT FOUND',
  });
}

console.log('=== PULL RESULT ===');
console.table(report);
console.log('\nSandbox:', outDir);
