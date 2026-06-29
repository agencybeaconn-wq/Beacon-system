// Apply Kit Casal block to Mega Mantos theme (main)
// Source: JGS Sports (.LIVE files already pulled)
// Dest: Mega Mantos main theme 181847916655
//
// Flow: generate .PATCHED -> validateAll -> backup -> PUT -> re-fetch -> validate .APPLIED
//
// Run with --apply to actually PUT (without it, just validates and shows summary)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { validateAll } from '../../../.claude/lib/code-blocks-validate.mjs';
import { backupAsset } from '../../../.claude/lib/code-blocks-backup.mjs';

const APPLY = process.argv.includes('--apply');
const HERE = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/mega-mantos-kit-casal';

const envText = readFileSync('c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).filter(l => !l.startsWith('#')).map(l => {
  const i = l.indexOf('=');
  return [l.slice(0, i), l.slice(i+1).replace(/^["']|["']$/g, '')];
}));
const SUPA = env.VITE_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_KEY;
async function supa(p) { const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } }); return r.json(); }

const [dst] = await supa(`agency_clients?select=shopify_domain,shopify_access_token&name=eq.Mega%20mantos`);
const DOMAIN = dst.shopify_domain;
const TOKEN = dst.shopify_access_token;
const THEME_ID = 181847916655;
const CLIENT_NAME = 'mega-mantos';

// shopFn signature compatible with backupAsset helper
async function shopFn(method, urlPath, body) {
  const r = await fetch(`https://${DOMAIN}/admin/api/2025-01${urlPath}`, {
    method,
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  return { status: r.status, data };
}

async function putAsset(key, value) {
  return shopFn('PUT', `/themes/${THEME_ID}/assets.json`, { asset: { key, value } });
}

async function getAsset(key) {
  const r = await shopFn('GET', `/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(key)}`);
  return r.data?.asset?.value ?? null;
}

// Normalize CRLF -> LF (pitfall #13)
function norm(s) { return s.replace(/\r\n/g, '\n'); }

const ops = [];

// --- 1) NEW: kit-casal-variant-picker.liquid ---
{
  const src = norm(readFileSync(path.join(HERE, 'JGS_snippets__kit-casal-variant-picker.liquid.LIVE'), 'utf8'));
  ops.push({ key: 'snippets/kit-casal-variant-picker.liquid', kind: 'NEW', content: src });
}

// --- 2) NEW: cart-item-kit-casal.liquid ---
{
  const src = norm(readFileSync(path.join(HERE, 'JGS_snippets__cart-item-kit-casal.liquid.LIVE'), 'utf8'));
  ops.push({ key: 'snippets/cart-item-kit-casal.liquid', kind: 'NEW', content: src });
}

// --- 3) PATCH: product-variant-picker.liquid ---
{
  const mm = norm(readFileSync(path.join(HERE, 'MM_snippets__product-variant-picker.liquid.LIVE'), 'utf8'));
  const anchor = '{%- unless product.has_only_default_variant -%}';
  if (!mm.includes(anchor)) throw new Error('anchor unless not found in product-variant-picker');
  if (mm.includes("product.tags contains 'kit-casal'")) {
    console.log('  product-variant-picker already patched, skipping');
    ops.push({ key: 'snippets/product-variant-picker.liquid', kind: 'SKIP', content: mm });
  } else {
    const inject = `{%- if product.tags contains 'kit-casal' -%}\n  {% render 'kit-casal-variant-picker', product: product, block: block, product_form_id: product_form_id, section: section %}\n{%- else -%}\n${anchor}`;
    let patched = mm.replace(anchor, inject);
    // Find last `{%- endunless -%}` and add `{%- endif -%}` after it
    const idx = patched.lastIndexOf('{%- endunless -%}');
    if (idx === -1) throw new Error('endunless not found');
    const insertAt = idx + '{%- endunless -%}'.length;
    patched = patched.slice(0, insertAt) + '\n{%- endif -%}' + patched.slice(insertAt);
    ops.push({ key: 'snippets/product-variant-picker.liquid', kind: 'PATCH', content: patched });
  }
}

// --- 4) PATCH: cart-progress-bar.liquid ---
{
  const mm = norm(readFileSync(path.join(HERE, 'MM_snippets__cart-progress-bar.liquid.LIVE'), 'utf8'));
  if (mm.includes("product.tags contains 'kit-casal'")) {
    console.log('  cart-progress-bar already patched, skipping');
    ops.push({ key: 'snippets/cart-progress-bar.liquid', kind: 'SKIP', content: mm });
  } else {
    // Anchor: line "endif" followed by blank line then "if is_shirt"
    // Pattern is unique in MM file at lines 31-33
    const anchor = '    endif\n\n    if is_shirt';
    if (!mm.includes(anchor)) throw new Error('cart-progress-bar anchor not found');
    const inject = `    endif\n\n    # Kit Casal: já é promoção à parte, não conta nos milestones\n    if item.product.tags contains 'kit-casal'\n      assign is_shirt = false\n    endif\n\n    if is_shirt`;
    const patched = mm.replace(anchor, inject);
    ops.push({ key: 'snippets/cart-progress-bar.liquid', kind: 'PATCH', content: patched });
  }
}

// --- 5) PATCH: cart-drawer.liquid (two injections) ---
{
  const mm = norm(readFileSync(path.join(HERE, 'MM_snippets__cart-drawer.liquid.LIVE'), 'utf8'));
  if (mm.includes('kit-casal-tag')) {
    console.log('  cart-drawer already patched, skipping');
    ops.push({ key: 'snippets/cart-drawer.liquid', kind: 'SKIP', content: mm });
  } else {
    // Injection 1: badge after cart-item__name closing </a>
    const badgeAnchor = `<a href="{{ item.url }}" class="cart-item__name h4 break">\n                            {{- item.product.title | escape -}}\n                          </a>`;
    if (!mm.includes(badgeAnchor)) throw new Error('cart-drawer badge anchor not found');
    const badge = `${badgeAnchor}\n                          {%- if item.product.tags contains 'kit-casal' -%}\n                            <span class="kit-casal-tag">\n                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>\n                              <span>KIT CASAL</span>\n                            </span>\n                            <style>\n                              .kit-casal-tag { display: inline-flex; align-items: center; gap: 0.4rem; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #fff; font-size: 1rem; font-weight: 700; padding: 0.4rem 0.9rem; border-radius: 999px; letter-spacing: 0.05em; margin-top: 0.4rem; white-space: nowrap; text-transform: uppercase; }\n                              .kit-casal-tag svg { flex-shrink: 0; }\n                            </style>\n                          {%- endif -%}`;
    let patched = mm.replace(badgeAnchor, badge);

    // Injection 2: wrap <dl class="cart-item__properties"> with if/else delegating
    const dlAnchor = `<dl class="cart-item__properties">`;
    const dlIdx = patched.indexOf(dlAnchor);
    if (dlIdx === -1) throw new Error('cart-drawer dl anchor not found');
    // Find indentation prefix (spaces before <dl)
    const lineStart = patched.lastIndexOf('\n', dlIdx) + 1;
    const indent = patched.slice(lineStart, dlIdx);
    // Find matching </dl> — search forward
    const dlClose = patched.indexOf('</dl>', dlIdx);
    if (dlClose === -1) throw new Error('cart-drawer </dl> not found');
    const dlCloseLineEnd = patched.indexOf('\n', dlClose);

    // Build replacement: prepend `{%- if kit-casal %}{% render 'cart-item-kit-casal' %}{%- else %}` before <dl> and append `{%- endif -%}` after </dl>
    const before = patched.slice(0, lineStart);
    const dlBlock = patched.slice(lineStart, dlCloseLineEnd + 1);
    const after = patched.slice(dlCloseLineEnd + 1);
    const wrapped = `${indent}{%- if item.product.tags contains 'kit-casal' -%}\n${indent}  {% render 'cart-item-kit-casal', item: item %}\n${indent}{%- else -%}\n${dlBlock}${indent}{%- endif -%}\n`;
    patched = before + wrapped + after;
    ops.push({ key: 'snippets/cart-drawer.liquid', kind: 'PATCH', content: patched });
  }
}

// Save .PATCHED files and validate
console.log('\n=== VALIDATION ===');
let blocked = false;
for (const op of ops) {
  if (op.kind === 'SKIP') { console.log(`  [SKIP] ${op.key}`); continue; }
  const patchedPath = path.join(HERE, `MM_${op.key.replace(/\//g, '__')}.PATCHED`);
  writeFileSync(patchedPath, op.content);
  const v = validateAll(op.content, op.key);
  const pitfalls = v.pitfalls || [];
  if (pitfalls.length > 0) {
    console.log(`  [BLOCK] ${op.key} (${op.kind}) — ${pitfalls.length} pitfall(s):`);
    for (const p of pitfalls) console.log(`    - ${p.code || p.id || ''}: ${p.message || p}`);
    blocked = true;
  } else {
    console.log(`  [OK] ${op.key} (${op.kind}) — ${op.content.length} chars, 0 pitfalls`);
  }
}

if (blocked) {
  console.log('\n❌ BLOCKED — patches têm pitfalls, abortando.');
  process.exit(1);
}

if (!APPLY) {
  console.log('\n✓ Dry-run OK. Para aplicar de verdade: node apply.mjs --apply');
  process.exit(0);
}

console.log('\n=== APPLYING ===');
for (const op of ops) {
  if (op.kind === 'SKIP') continue;
  // Backup current asset before PUT (only if it exists)
  if (op.kind === 'PATCH') {
    try {
      await backupAsset(shopFn, THEME_ID, op.key, CLIENT_NAME);
      console.log(`  [BACKUP] ${op.key}`);
    } catch (e) {
      console.log(`  [BACKUP FAIL] ${op.key}: ${e.message}`);
    }
  }
  const res = await putAsset(op.key, op.content);
  if (res.status >= 400) {
    console.log(`  [PUT FAIL] ${op.key} status ${res.status}: ${JSON.stringify(res.data)}`);
    continue;
  }
  console.log(`  [PUT OK] ${op.key}`);
  // Re-fetch and validate
  const remote = norm(await getAsset(op.key) || '');
  const appliedPath = path.join(HERE, `MM_${op.key.replace(/\//g, '__')}.APPLIED`);
  writeFileSync(appliedPath, remote);
  const v = validateAll(remote, op.key);
  const pitfalls = v.pitfalls || [];
  if (pitfalls.length > 0) {
    console.log(`    ⚠️ APPLIED has ${pitfalls.length} pitfalls — review!`);
    for (const p of pitfalls) console.log(`      - ${p.code || p.id || ''}: ${p.message || p}`);
  } else {
    console.log(`    ✓ APPLIED validated (0 pitfalls)`);
  }
  if (remote.length !== op.content.length) {
    console.log(`    ⚠️ size mismatch: local ${op.content.length} vs remote ${remote.length}`);
  }
}

console.log('\n=== TAGGING PRODUCTS ===');
const KIT_CASAL_PRODUCTS = [
  { id: 'gid://shopify/Product/14999989354607', title: 'Kit Casal Torcedor Brasil 2026/27 I' },
  { id: 'gid://shopify/Product/14999990534255', title: 'Kit Casal Torcedor Brasil 2026/27 II' },
];

async function gql(q, v={}) {
  const r = await fetch(`https://${DOMAIN}/admin/api/2025-01/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: v }) });
  return r.json();
}

for (const p of KIT_CASAL_PRODUCTS) {
  // tagsAdd preserves existing
  const r = await gql(`mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`, {
    id: p.id,
    tags: ['kit-casal', 'excluded-from-promo'],
  });
  const errs = r.data?.tagsAdd?.userErrors || [];
  if (errs.length) console.log(`  [TAG FAIL] ${p.title}: ${JSON.stringify(errs)}`);
  else console.log(`  [TAG OK] ${p.title} → +kit-casal, +excluded-from-promo`);
}

console.log('\n✓ DONE. Test storefront:');
console.log(`  https://${DOMAIN.replace('.myshopify.com','')}.myshopify.com/products/kit-casal-torcedor-brasil-2026-27-i`);
console.log(`  https://${DOMAIN.replace('.myshopify.com','')}.myshopify.com/products/kit-casal-torcedor-brasil-2026-27-ii`);
