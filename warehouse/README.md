# Lever Data Warehouse — MVP

**Status:** Bootstrap (D1 de 7) — 2026-05-13
**Deadline duro:** 2026-06-10 (1d antes da Copa)
**Owner:** João Vithor + Claude (COS)

## Por que existe

Inteligência cross-cliente. Hoje cada loja vive isolada em sua infra (Shopify/CartPanda + Meta/Google). Sem warehouse:
- Não dá pra comparar top SKUs entre clientes
- Não dá pra detectar padrão "vencedor numa loja, replicável noutra"
- Não dá pra segmentar cliente final cross-loja por geo/idade/ticket
- Briefing diário fica manual, sem dado

Copa 2026 (11/jun→19/jul) é a janela de validação: 4 semanas de tráfego comprimido em clientes sportswear BR. Sem warehouse, perde-se 50% do learning.

## Arquitetura (decidida no bootstrap)

```
┌─────────────────────────────────────────────────────────────┐
│ FONTES                                                       │
│  • Shopify Admin API (cada loja com OAuth via Lever app)    │
│  • CartPanda API (lojas BR que não usam Shopify)            │
│  • Meta Marketing API v25 (via fb_connections existente)    │
│  • Google Ads API (via MCC Lever 7381631747)                │
└────────────────────┬────────────────────────────────────────┘
                     │ ELT scripts Node + edge functions
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE LEVER — schema `warehouse`                          │
│                                                              │
│  dim_store            ← agency_clients + scopes              │
│  dim_customer         ← email_hash cross-loja                │
│  fact_order           ← grão pedido                          │
│  fact_order_item      ← grão linha (SKU)                     │
│  fact_ad_spend_daily  ← grão dia × campanha                  │
│                                                              │
│  marts:                                                      │
│    mart_top_skus_cross_store                                 │
│    mart_geo_age_ticket                                       │
│    mart_winners_replicable                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ DASHBOARD: Metabase self-host (decisão final D2)             │
└─────────────────────────────────────────────────────────────┘
```

## Decisões arquiteturais

1. **Schema separado** (`warehouse.*`) no Supabase Lever existente — não mexe em tabelas live
2. **Stack ELT** = scripts Node + Supabase REST + cron — sem Airbyte/Fivetran (overkill)
3. **Identidade cross-loja** = SHA-256(email lowercased) → permite agregação sem expor PII bruto entre tenants
4. **Grão métricas ads** = diário (não horário) — reduz volume 24×
5. **Cron** = Vercel cron 06:00 BRT (após fechamento UTC)

## Roadmap

| Dia | Entrega | Bloqueio |
|---|---|---|
| D1 (hoje) | Inventário lojas + estrutura brain/ + este README + migration SQL draft | Service key |
| D2 | Migration aplicada + dim_store populada + decisão dashboard | OK João |
| D3 | Connector Shopify (1 loja piloto + loop) → fact_order/fact_order_item | |
| D4 | Connectors Meta+Google → fact_ad_spend_daily | |
| D5 | Identity resolution + marts SQL | |
| D6 | Dashboard MVP + cron | |
| D7 | Buffer + docs equipe | |

## Pendências bloqueantes

Ver [briefing-diario.md](../../brain/João Brain/00-system/briefing-diario.md) seção "Decisões pendentes".

## Próximo arquivo a criar

`migrations/20260513_create_warehouse_schema.sql` — só após OK João.
