---
title: Beacon DW — Mapa de Clientes
tags: [dw, clientes, mapeamento]
---

# 🏪 Mapeamento Clientes Beacon

> Mapa de quem é quem na Beacon, onde tem dado e onde não tem.

**Última auditoria:** 2026-05-13

---

## Lojas ATIVAS rodando (com dado Shopify)

| Cliente | Shopify | Meta | Top categoria | Volume |
|---|---|---|---|---|
| **Mantos do PH** | ✅ 60d | ✅ R$40k/60d | Seleção 44% | 🔥 #1 receita |
| **Coringão Shop** | ✅ 60d | ✅ R$10k/60d | Atual 76% (Corinthians) | 🔥 #2 receita |
| **Voltz Club** | ✅ 60d | ✅ R$5k/60d | Atual 54% | 💪 |
| **Brasileiríssimo** | ✅ 60d | ✅ R$3k/60d | Seleção 65% | 💪 |
| **Diario Stores** | ⚠️ não rodado | ✅ R$15k/60d | — | confirmar c/ João |
| **O Colecionador De Mantos** | ⚠️ não rodado | ✅ R$9k/60d | — | confirmar c/ João |
| **Jhon Atacado** | ⚠️ não rodado | ✅ R$2k/60d (ROAS 16!) | — | confirmar c/ João |
| Loja da Torcida | ✅ 60d | ✅ R$3k/60d | Seleção 73% | 🟡 baixo |
| Setor Esportes | ✅ 60d | ✅ R$3k/60d | Seleção 56% | 🟡 baixo |
| TRAVE | ✅ 60d | ✅ R$1k/60d | Plus 57% | 🟢 começando |

---

## Lojas com ACESSO TRAVADO (Pedro task)

🔴 **Erro 403 — cliente não aprovou app:**
- JGS Sports → tem R$ 6k/60d Meta gastando, sem ver retorno Shopify
- Mega Mantos → tem R$ 6k/60d Meta
- Black Hype → tem Shopify mas erro 403
- Puskas → tem R$ 1k/60d Meta

🟡 **Falta `read_all_orders` (limita histórico a 60d):**
- Mantos do PH (tem 8.451 pedidos travados além dos 60d)
- Coringão Shop (7.417 travados)
- Voltz Club (4.248 travados)

Ações detalhadas em [[06-pedro-tasks]]

---

## Lojas SÓ-PROJETO (não rodam — fora do DW)

Lojas onde Beacon só fez tema/deploy, não opera tráfego:
- FutNations, Loja do Belo, Golaço, TG Jersey, Soccer Boutique
- Dribla Club, Boutique do Boleiro (todas duplicadas)
- Retro Football, Foot Kids, Foot Mania
- Julico Sports *(parou de rodar)*

Não geram dado relevante hoje. Reativar caso virem cliente ativo.

---

## Marcas do João (fora do DW Beacon)

- **Kron Watches** — marca relógios, mart próprio
- **Nord** — marca camisa UK, mart próprio
- **Real 01 / Real 02** — Arquibancada Esportes (operação dele)

Esses NÃO contam pra BI cross-cliente. Vivem em DW separado quando preciso.

---

## Tier de prioridade (atualizar conforme rotação)

🥇 **Tier S (comissão sobre faturamento)**: Mantos do PH, Coringa On Shop, Diario Stores
🥈 **Tier A (escala alvo, sem multiplicador)**: Voltz, Brasileiríssimo, Mega Mantos
🥉 **Tier B (rodando, monitorar)**: TRAVE, Setor Esportes, Loja da Torcida, Puskas
