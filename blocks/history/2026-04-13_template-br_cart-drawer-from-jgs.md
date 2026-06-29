# Cart Drawer (JGS → Template BR)

## Operação
- **Data:** 2026-04-13
- **Origem:** JGS Sports (z6zsci-qt.myshopify.com) theme=154355171483
- **Destino:** Template BR (testeloja-9899.myshopify.com) theme=160282804466
- **Status:** Aplicado

## O que sobe
Snippets finalizados do carrinho lateral — versão 3 (Foot Mania → JGS → Template).

### snippets/cart-drawer.liquid (31KB)
- 9 features do TG Jerseys já adaptadas
- 3 tags `<a>/<button>` malformadas corrigidas
- Checkout nativo Shopify (sem Yampi/Cartpanda)
- Subtotal removido (TOTAL já tem compare-at riscado)
- Verde hardcoded removido
- **Discount labels condicionais**: só renderiza `Promoção X` nos line items que realmente receberam o desconto (`discount.amount > 0`)

### snippets/cart-progress-bar.liquid (16KB)
- Settings-driven (milestone_0/1/2 icon + qty + badge)
- 11 mensagens dinâmicas por shirt_count (settings.message_0..10_plus)
- **Generalizado**: hardcode "X camisas GRÁTIS" no stage 2 substituído por `{{ settings.bonus_2_text_max | default: settings.bonus_2_text }}`

### snippets/icon-home.liquid
- Ícone da casinha (início da progress bar)

## NÃO sobe
- Settings (milestones/messages são específicas por cliente — promo Pague 2 Leve 3 / Leve 4 / Leve 5 etc variam)
- Promoções automáticas Shopify (cada loja tem suas regras BXGY)
- Smart collection `camisas-promocao` (opcional, cada loja decide o alvo)

## Como usar num novo cliente
1. `/code-blocks` → copia os 3 snippets pro tema Lever do cliente
2. Setar settings: `milestone_1_quantity`, `milestone_1_badge`, `bonus_2_text`, `bonus_2_text_max`, `message_0..10_plus`
3. Criar coleção smart alvo da promo (ex: `camisas-promocao`) com regra TITLE contains (Camisa, Manto, Jersey, Conjunto Infantil, Kit Infantil)
4. Criar BXGY automatic discounts (Pague X Leve Y) via GraphQL `discountAutomaticBxgyCreate`

## Lições
- Discount labels do Shopify são allocados em TODOS os line items participantes — filtrar por `amount > 0` pra mostrar só no item efetivamente gratis
- Progress bar final "X camisas GRÁTIS" varia por promo — deixar settings-driven evita edição Liquid por loja
