// FASE B step 1: extract current price structure from Kit I and Kit II
// Output: acréscimos extraídos pra montar nova matriz de 196 variants
import { readFileSync, writeFileSync } from 'node:fs';
const envText = readFileSync('c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).filter(l => !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i+1).replace(/^["']|["']$/g, '')]; }));
const SUPA = env.VITE_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_KEY;
async function supa(p) { const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } }); return r.json(); }
const [dst] = await supa(`agency_clients?select=shopify_domain,shopify_access_token&name=eq.Mega%20mantos`);
const DOMAIN = dst.shopify_domain, TOKEN = dst.shopify_access_token;
async function gql(q, v={}) { const r = await fetch(`https://${DOMAIN}/admin/api/2025-01/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: v }) }); const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data; }

const PRODUCTS = [
  { id: 'gid://shopify/Product/14999989354607', label: 'Kit I' },
  { id: 'gid://shopify/Product/14999990534255', label: 'Kit II' },
];

const Q = `query($id: ID!) { product(id: $id) { id title vendor productType
  variants(first: 250) { edges { node { id title price compareAtPrice selectedOptions { name value } } } }
  options { id name values position }
} }`;

const out = {};
for (const p of PRODUCTS) {
  const d = await gql(Q, { id: p.id });
  const prod = d.product;
  const variants = prod.variants.edges.map(e => e.node);
  const byKey = {};
  for (const v of variants) {
    const tam = v.selectedOptions.find(o => /tamanh/i.test(o.name))?.value;
    const perso = v.selectedOptions.find(o => /personali/i.test(o.name))?.value;
    byKey[`${tam}|${perso}`] = parseFloat(v.price);
  }
  // base = P / Não Personalizar
  const NAO = 'Não Personalizar';
  const SIM = 'Personalizar';
  const base = byKey[`P|${NAO}`];
  const persoAdd = byKey[`P|${SIM}`] != null ? byKey[`P|${SIM}`] - base : null;
  const sizeAdds = {};
  for (const tam of ['P','M','G','GG','2GG','3GG','4GG']) {
    const v = byKey[`${tam}|${NAO}`];
    if (v != null) sizeAdds[tam] = v - base;
  }
  out[p.label] = {
    pid: p.id,
    title: prod.title,
    vendor: prod.vendor,
    type: prod.productType,
    options_current: prod.options.map(o => ({ id: o.id, name: o.name, values: o.values, position: o.position })),
    base_price: base,
    perso_add: persoAdd,
    size_adds: sizeAdds,
    total_variants_current: variants.length,
  };
  console.log(`\n=== ${p.label}: ${prod.title} ===`);
  console.log('  base price (P / Não):', base);
  console.log('  perso add:', persoAdd);
  console.log('  size adds:', sizeAdds);
  console.log('  total variants atuais:', variants.length);
  console.log('  options:', prod.options.map(o => `${o.name} (${o.values.length} values)`).join(', '));
}

writeFileSync('c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/mega-mantos-kit-casal/fase-b-extracted.json', JSON.stringify(out, null, 2));
console.log('\n✓ Salvo em fase-b-extracted.json');
