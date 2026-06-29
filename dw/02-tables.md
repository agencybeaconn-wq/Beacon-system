---
title: Beacon DW — Tabelas
tags: [dw, schema, reference]
---

# 🗄️ Tabelas do DW

> Todas as tabelas tem prefixo `dw_`. Service role only — não tem RLS.

---

## Shopify

### `dw_orders`
Um pedido = uma linha. Inclui geo, status, canal detectado, faixa de ticket. Tem `email_hash` (SHA-256 do email) pra cross-loja join.

**Campos chave:**
- `client_id` → `agency_clients.id`
- `shopify_order_id` (BIGINT)
- `total_price`, `currency`, `ticket_band`
- `ship_country_code`, `ship_province_code`, `ship_city`
- `email_hash`, `channel` ('meta', 'google', 'direct', etc)

### `dw_order_items`
**Granularidade onde mora o BI cross-loja.** Cada item de pedido, enriquecido automaticamente:
- `team`, `team_country` (Brasil/Cruzeiro/Real Madrid/...)
- `category` (Seleção / Atual / Retrô / Treino / Infantil / Plus size / Acessório)
- `season`, `season_year` (93/94, 2024/25...)
- `model` (Titular / Reserva / Goleiro)
- `is_personalized`, `personalization_name`, `personalization_number`
- `has_patches`, `patches_count`, `patch_titles[]`
- `size`, `is_plus_size`

### `dw_customers`
1 cliente final por loja. Já tem agregados pré-calculados: `total_orders`, `total_spent`, `first_order_at`, `last_order_at`, `avg_ticket`.

### `dw_customer_identity`
**Mágico**: cross-loja por `email_hash`. Cada email único vira 1 identity. Aponta pra todas as `(client_id)` onde aquele email apareceu.
- `stores_count`, `total_orders_all_stores`, `total_spent_all_stores_brl`
- `client_ids[]` (array)

### `dw_sync_state`
Rastreia onde parou o backfill de cada loja. `last_run_at`, `total_orders_synced`, `last_error`.

---

## Meta Ads

### `dw_meta_accounts`
47 ad accounts visíveis pelo token Beacon. Classificadas por `ownership`:
- `client` — pertence a cliente Beacon (linkado via `client_id`)
- `lever_internal` — pool/operação/legacy Lever
- `jvf_owned` — Kron/Nord/etc (fora do DW)
- `excluded` — SS3, Ayla pessoal, etc
- `orphan` — não classificada ainda

### `dw_meta_campaigns` / `dw_meta_adsets` / `dw_meta_ads`
Hierarquia padrão Meta. Ads tem creative inline:
- `creative_body`, `creative_title`, `creative_image_url`, `creative_video_id`
- `destination_url` + UTMs já parseadas (`utm_source`, `utm_medium`, etc)

### `dw_meta_insights_daily`
**Fato granular.** Por (`entity_id`, `entity_type`, `date`). Inclui:
- Spend, impressions, reach, clicks, ctr, cpm, cpc
- Purchases (Meta-reportado), purchases_value
- Add-to-cart, IC, landing page views, video views
- `roas` (Meta) e `cpa` calculados

---

## Views úteis (atalho pra queries comuns)

| View | O que mostra |
|---|---|
| `dw_v_sku_velocity` | Top SKU por loja (volume × receita) |
| `dw_v_geo_team_heatmap` | Time × país × estado × categoria |
| `dw_v_customer_rfm` | RFM por cliente final (recência/frequência/monetário) |
| `dw_v_cross_store_customers` | Quem comprou em 2+ lojas Beacon |
| `dw_v_meta_vs_shopify_daily` | Spend Meta × receita Shopify por dia (ROAS real) |
| `dw_v_top_ads_30d` | Top ads por ROAS Meta últimos 30d |

---

## Pra explorar no Supabase Studio

1. https://supabase.com/dashboard/project/pxhmzpwvxvlwngjbjkrg/editor
2. Tabela `dw_v_top_ads_30d` (view) — top criativos cross-loja
3. Tabela `dw_orders` filtra por `client_id` + `created_at` desc
4. Pra cruzar manual: SQL Editor + query custom

Cuidado: as views agregam, podem demorar 2-5s.
