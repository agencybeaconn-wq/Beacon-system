// Pulls JGS Sports kit-casal evolved files (canonical Lever pattern: verde + isolated snippet + cursor fix)
import { getCreds, shReq, delay, shopifyGraphQL } from '../../../../.claude/lib/shopify-api.mjs';
import fs from 'fs';
import path from 'path';

const JGS_UUID = '058fd777-f6ef-42a3-936c-81a8bb915918';
const OUTDIR = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19/jgs-reference';

const FILES = [
  'snippets/kit-casal-variant-picker.liquid',
  'snippets/cart-item-kit-casal.liquid',
  'snippets/product-variant-picker.liquid',
  'snippets/cart-drawer.liquid',
  'snippets/cart-progress-bar.liquid',
];

async function pullFile(shop, token, themeId, key, outdir) {
  const r = await shReq(shop, token, 'GET', `/admin/api/2026-04/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
  if (r.status === 404 || r.body?.errors) {
    return { key, exists: false, error: r.body?.errors || `status=${r.status}` };
  }
  const content = r.body.asset?.value || '';
  const outpath = path.join(outdir, key);
  fs.mkdirSync(path.dirname(outpath), { recursive: true });
  fs.writeFileSync(outpath, content);
  return { key, exists: true, size: content.length };
}

(async () => {
  const c = await getCreds(JGS_UUID);
  // Find published / main theme
  const themesR = await shReq(c.shop, c.token, 'GET', `/admin/api/2026-04/themes.json`);
  const main = themesR.body.themes.find(t => t.role === 'main');
  console.log(`JGS main theme: ${main.name} (${main.id})`);
  fs.mkdirSync(OUTDIR, { recursive: true });
  for (const f of FILES) {
    const r = await pullFile(c.shop, c.token, main.id, f, OUTDIR);
    if (r.exists) console.log(`  ✓ ${f} (${r.size} bytes)`);
    else console.log(`  ✗ ${f} not found`);
    await delay(120);
  }
})().catch(e => { console.error(e); process.exit(1); });
