---
name: inline-customization
description: Personalização (Nome+Número) e patches inline na PDP — sem drawer lateral. Usar quando o user pede "Personalização direto na página igual Mantos do PH" ou "patches em cards visuais com foto/preço". Suporta exceção por título (ex Voltz Brasil 2026 mantém drawer).
argument-hint: "[nome do cliente]"
---

# Inline Customization

Refactora PDP de tema Lever/Dawn pra mover personalização e patches do drawer lateral pra DENTRO do form. Padrão Voltz Club 2026-04-30.

## Pré-requisitos

- Tema com `snippets/product-variant-picker.liquid` + `customization-inputs.liquid` (drawer atual) + `patch-script.liquid` + `sections/custom-patch-rules.liquid` (popula `window.customPatchRules`).
- Produto com option `Personalizar` (valores `Personalizar`/`Não Personalizar`) — variant `Com` mais cara que `Sem` (`feedback_pricing_increments`).
- Patches: produtos com title começando com "Patch"/"Patches", ACTIVE + publicados. Regras em `templates/product.json` blocks `patch_rule_*`.

## Como aplicar

1. **Apender** (não substituir) bloco em `snippets/product-variant-picker.liquid` após `</variant-selects>`:
   - `#aparecer` (Nome + Núm grid 2-col, escondido via `removeContainerPersonalizar`)
   - `#patch-toggle-block` (toggle Não/Sim com `+R$X` lido do menor `variants[0].price` dos patches matched)
   - `#custom-patch-grid` (cards com img/title/price + selected state — escondido até user clicar Sim)
   - `#patch-unavailable` (mensagem "produto não tem patches" — só aparece após Sim se vazio)
   - `#patch-extra-price` (label verde `+ R$ X (patch)` quando user escolhe um)
2. **Filtro de exceção** (opcional): envolver bloco em `{% unless is_exception %}` baseado em title regex; gatear `customization-inputs.liquid` em `{% if is_exception %}` (drawer só pra exceção).
3. **JS lê `window.customPatchRules`** (NÃO depender de `renderDrawerPatches` — essa só existe quando drawer está renderizado): match keywords vs `product.title.toLowerCase()`, fetch `/products/<handle>.json` em paralelo, render cards.
4. **Patch ao cart**: line item separado via `setTimeout(fetch /cart/add.js, 900)` no click do "Adicionar ao Carrinho" + `properties[Patch]` (texto, visível) na camisa. Thumb da imagem do patch: salvar `localStorage.voltz_patch_thumbs[title.toLowerCase()] = imgUrl` na PDP, ler no cart-drawer.
5. **Validação submit**: bloquear se `Personalizar` checked mas Nome E Número vazios — `event.preventDefault()` + mensagem inline pequena ANTES do `.product-form__buttons` (não dentro do flex, senão deforma o botão).
6. **Promoção Bxgy**: ver `create-discount` "Fixar promoção EXISTENTE que está pegando patches" — patch line item conta em Bxgy se não filtrar.

## Pitfalls (regressão certa se ignorar)

1. **`/products/X.json` price em string reais** (`"50.00"`), não centavos. `parseFloat * 100` se `< 1000`.
2. **`/products/X.json` images[0] é objeto** `{src, alt, ...}`, não string. Usar `imgRaw.src || imgRaw.original_src || imgRaw.url`.
3. **MutationObserver no `.price-item--regular`** — Dawn re-renderiza preço ao trocar variant; observer modifica texto que dispara observer = **loop infinito trava a página**. Não tentar; usar elemento separado pra mostrar `+R$X (patch)`.
4. **Race detectar patches**: `patch-script` popula DOM com delay (~500ms). Ao clicar Sim, mostrar loader; após 2s decidir "indisponível".
5. **Title vs handle pra filtrar patches**: query `handle:patch*` pega camisas com "patch" no nome (ex `camisa-flamengo-patchs-libertadores`). SEMPRE filtrar por `title.startsWith('Patch')` ou `'Patches'`.
6. **Properties com `_` aparecem em checkout custom** (Yampi/CartPanda). NÃO usar `properties[_patch_image]` etc — usar localStorage ou ler do DOM.
7. **Event delegation obrigatório**: Dawn re-renderiza variant-selects e remove listeners diretos. Usar `document.addEventListener('change', e => e.target.matches(...) && handler())` em vez de `input.addEventListener`.

## Relacionado

`code-blocks` (propagar pra outras lojas) · `create-discount` (fix promo) · `lever-theme` (dev-first workflow) · `feedback_quantity_selector_rule` · `feedback_compare_at_2x_rule`.
