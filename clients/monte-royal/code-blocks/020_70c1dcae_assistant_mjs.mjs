// Gera o templates/index.json adaptado pro MontRoyal:
// - sequência masculina exclusiva, sem placeholders
// - cada featured-collection aponta pra coleção real e populada
// - inclui um "Capítulo Gold" com produtos curados manualmente

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const NORD_INDEX = path.join(REPO_ROOT, 'themes/client-3555185d/templates/index.json');
const TARGET = path.join(REPO_ROOT, 'themes/client-d9e577c9/templates/index.json');

const nord = JSON.parse(fs.readFileSync(NORD_INDEX, 'utf8'));

// Produtos do Capítulo Gold (curadoria manual)
const GOLD_CHAPTER = [
  'gid://shopify/Product/9327497609404', // oceanus (AP RO)
  'gid://shopify/Product/9327499411644', // tourbillon (AP RO Chrono)
  'gid://shopify/Product/9327499378876', // atlas (rose gold w/ leather)
  'gid://shopify/Product/9327497543868', // etienne (Cartier Crash)
];

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function rid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

function buildAdaptedIndex() {
  const sections = {};
  const order = [];

  // 1. SLIDESHOW HERO
  const nordSlideshow = Object.entries(nord.sections).find(([id, s]) => s.type === 'slideshow');
  if (nordSlideshow) {
    const id = rid('slideshow');
    sections[id] = clone(nordSlideshow[1]);
    order.push(id);
  }

  // 2. COLLECTION-LIST overview (3 cards: Best-Sellers, Men's, Automatic)
  const nordCL = Object.entries(nord.sections).find(([id, s]) => s.type === 'collection-list');
  if (nordCL) {
    const id = rid('collection_list');
    const cloned = clone(nordCL[1]);
    const cardKeys = Object.keys(cloned.blocks).filter(k => cloned.blocks[k].type === 'collection-card');
    const cardTemplate = cardKeys[0] ? clone(cloned.blocks[cardKeys[0]]) : null;
    for (const k of cardKeys) delete cloned.blocks[k];
    cloned.block_order = (cloned.block_order || []).filter(k => !cardKeys.includes(k));

    const overview = [
      { handle: 'watches', label: 'Best-Sellers' },
      { handle: 'mens-watches', label: "Men's Watches" },
      { handle: 'automatic-watches', label: 'Automatic' },
    ];
    for (const item of overview) {
      if (!cardTemplate) break;
      const cardId = rid('collection_card');
      const card = clone(cardTemplate);
      card.settings.collection = item.handle;
      card.settings.image = '';
      card.settings.title = '';
      cloned.blocks[cardId] = card;
      cloned.block_order.unshift(cardId);
    }

    if (cloned.blocks['section-header']) {
      cloned.blocks['section-header'].settings.title = 'BUILT FOR THE CLIMB';
      cloned.blocks['section-header'].settings.content = '<p>Watches for the man on his way up</p>';
    }
    cloned.settings.items_per_row = 3;
    sections[id] = cloned;
    order.push(id);
  }

  // 3-7. FEATURED COLLECTIONS (5 sections, ordem estratégica)
  const nordFC = Object.entries(nord.sections).find(([id, s]) => s.type === 'featured-collections');

  const featuredColls = [
    { handle: 'watches', title: 'Best-Sellers', content: '<p>Where most men start. Our most-loved timepieces.</p>' },
    { handle: 'mens-watches', title: "Men's Watches", content: '<p>The full collection. Every piece, refined for the modern gentleman.</p>' },
    { handle: 'automatic-watches', title: 'Automatic', content: '<p>For the connoisseur. Mechanical movements, no compromise.</p>' },
    { handle: 'quartz-watches', title: 'Quartz', content: '<p>Precision in every second. Built to last.</p>' },
    { handle: 'watch-accessories', title: 'The Essentials', content: '<p>The small details that complete the piece.</p>' },
  ];

  // Insere Capítulo Gold ENTRE automatic e quartz (posição estratégica: depois do "for connoisseurs")
  for (let i = 0; i < featuredColls.length; i++) {
    const fc = featuredColls[i];
    if (!nordFC) break;
    const id = rid('featured_collections');
    const cloned = clone(nordFC[1]);
    const collBlockKey = Object.keys(cloned.blocks).find(k => cloned.blocks[k].type === 'collection');
    if (collBlockKey) {
      const newKey = rid('collection');
      cloned.blocks[newKey] = clone(cloned.blocks[collBlockKey]);
      cloned.blocks[newKey].settings.collection = fc.handle;
      cloned.blocks[newKey].settings.title = fc.title;
      cloned.blocks[newKey].settings.content = fc.content;
      if (newKey !== collBlockKey) delete cloned.blocks[collBlockKey];
      cloned.block_order = [newKey];
    }
    sections[id] = cloned;
    order.push(id);

    // Depois da seção automatic (índice 2), insere o Capítulo Gold
    if (i === 2) {
      const goldId = rid('featured_product_list');
      sections[goldId] = {
        type: 'featured-product-list',
        blocks: {
          'section-header': {
            type: '_section-header',
            static: true,
            settings: {
              subheading: 'THE GOLD CHAPTER',
              title: 'Reserved for the few',
              content: '<p>Four pieces. Carefully chosen. Where gold is not an accessory — it is the language.</p>',
              button_text: '',
              button_link: '',
              button_style: 'outline',
              text_alignment: 'center',
              heading_size: 'h3',
              title_icon: 'none',
              show_scrolling_title: false,
            },
            blocks: {},
          },
        },
        block_order: [],
        settings: {
          color_scheme: 'scheme-1',
          product_list: GOLD_CHAPTER,
          stack_products_mobile: false,
          stack_products_desktop: true,
          products_per_row_mobile: '2',
          products_per_row_desktop: 4,
          show_view_all_button: false,
        },
      };
      order.push(goldId);
    }
  }

  // 8. TESTIMONIALS
  const nordTestim = Object.entries(nord.sections).find(([id, s]) => s.type === 'testimonials');
  if (nordTestim) {
    const id = rid('testimonials');
    sections[id] = clone(nordTestim[1]);
    order.push(id);
  }

  // 9. CUSTOMER REVIEWS (mantém se a Nord tem)
  const nordReviews = Object.entries(nord.sections).find(([id, s]) => s.type === 'customer-reviews');
  if (nordReviews) {
    const id = rid('customer_reviews');
    sections[id] = clone(nordReviews[1]);
    order.push(id);
  }

  return { sections, order };
}

const adapted = buildAdaptedIndex();

console.log('=== Adapted index.json ===');
console.log('Total sections:', Object.keys(adapted.sections).length);
console.log('\nOrdem:');
adapted.order.forEach((id, i) => {
  const s = adapted.sections[id];
  const blocks = s.blocks ? Object.keys(s.blocks).length : 0;
  const colls = new Set();
  const find = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'collection' && typeof v === 'string') colls.add(v);
      else find(v);
    }
  };
  find(s);
  const productList = s.settings?.product_list ? `[${s.settings.product_list.length} produtos]` : '';
  console.log(`  ${i+1}. ${s.type.padEnd(28)} | blocks=${blocks} | colls=[${[...colls].join(', ')}] ${productList}`);
});

fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, JSON.stringify(adapted, null, 2));
console.log(`\n✓ Salvo em ${TARGET}`);

