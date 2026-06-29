# cart-drawer

Cart drawer lateral completo, versão Lever do Dawn.

## Origem
- **Loja**: Golaço (`smyvkp-2j.myshopify.com`)
- **Extraído em**: 2026-04-11

## O que faz

Drawer completo de carrinho com features proprietárias Lever:

- **Progress bar** no topo (renderiza `{% render 'cart-progress-bar' %}`)
- **Botões + / −** inline em cada item (JS listener no document)
- **Item grátis (R$0)** com badge "🎁 GRÁTIS" + preço original riscado
- **Patches thumbnail** — lê `item.properties['_patch_images']` (pipe-separated URLs), renderiza 24×24 na base do line item
- **Propriedades line-item empilhadas** — Qtd → Tamanho → Nome → Número → Patches → Posição → upload
- **Banner verde** do cupom ativo (lê `cart.discount_applications`)
- **TOTAL em caixa-alta** 2.4rem bold
- **Riscado vermelho** mostrando quanto economizou (soma de `compare_at_price - final_price`)
- **Badge** "💰 Você está economizando R$X! 🎉"
- **FINALIZAR COMPRA** verde (#22c55e) full-width uppercase

## Arquivos
```
cart-drawer.liquid  → snippets/cart-drawer.liquid
```

## Dependências
- Requer bloco `cart-progress-bar` instalado
- Requer `cart.js` (do Dawn) + `quantity-popover.js` (do Dawn)
- CSS: `quantity-popover.css`, `component-card.css`, `component-cart-drawer.css` (Dawn) + `cart-progress-bar.css`
- Snippets Dawn: `icon-close.svg`, `icon-remove.svg`, `icon-caret.svg`, `icon-discount.svg`, `icon-error.svg`

## Settings necessários
- `cart_color_scheme` (color_scheme)
- `show_cart_note` (boolean)
- `cart_drawer_collection` (collection — mostrada quando carrinho vazio)

## Como aplicar

```js
// 1. Upload
await uploadAsset(theme, 'snippets/cart-drawer.liquid', readFile('blocks/cart-drawer/cart-drawer.liquid'));

// 2. Garantir que sections/cart-drawer.liquid existe (geralmente é só 1 linha)
await uploadAsset(theme, 'sections/cart-drawer.liquid', `{% render 'cart-drawer' %}`);

// 3. Garantir settings.cart_type = 'drawer' em config/settings_data.json
```

## Pitfalls

- **Line item property `_patch_images`** é Lever-specific — lojas sem patch workflow não vão usar
- **CSS inline pesado** (~4KB de estilos dentro do liquid `<style>`) — candidato a extrair pra CSS externo v2
- **JS de qty btns** é inline no fim do arquivo, não em asset separado — candidato a extrair

## i18n
- Textos PT: "Seu carrinho está vazio", "CONTINUAR COMPRANDO", "Qtd:", "GRÁTIS", "FINALIZAR COMPRA", "Continuar comprando"
- Algumas strings já usam `{{ 'sections.cart.xxx' | t }}` (locales) — outras estão hard-coded
- Status: **i18n: parcial**

## Relacionado
- [../cart-progress-bar/manifest.md](../cart-progress-bar/manifest.md)
- [../../../Inteligencia lever/Lever QI/Shopify/blocos/cart-drawer.md](../../../Inteligencia lever/Lever QI/Shopify/blocos/cart-drawer.md)
