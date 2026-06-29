# FutNations — Cart drawer: 1 milestone + Fast Shipping badge

**Data:** 2026-05-11
**Loja:** FutNations (`loja-futnation.myshopify.com` → `www.futnationshop.com`)
**Tema:** `Tema Lever FutNation ( Corrigido )` (id 130005991482)

## Pedido do cliente

Áudio do dono da loja:
1. Tirar a segunda promo do cart (havia "Buy 2 Get 3" + "Pay 3 Get 5") — manter só a primeira ("compra 2 ganha 1").
2. Substituir qualquer referência a "frete grátis" por "Fast Shipping" — ele não vende com frete grátis.

## Diagnóstico

- **BxGy real (Shopify Discounts):** só 1 automatic discount "Buy 2 Get 1", já EXPIRED. Não era a fonte da segunda promo visível.
- **Fonte real:** `snippets/cart-progress-bar.liquid` tinha 2 milestones hardcoded (goal_1=3 jerseys, goal_2=5 jerseys) com mensagens estáticas no `{% case shirt_count %}`.
- **"Frete grátis":** não existia literalmente no tema. Provável interpretação do cliente da mensagem "get the 3rd one free" — confusão "free" → "frete grátis", possivelmente reforçada por tradução do navegador.

## Alterações

### `snippets/cart-progress-bar.liquid`
- Removidas todas as variáveis e DOM do milestone 2 (`goal_2`, `milestone_2_*`, `Pay 3 Get 5`).
- Progress bar agora vai de 0% a 100% baseado só em `goal_1`.
- Loop de steps usa `(1..goal_1)` em vez de `(1..goal_2)`.
- Mensagens reescritas sem a palavra "free" (que causou ambiguidade):
  - 0 jerseys: "Add 3 jerseys to your cart and the 3rd one is on us!"
  - 1: "2 more jerseys and the 3rd one is on us!"
  - 2: "1 more jersey and the 3rd one is on us!"
  - 3+: "Promo unlocked! Buy 2 Get 1 jersey on us — enjoy!"

### `snippets/cart-drawer.liquid`
- Adicionado `<div class="cart-drawer__shipping-badge">` com `icon-truck.svg` + "Fast Shipping Worldwide" antes do bloco `cart-drawer__footer` (acima do TOTAL/CTA).
- Estilo inline pra não depender de CSS extra (mantém o badge visível mesmo sem deploy de stylesheet).

## Validação

`curl https://www.futnationshop.com/` confirma:
- Texto novo do progress bar ("3rd one is on us") renderizado.
- Badge "Fast Shipping Worldwide" renderizado no DOM do cart drawer.
- "Pay 3 Get 5" não aparece mais.

## Backup

Originais em `c:/tmp/futnation-backup-2026-05-11T23-56-12-969Z/`:
- `cart-progress-bar.original.liquid`
- `cart-drawer.edited.liquid` (versão já com badge — preservada como reference)

## Candidato a /code-blocks?

**Sim, parcial.** O padrão "1 milestone simples com badge Fast Shipping" pode virar variante BR/EN do cart-drawer, mas só quando outras lojas pedirem. Por ora é cosmético específico da FutNations. Hardcode no `case shirt_count` é frágil — vale virar settings de section quando promovermos.

## Pendências

Não há. Cliente pode validar visualmente no www.futnationshop.com → adicionar camisa no cart.
