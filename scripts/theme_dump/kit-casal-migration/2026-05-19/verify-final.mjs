// Final verification: compare torcida-after/ vs torcida-after-proposed/ byte-by-byte
import fs from 'fs';
import crypto from 'crypto';

const BASE = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19';
const PROPOSED = `${BASE}/torcida-after-proposed`;
const AFTER = `${BASE}/torcida-after`;

const FILES = [
  'snippets/kit-casal-variant-picker.liquid',
  'snippets/cart-item-kit-casal.liquid',
  'snippets/product-variant-picker.liquid',
  'snippets/cart-drawer.liquid',
  'snippets/cart-progress-bar.liquid',
];

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

let allOk = true;
for (const f of FILES) {
  const p = fs.readFileSync(`${PROPOSED}/${f}`);
  const a = fs.readFileSync(`${AFTER}/${f}`);
  const ph = sha256(p), ah = sha256(a);
  const eq = ph === ah;
  console.log(`${eq ? 'OK' : 'MISMATCH'}  ${f}`);
  console.log(`   proposed: ${p.length} bytes  sha=${ph.slice(0,16)}`);
  console.log(`   after:    ${a.length} bytes  sha=${ah.slice(0,16)}`);
  if (!eq) allOk = false;
}
console.log(allOk ? '\n=== ALL FILES BYTE-EQUAL ===' : '\n=== MISMATCH DETECTED ===');
process.exit(allOk ? 0 : 1);
