// Lists all theme assets for Mantos PH (source) and Loja da Torcida (destination)
// Phase 1 - Pure read, zero writes.
import { getCreds, shReq } from '../../../../.claude/lib/shopify-api.mjs';
import fs from 'fs';

const MANTOS_UUID = '053f7258-95f4-4ca9-81ad-4032b18829ba';
const TORCIDA_UUID = '3a9a7bf6-e392-427c-ae73-0d2823dbe53f';
const MANTOS_THEME = 142261027011;
const TORCIDA_THEME = 128963772488;
const OUTDIR = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19';

async function listAssets(label, uuid, themeId, outfile) {
  const c = await getCreds(uuid);
  const r = await shReq(c.shop, c.token, 'GET', `/admin/api/2026-04/themes/${themeId}/assets.json`);
  if (r.status !== 200) {
    console.error(`${label} list FAILED status=${r.status} body=`, JSON.stringify(r.body).slice(0, 300));
    return null;
  }
  const assets = r.body.assets.map(a => a.key).sort();
  fs.writeFileSync(`${OUTDIR}/${outfile}`, assets.join('\n'));
  console.log(`${label}: ${assets.length} assets -> ${outfile}`);
  return assets;
}

(async () => {
  const [mantos, torcida] = await Promise.all([
    listAssets('Mantos PH', MANTOS_UUID, MANTOS_THEME, 'mantos-assets.txt'),
    listAssets('Loja da Torcida', TORCIDA_UUID, TORCIDA_THEME, 'torcida-assets.txt'),
  ]);

  // Identify kit-casal / cart / patch / size-chart / picker related files in BOTH
  const PATTERNS = [/kit-casal/i, /cart-drawer/i, /cart-item/i, /cart-progress/i, /variant-picker/i, /patch/i, /size-chart/i, /customization/i, /main-product/i, /product.json/i];
  function relevant(assets, label) {
    const filtered = assets.filter(a => PATTERNS.some(p => p.test(a)));
    console.log(`\n=== ${label} files of interest (${filtered.length}) ===`);
    filtered.forEach(a => console.log(`  ${a}`));
    return filtered;
  }
  const mantosRel = relevant(mantos, 'MANTOS PH');
  const torcidaRel = relevant(torcida, 'LOJA DA TORCIDA');

  // Files present in Mantos but missing in Torcida = GAP
  const torcidaSet = new Set(torcida);
  const gap = mantosRel.filter(a => !torcidaSet.has(a));
  console.log(`\n=== GAP (Mantos has, Torcida missing) ===`);
  gap.forEach(a => console.log(`  ${a}`));

  fs.writeFileSync(`${OUTDIR}/gap-mantos-not-in-torcida.txt`, gap.join('\n'));
  fs.writeFileSync(`${OUTDIR}/mantos-relevant.txt`, mantosRel.join('\n'));
  fs.writeFileSync(`${OUTDIR}/torcida-relevant.txt`, torcidaRel.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
