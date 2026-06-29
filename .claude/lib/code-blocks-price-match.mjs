// Auto-detect price patterns from existing products in a store
// Used when copying a single product from one store to another — automatically
// applies the destination store's pricing for the same category.
//
// Usage:
//   import { detectPricePattern, applyPriceToVariants } from './code-blocks-price-match.mjs';
//   const pattern = await detectPricePattern(shopFn, 'camisa_torcedor');
//   const newVariants = applyPriceToVariants(product.variants, pattern);

// Categorize by title (same rules as shopify-pricing.mjs, duplicated small)
export function categorizeByTitle(title) {
  const t = title.toLowerCase();
  if (/^patch|^patches|^kit patch/i.test(title)) return 'patch';
  if (/short/.test(t)) return 'short';
  if (/agasalho|jaqueta|moletom|corta[-\s]?vento/.test(t)) return 'frio';
  if (/conjunto.*treino/.test(t)) return 'conjunto_treino';
  if (/infantil|kids/.test(t) && !/kidsup/.test(t)) return 'infantil';
  if (/retr[oô]/.test(t)) return 'retro';
  if (/jogador|authentic|player/.test(t)) return 'jogador';
  if (/feminin/.test(t)) return 'feminina';
  return 'torcedor';
}

function variantKey(variant) {
  const opts = [variant.option1, variant.option2, variant.option3]
    .filter(Boolean).join('|').toLowerCase();
  if (/personaliz/.test(opts) && !/não|nao/.test(opts)) return 'personalizada';
  if (/4gg|4xl|xxxxl/.test(opts)) return '4gg';
  if (/3gg|3xl|xxxl/.test(opts) && !/4/.test(opts)) return '3gg';
  if (/2gg|2xl|xxl/.test(opts) && !/3|4/.test(opts)) return '2gg';
  return 'normal';
}

// Detect the most common price pattern for a given category in a store.
// shopFn: async (method, path) => { data }
// Returns: { normal: {price, compare_at}, personalizada: {...}, 2gg: {...}, ... }
export async function detectPricePattern(shopFn, targetCategory, maxSample = 500) {
  const prices = {};
  let sinceId = 0;
  let scanned = 0;

  while (scanned < maxSample) {
    const r = await shopFn('GET', `/products.json?limit=250&since_id=${sinceId}&fields=id,title,variants`);
    const batch = r.data.products || [];
    if (batch.length === 0) break;

    for (const p of batch) {
      if (categorizeByTitle(p.title) !== targetCategory) continue;
      scanned++;
      for (const v of p.variants) {
        const k = variantKey(v);
        if (!prices[k]) prices[k] = {};
        const pc = `${v.price}|${v.compare_at_price || 'null'}`;
        prices[k][pc] = (prices[k][pc] || 0) + 1;
      }
    }

    sinceId = batch[batch.length - 1].id;
    if (batch.length < 250) break;
  }

  // Pick most common per variant key
  const pattern = {};
  for (const [k, counts] of Object.entries(prices)) {
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) continue;
    const [price, compare] = top[0].split('|');
    pattern[k] = {
      price,
      compare_at_price: compare === 'null' ? null : compare,
      samples: top[1]
    };
  }

  return { category: targetCategory, scanned, pattern };
}

// Apply detected pattern to a variants array
export function applyPriceToVariants(variants, pattern) {
  return variants.map(v => {
    const k = variantKey(v);
    const pr = pattern[k] || pattern.normal;
    if (!pr) return v;
    return {
      ...v,
      price: pr.price,
      compare_at_price: pr.compare_at_price
    };
  });
}
