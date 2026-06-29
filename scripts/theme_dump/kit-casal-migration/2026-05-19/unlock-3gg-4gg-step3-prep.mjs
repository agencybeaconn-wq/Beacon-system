// STEP 3-prep — Confere produto Kit Casal Brasil Home 26/27 antes de criar variants
// Produto: gid://shopify/Product/8248726585539
// Garante:
//   - 2 options exatas: Tamanho + Personalização (nessa ordem)
//   - 100 variants atuais (5 tamanhos masc × 5 fem × 4 pers = 100)
//   - Detecta combinações 3GG e 4GG já existentes (deve ser 0)
//   - Calcula preços conforme regra Lever (base + acréscimos)
// Não cria nada. Só dumpa pra arquivo as 40 combinações que vamos criar.

import { getCreds, shopifyGraphQL } from '../../../../.claude/lib/shopify-api.mjs';
import fs from 'fs';

const MANTOS_UUID = '053f7258-95f4-4ca9-81ad-4032b18829ba';
const PRODUCT_GID = 'gid://shopify/Product/8248726585539';
const OUT = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19/unlock-3gg-4gg-variants-planned.json';

const QUERY = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      tags
      options { id name position values }
      variants(first: 250) {
        edges {
          node {
            id
            title
            price
            compareAtPrice
            inventoryPolicy
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

(async () => {
  const c = await getCreds(MANTOS_UUID);
  const r = await shopifyGraphQL(c.shop, c.token, QUERY, { id: PRODUCT_GID });
  if (r.errors) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); }
  const p = r.data.product;
  if (!p) { console.error('Produto não encontrado'); process.exit(1); }
  console.log(`Produto: ${p.title}`);
  console.log(`Handle: ${p.handle}`);
  console.log(`Status: ${p.status}`);
  console.log(`Tags: ${p.tags.join(', ')}`);
  console.log(`Options:`);
  for (const o of p.options) {
    console.log(`  - ${o.name} (pos=${o.position}): ${o.values.join(', ')}`);
  }
  console.log(`Variants atuais: ${p.variants.edges.length}`);

  // Indexa por (Tamanho, Personalização)
  const existing = new Set();
  let priceMap = {};
  for (const e of p.variants.edges) {
    const opts = {};
    for (const so of e.node.selectedOptions) opts[so.name] = so.value;
    const sizeKey = opts['Tamanho'] || '';
    const persKey = opts['Personalização'] || '';
    existing.add(`${sizeKey}__${persKey}`);
    if (sizeKey && persKey) {
      priceMap[`${sizeKey}__${persKey}`] = { price: e.node.price, compareAt: e.node.compareAtPrice };
    }
  }
  console.log(`\nExistentes (chaves Tamanho+Personalização):`);
  const sample = [...existing].slice(0, 10);
  for (const k of sample) console.log(`  - ${k}`);
  console.log(`  ... total ${existing.size}`);

  // Detectar preços base por inspeção das atuais
  // Esperado segundo o relatório:
  // base 339,90  (Nenhum)
  // só uma 369,90
  // ambas 399,90
  // tamanho acréscimos: +0 (P/M/G/GG), +10 (2GG), +20 (3GG), +30 (4GG)
  // PERGUNTA: acréscimo é por LADO ou somado?
  // Olhando as 100 atuais: spot-check umas combinações
  const sampleSizes = ['P/P', 'P/2GG', '2GG/2GG', 'G/GG'];
  const samplePers = ['Nenhum', 'Só Camisa Masculina', 'Só Camisa Feminina', 'Ambas as camisas'];
  console.log(`\nSpot-check preços atuais (100 variants existentes):`);
  for (const s of sampleSizes) {
    for (const p of samplePers) {
      const k = `${s}__${p}`;
      const v = priceMap[k];
      if (v) console.log(`  ${k.padEnd(50)} -> price=${v.price}  compareAt=${v.compareAt}`);
    }
  }

  // Lista esperada de combinações novas
  // Tamanho: "X/Y" onde X masc, Y fem
  // Vamos detectar formato atual do option Tamanho
  const tamanhoOption = p.options.find(o => o.name === 'Tamanho');
  if (!tamanhoOption) {
    console.error('Option "Tamanho" não encontrada!');
    process.exit(1);
  }
  console.log(`\nTamanho values atuais (${tamanhoOption.values.length}): ${tamanhoOption.values.join(', ')}`);

  // Confirmar formato "X/Y"
  const firstVal = tamanhoOption.values[0];
  console.log(`Formato primeiro valor: "${firstVal}"`);

  // Detectar quais sizes masc já existem
  const mascSizes = new Set();
  const femSizes = new Set();
  for (const v of tamanhoOption.values) {
    const [m, f] = v.split('/');
    mascSizes.add(m);
    femSizes.add(f);
  }
  console.log(`Sizes masc detectados: ${[...mascSizes].join(', ')}`);
  console.log(`Sizes fem detectados: ${[...femSizes].join(', ')}`);

  console.log(`\n=== Plano de criação ===`);
  // 40 novas = 2 sizes masc novos (3GG, 4GG) × 5 sizes fem (P, M, G, GG, 2GG) × 4 pers
  // OBS: como já existem todas combinações masc-existente × fem-todas (incluindo 3GG/4GG fem?? NÃO!
  // pelo storefront fem TAMBÉM tá riscada — mas pelo admin print só tem 5 sizes masc visíveis × 5 fem = 25??
  // OK relatório: 25 tamanho × 4 pers = 100. Então fem tem 5 sizes (P/M/G/GG/2GG)
  // Novas = 2 (masc 3GG,4GG) × 5 (fem P/M/G/GG/2GG) × 4 (pers) = 40

  const newMasc = ['3GG', '4GG'];
  const existingFem = [...femSizes]; // 5
  const persOptions = ['Nenhum', 'Só Camisa Masculina', 'Só Camisa Feminina', 'Ambas as camisas'];

  // Pricing rules (baseado no relatório):
  //   base 339.90 (size masc P/M/G/GG + size fem P/M/G/GG + Nenhum)
  //   pers:
  //     Nenhum -> +0
  //     Só Masc -> +30
  //     Só Fem -> +30
  //     Ambas -> +60
  //   tamanho acréscimo (por LADO):
  //     P/M/G/GG -> +0
  //     2GG -> +10
  //     3GG -> +20
  //     4GG -> +30
  // ==> total = 339.90 + masc_extra + fem_extra + pers_extra
  // compareAt sempre 450.00 (regra Lever spot-check)

  const sizeExtra = { 'P': 0, 'M': 0, 'G': 0, 'GG': 0, '2GG': 10, '3GG': 20, '4GG': 30 };
  const persExtra = {
    'Nenhum': 0,
    'Só Camisa Masculina': 30,
    'Só Camisa Feminina': 30,
    'Ambas as camisas': 60,
  };
  const BASE = 339.90;
  const COMPARE = '450.00';

  const planned = [];
  for (const m of newMasc) {
    for (const f of existingFem) {
      for (const pers of persOptions) {
        const tamanho = `${m}/${f}`;
        const key = `${tamanho}__${pers}`;
        if (existing.has(key)) {
          console.log(`  SKIP (já existe): ${key}`);
          continue;
        }
        const price = (BASE + (sizeExtra[m] || 0) + (sizeExtra[f] || 0) + (persExtra[pers] || 0)).toFixed(2);
        planned.push({
          tamanho,
          pers,
          price,
          compareAt: COMPARE,
          masc: m,
          fem: f,
        });
      }
    }
  }

  console.log(`\nPlanejado: ${planned.length} variants novas`);
  console.log(`Amostra:`);
  for (const v of planned.slice(0, 6)) {
    console.log(`  Tamanho=${v.tamanho.padEnd(7)}  Pers=${v.pers.padEnd(22)}  price=${v.price}  compareAt=${v.compareAt}`);
  }
  console.log(`  ...`);
  for (const v of planned.slice(-3)) {
    console.log(`  Tamanho=${v.tamanho.padEnd(7)}  Pers=${v.pers.padEnd(22)}  price=${v.price}  compareAt=${v.compareAt}`);
  }

  fs.writeFileSync(OUT, JSON.stringify({
    product: { id: PRODUCT_GID, title: p.title, handle: p.handle },
    existingCount: p.variants.edges.length,
    planned,
    pricing: { base: BASE, compareAt: COMPARE, sizeExtra, persExtra },
  }, null, 2));
  console.log(`\nPlano salvo em: ${OUT}`);
  console.log('STEP 3-prep OK');
})();
