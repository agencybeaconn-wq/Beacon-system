# Bloco: cart-drawer atualizado (com banners + Patches inline + qty selector + savings)

## Operação
- **Data:** 2026-04-23
- **Origem:** Mantos do PH (a9dc24-2.myshopify.com) — tema Cartpanda main 141617496259
- **Destino:** MatchWear (iwc24w-xt.myshopify.com) — tema **Lever 2** unpublished 151545118894
- **Idioma:** PT → EN (loja EN)
- **Validação:** OK (PT residuais só em comentários Liquid + variável `camisa_base` interna)
- **Status:** Aplicado, verificado (re-fetch APPLIED == PATCHED size=42578)

## Arquivos tocados
| Arquivo | Antes | Depois | Diff |
|---|---|---|---|
| `snippets/cart-drawer.liquid` | 37442 chars (versão Lever original) | 42578 chars | +5136 (+13.7%) |

## Features adicionadas (vs versão Lever 2 anterior)
1. **Banner "You got Free Shipping"** — empilhado, verde, com ícone de caminhão + check
2. **Banner "You got X free shirt(s)"** — aparece quando atinge milestone (3 = 1 grátis, 5 = 2 grátis)
3. **TOTAL com strikethrough** do preço original quando há desconto
4. **Banner "You're saving $X"** — aparece quando `total_savings > 0`
5. **Quantity selector +/-** (Qty: - 1 +) com regra: aparece SÓ em camisas NÃO personalizadas (`is_customized == false`) E NÃO promocionais (`item.final_price > 0`)
6. **Patches inline** no card pai (não como linha separada) — exclusion `Patches` removida do property loop
7. **Patch thumbnails** com `_patch_images` (preparado, lib add-to-cart precisa setar a prop)
8. **Price breakdown** "Jersey + Customization + Patches" (horizontal compact)
9. **Recompute shirt_count** com mesma lógica do cart-progress-bar (ignora patches + exclude_tags)
10. **Defer JS handler** `.cart-qty-btn` pra +/- funcional

## Traduções feitas (PT → EN)
| BR | EN |
|---|---|
| Você ganhou (2x) | You got |
| Você ganhou Frete Grátis | You got Free Shipping |
| Você está economizando | You're saving |
| Frete Grátis | Free Shipping |
| camisa(s) de brinde | free shirt(s) |
| FINALIZAR COMPRA (2x) | CHECKOUT |
| Continuar comprando | Continue shopping |
| Qtd: (2x) | Qty: |
| Diminuir/Aumentar quantidade | Decrease/Increase quantity |
| Camisa\</span> | Jersey\</span> |
| Personalização\</span> | Customization\</span> |
| + Personalização | + Customization |

## Adaptações estruturais
- **Cents conversão BRL→USD:** `assign pers_fee = 2000` (R$20) → `pers_fee = 500` ($5) per pricing.extras.personalizacao
- **Detection de Customize:** adicionei `'customize'` à lista (option value EN), mantendo `'com personalização'` legacy
- **Botão checkout:** trocado de Cartpanda (`onclick=cartxTriggerCheckout`) → submit nativo Shopify (`type="submit" name="checkout" form="CartDrawer-Form"`)

## Milestones do cart (`templates/cart.json`)
- ✓ Já configurado em EN com Pay 2 Get 3 (milestone_1=3) + Pay 3 Get 5 (milestone_2=5) — bate com `briefing.ofertas`
- ⚠ Mensagens contêm emojis (🎁🚀🏆) — viola regra Lever (sempre SVG)

## Erros encontrados durante execução
- Re-fetch após PUT trouxe size cacheado (37519); 5s depois retornou correto (42578). Cache de CDN.

## Bugs do template observados nessa op (lista pra fim do dia)
1. Cart-drawer da template EN está desatualizado — features de Mantos PH (banners + Patches inline + qty selector + savings) não foram propagadas
2. `templates/cart.json` da template EN tem emojis (🎁🚀🏆) nas mensagens — violar regra `feedback_no_emojis_use_icons`
3. Cents BRL hardcoded (`pers_fee = 2000`) na versão Mantos PH — deveria ler de `extras.personalizacao` pra ser locale-agnostic

## Lições / candidato?
- Depois de validar visualmente no preview do Lever 2, a versão atual do cart-drawer (com tudo: banners + Patches + qty selector + savings + checkout nativo) é **forte candidato a Template EN**.
- Pré-condição pra subir: corrigir o cents-hardcode (ler de `pricing.extras.personalizacao`) pra funcionar em qualquer loja sem patch manual.
- Flag pro colaborador: "marca como candidato Template EN?"

## Backup
- LIVE pre-PUT: `C:/tmp/matchwear-backup/cart-drawer.LIVE.liquid`
- PATCHED (proposta): `C:/tmp/matchwear-cart-drawer.PATCHED.liquid`
- APPLIED (pós-fetch): `C:/tmp/matchwear-backup/cart-drawer.APPLIED.liquid`
