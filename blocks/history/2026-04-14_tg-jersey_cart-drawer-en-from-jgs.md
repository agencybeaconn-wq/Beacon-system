# Cart Drawer EN + Personalization Fixes (JGS → TG Jersey)

## Operação
- **Data:** 2026-04-14
- **Origem:** JGS Sports (z6zsci-qt.myshopify.com) theme=154355171483
- **Destino:** TG Jersey (store-tg-jersey.myshopify.com) theme main=157588324582 "LEVER EVER TG JERSEYS"
- **Idioma:** EN (TG é loja EN)
- **Status:** Aplicado ao vivo (PUT 200 em todos)

## Arquivos tocados
| Arquivo | Ação | Tamanho |
|---|---|---|
| snippets/cart-drawer.liquid | Substituído por versão JGS traduzida EN | 678 linhas (era 624) |
| snippets/cart-progress-bar.liquid | Substituído (milestones settings-driven) | 301 linhas (era 217) |
| snippets/icon-home.liquid | Novo | 4 linhas |
| snippets/customization-inputs.liquid | Fixes: property keys PT→EN, detector "Customize", URL fetch /cart | — |

## Features adicionadas
- Ícone de presente no banner do carrinho (substitui "Você está economizando")
- Milestones dinâmicos por qty de jerseys (settings-driven: `milestone_0/1/2`, `message_0..10_plus`, `bonus_2_text`)
- Discount labels condicionais (só aparece em line items que realmente receberam desconto)
- `icon-home.liquid` pro início da progress bar

## Fixes críticos (bug personalização)
1. **Detector de opção "Customize"** em `customization-inputs.liquid:486-489` — antes só matchava `personalizar` (PT). TG usa option name `Customize` com valores `No/Yes`. Agora: `includes('customize') || includes('custom') || includes('personali')`.
2. **URL de fetch do cart-drawer render errada** — `customization-inputs.liquid:582` usava `${Shopify.routes.root}?sections=...` (acertava a HOMEPAGE). Trocado pra `${routes.root}cart?sections=...`. Isso provavelmente causava o cart drawer aparecer vazio após add personalizado.
3. **Property keys PT→EN** em 3 snippets: `Nome→Name`, `Número→Number`, `Posição→Position`. Assim o cliente EN vê "Name: JOHN / Number: 10" em vez de "Nome: JOHN / Número: 10" no carrinho/checkout.
4. `aria-label="Fechar"` → `"Close"`, erro `'ID da variante não encontrado'` → `'Variant ID not found'`.

## Traduções (subagente)
- CARRINHO → CART, Seu carrinho está vazio → Your cart is empty, CONTINUAR COMPRANDO → CONTINUE SHOPPING, FINALIZAR COMPRA → CHECKOUT, GRÁTIS → FREE, Qtd → Qty, Você ganhou 2 camisas GRÁTIS → You earned 2 FREE jerseys, Você está economizando → You are saving.

## NÃO sobe
- Settings (milestones/messages são configurados pelo cliente no theme editor)
- Option name "Customize" em produtos já é EN — nada a fazer no data side
- `patch-script.liquid` intocado (outro snippet, fluxo de patches)

## Pendente (user mencionou, não feito ainda)
- **Qty selector em camisas personalizadas** (mesmo padrão das free da promo). Investigar se cart-drawer JGS já tem qty em todos os itens ou se há bloqueio pra linha personalizada.

## Lições
- Option data da loja (Shopify Admin) driva o match JS. Sem checar o option name real, o detector silenciosamente falha e o fee de personalização não é aplicado.
- URL `${Shopify.routes.root}?sections=...` em loja sem locale prefix acerta a home — parece funcionar mas retorna JSON vazio pro cart-drawer. Sempre usar `routes.root + 'cart'`.
- BR→EN exige também traduzir property keys, não só strings visíveis — senão o checkout EN mostra "Nome: ..." quebrando UX.

## Candidato?
Manter pra revisão do Pedro depois do teste ao vivo.
