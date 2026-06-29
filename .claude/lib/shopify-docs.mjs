// Helper de consulta ao mirror local de shopify-docs/.
//
// shopify-docs/ é um mirror completo da documentação oficial Shopify (7.8k+ pages,
// gitignored, ~100MB). Estrutura:
//   shopify-docs/
//     ├─ search-index.json        ← array de { path, title, section, description }
//     ├─ pages/<path>/content.md  ← conteúdo markdown de cada página
//     ├─ llms.txt                 ← índice resumido
//     └─ visited.json             ← metadata do scraper
//
// Uso:
//   import { searchDocs, readDocPage, listSections } from './shopify-docs.mjs';
//   const hits = await searchDocs('productSet mutation', { limit: 5 });
//   const md = await readDocPage(hits[0].path);
//
// Search faz scoring simples (title match > description > path) — sem fuzzy
// sofisticado, mas rápido e suficiente pra consultas ad-hoc.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_ROOT = path.resolve(__dirname, '..', '..', 'shopify-docs');

let _indexCache = null;
let _sectionsCache = null;

function loadIndex() {
  if (_indexCache) return _indexCache;
  const p = path.join(DOCS_ROOT, 'search-index.json');
  if (!fs.existsSync(p)) {
    throw new Error(`shopify-docs não encontrado em ${DOCS_ROOT}. Rode o scraper primeiro (veja shopify-docs/README.md).`);
  }
  const raw = fs.readFileSync(p, 'utf8');
  _indexCache = JSON.parse(raw);
  return _indexCache;
}

/**
 * Lista todas as sections distintas do index.
 * @returns {string[]}
 */
export function listSections() {
  if (_sectionsCache) return _sectionsCache;
  const idx = loadIndex();
  const set = new Set();
  for (const e of idx) if (e.section) set.add(e.section);
  _sectionsCache = [...set].sort();
  return _sectionsCache;
}

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function scoreEntry(entry, tokens) {
  const title = normalize(entry.title);
  const desc = normalize(entry.description);
  const pathN = normalize(entry.path);
  let score = 0;
  for (const tok of tokens) {
    // Match exato no title = peso alto
    if (title === tok) score += 100;
    // Title contém token
    if (title.includes(tok)) score += 30;
    // Path termina com o token (ex: /productSet)
    if (pathN.endsWith('/' + tok)) score += 25;
    // Path contém
    if (pathN.includes(tok)) score += 10;
    // Description contém
    if (desc.includes(tok)) score += 5;
    // Boundary match no title (palavra separada)
    const re = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (re.test(title)) score += 15;
  }
  return score;
}

/**
 * Busca na documentação Shopify.
 * @param {string} query - ex: "productSet mutation", "webhook topics", "image_tag filter"
 * @param {{ section?: string, limit?: number }} [opts]
 * @returns {Array<{path: string, title: string, section: string, description: string, score: number}>}
 */
export function searchDocs(query, opts = {}) {
  const { section, limit = 10 } = opts;
  if (!query || !query.trim()) return [];
  const idx = loadIndex();
  const tokens = normalize(query).split(/\s+/).filter(t => t.length >= 2);
  if (!tokens.length) return [];

  const scored = [];
  for (const entry of idx) {
    if (section && !entry.section?.startsWith(section)) continue;
    const score = scoreEntry(entry, tokens);
    if (score > 0) scored.push({ ...entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Converte path do index (`/docs/api/admin-graphql/.../productSet`) no path do content.md local.
 * O scraper salva em `shopify-docs/pages/<subpath>/content.md`.
 * @param {string} docPath - `path` retornado por searchDocs
 */
function resolveContentPath(docPath) {
  // O scraper remove o prefixo /docs/ e coloca dentro de pages/
  const clean = docPath.replace(/^\/docs\//, '').replace(/^\//, '');
  return path.join(DOCS_ROOT, 'pages', clean, 'content.md');
}

/**
 * Lê o content.md de uma página.
 * @param {string} docPath - o path retornado por searchDocs
 * @returns {{ path: string, frontmatter: object, content: string }}
 */
export function readDocPage(docPath) {
  const fullPath = resolveContentPath(docPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Página não encontrada: ${fullPath} (original: ${docPath})`);
  }
  const raw = fs.readFileSync(fullPath, 'utf8');
  // Frontmatter YAML simples: --- ... ---
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (fmMatch) {
    const fmBlock = fmMatch[1];
    const content = fmMatch[2];
    const frontmatter = {};
    for (const line of fmBlock.split(/\r?\n/)) {
      const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) frontmatter[m[1]] = m[2].trim();
    }
    return { path: docPath, frontmatter, content };
  }
  return { path: docPath, frontmatter: {}, content: raw };
}

/**
 * Extrai um excerpt centrado no primeiro match de algum token na content.
 * Útil pra preview em search results.
 * @param {string} content
 * @param {string} query
 * @param {number} [radius=160]
 */
export function excerpt(content, query, radius = 160) {
  const tokens = normalize(query).split(/\s+/).filter(t => t.length >= 3);
  const lower = normalize(content);
  let pos = -1;
  for (const tok of tokens) {
    pos = lower.indexOf(tok);
    if (pos >= 0) break;
  }
  if (pos < 0) return content.slice(0, radius * 2).replace(/\s+/g, ' ').trim() + '...';
  const start = Math.max(0, pos - radius);
  const end = Math.min(content.length, pos + radius);
  return (start > 0 ? '...' : '') +
    content.slice(start, end).replace(/\s+/g, ' ').trim() +
    (end < content.length ? '...' : '');
}

// CLI mode: `node shopify-docs.mjs "query"`
const isMainModule = process.argv[1] && (() => {
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch { return false; }
})();

if (isMainModule) {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.log('Uso: node shopify-docs.mjs "<query>"');
    console.log('Ex:  node shopify-docs.mjs "productSet mutation"');
    process.exit(0);
  }
  const hits = searchDocs(query, { limit: 10 });
  if (!hits.length) {
    console.log('Nenhum resultado pra:', query);
    process.exit(0);
  }
  console.log(`\n${hits.length} resultados pra "${query}":\n`);
  for (const h of hits) {
    console.log(`[${h.score}] ${h.title}`);
    console.log(`     section: ${h.section}`);
    console.log(`     path:    ${h.path}`);
    if (h.description && h.description !== '>-') {
      console.log(`     desc:    ${h.description.slice(0, 120)}`);
    }
    console.log('');
  }
}
