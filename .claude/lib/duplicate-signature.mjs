// Shared duplicate detection library
// Used by: code-blocks, dedupe-products, import-missing
//
// signature(title) → canonical string for grouping
// findDuplicates(products) → { groups, toDelete, safe, review }

const FILLERS = new Set([
  'adidas','nike','puma','umbro','mizuno','jordan','kappa','new','balance','newbalance','castore','macron',
  'camisa','camiseta','camisas','conjunto','kit',
  'de','do','da','e','a','o',
  'masculina','masculino','m','home',
  'primeira','segunda','terceira','treinamento',
  'pre','jogo','prejogo'
]);

const SYNONYMS = {
  'primeira':'i','1':'i','home':'i','i':'i',
  'segunda':'ii','2':'ii','away':'ii','ii':'ii',
  'terceira':'iii','3':'iii','third':'iii','iii':'iii',
  'feminino':'feminina','fem':'feminina','feminina':'feminina',
  'jogador':'jogador','player':'jogador','authentic':'jogador',
  'torcedor':'torcedor','fan':'torcedor','tor':'torcedor',
  'infantil':'infantil','kids':'infantil'
};

// "Camisa vs Conjunto" duplicates are AMBIGUOUS — same signature but different products
// (camisa = shirt only, conjunto = full kit with shorts).
// Caller should flag groups containing BOTH 'treino' token variants for manual review.
const AMBIGUOUS_TOKEN_PAIRS = [
  ['camisa treino', 'conjunto de treino'],
  ['camisa de treino', 'conjunto treino']
];

export function signature(title) {
  let t = title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Year normalization
  t = t.replace(/\b(20\d\d)\/(\d\d)\b/g, '$1$2');
  t = t.replace(/\b(20\d\d)\/(20\d\d)\b/g, (_, a, b) => a.slice(2) + b.slice(2));
  t = t.replace(/\b(\d\d)\/(\d\d)\b/g, '$1$2');

  // Punctuation → space
  t = t.replace(/[^a-z0-9]+/g, ' ');

  // Tokenize + canonicalize + filter
  const tokens = t.split(/\s+/).filter(Boolean)
    .map(tok => SYNONYMS[tok] || tok)
    .filter(tok => !FILLERS.has(tok));

  // Dedupe + sort → order-independent signature
  return [...new Set(tokens)].sort().join('-');
}

// Detect if a group contains Camisa vs Conjunto ambiguity (manual review needed)
function isAmbiguousGroup(products) {
  const titles = products.map(p => p.title.toLowerCase());
  const hasCamisa = titles.some(t => /\bcamisa\b.*\btreino\b/.test(t));
  const hasConjunto = titles.some(t => /\bconjunto\b.*\btreino\b/.test(t));
  return hasCamisa && hasConjunto;
}

export function findDuplicates(products) {
  const groups = {};
  for (const p of products) {
    const sig = signature(p.title);
    if (!groups[sig]) groups[sig] = [];
    groups[sig].push(p);
  }

  const safe = [];    // safe to auto-delete
  const review = [];  // manual review needed (camisa vs conjunto)
  const toDelete = [];

  for (const [sig, arr] of Object.entries(groups)) {
    if (arr.length < 2) continue;
    // Keep oldest
    arr.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const group = { signature: sig, keep: arr[0], delete: arr.slice(1) };

    if (isAmbiguousGroup(arr)) {
      review.push(group);
    } else {
      safe.push(group);
      toDelete.push(...group.delete);
    }
  }

  return {
    totalProducts: products.length,
    uniqueSignatures: Object.keys(groups).length,
    duplicateGroups: safe.length + review.length,
    safe,
    review,
    toDelete
  };
}
