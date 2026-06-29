# Bloco: Cart Drawer (Golaço → Foot Mania)

## Operacao
- **Data:** 2026-04-13
- **Origem:** Golaço (smyvkp-2j.myshopify.com) theme=139263606847 — BR
- **Destino:** Foot Mania (fcrn0i-5c.myshopify.com) theme=160723632347 — BR
- **Idioma:** BR
- **Validacao:** 100% (validateAll OK em ambos arquivos)
- **Status:** Aplicado

## O que faz
Transferiu cart-drawer.liquid + cart-progress-bar.liquid do Golaço (versão BR já adaptada do TG Jerseys com 9 features) pra Foot Mania. Sanitizou pra usar checkout Shopify NATIVO (sem Yampi/Cartpanda/redirect) e removeu verde hardcoded pra respeitar cor do tema Lever.

## Arquivos tocados
| Arquivo | Antes | Depois | Sanitize |
|---|---|---|---|
| snippets/cart-drawer.liquid | 20901 | 31423 | removed hardcoded green #22c55e |
| snippets/cart-progress-bar.liquid | 14901 | 15919 | - |

## Features trazidas do Golaço
1. Quantity stepper (+/-) interativo
2. Badge "🎁 GRÁTIS" pra itens com final_price = 0
3. Savings calculator + banner "🎉 Você economiza R$X"
4. Patch thumbnails gallery
5. Flag is_customized (esconde stepper em personalizadas)
6. Layout stacked das propriedades
7. Inline <style> com classes novas
8. Remove button condicional
9. JS handler do stepper

## Adaptacoes pra Foot Mania
- Checkout nativo Shopify: removido qualquer bloco Yampi/Cartpanda
- Cor do tema preservada (removido #22c55e hardcoded)
- Milestones progress bar é settings-driven → ja usa milestone_1_quantity=2/badge="Leve 4" e milestone_2_quantity=3/badge="Leve 6" ja configurado no settings_data.json

## Backups
- c:\Users\pedro\OneDrive\Documentos\Lever System\Lever-System\blocks\backups\2026-04-13_foot-mania_snippets__cart-drawer.liquid.bak
- c:\Users\pedro\OneDrive\Documentos\Lever System\Lever-System\blocks\backups\2026-04-13_foot-mania_snippets__cart-progress-bar.liquid.bak

## Licoes
- Golaço já era o destino ideal — versão TG Jerseys ja traduzida BR com 9/10 features
- Progress bar settings-driven evita tocar no Liquid só pra mudar promo
- Sanitize removendo Yampi-block garante isolamento de dependência em loja sem esse app

## Fixes aplicados depois do transfer inicial (candidato #1)

### 1. Tags `<a>` malformadas (3 instâncias)
O Golaço tinha 3 tags `<a href>...</button>` (abre `<a>`, fecha com `</button>`):
- `<a class="cart-item__link">` (wrapper da imagem do produto)
- `<a class="cart-item__name">` (link do título)
- `<a class="empty-cart-button">` (botão CONTINUAR COMPRANDO do estado vazio)

Efeito colateral: como `<a>` nunca fecha, todo o conteúdo subsequente vira parte do link — clicar no stepper de quantidade abria a página do produto; o "TEM UMA CONTA? Faça login" do estado vazio quebrava visualmente.

**Fix:** substituir `</button>` por `</a>` nas 3 ocorrências.

### 2. Bonus_2_text sem wrap `<p>`
Eu havia setado `<p>Você ganhou <strong>1 camisa GRÁTIS</strong></p>` em `settings.bonus_2_text`. O `<p>` adicionava espaçamento extra visível no banner. O `bonus_1_text` (Frete Grátis) não vinha wrapped, layout ficou inconsistente.

**Fix:** setar plain text `Você ganhou <strong>1 camisa GRÁTIS</strong>` — a Shopify aceita em settings de tipo `inline_richtext`.

### 3. Hardcoded "2 camisas de brinde" trocado
Linha 292 tinha hardcoded `Você ganhou <strong>2 camisas de brinde</strong>` pro estágio final. Foot Mania usa Pague 3 Leve 6 → 3 grátis.

**Fix:** substituir por `Você ganhou <strong>3 camisas GRÁTIS</strong>`.

### 4. Subtotal removido
O footer mostrava Subtotal + TOTAL. Como o TOTAL já vem com preço riscado (compare-at), o Subtotal ficava redundante.

**Fix:** remover o bloco Subtotal inteiro (6 linhas).

### 5. Milestones settings-driven (3 ícones)
Configurado no `settings_data.json` da Foot Mania:
- `milestone_0_icon = 'home'` (casinha que anda)
- `milestone_1_icon = 'gift'`, `quantity=3`, `badge='Leve 3'`
- `milestone_2_icon = 'gift'`, `quantity=6`, `badge='Leve 6'`

Copiado snippet `icon-home.liquid` do Golaço (faltava na Foot Mania).

### 6. 11 mensagens dinâmicas por shirt_count
Setadas `settings.message_0` até `message_10_plus` — mensagens emocionais por quantidade de camisas no carrinho (ex: qty=3 → "🎉 Parabéns! Ganhou 1 GRÁTIS! Leve mais 3 e ganhe +2"). Precisam de wrap `<p>...</p>` (validação Shopify rejeita sem).

## Dependências externas
- Shopify discount `Promoção Pague 2 Leve 3` + `Promoção Pague 3 Leve 6` (automatic BXGY, 100% off em N itens, alvo coleção smart `camisas-promocao` que filtra Camisa/Manto/Jersey/Conjunto Infantil/Kit Infantil)
- Snippet `icon-home.liquid` (copiar do Golaço se faltar)
- Settings `milestone_0_icon`, `milestone_1_*`, `milestone_2_*`, `message_0..10_plus`, `bonus_1_text`, `bonus_2_text`

## Candidato #1 — template BR, categoria CARRINHO LATERAL
Esta versão é superior ao Golaço porque corrige 3 bugs que estavam silenciosos lá (malformed `<a>/</button>`, hardcoded "2 camisas" pra promo diferente, verde fixo no checkout).
