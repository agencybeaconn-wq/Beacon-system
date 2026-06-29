// Pulls the actual file contents from Mantos PH (source) and Loja da Torcida (before)
// for all files of interest. Phase 1 - read only.
import { getCreds, shReq, delay } from '../../../../.claude/lib/shopify-api.mjs';
import fs from 'fs';
import path from 'path';

const MANTOS_UUID = '053f7258-95f4-4ca9-81ad-4032b18829ba';
const TORCIDA_UUID = '3a9a7bf6-e392-427c-ae73-0d2823dbe53f';
const MANTOS_THEME = 142261027011;
const TORCIDA_THEME = 128963772488;
const OUTDIR = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19';

// Critical Kit Casal pipeline files. The picker is the headline new asset; the others
// require surgical patches in destination.
const FILES = [
  'snippets/kit-casal-variant-picker.liquid',  // Mantos only - NEW for Torcida
  'snippets/product-variant-picker.liquid',    // both - need surgical patch in Torcida
  'snippets/cart-drawer.liquid',               // both - need badge + render injection
  'snippets/cart-progress-bar.liquid',         // both - need skip kit-casal lines
  'snippets/customization-inputs.liquid',      // both - dependency check
  'snippets/patch-script.liquid',              // both - check if differs (Lever evolution)
  'sections/main-product.liquid',              // both - large file (kit casal blocks)
  'sections/cart-drawer.liquid',               // both
  'sections/main-cart-items.liquid',           // both
  'sections/custom-patch-rules.liquid',        // both
  'templates/product.json',                    // both
  // From JGS+Mega Mantos history, isolated snippet for cart line (Mantos might still be inline)
  'snippets/cart-item-kit-casal.liquid',       // probably only on JGS/Mega - check Mantos
];

async function pullFile(shop, token, themeId, key, outdir) {
  const r = await shReq(shop, token, 'GET', `/admin/api/2026-04/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
  if (r.status === 404 || r.body?.errors) {
    return { key, exists: false, size: 0, error: r.body?.errors || `status=${r.status}` };
  }
  if (r.status !== 200 || !r.body?.asset) {
    return { key, exists: false, size: 0, error: `unexpected status=${r.status}` };
  }
  const content = r.body.asset.value || '';
  const outpath = path.join(outdir, key);
  fs.mkdirSync(path.dirname(outpath), { recursive: true });
  fs.writeFileSync(outpath, content);
  return { key, exists: true, size: content.length };
}

async function pullStore(label, uuid, themeId, outdir) {
  const c = await getCreds(uuid);
  console.log(`\n=== Pulling from ${label} (${c.shop}, theme ${themeId}) -> ${outdir} ===`);
  // serial within same store (avoid burning rate)
  const results = [];
  for (const f of FILES) {
    const r = await pullFile(c.shop, c.token, themeId, f, outdir);
    if (r.exists) {
      console.log(`  ✓ ${f} (${r.size} bytes)`);
    } else {
      console.log(`  ✗ ${f} — NOT FOUND`);
    }
    results.push(r);
    await delay(120);
  }
  return results;
}

(async () => {
  // Two stores in parallel (different rate buckets)
  const [mantosResults, torcidaResults] = await Promise.all([
    pullStore('Mantos PH', MANTOS_UUID, MANTOS_THEME, `${OUTDIR}/mantos-source`),
    pullStore('Loja da Torcida', TORCIDA_UUID, TORCIDA_THEME, `${OUTDIR}/torcida-before`),
  ]);

  const summary = {
    mantos: mantosResults,
    torcida: torcidaResults,
  };
  fs.writeFileSync(`${OUTDIR}/pull-summary.json`, JSON.stringify(summary, null, 2));
  console.log(`\n=== Summary saved -> pull-summary.json ===`);
})().catch(e => { console.error(e); process.exit(1); });
