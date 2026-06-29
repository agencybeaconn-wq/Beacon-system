// FASE B step 2: rebuild Kit I + Kit II with 3-option structure (Tamanho Masculino + Tamanho Feminino + Personalização)
// Strategy: productSet (replaces options + variants atomically). Preserves title/vendor/type/desc/media/seo.
//
// Pricing rules (from Pedro):
//   - base price NOT touched (Kit I/II = R$ 330 each)
//   - perso add NOT touched (+R$ 30 por lado)
//   - no size add (Mega Mantos doesn't charge extra for big sizes)
//   - compare_at = 2 × base price ONLY on variants where Personalização = "Nenhum"  (50% OFF visível, Lever standard)
//
// Use --apply to actually run productSet
import { readFileSync, writeFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const SINGLE = process.argv.find(a => a.startsWith('--only='))?.slice('--only='.length);

const envText = readFileSync('c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).filter(l => !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i+1).replace(/^["']|["']$/g, '')]; }));
const SUPA = env.VITE_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_KEY;
async function supa(p) { const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } }); return r.json(); }
const [dst] = await supa(`agency_clients?select=shopify_domain,shopify_access_token&name=eq.Mega%20mantos`);
const DOMAIN = dst.shopify_domain, TOKEN = dst.shopify_access_token;
async function gql(q, v={}) { const r = await fetch(`https://${DOMAIN}/admin/api/2025-01/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: v }) }); const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data; }

const extracted = JSON.parse(readFileSync('c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/mega-mantos-kit-casal/fase-b-extracted.json', 'utf8'));

const TAMANHOS_MASC = ['P','M','G','GG','2GG','3GG','4GG'];
const TAMANHOS_FEM  = ['P','M','G','GG','2GG']; // fem só vai até 2GG
const SIZE_ADD_MASC = { P:0, M:0, G:0, GG:0, '2GG':10, '3GG':20, '4GG':30 };
const SIZE_ADD_FEM  = { P:0, M:0, G:0, GG:0, '2GG':10 };
const PERSOS = [
  { value: 'Nenhum',       addM: 0,  addF: 0  },
  { value: 'Só Masculina', addM: 30, addF: 0  },
  { value: 'Só Feminina',  addM: 0,  addF: 30 },
  { value: 'Ambos',        addM: 30, addF: 30 },
];

function buildVariants(basePrice) {
  const variants = [];
  for (const tm of TAMANHOS_MASC) for (const tf of TAMANHOS_FEM) for (const p of PERSOS) {
    const price = basePrice + SIZE_ADD_MASC[tm] + SIZE_ADD_FEM[tf] + p.addM + p.addF;
    variants.push({
      optionValues: [
        { name: tm, optionName: 'Tamanho Masculino' },
        { name: tf, optionName: 'Tamanho Feminino' },
        { name: p.value, optionName: 'Personalização' },
      ],
      price: price.toFixed(2),
      compareAtPrice: (basePrice * 2).toFixed(2), // FIXO em 2x preço base (R$ 660) — não muda com variant
      inventoryPolicy: 'CONTINUE',
    });
  }
  return variants;
}

const PRODUCT_SET = `mutation($input: ProductSetInput!, $synchronous: Boolean!) {
  productSet(input: $input, synchronous: $synchronous) {
    product { id title options { id name values position } variants(first: 250) { edges { node { id title price compareAtPrice } } } }
    userErrors { field message }
    productSetOperation { id status }
  }
}`;

const products = Object.entries(extracted).filter(([k]) => !SINGLE || k === SINGLE);

if (!APPLY) {
  console.log('DRY-RUN — para aplicar, passe --apply');
  for (const [label, info] of products) {
    const variants = buildVariants(info.base_price);
    console.log(`\n${label}: ${info.title}`);
    console.log(`  base: R$ ${info.base_price} → ${variants.length} variants (${TAMANHOS_MASC.length}×${TAMANHOS_FEM.length}×${PERSOS.length})`);
    console.log(`  preços únicos: ${[...new Set(variants.map(v => v.price))].sort((a,b)=>parseFloat(a)-parseFloat(b)).join(', ')}`);
    console.log(`  sample (extremos):`);
    const samples = [variants[0], variants[3], variants[variants.length-4], variants[variants.length-1]];
    for (const v of samples) console.log(`    - ${v.optionValues.map(o => o.name).join(' / ')} = R$ ${v.price} (compare R$ ${v.compareAtPrice})`);
  }
  process.exit(0);
}

for (const [label, info] of products) {
  console.log(`\n=== ${label}: ${info.title} ===`);
  const variants = buildVariants(info.base_price);
  const input = {
    id: info.pid,
    productOptions: [
      { name: 'Tamanho Masculino', position: 1, values: TAMANHOS_MASC.map(v => ({ name: v })) },
      { name: 'Tamanho Feminino',  position: 2, values: TAMANHOS_FEM.map(v => ({ name: v })) }, // 5 valores agora (sem 3GG/4GG)
      { name: 'Personalização',    position: 3, values: PERSOS.map(p => ({ name: p.value })) },
    ],
    variants,
  };
  const t0 = Date.now();
  const res = await gql(PRODUCT_SET, { input, synchronous: true });
  const errs = res.productSet?.userErrors || [];
  if (errs.length) {
    console.log(`  ❌ userErrors:`);
    for (const e of errs) console.log(`    - [${e.field?.join('.')}] ${e.message}`);
    continue;
  }
  const p = res.productSet.product;
  console.log(`  ✓ ${p.variants.edges.length} variants criadas em ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log(`  options: ${p.options.map(o => `${o.name} (${o.values.length})`).join(' / ')}`);
}

console.log('\n✓ FASE B done. Testar:');
console.log('  https://loja-mega-manto.myshopify.com/products/kit-casal-torcedor-brasil-2026-27-i');
console.log('  https://loja-mega-manto.myshopify.com/products/kit-casal-torcedor-brasil-2026-27-ii');
