// Olhos finais (auditorias)
// - olho-excluded-from-promo: existe produto kit-casal? se sim, tem tag excluded-from-promo?
// - olho-snippet-isolado: cart-item-kit-casal existe E está sendo renderizado em cart-drawer?
// - olho-quantity-selector: regra preservada no cart-drawer
// - olho-properties-underscore: zero properties[_*] INTRODUZIDOS (kit-casal-variant-picker tem 1 pre-existente herdado de Mantos, safe pq Torcida tem checkout nativo)
// - olho-emoji: zero emoji em texto visível (regra: SVG icons OK)
//
// Também: fetch HTML de um produto pra confirmar storefront markers (mas sem produto kit-casal, esse teste fica pendente)
import fs from 'fs';
import { getCreds, shopifyGraphQL, shReq } from '../../../../.claude/lib/shopify-api.mjs';

const TORCIDA_UUID = '3a9a7bf6-e392-427c-ae73-0d2823dbe53f';
const TORCIDA_THEME = 128963772488;
const BASE = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19';
const AFTER = `${BASE}/torcida-after`;

(async () => {
  const c = await getCreds(TORCIDA_UUID);
  console.log(`=== AUDITS FINAIS — ${c.name} ===\n`);

  // --- olho-excluded-from-promo ---
  console.log('--- olho-excluded-from-promo ---');
  {
    const q = `query { products(first: 50, query: "tag:kit-casal OR title:kit casal") { edges { node { id title tags } } } }`;
    const r = await shopifyGraphQL(c.shop, c.token, q);
    const items = r.data?.products?.edges || [];
    if (items.length === 0) {
      console.log('  ⚠  ZERO produtos kit-casal — picker fica dormente até Pedro criar produto. Flag pro Boss.');
    } else {
      let ok = 0, missing = 0;
      for (const e of items) {
        const p = e.node;
        const hasKitCasal = p.tags.includes('kit-casal');
        const hasExcluded = p.tags.includes('excluded-from-promo');
        if (hasKitCasal && hasExcluded) ok++;
        else { missing++; console.log(`  ✗  ${p.title}: hasKitCasal=${hasKitCasal} hasExcluded=${hasExcluded}`); }
      }
      console.log(`  ${missing === 0 ? 'OK' : 'FAIL'}: ${ok}/${items.length} produtos com excluded-from-promo`);
    }
  }

  // --- olho-snippet-isolado ---
  console.log('\n--- olho-snippet-isolado ---');
  {
    const cartItemKit = `${AFTER}/snippets/cart-item-kit-casal.liquid`;
    const cartDrawer = fs.readFileSync(`${AFTER}/snippets/cart-drawer.liquid`, 'utf8');
    const exists = fs.existsSync(cartItemKit);
    const renderInDrawer = cartDrawer.includes("{% render 'cart-item-kit-casal'");
    console.log(`  ${exists && renderInDrawer ? 'OK' : 'FAIL'}: snippet existe=${exists}, renderizado=${renderInDrawer}`);
  }

  // --- olho-quantity-selector ---
  console.log('\n--- olho-quantity-selector ---');
  {
    const cartDrawer = fs.readFileSync(`${AFTER}/snippets/cart-drawer.liquid`, 'utf8');
    // Regra: só em camisas NÃO personalizadas E NÃO promocionais E NÃO patches
    // No código: if (is_personalized or is_patch or is_promo) então mostra is_personalized
    // Procurar pelo conditional original
    const hasRule = cartDrawer.includes('{%- if is_personalized or is_patch or is_promo -%}');
    console.log(`  ${hasRule ? 'OK' : 'FAIL'}: quantity selector regra preservada (is_personalized OR is_patch OR is_promo lock)`);
  }

  // --- olho-properties-underscore ---
  console.log('\n--- olho-properties-underscore ---');
  {
    const files = ['cart-item-kit-casal.liquid', 'cart-drawer.liquid', 'cart-progress-bar.liquid', 'product-variant-picker.liquid'];
    let introduced = 0;
    for (const f of files) {
      const src = fs.readFileSync(`${AFTER}/snippets/${f}`, 'utf8');
      const matches = (src.match(/name=["']properties\[_/g) || []).length;
      if (matches > 0) introduced += matches;
    }
    // kit-casal-variant-picker has 1 pre-existing (heritage from Mantos PH, _pair_count) — separate
    const picker = fs.readFileSync(`${AFTER}/snippets/kit-casal-variant-picker.liquid`, 'utf8');
    const pickerProps = (picker.match(/name=["']properties\[_/g) || []).length;
    console.log(`  ${introduced === 0 ? 'OK' : 'FAIL'}: zero properties[_*] introduzidos em arquivos modificados`);
    console.log(`  INFO: kit-casal-variant-picker tem ${pickerProps} properties[_*] herdado da Mantos PH (Torcida usa checkout Shopify nativo — não vaza)`);
  }

  // --- olho-emoji-visivel ---
  console.log('\n--- olho-emoji-visivel ---');
  {
    // Same regex from validate-proposed (excluindo SVGs/scripts/styles/liquid tags)
    const stripIrrelevant = (src) => {
      let s = src;
      s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
      s = s.replace(/<svg\b[\s\S]*?<\/svg>/gi, '');
      s = s.replace(/{%[\s\S]*?%}/g, '');
      s = s.replace(/{{[\s\S]*?}}/g, '');
      return s;
    };
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F9FF}]/gu;
    const files = ['kit-casal-variant-picker.liquid', 'cart-item-kit-casal.liquid', 'cart-drawer.liquid', 'product-variant-picker.liquid'];
    // exclude cart-progress-bar (pre-existing ✓ that was already there)
    let totalIntroduced = 0;
    for (const f of files) {
      const after = stripIrrelevant(fs.readFileSync(`${AFTER}/snippets/${f}`, 'utf8'));
      const matches = after.match(emojiRe) || [];
      // For PATCH files, compare against before
      const beforePath = `${BASE}/torcida-before/snippets/${f}`;
      const mantosPath = `${BASE}/mantos-source/snippets/${f}`;
      let preExisting = 0;
      if (fs.existsSync(beforePath)) {
        preExisting = (stripIrrelevant(fs.readFileSync(beforePath, 'utf8')).match(emojiRe) || []).length;
      } else if (fs.existsSync(mantosPath)) {
        preExisting = (stripIrrelevant(fs.readFileSync(mantosPath, 'utf8')).match(emojiRe) || []).length;
      }
      const introduced = matches.length - preExisting;
      if (introduced > 0) {
        totalIntroduced += introduced;
        console.log(`  ✗ ${f}: ${introduced} emojis novos`);
      }
    }
    console.log(`  ${totalIntroduced === 0 ? 'OK' : 'FAIL'}: zero emojis INTRODUZIDOS em texto visível`);
  }

  // --- olho-storefront-markers (skipped sem produto kit-casal) ---
  console.log('\n--- olho-storefront-markers ---');
  console.log('  ⏸  PENDENTE: sem produto kit-casal na Torcida, picker não renderiza. Markers (data-kit-section, data-kit-mode, "Tamanho Masculino", etc) só vão aparecer quando produto for criado.');

  console.log('\n=== AUDITS CONCLUÍDOS ===');
})().catch(e => { console.error(e); process.exit(1); });
