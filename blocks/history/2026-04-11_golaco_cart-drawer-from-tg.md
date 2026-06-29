# Bloco: Cart Drawer Completo (TG → Golaço, EN → BR)

## Operacao
- **Data:** 2026-04-11
- **Origem:** TG Jerseys (store-tg-jersey.myshopify.com) — EN
- **Destino:** Golaço (smyvkp-2j.myshopify.com) — BR
- **Tema destino:** Tema Lever 02/04 (139263606847, unpublished)
- **Validacao:** 100% — MELHORIA
- **Status:** Aplicado

## O que faz
Transferiu cart-drawer da TG Jerseys pra Golaço adicionando 9 features novas, traduzidas pra BR. Cart drawer agora tem stepper interativo, savings calculator, patch thumbnails, badge GRÁTIS, etc.

## Features adicionadas (9)
1. Quantity stepper (+/-) interativo
2. Badge "🎁 GRÁTIS" pra itens com final_price = 0
3. Savings calculator + banner "🎉 Você economiza R$X"
4. Patch thumbnails gallery no carrinho
5. Flag is_customized (esconde stepper em personalizadas)
6. Layout stacked das propriedades
7. Inline <style> block com todas as classes novas
8. Remove button condicional (esconde em itens grátis)
9. JS handler do stepper (click → updateQuantity)

## Preservado da Golaço
- Subtotal row (cart.original_total_price)
- Banner de cupom/desconto
- Botão checkout com cor do tema (NÃO forçado verde)
- iOS safe-area no footer
- Yampi z-index compat
- Todas as traduções existentes

## Traducoes EN → BR (6)
- Qty: → Qtd:
- Decrease quantity → Diminuir quantidade
- Increase quantity → Aumentar quantidade
- Quantity for X → Quantidade de X
- 🎁 FREE → 🎁 GRÁTIS
- 🎉 You save → 🎉 Você economiza

## Metricas
- Antes: 422 linhas
- Depois: 649 linhas (+227)
- Features: 0/9 → 9/9

## Cuidados / Licoes
- NAO copiar cart-progress-bar.liquid da TG — o da Golaço é settings-driven e superior
- NAO copiar component-cart-drawer.css — Golaço tem iOS safe-area e Yampi compat
- NAO forçar botão verde — manter cor do tema
- Subagente não conseguiu fazer upload (Bash bloqueado) — rodei o PUT na sessão principal
- Subagente é útil pra preparar arquivo, executar NÃO

## Candidato?
Sim — candidato #1 Template BR pra carrinho lateral completo
