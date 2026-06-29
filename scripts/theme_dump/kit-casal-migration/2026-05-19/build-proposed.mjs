// Builds the proposed files in torcida-after-proposed/ from source files
// Phase 2 - local build only, no writes yet
import fs from 'fs';
import path from 'path';

const BASE = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/theme_dump/kit-casal-migration/2026-05-19';
const PROPOSED = `${BASE}/torcida-after-proposed`;
const MANTOS = `${BASE}/mantos-source`;
const TORCIDA = `${BASE}/torcida-before`;

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, content) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); console.log(`  wrote ${p.replace(BASE, '.')} (${content.length} bytes)`); }

// ============================================================
// FILE 1: snippets/kit-casal-variant-picker.liquid (NEW)
// Cópia 1:1 do Mantos, EXCETO removendo o {% render 'size-chart' %} (snippet não existe na Torcida)
// ============================================================
{
  let src = read(`${MANTOS}/snippets/kit-casal-variant-picker.liquid`);
  // Remove the {% render 'size-chart' %} block (and surrounding comment) since Torcida has no size-chart snippet (uses size-chart-drawer section instead)
  const sizeChartBlock = `  {%- comment -%} Modal da Tabela de Medidas (define overlay + JS com window.openSizePanel) {%- endcomment -%}
  {% render 'size-chart' %}`;
  if (!src.includes(sizeChartBlock)) {
    throw new Error('size-chart render block NOT FOUND in mantos picker — abort');
  }
  src = src.replace(sizeChartBlock, `  {%- comment -%} size-chart render omitido — Torcida usa sections/size-chart-drawer.liquid em vez do snippet; botão fica clicável sem ação (fallback silencioso) {%- endcomment -%}`);
  write(`${PROPOSED}/snippets/kit-casal-variant-picker.liquid`, src);
}

// ============================================================
// FILE 2: snippets/cart-item-kit-casal.liquid (NEW)
// Construído próprio: grid masc/fem azul/rosa Mantos-style, mas usando classes Torcida-style (.cart-item__prop)
// O cart-drawer da Torcida usa <div class="cart-item__props"> em vez de <dl class="cart-item__properties">
// Vou criar um snippet que substitui o bloco de properties pelo grid quando kit-casal
// ============================================================
{
  const content = `{% comment %}
  Renders kit-casal cart line items (masculine + feminine grid)
  Replaces the default <div class="cart-item__props"> for kit-casal products.
  Adapted to Loja da Torcida cart drawer structure (<ul><li>, .cart-item__props).

  Accepts:
  - item: cart line item

  Usage:
  {% render 'cart-item-kit-casal', item: item %}
{% endcomment %}

{%- liquid
  assign tam_masc = ''
  assign tam_fem = ''
  for option in item.options_with_values
    case option.name
      when 'Tamanho Masculino'
        assign tam_masc = option.value
      when 'Tamanho Feminino'
        assign tam_fem = option.value
      when 'Tamanho'
        assign tam_combined = option.value | strip
        assign tam_parts = tam_combined | split: '/'
        if tam_parts.size >= 2
          assign tam_masc = tam_parts[0] | strip
          assign tam_fem = tam_parts[1] | strip
        endif
    endcase
  endfor
  assign nome_masc = item.properties['Nome Masculino']
  assign num_masc  = item.properties['Número Masculino']
  assign nome_fem  = item.properties['Nome Feminino']
  assign num_fem   = item.properties['Número Feminino']
-%}

<div class="kit-casal-cart-grid">
  <div class="kit-casal-cart-col kit-casal-cart-col--masc">
    <p class="kit-casal-cart-title">Camisa Masculina</p>
    <dl class="kit-casal-cart-props">
      <div class="kit-casal-cart-prop"><dt>Tamanho:</dt><dd>{{ tam_masc }}</dd></div>
      <div class="kit-casal-cart-prop"><dt>Personalização:</dt><dd>
        {%- if nome_masc != blank or num_masc != blank -%}
          {{ nome_masc }}{% if num_masc != blank %} {{ num_masc }}{% endif %}
        {%- else -%}Não{%- endif -%}
      </dd></div>
    </dl>
  </div>
  <div class="kit-casal-cart-col kit-casal-cart-col--fem">
    <p class="kit-casal-cart-title">Camisa Feminina</p>
    <dl class="kit-casal-cart-props">
      <div class="kit-casal-cart-prop"><dt>Tamanho:</dt><dd>{{ tam_fem }}</dd></div>
      <div class="kit-casal-cart-prop"><dt>Personalização:</dt><dd>
        {%- if nome_fem != blank or num_fem != blank -%}
          {{ nome_fem }}{% if num_fem != blank %} {{ num_fem }}{% endif %}
        {%- else -%}Não{%- endif -%}
      </dd></div>
    </dl>
  </div>
</div>

<style>
  .kit-casal-cart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    margin: 0.4rem 0 0.2rem;
    border-radius: 0.6rem;
    overflow: hidden;
  }
  .kit-casal-cart-col {
    padding: 0.8rem 1rem;
    border-radius: 0.5rem;
    border: 2px solid transparent;
  }
  .kit-casal-cart-col--masc {
    background: #dbeafe;
    border-color: #2563eb;
  }
  .kit-casal-cart-col--fem {
    background: #fbcfe8;
    border-color: #ec4899;
  }
  .kit-casal-cart-title {
    font-size: 1.05rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin: 0 0 0.35rem;
    line-height: 1.2;
  }
  .kit-casal-cart-col--masc .kit-casal-cart-title { color: #1e40af; }
  .kit-casal-cart-col--fem  .kit-casal-cart-title { color: #9d174d; }
  .kit-casal-cart-props { margin: 0; padding: 0; }
  .kit-casal-cart-prop {
    font-size: 1.15rem;
    line-height: 1.35;
    margin: 0.15rem 0;
  }
  .kit-casal-cart-prop dt { display: inline; color: #555; font-weight: 500; margin: 0; }
  .kit-casal-cart-prop dd { display: inline; margin-left: 0.3rem; color: #111; font-weight: 600; }
</style>
`;
  write(`${PROPOSED}/snippets/cart-item-kit-casal.liquid`, content);
}

// ============================================================
// FILE 3: snippets/product-variant-picker.liquid (PATCH)
// Add wrap if/else delegating kit-casal products to the new snippet, keep everything else intact
// ============================================================
{
  const src = read(`${TORCIDA}/snippets/product-variant-picker.liquid`);
  // Find first non-comment Liquid block (the {%- unless product.has_only_default_variant -%}) and wrap everything from there until end of relevant block
  // We don't want to touch the {% comment %} header or the trailing scripts/styles which are global (mask, inline-customization-state).
  // The delegation only needs to wrap the <variant-selects> block (lines 11-123 of original)
  // We'll wrap from {%- unless product.has_only_default_variant -%} to the matching {%- endunless -%}
  const startMarker = '{%- unless product.has_only_default_variant -%}';
  const endMarker = `{%- endunless -%}

<!-- Campos e Aviso (escondidos por padrão) -->`;
  if (!src.includes(startMarker)) throw new Error('startMarker not found in product-variant-picker');
  if (!src.includes(endMarker)) throw new Error('endMarker not found in product-variant-picker');

  // Replace startMarker -> add wrapper {% if product.tags contains 'kit-casal' %}{% render ... %}{% else %} + startMarker
  // And replace endMarker -> {%- endunless -%}{% endif %}
  const newStart = `{%- if product.tags contains 'kit-casal' -%}
  {% render 'kit-casal-variant-picker', product: product, block: block, product_form_id: product_form_id, section: section %}
{%- else -%}
${startMarker}`;
  const newEnd = `{%- endunless -%}
{%- endif -%}

<!-- Campos e Aviso (escondidos por padrão) -->`;

  // Important: wrap MUST cover the entire <variant-selects>...customization-inputs block
  // but NOT the trailing #aparecer / patches / scripts (global for non-kit products only)
  // Actually... if it's kit-casal, the inline-customization stuff (#aparecer) shouldn't run either.
  // But it's harmless: #aparecer hides by default (display:none) and only shows when "Personalizar" option is selected — kit-casal products don't have an option named "Personalizar" (they have "Personalização" with values Nenhum/Só M/Só F/Ambos).
  // The isPersonalizarValue script checks for option values containing "personalizar" or "sim/yes" — kit casal has "Personalização" (note the "ção" ending) and "Só Masculina" etc. The legend matcher uses /\b(personalizar|customize)\b/ word-boundary, so "Personalização" with cedilla won't match. Safe.
  // -> only wrap variant-selects block
  let proposed = src.replace(startMarker, newStart);
  proposed = proposed.replace(endMarker, newEnd);

  // Sanity: ensure exactly 1 occurrence each
  const countStart = (proposed.match(new RegExp("{%- if product.tags contains 'kit-casal' -%}", 'g')) || []).length;
  if (countStart !== 1) throw new Error(`Expected 1 if-wrap, found ${countStart}`);

  write(`${PROPOSED}/snippets/product-variant-picker.liquid`, proposed);
}

// ============================================================
// FILE 4: snippets/cart-drawer.liquid (PATCH)
// Inject: (a) badge "KIT CASAL" inside .cart-item__head, after the title anchor
//         (b) wrap properties block: kit-casal -> render snippet, else -> default props
// ============================================================
{
  const src = read(`${TORCIDA}/snippets/cart-drawer.liquid`);

  // (a) Badge: insertion after the <a> closing tag of cart-item__name. Anchor:
  //    <a href="{{ item.url }}" class="cart-item__name">{{- item.product.title | escape -}}</a>
  // We'll wrap with kit-casal-tag right after.
  const titleAnchor = `<a href="{{ item.url }}" class="cart-item__name">{{- item.product.title | escape -}}</a>`;
  if (!src.includes(titleAnchor)) throw new Error('cart-drawer title anchor not found');
  const badgeInjection = `<a href="{{ item.url }}" class="cart-item__name">{{- item.product.title | escape -}}</a>
                    {%- if item.product.tags contains 'kit-casal' -%}
                      <span class="kit-casal-tag" aria-label="Kit Casal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                        <span>KIT CASAL</span>
                      </span>
                    {%- endif -%}`;
  let proposed = src.replace(titleAnchor, badgeInjection);

  // (b) Wrap the <dl class="cart-item__props">...</dl> with if/else for kit-casal
  // Anchor block (full block):
  const propsBlockAnchor = `                  {%- if item.product.has_only_default_variant == false or item.properties.size != 0 -%}
                    <dl class="cart-item__props">`;
  if (!proposed.includes(propsBlockAnchor)) throw new Error('cart-drawer props block start not found');

  // Inject inner if-else: keep the outer "if has_only_default_variant == false or properties.size != 0", then check kit-casal
  const propsBlockReplacement = `                  {%- if item.product.has_only_default_variant == false or item.properties.size != 0 -%}
                    {%- if item.product.tags contains 'kit-casal' -%}
                      {% render 'cart-item-kit-casal', item: item %}
                    {%- else -%}
                    <dl class="cart-item__props">`;
  proposed = proposed.replace(propsBlockAnchor, propsBlockReplacement);

  // Close the else branch right before the closing </dl> of cart-item__props
  // The original closing pattern (with </dl> followed by {%- endif -%}):
  const propsBlockClose = `                    </dl>
                  {%- endif -%}

                  <ul class="discounts list-unstyled" role="list">`;
  if (!proposed.includes(propsBlockClose)) throw new Error('cart-drawer props block close anchor not found');
  const propsBlockCloseReplacement = `                    </dl>
                    {%- endif -%}
                  {%- endif -%}

                  <ul class="discounts list-unstyled" role="list">`;
  proposed = proposed.replace(propsBlockClose, propsBlockCloseReplacement);

  // (c) Append CSS for the kit-casal-tag at end of file (before the last </cart-drawer>)
  // The .kit-casal-tag style needs to live in the cart drawer scope.
  const closingMarker = `</cart-drawer>`;
  if (!proposed.includes(closingMarker)) throw new Error('cart-drawer closing tag not found');
  const tagStyles = `
<style>
  /* KIT-CASAL-TAG-CART (Loja da Torcida 2026-05-19) */
  cart-drawer .kit-casal-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: linear-gradient(90deg, #2563eb 0%, #ec4899 50%, #2563eb 100%);
    background-size: 200% 100%;
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    margin-left: 0.6rem;
    white-space: nowrap;
    animation: kit-tag-shift 2.4s linear infinite;
    flex-shrink: 0;
  }
  cart-drawer .kit-casal-tag svg { flex-shrink: 0; }
  @keyframes kit-tag-shift {
    0% { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }
  /* Mantém título flexível pra tag caber */
  cart-drawer .cart-item__head .cart-item__name {
    flex: 1 1 auto;
    min-width: 0;
  }
</style>
${closingMarker}`;
  proposed = proposed.replace(closingMarker, tagStyles);

  write(`${PROPOSED}/snippets/cart-drawer.liquid`, proposed);
}

// ============================================================
// FILE 5: snippets/cart-progress-bar.liquid (PATCH)
// Add `if tags contains 'kit-casal' assign is_shirt = false` after the patches detection block
// ============================================================
{
  const src = read(`${TORCIDA}/snippets/cart-progress-bar.liquid`);
  // Use regex tolerant of CRLF (Torcida file has \r\n line endings) — but capture and reuse the EOL to preserve original line endings
  const re = /(       endunless\r?\n    endif\r?\n)(\r?\n    if is_shirt)/;
  if (!re.test(src)) throw new Error('cart-progress-bar anchor not found (regex)');
  const proposed = src.replace(re, (m, head, tail) => {
    // Detect EOL from head (preserves CRLF if input has it)
    const eol = head.includes('\r\n') ? '\r\n' : '\n';
    const inj = `${head}${eol}    # Kit Casal: já é promoção à parte, não conta nos milestones${eol}    if item.product.tags contains 'kit-casal'${eol}      assign is_shirt = false${eol}    endif${eol}${tail}`;
    return inj;
  });
  if (proposed === src) throw new Error('cart-progress-bar patch failed (no change)');

  write(`${PROPOSED}/snippets/cart-progress-bar.liquid`, proposed);
}

console.log('\n=== All 5 proposed files built ===');
