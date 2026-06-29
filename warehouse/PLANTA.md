# Planta do Galpão — Lever DW

**Status:** desenhada (não aplicada). Aguarda service_role key + OK do João.

Linguagem humana: que "prateleira" guarda o quê.

---

## Prateleiras do galpão

| Prateleira | O que guarda | Vai virar | Fonte |
|---|---|---|---|
| `dim_store` | 1 linha por loja (Mantos PH, Coringa, Kron, Nord, etc) + tier + comissão | Filtro "por loja" do dashboard | `agency_clients` Lever |
| `dim_customer` | 1 linha por **email anônimo** que já comprou em qualquer loja | Cruzamento cross-loja, persona | Shopify/CartPanda |
| `fact_order` | 1 linha por pedido | Faturamento diário, ROAS real, atribuição | Shopify/CartPanda |
| `fact_order_item` | 1 linha por SKU vendido (1 pedido pode ter N linhas) | Top SKUs, winners replicáveis | Shopify/CartPanda |
| `fact_ad_spend_daily` | 1 linha por dia × campanha × loja | Gasto vs receita, CPA, escala | Meta + Google |
| `fx_rate` | Câmbio diário (BRL ⇄ GBP/EUR/USD) | Normalização cross-loja | API câmbio |
| `ingestion_log` | Log do robôzinho (quando rodou, deu erro?) | Saúde do warehouse | Auto |

---

## Cruzamentos prontos (marts)

| Mart | Pergunta que responde | Quem consome |
|---|---|---|
| `mart_top_skus_cross_store` | Que produto vendeu em 2+ lojas? Quanto faturou? | Replicação cross-cliente |
| `mart_geo_age_ticket` | Como persona (geo × idade) se distribui por ticket? | Decisão de targeting |
| `mart_daily_briefing` | Estado D-1 de cada loja: orders, faturamento, gasto, ROAS real | Briefing matinal (sai automático no dashboard) |

Marts futuros (V2):
- `mart_winners_replicable` — combina top SKU + criativo que vendeu
- `mart_attribution_corrected` — cruza Meta-attributed × Shopify-actual
- `mart_kron_pnl` — único mart com margem real (só Kron)

---

## O que o robôzinho faz (resumo de cada conector)

| Conector | Roda quando | O que enche |
|---|---|---|
| `pull-shopify-orders.mjs` | 06h BRT diário | `fact_order` + `fact_order_item` + atualiza `dim_customer` |
| `pull-cartpanda-orders.mjs` | 06h BRT diário | igual ao Shopify mas via API CartPanda |
| `pull-meta-insights.mjs` | 06h05 BRT diário | `fact_ad_spend_daily` (platform=meta) |
| `pull-google-insights.mjs` | 06h10 BRT diário | `fact_ad_spend_daily` (platform=google) |
| `update-fx.mjs` | 06h BRT diário | `fx_rate` (1 chamada API) |
| `refresh-customer-aggregates.mjs` | 06h15 BRT diário | recalcula `total_orders`, `total_revenue_brl`, `stores_purchased` em `dim_customer` |

---

## Ordem de ligação D3-D4 (Mantos PH primeiro)

1. **D3 manhã:** Mantos do PH → Shopify connector → valida dados
2. **D3 tarde:** Coringa On Shop + Diario Stores
3. **D4 manhã:** Kron + Nord + Respeita (próprios)
4. **D4 tarde:** Resto da carteira Lever em loop
5. **D4 noite:** Meta + Google connectors (todos clientes ao mesmo tempo, reusa fb_connections existente)

---

## Como aplicar (1 clique, quando João liberar)

1. Supabase Lever Dashboard → SQL Editor
2. Cola `migrations/20260513_create_warehouse_schema.sql` → Run
3. Cola cada `marts/0*.sql` → Run
4. Pronto — galpão vazio, esperando robôzinho rodar

Robôzinho roda depois com `SUPABASE_SERVICE_ROLE_KEY` em `lever/.env.local` + `node lever/warehouse/scripts/run-all.mjs`.
