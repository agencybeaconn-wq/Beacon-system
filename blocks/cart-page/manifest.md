# cart-page

Template de página `/cart` Lever — usada como secundária (fluxo principal é drawer) mas precisa existir pra quem digita URL direto.

## Origem
- **Loja**: Golaço (`smyvkp-2j.myshopify.com`)
- **Extraído em**: 2026-04-11

## O que contém
Três arquivos que compõem a página `/cart`:

1. **`cart.json`** → `templates/cart.json` — layout JSON com 2 sections (items + footer)
2. **`main-cart-items.liquid`** → `sections/main-cart-items.liquid` — listagem dos itens + promo badge topo
3. **`main-cart-footer.liquid`** → `sections/main-cart-footer.liquid` — subtotal, total, shipping calculator, CTA

## Features
- **Promo banner topo** ("🔥 PROMOÇÃO ESPECIAL - 50% OFF · Leve 4 pague 2 · ou · Leve 6 pague 3")
- **Cart progress bar** via `{% render 'cart-progress-bar' %}`
- **Shipping calculator** via bloco `shipping_calculator`
- **Checkout button** estilizado (green #22c55e, rounded 12px, uppercase bold 1.8rem)

## Arquivos
```
cart.json                → templates/cart.json
main-cart-items.liquid   → sections/main-cart-items.liquid
main-cart-footer.liquid  → sections/main-cart-footer.liquid
```

## Dependências
- Bloco `cart-progress-bar` instalado
- Bloco `shipping-calculator` instalado
- CSS Dawn: `component-cart.css`, `component-cart-items.css`, `component-totals.css`, `component-price.css`, `component-discounts.css`
- JS: `cart.js` (Dawn), `quantity-popover.js` (Dawn), `cart-progress-bar.js`

## Configuração do cart.json

```json
{
  "sections": {
    "cart-items": { "type": "main-cart-items", "settings": { "padding_top": 36, "padding_bottom": 36 } },
    "cart-footer": {
      "type": "main-cart-footer",
      "blocks": {
        "subtotal": { "type": "subtotal" },
        "buttons": { "type": "buttons" },
        "shipping_calculator": {
          "type": "shipping_calculator",
          "settings": {
            "title": "Calcule O Frete E Prazo De Entrega",
            "subtitle": "Simule com seu CEP",
            "option_1_title": "Frete Padrão Grátis (7 a 15 dias )",
            "option_2_title": "Frete Expresso - R$27,90 (6 a 9 dias )"
          }
        }
      },
      "block_order": ["subtotal", "buttons", "shipping_calculator"]
    }
  },
  "order": ["cart-items", "cart-footer"]
}
```

## Pitfalls
- **Promo banner texto hard-coded** — mover pra settings no v2
- Frete option_1/option_2 são só labels, **não conectam** a real shipping rates
- Alguns CSS inline via `<style>` dentro do liquid — candidatos a extrair

## i18n
- Status: **parcial** — usa `{{ 'sections.cart.xxx' | t }}` em headers, mas promo banner e labels de frete são hard-coded PT

## Relacionado
- [../cart-progress-bar/manifest.md](../cart-progress-bar/manifest.md)
- [../cart-drawer/manifest.md](../cart-drawer/manifest.md)
- [../shipping-calculator/manifest.md](../shipping-calculator/manifest.md)
