// Validates the proposed files:
// 1. Liquid tag balance (if/endif, unless/endunless, for/endfor, comment/endcomment, case/endcase, schema)
// 2. No emoji in visible text content (only inside SVG content or attributes is OK; we'll check for common emoji ranges in liquid text nodes)
// 3. No properties[_*] keys (memory: leaks in Yampi/Cartpanda)
// 4. File-specific sanity checks
import fs from 'fs';

const PROPOSED = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19/torcida-after-proposed';
const TORCIDA = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19/torcida-before';
const MANTOS = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19/mantos-source';

const FILES = [
  'snippets/kit-casal-variant-picker.liquid',
  'snippets/cart-item-kit-casal.liquid',
  'snippets/product-variant-picker.liquid',
  'snippets/cart-drawer.liquid',
  'snippets/cart-progress-bar.liquid',
];

function countTag(src, openRe, closeRe) {
  const opens = (src.match(openRe) || []).length;
  const closes = (src.match(closeRe) || []).length;
  return { opens, closes };
}

function liquidBalance(src) {
  // {% if ... %} ... {% endif %} — including {%- if -%}
  const ifs = countTag(src, /{%-?\s*if\b/g, /{%-?\s*endif\s*-?%}/g);
  const unlesses = countTag(src, /{%-?\s*unless\b/g, /{%-?\s*endunless\s*-?%}/g);
  const fors = countTag(src, /{%-?\s*for\b/g, /{%-?\s*endfor\s*-?%}/g);
  const cases = countTag(src, /{%-?\s*case\b/g, /{%-?\s*endcase\s*-?%}/g);
  const comments = countTag(src, /{%-?\s*comment\s*-?%}/g, /{%-?\s*endcomment\s*-?%}/g);
  const schemas = countTag(src, /{%-?\s*schema\s*-?%}/g, /{%-?\s*endschema\s*-?%}/g);
  const liquids = countTag(src, /{%-?\s*liquid\b/g, /-?%}/g); // less precise
  return { ifs, unlesses, fors, cases, comments, schemas };
}

function findEmojiInVisibleText(src) {
  // Strip {% ... %} liquid tags and <script>...</script> and <style>...</style> and SVG content (which may have unicode glyphs in path data — though our SVGs are all ASCII)
  // Then check the remaining text for common emoji ranges:
  //   U+1F300-U+1FAFF (emoticons, symbols), U+2600-U+27BF (misc symbols), U+2700-U+27BF (dingbats)
  //   U+2B00-U+2BFF (misc symbols and arrows), U+1F000-U+1F9FF
  // Note:   (nbsp) and other latin-1 accented chars are NOT emoji and are OK
  let stripped = src;
  stripped = stripped.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  stripped = stripped.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  stripped = stripped.replace(/<svg\b[\s\S]*?<\/svg>/gi, '');
  stripped = stripped.replace(/{%[\s\S]*?%}/g, '');
  stripped = stripped.replace(/{{[\s\S]*?}}/g, '');
  // Now scan
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F9FF}]/gu;
  const matches = stripped.match(emojiRe);
  return matches || [];
}

function checkProperties_underscore(src) {
  // Properties keys that start with _ (e.g. properties[_pair_count]) leak in checkout custom
  // Allow READ (item.properties._pairing_id) — only outputs to checkout are the WRITE side
  // We need to check for INPUT/FORM emits like name="properties[_foo]"
  const re = /name=["']properties\[_/g;
  return (src.match(re) || []).length;
}

let allOk = true;
let warnings = [];
for (const f of FILES) {
  const src = fs.readFileSync(`${PROPOSED}/${f}`, 'utf8');
  const bal = liquidBalance(src);
  const emojis = findEmojiInVisibleText(src);
  const propUnderscore = checkProperties_underscore(src);
  // Compare against torcida-before if exists, else fall back to mantos-source (for NEW files copied 1:1 from Mantos)
  // to distinguish "introduced by patch" vs "pre-existing in source"
  let preExistingEmojis = 0, preExistingProps = 0, baseline = '(none)';
  const torcidaPath = `${TORCIDA}/${f}`;
  const mantosPath = `${MANTOS}/${f}`;
  if (fs.existsSync(torcidaPath)) {
    const before = fs.readFileSync(torcidaPath, 'utf8');
    preExistingEmojis = findEmojiInVisibleText(before).length;
    preExistingProps = checkProperties_underscore(before);
    baseline = 'torcida-before';
  } else if (fs.existsSync(mantosPath)) {
    const mantos = fs.readFileSync(mantosPath, 'utf8');
    preExistingEmojis = findEmojiInVisibleText(mantos).length;
    preExistingProps = checkProperties_underscore(mantos);
    baseline = 'mantos-source (NEW file)';
  }
  const introducedEmojis = emojis.length - preExistingEmojis;
  const introducedProps = propUnderscore - preExistingProps;
  console.log(`\n=== ${f} ===`);
  console.log(`  size: ${src.length} bytes`);
  console.log(`  if/endif:           ${bal.ifs.opens}/${bal.ifs.closes} ${bal.ifs.opens === bal.ifs.closes ? '✓' : 'MISMATCH ✗'}`);
  console.log(`  unless/endunless:   ${bal.unlesses.opens}/${bal.unlesses.closes} ${bal.unlesses.opens === bal.unlesses.closes ? '✓' : 'MISMATCH ✗'}`);
  console.log(`  for/endfor:         ${bal.fors.opens}/${bal.fors.closes} ${bal.fors.opens === bal.fors.closes ? '✓' : 'MISMATCH ✗'}`);
  console.log(`  case/endcase:       ${bal.cases.opens}/${bal.cases.closes} ${bal.cases.opens === bal.cases.closes ? '✓' : 'MISMATCH ✗'}`);
  console.log(`  comment/endcomment: ${bal.comments.opens}/${bal.comments.closes} ${bal.comments.opens === bal.comments.closes ? '✓' : 'MISMATCH ✗'}`);
  const emojiMark = introducedEmojis > 0 ? 'INTRODUCED ✗' : (emojis.length > 0 ? `${emojis.length} pre-existing in ${baseline} (no regression)` : '✓');
  console.log(`  emojis (visible):   total=${emojis.length} introduced=${introducedEmojis} ${emojiMark}`);
  const propMark = introducedProps > 0 ? 'INTRODUCED ✗' : (propUnderscore > 0 ? `${propUnderscore} pre-existing in ${baseline} (Shopify native checkout — Torcida sem Yampi/Cartpanda — safe)` : '✓');
  console.log(`  properties[_*]:     total=${propUnderscore} introduced=${introducedProps} ${propMark}`);
  if (emojis.length > 0 || propUnderscore > 0) {
    warnings.push(`${f}: ${emojis.length} emoji(s), ${propUnderscore} properties[_*] (pre-existing in source: ${preExistingEmojis} emoji, ${preExistingProps} props — Mantos PH legacy)`);
  }
  if (
    bal.ifs.opens !== bal.ifs.closes ||
    bal.unlesses.opens !== bal.unlesses.closes ||
    bal.fors.opens !== bal.fors.closes ||
    bal.cases.opens !== bal.cases.closes ||
    bal.comments.opens !== bal.comments.closes ||
    introducedEmojis > 0 ||
    introducedProps > 0
  ) allOk = false;
}
if (warnings.length) {
  console.log('\n=== WARNINGS (pre-existing, NOT regressions) ===');
  warnings.forEach(w => console.log('  ' + w));
}

// Diff vs torcida-before for sanity (patches should only add, not destroy)
console.log('\n=== DIFF SIZES (before -> after-proposed) ===');
for (const f of FILES) {
  const proposedPath = `${PROPOSED}/${f}`;
  const torcidaPath = `${TORCIDA}/${f}`;
  if (!fs.existsSync(torcidaPath)) {
    console.log(`  NEW: ${f} (${fs.statSync(proposedPath).size} bytes)`);
    continue;
  }
  const sizeBefore = fs.statSync(torcidaPath).size;
  const sizeAfter = fs.statSync(proposedPath).size;
  const delta = sizeAfter - sizeBefore;
  console.log(`  PATCH: ${f} ${sizeBefore} -> ${sizeAfter} (${delta >= 0 ? '+' : ''}${delta})`);
}

console.log(allOk ? '\n=== ALL CHECKS PASSED ✓ ===' : '\n=== VALIDATION FAILED ✗ ===');
process.exit(allOk ? 0 : 1);
