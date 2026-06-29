#!/usr/bin/env node
// clone-layout-extract — extrai sequência exata de sections do HTML scraped do alvo.
//
// Lê _raw/<page>/index.html e identifica:
//   - Ordem das sections na página (top → bottom)
//   - Tipo Shopify de cada section (de `shopify-section-template--XXX__TIPO`)
//   - Quantidade de blocos/items aparentes (cards, slides, features)
//   - "Densidade" aproximada (chars de conteúdo dentro da section)
//
// Salva _design/layout-<page>.json — input pra clone-templates e edição manual.
//
// Esse extrator NÃO reproduz conteúdo: só catalogue tipo+ordem+contagens estruturais.
//
// Uso:
//   node clone-layout-extract.mjs <slug> [<page>]
//   (sem <page>, roda em todas as pages scrapeadas)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Regex pra detectar abertura de <section id="shopify-section-...">
const RE_SECTION_START = /<section\s+[^>]*?id=["']shopify-section-([^"']+)["'][^>]*>/g;
// Pra Shopify section IDs: `template--ID__TYPE_hash` ou `sections--ID__NAME_hash`
const RE_SECTION_TYPE = /^(?:template|sections)--\d+__([a-z0-9_-]+?)(?:_[A-Za-z0-9]{6,})?$/;

function extractSectionType(rawId) {
  const m = rawId.match(RE_SECTION_TYPE);
  if (m) return m[1].replace(/_/g, '-');
  // Fallback: outros padrões de id
  return rawId.replace(/^shopify-section-/, '').slice(0, 40);
}

// Conta blocos visualmente significativos dentro de um trecho de HTML
function countBlocks(htmlChunk) {
  const patterns = {
    // grid de produtos/cards
    product_cards: /<(?:li|article|div)[^>]*?class=["'][^"']*(?:product-card|card-wrapper|grid__item|product-grid__item|collection-grid__item)/g,
    // blocks "feature" (icon + heading + text)
    features: /<(?:li|article|div)[^>]*?class=["'][^"']*(?:feature|multicolumn-card|icon-with-text)/g,
    // slides
    slides: /<(?:li|div)[^>]*?(?:class=["'][^"']*slide|data-slide-index|aria-roledescription=["']slide)/g,
    // testimonials
    testimonials: /<(?:li|div|blockquote)[^>]*?class=["'][^"']*(?:testimonial|review-card|quote)/g,
    // images explícitas
    images: /<img\s/g,
    // headings
    headings: /<h[1-6][^>]*>/g,
    // CTA buttons
    buttons: /<(?:a|button)[^>]*?class=["'][^"']*(?:btn|button)/g,
  };
  const out = {};
  for (const [k, re] of Object.entries(patterns)) {
    re.lastIndex = 0;
    out[k] = (htmlChunk.match(re) || []).length;
  }
  // Tamanho aproximado em chars (proxy de "densidade")
  out.chars = htmlChunk.length;
  return out;
}

// Walk pelas sections — usa profundidade implicíta (já que <section> não aninha em Shopify)
function extractSections(html) {
  const matches = [...html.matchAll(RE_SECTION_START)];
  const sections = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const rawId = m[1];
    const type = extractSectionType(rawId);
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    // Recorte até fechar a section (busca </section> não-aninhada — heurística)
    const slice = html.slice(start, end);
    const closeIdx = slice.lastIndexOf('</section>');
    const inner = closeIdx > 0 ? slice.slice(0, closeIdx) : slice;
    sections.push({
      order: i + 1,
      raw_id: rawId,
      type,
      offset: m.index,
      ...countBlocks(inner),
    });
  }
  return sections;
}

function suggestMonRoyalEquivalent(type, blocks) {
  // Mapeia tipo Shopify do alvo → section equivalente do meu workspace clone-theme
  const lower = type.toLowerCase();
  if (lower.includes('hero')) {
    if (lower.includes('_b') || lower.includes('-b')) return 'clone-hero-secondary';
    if (lower.includes('_c') || lower.includes('-c')) return 'clone-hero-tertiary';
    return 'clone-hero';
  }
  if (lower.includes('announcement')) return '[Dawn announcement-bar]';
  if (lower.includes('collection-list') || lower.includes('collection_list')) return 'clone-collection-list';
  if (lower.includes('collection-banner')) return 'clone-image-banner (variante banner-com-link-de-coleção)';
  if (lower.includes('featured-collection') || lower.includes('featured_collection')) return 'clone-product-grid';
  if (lower.includes('image-banner') || lower.includes('image_banner')) return 'clone-image-banner';
  if (lower.includes('product-filter') || lower.includes('product_filter')) return '[SKIP: configurador específico do alvo]';
  if (lower.includes('rich-text') || lower.includes('rich_text')) return '[Dawn rich-text]';
  if (lower.includes('newsletter') || lower.includes('email-signup')) return '[Dawn email-signup]';
  if (lower.includes('main-product')) return 'clone-product-main';
  if (lower.includes('main-collection')) return 'clone-product-grid (modo coleção)';
  if (lower.includes('main-cart')) return 'clone-cart-main';
  if (lower.includes('main-page')) return 'clone-page-content';
  if (blocks.product_cards >= 6) return 'clone-product-grid';
  if (blocks.features >= 3) return 'clone-featured-grid';
  return '[avaliar caso a caso]';
}

async function main() {
  const slug = process.argv[2];
  const pageArg = process.argv[3];
  if (!slug) {
    console.error('Uso: node clone-layout-extract.mjs <slug> [<page-dir>]');
    process.exit(1);
  }

  console.log('\n=== clone-layout-extract ===');

  const rawDir = path.join(REPO_ROOT, 'themes', 'clones', slug, '_raw');
  const designDir = path.join(REPO_ROOT, 'themes', 'clones', slug, '_design');
  if (!fs.existsSync(rawDir)) {
    console.error(`Não achei ${rawDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(designDir)) fs.mkdirSync(designDir, { recursive: true });

  const pages = pageArg ? [pageArg] : fs.readdirSync(rawDir).filter(d => fs.statSync(path.join(rawDir, d)).isDirectory());

  const grand = {};
  for (const page of pages) {
    const htmlPath = path.join(rawDir, page, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const sections = extractSections(html);
    if (!sections.length) {
      console.log(`\n[${page}] nenhuma section detectada`);
      continue;
    }
    console.log(`\n[${page}] ${sections.length} sections`);
    console.log(`  #  type${' '.repeat(28)} cards feat slides imgs head btn   chars   sugestão clone-theme`);
    console.log('  ' + '-'.repeat(120));
    for (const s of sections) {
      const sugg = suggestMonRoyalEquivalent(s.type, s);
      console.log(
        '  ' + String(s.order).padStart(2) +
        '  ' + (s.type.slice(0, 30)).padEnd(32) +
        ' ' + String(s.product_cards).padStart(4) +
        ' ' + String(s.features).padStart(4) +
        ' ' + String(s.slides).padStart(6) +
        ' ' + String(s.images).padStart(4) +
        ' ' + String(s.headings).padStart(4) +
        ' ' + String(s.buttons).padStart(3) +
        ' ' + String(s.chars).padStart(7) +
        '   ' + sugg
      );
    }
    grand[page] = sections;
    fs.writeFileSync(path.join(designDir, `layout-${page}.json`), JSON.stringify(sections, null, 2));
  }
  fs.writeFileSync(path.join(designDir, 'layout-all.json'), JSON.stringify(grand, null, 2));
  console.log('\n✓ Salvo em _design/layout-*.json e _design/layout-all.json');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
