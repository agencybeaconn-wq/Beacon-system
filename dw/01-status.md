---
title: Beacon DW — Status Atual
tags: [dw, status]
updated: 2026-05-13
---

# 📊 Status do DW Beacon

**Atualizado:** 2026-05-13

---

## Totalizadores Beacon (60 dias)

| Métrica | Valor |
|---|---|
| Receita Shopify cross-loja | **R$ 547 mil** |
| Pedidos pagos | 1.654 |
| Itens enriquecidos | 4.335 |
| Clientes finais únicos | 681 |
| Gasto Meta total | **R$ 103 mil** |
| Receita Meta-reportada | R$ 489 mil (ROAS 4.73) |
| **ROAS real (Shopify/Meta)** | **5.29** |

---

## Lojas com dado Shopify (7 ativas)

| Loja | Pedidos | Receita | Ticket médio | Top time |
|---|---|---|---|---|
| **Mantos do PH** | 697 | R$ 321.522 | R$ 461 | Brasil |
| **Coringão Shop** | 515 | R$ 146.611 | R$ 285 | Corinthians |
| **Voltz Club** | 180 | R$ 51.427 | R$ 286 | Brasil |
| **Brasileiríssimo** | 254 | R$ 23.166 | R$ 91 | Brasil |
| Loja da Torcida | 5 | R$ 2.949 | R$ 590 | Brasil |
| Setor Esportes | 2 | R$ 1.030 | R$ 515 | Brasil |
| TRAVE | 1 | R$ 280 | R$ 280 | Brasil |

---

## Lojas Meta cruzando (14 contas, 31 sincando)

Detalhe por loja em [[05-meta-accounts]]. Resumo do gasto 60d:

| Loja | Gasto Meta | ROAS Meta | ROAS Real | Δ |
|---|---|---|---|---|
| Mantos do PH | R$ 40.315 | 5.39 | **7.98** | +48% |
| Diario Stores | R$ 14.562 | 6.29 | — *(sem Shopify cruzado)* | |
| **Coringão Shop** | R$ 9.633 | 4.39 | **15.22** | **+246%** |
| O Colecionador De Mantos | R$ 9.471 | 4.51 | — | |
| JGS Sports | R$ 5.723 | 0.90 | — *(acesso 403)* | |
| Mega mantos | R$ 5.567 | 3.10 | — *(acesso 403)* | |
| **Voltz Club** | R$ 4.822 | 2.58 | **10.67** | **+314%** |
| Brasileiríssimo | R$ 2.838 | 6.50 | 8.16 | +26% |
| Setor Esportes | R$ 2.624 | 0.89 | 0.39 | -56% |

---

## Bloqueios atuais

🔴 **6 lojas com acesso travado** (Pedro task):
- JGS Sports, Mega Mantos, Black Hype, Puskas — sem `read_orders`
- Mantos PH, Coringão, Voltz — sem `read_all_orders` (limita histórico a 60d)

🟡 **Token Meta expira 12/jul/2026** — precisa reconectar antes

🟢 **Sync diário ativo** — cron Supabase às 02:00 BR

---

## Mudanças importantes desde o setup

- 12 ad accounts Lever-internas renomeadas pra padrão `Lever · Tipo · Moeda`
- 2 pool accounts desvinculadas de Coringão e Julico (eram empréstimos não usados)
- Backfill 24m bloqueado a 60d pela Shopify (scope `read_orders` only)
