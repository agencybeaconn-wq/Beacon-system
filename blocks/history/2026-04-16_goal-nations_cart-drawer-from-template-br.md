# Bloco: Cart Drawer completo do Template BR → Goal Nations (EN)

## Operação
- **Data:** 2026-04-16
- **Origem:** Template BR (testeloja-9899.myshopify.com), theme 160282804466 "Tema Lever Atualizado 18/03"
- **Destino:** Goal Nations (nghke7-in.myshopify.com), theme 148780482713 "Lever | GoalNations" (publicado)
- **Idioma:** BR → EN (tradução automática via script de replacements)
- **Validação:** 100% (validateAll em todos 6 arquivos)
- **Status:** Aplicado (PUT 200 em todos)

## Por que BR e não Template EN
- Template EN tem cart drawer funcional mas mais simples (versão TG Jersey)
- Template BR tem features mais completas (breakdown por item, banner de cupom, badge FREE, patch thumbnails, You're saving)
- Usuário preferiu BR + tradução vs EN pronto

## Arquivos propagados (6)
| Arquivo | Antes (GN) | Depois | Diff |
|---|---|---|---|
| sections/cart-drawer.liquid | 30b | 29b | idêntico (wrapper) |
| snippets/cart-drawer.liquid | 17.9KB | 37.5KB | +19.6KB (dobrou) |
| snippets/cart-progress-bar.liquid | 13.7KB | 15.9KB | +2.2KB |
| snippets/icon-home.liquid | 0b (404) | 447b | NOVO |
| assets/cart-drawer.js | 4.3KB | 4.3KB | refresh |
| assets/cart-progress-bar.js | 3.2KB | 4.1KB | +0.9KB |

## Traduções aplicadas (script `c:/tmp/cart-copy/translate.mjs`)
### User-facing
- Seu carrinho está vazio → Your cart is empty
- CONTINUAR COMPRANDO → CONTINUE SHOPPING
- Continuar comprando → Continue shopping
- 🎁 GRÁTIS → 🎁 FREE
- Qtd → Qty
- Diminuir/Aumentar quantidade → Decrease/Increase quantity
- Camisa → Jersey
- Personalização → Customization
- Você está economizando → You're saving
- FINALIZAR COMPRA → CHECKOUT

### Property keys (Liquid) — MATCH com customization-inputs.liquid EN do GN
- `['Posição']` → `['Position']`
- `['Nome']` → `['Name']`
- `['Número']` / `['Numero']` → `['Number']`
- `['Jogador']` → `['Player']`
- `'Manga'` → `'Sleeve'`, `'Peito'` → `'Chest'`

### Option value detection (Customize toggle)
- `val_lc == 'com personalização'` → `val_lc == 'customize'`

### Moeda/ajustes
- `pers_fee = 2000` (R$20 cents) → `pers_fee = 500` ($5 USD cents) — corresponde ao acréscimo "Personalização (Nome e Número)" da tabela Goal Nations

## Features trazidas do BR (novas no GN)
- Banner verde com ícone de tag pra cupom aplicado (`cart.total_discount > 0`)
- Total riscado (preço antes do desconto) no rodapé
- "💰 You're saving $X" no rodapé quando tem economia
- Quantity selector inline +/- com SVG (em itens pagos não-personalizados)
- Qty hidden em itens personalizados (`is_customized`) e grátis (`final_price == 0`)
- Patch thumbnails com imagem + nome + preço ao lado
- Breakdown por item: Jersey + Patches + Customization + Total (quando tem extras)
- Patch pairing system (remove patches quando remove camisa pai via `_pairing_id`)
- Cleanup automático de patches órfãos no cart:refresh

## Arquivos NÃO copiados (scope mínimo)
- `snippets/customization-inputs.liquid` — já tem EN no GN, mudanças seriam massivas
- `assets/cart-progress-bar.css`, `assets/component-cart-drawer.css` — GN tem versões similares em tamanho
- `assets/cart-drawer.js` — foi substituído mesmo sendo similar, garantia de consistência
- `templates/cart.json` — cart page template, não é drawer

## Pontos que usuário pediu atenção (pós-apply, pra confirmar)
1. Seletor de quantidade aparece em itens normais ✓ (código linha 402-442)
2. Itens personalizados não têm seletor ✓ (`is_customized == false` gate)
3. Itens personalizados não são de promoção — está no layout com `cart-item--parent`
4. Fotos dos patches aparecem ✓ (linha 494-510)
5. Size e Customize empilhados — já é default (loop `options_with_values` cria um `<div>` por option)
6. Total aparece ✓ (linha 675-690)
7. **Milestone 2 message** — cart-progress-bar.liquid do BR tem lógica fallback, mas config fica no theme editor (`config/settings_data.json` — NÃO copiado). Se aparecer vazio, usuário precisa abrir Theme Editor → Cart drawer → configurar `message_2` manualmente.

## Validações executadas
- `validateLiquid` — OK em todos liquid
- `validateJS` — OK em todos js
- `validateLeverPitfalls` — OK:
  - checkout button usa `<button type="submit" form="CartDrawer-Form">` (não `<a href="/checkout">`)
  - classe no checkout é `cart__checkout-button` (sem classe `button` extra)
  - `lever-protection` não é tocada por esses arquivos

## Candidato?
Não — é reaproveitamento do Template BR existente pra cliente EN. O Template EN já tem sua versão oficial (outra origem, mais enxuta). Ambos coexistem até decisão do colaborador sobre unificação.

## Lições
- Traduzir BR→EN é viável via script de replacements se tradução for conservadora (labels e keys). Preço hardcoded (pers_fee) requer conversão de moeda manual.
- Backup automático com `backupAsset` falhou (`shopFn is not a function`) — bug na lib. PUT foi direto; pode voltar se precisar via histórico anterior.
- Tamanho do cart-drawer dobrou (17→37KB) — user tinha razão que BR era "muito mais completo".
