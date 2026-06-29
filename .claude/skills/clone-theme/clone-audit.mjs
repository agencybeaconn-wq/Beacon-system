#!/usr/bin/env node
// clone-audit — passo de conferência: compara o que o alvo tem (no scrape)
// com o que o workspace clonado tem. Lista gaps acionáveis.
//
// "Clone, conferência e aplicação" — esse script é a etapa de CONFERÊNCIA.
//
// Lê:
//   - _raw/<page>/index.html  (estrutura HTML do alvo)
//   - sections/clone-*.liquid (o que já existe no workspace)
//   - templates/*.json         (como as sections estão amarradas)
//
// Reporta:
//   - Quantidade e tipos de sections no alvo (por page-type)
//   - Quantidade e tipos no workspace
//   - Gap: sections que existem no alvo mas faltam no workspace
//   - Sugestões de novas sections a gerar
//
// Salva: _design/audit.json (input pro próximo passo de geração)
//
// Uso:
//   node clone-audit.mjs <slug>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Padrões pra extrair section types do HTML scraped
// Shopify themes têm `<section id="shopify-section-template--XXX__SECTION_TYPE_SUFFIX">`
// ou `<div class="shopify-section ...">` ou `data-section-type="X"`.
const RE_SHOPIFY_SECTION_ID = /id=["']shopify-section-(?:template|sections)--[^_]+(?:__|--)([a-z0-9_-]+?)(?:_[A-Za-z0-9]+)?["']/g;
const RE_DATA_SECTION_TYPE = /data-section-type=["']([^"']+)["']/g;
const RE_CUSTOM_SECTION_CLASS = /<section[^>]*class=["']([a-z0-9-]+(?:-section)?)["']/g;
const RE_DAWN_LIKE_SECTION = /<section[^>]*id=["']shopify-section-([^"']+?)["']/g;

// Classifica section types em categorias genéricas e-commerce.
// IMPORTANTE: os patterns precisam cobrir tanto o nome no scrape (Shopify usa snake_case)
// quanto o nome dos arquivos do workspace (`clone-X.liquid` em kebab-case).
// O matching já normaliza separadores, então listar uma forma é suficiente.
const SECTION_TAXONOMY = {
  hero:                ['hero', 'hero-section', 'hero-version', 'main-banner', 'slideshow'],
  featured_collection: ['featured-collection', 'featured-grid', 'product-grid', 'collection-list-tabs', 'product-recommendations', 'best-sellers'],
  collection_list:     ['collection-list', 'collections-overview', 'shop-by-category', 'collection-banner'],
  product_filter:      ['custom-product-filter', 'product-filter', 'try-your-luck', 'configurator'],
  image_banner:        ['image-banner', 'promo-banner', 'split-banner'],
  testimonials:        ['testimonials', 'reviews', 'social-proof'],
  rich_text:           ['rich-text', 'text-block', 'content-block'],
  newsletter:          ['newsletter', 'email-signup', 'subscribe'],
  faq:                 ['faq', 'accordion', 'questions'],
  features_grid:       ['features', 'icons-row', 'usps', 'value-props', 'benefits'],
  product_main:        ['main-product', 'product-main', 'product-template', 'product-detail'],
  cart_main:           ['main-cart', 'cart-main', 'cart-items', 'cart-template', 'cart-page'],
  page_content:        ['main-page', 'page-content', 'static-page'],
  blog_main:           ['main-blog', 'blog-posts', 'article-list'],
  article_main:        ['main-article', 'article-template'],
  announcement:        ['announcement-bar', 'announcement', 'top-bar', 'utility-bar'],
};

function classifySection(rawName) {
  const lower = rawName.toLowerCase().replace(/[_-]+/g, '-');
  for (const [category, patterns] of Object.entries(SECTION_TAXONOMY)) {
    if (patterns.some(p => lower.includes(p.replace(/[_-]+/g, '-')))) {
      return category;
    }
  }
  return 'other';
}

function extractSectionsFromHtml(html) {
  const found = new Map(); // raw name → count
  const patterns = [RE_SHOPIFY_SECTION_ID, RE_DATA_SECTION_TYPE];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = m[1];
      if (!name || name.length > 60) continue;
      // Remove sufixos hash de Shopify (_xxxxxxx)
      const clean = name.replace(/_[A-Za-z0-9]{6,}$/, '');
      found.set(clean, (found.get(clean) || 0) + 1);
    }
  }
  return found;
}

function loadWorkspaceSections(workspace) {
  const sectionsDir = path.join(workspace, 'sections');
  if (!fs.existsSync(sectionsDir)) return { all: [], clone: [] };
  const all = fs.readdirSync(sectionsDir).filter(f => f.endsWith('.liquid'));
  const clone = all.filter(f => f.startsWith('clone-'));
  return { all, clone };
}

function loadTemplateUsage(workspace) {
  const tplDir = path.join(workspace, 'templates');
  if (!fs.existsSync(tplDir)) return [];
  const out = [];
  for (const f of fs.readdirSync(tplDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(tplDir, f), 'utf8'));
      const types = Object.values(data.sections || {}).map(s => s.type);
      out.push({ template: f, section_types: types, count: types.length });
    } catch { /* skip parse errors */ }
  }
  return out;
}

// Section groups (header-group.json, footer-group.json) também contêm sections
// ativas globalmente. Sem ler eles, audit gera falso positivo dizendo que
// `announcement-bar` está faltando quando na verdade está ativa em header-group.
function loadSectionGroupTypes(workspace) {
  const sectionsDir = path.join(workspace, 'sections');
  if (!fs.existsSync(sectionsDir)) return [];
  const out = [];
  for (const f of fs.readdirSync(sectionsDir)) {
    if (!f.endsWith('-group.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(sectionsDir, f), 'utf8'));
      const types = Object.values(data.sections || {}).map(s => s.type);
      out.push({ group: f, section_types: types });
    } catch { /* skip */ }
  }
  return out;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Uso: node clone-audit.mjs <slug>');
    process.exit(1);
  }

  console.log('\n=== clone-audit ===');

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', slug);
  const rawDir = path.join(workspace, '_raw');
  const designDir = path.join(workspace, '_design');
  if (!fs.existsSync(rawDir)) {
    console.error(`Não achei ${rawDir}. Rode pipeline antes (validate→scrape→assemble).`);
    process.exit(1);
  }

  // 1. Sections no alvo (por page-type)
  const targetByPage = {};
  const allTargetSections = new Map();
  for (const page of fs.readdirSync(rawDir)) {
    const htmlPath = path.join(rawDir, page, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const found = extractSectionsFromHtml(html);
    targetByPage[page] = Object.fromEntries(found);
    for (const [name, count] of found) {
      allTargetSections.set(name, (allTargetSections.get(name) || 0) + count);
    }
  }

  // Classifica todas as sections do alvo em categorias
  const categoryCounts = {};
  for (const [name, count] of allTargetSections) {
    const cat = classifySection(name);
    if (!categoryCounts[cat]) categoryCounts[cat] = { count: 0, examples: new Set() };
    categoryCounts[cat].count += count;
    categoryCounts[cat].examples.add(name);
  }

  // 2. Sections no workspace (.liquid files)
  const { all, clone } = loadWorkspaceSections(workspace);
  const cloneCategories = new Set(clone.map(f => {
    const name = f.replaceAll(/^clone-/g, '').replaceAll(/\.liquid$/g, '');
    return classifySection(name);
  }));

  // 2b. Section groups (header-group, footer-group) — também cobrem categorias
  const sectionGroups = loadSectionGroupTypes(workspace);
  for (const g of sectionGroups) {
    for (const t of g.section_types) cloneCategories.add(classifySection(t));
  }

  // 3. Templates usage
  const templates = loadTemplateUsage(workspace);

  // 4. Gap analysis
  const gaps = [];
  for (const [category, info] of Object.entries(categoryCounts)) {
    if (category === 'other') continue;
    if (!cloneCategories.has(category)) {
      gaps.push({
        category,
        target_count: info.count,
        target_examples: [...info.examples].slice(0, 3),
        suggested_section_name: `clone-${category.replace(/_/g, '-')}.liquid`,
      });
    }
  }

  // 5. Output
  console.log(`\n  ALVO (do scrape em _raw/):`);
  console.log(`    Total page-types scrapeadas: ${Object.keys(targetByPage).length}`);
  console.log(`    Total sections distintas detectadas: ${allTargetSections.size}`);
  console.log(`    Categorias:`);
  for (const [cat, info] of Object.entries(categoryCounts).sort((a, b) => b[1].count - a[1].count)) {
    const covered = cloneCategories.has(cat) ? '✓' : '✗';
    console.log(`      ${covered} ${cat.padEnd(22)} ${info.count.toString().padStart(3)}x   (ex: ${[...info.examples].slice(0, 2).join(', ')})`);
  }

  console.log(`\n  WORKSPACE (sections/clone-*.liquid):`);
  console.log(`    Sections totais: ${all.length} (Dawn: ${all.length - clone.length}, clone-*: ${clone.length})`);
  console.log(`    Categorias cobertas: ${[...cloneCategories].join(', ')}`);

  console.log(`\n  TEMPLATES (sections.json usage):`);
  for (const t of templates) {
    if (t.count > 0) console.log(`    ${t.template.padEnd(20)} → ${t.section_types.join(', ')}`);
  }

  console.log(`\n  GAPS — sections do alvo SEM equivalente no workspace:`);
  if (gaps.length === 0) {
    console.log(`    ✓ Tudo coberto (em nível de categoria)`);
  } else {
    for (const g of gaps) {
      console.log(`    ✗ ${g.category.padEnd(22)} ${g.target_count}x no alvo → criar ${g.suggested_section_name}`);
    }
  }

  // Salva audit.json
  if (!fs.existsSync(designDir)) fs.mkdirSync(designDir, { recursive: true });
  const audit = {
    audited_at: new Date().toISOString(),
    target: {
      pages_scraped: Object.keys(targetByPage).length,
      sections_distinct: allTargetSections.size,
      categories: Object.fromEntries(
        Object.entries(categoryCounts).map(([k, v]) => [k, { count: v.count, examples: [...v.examples] }])
      ),
      by_page: targetByPage,
    },
    workspace: {
      total_sections: all.length,
      clone_sections: clone,
      categories_covered: [...cloneCategories],
      templates,
    },
    gaps,
  };
  fs.writeFileSync(path.join(designDir, 'audit.json'), JSON.stringify(audit, null, 2), 'utf8');

  console.log(`\n✓ Audit salvo em _design/audit.json (${gaps.length} gaps)`);
  if (gaps.length > 0) {
    console.log(`\nPróximo: gerar as ${gaps.length} sections sugeridas, re-empacotar ZIP.`);
  }
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
