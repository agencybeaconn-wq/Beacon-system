-- mart_daily_briefing
-- Pergunta: estado D-1 de cada loja (faturamento, gasto ads, ROAS real)
-- Uso: alimenta o briefing diário matinal

CREATE OR REPLACE VIEW warehouse.mart_daily_briefing AS
WITH yesterday AS (
  SELECT (now() - interval '1 day')::date AS d
),
sales AS (
  SELECT
    fo.store_id,
    count(*)                                  AS orders,
    count(*) FILTER (WHERE fo.is_first_order) AS new_customers,
    sum(fo.total_amount_brl)                  AS revenue_brl
  FROM warehouse.fact_order fo, yesterday y
  WHERE fo.ordered_at::date = y.d
    AND fo.financial_status = 'paid'
  GROUP BY fo.store_id
),
spend AS (
  SELECT
    fasd.store_id,
    sum(fasd.spend_brl)                       AS spend_brl,
    sum(fasd.purchases)                       AS attributed_purchases,
    sum(fasd.purchase_value)                  AS attributed_revenue
  FROM warehouse.fact_ad_spend_daily fasd, yesterday y
  WHERE fasd.date = y.d
  GROUP BY fasd.store_id
)
SELECT
  ds.brand_name,
  ds.tier,
  ds.market,
  coalesce(s.orders, 0)                       AS orders_d1,
  coalesce(s.new_customers, 0)                AS new_customers_d1,
  coalesce(s.revenue_brl, 0)                  AS revenue_brl_d1,
  coalesce(sp.spend_brl, 0)                   AS spend_brl_d1,
  CASE
    WHEN coalesce(sp.spend_brl, 0) > 0
    THEN round(coalesce(s.revenue_brl, 0) / sp.spend_brl, 2)
    ELSE NULL
  END                                         AS roas_real_d1,
  CASE
    WHEN coalesce(s.orders, 0) > 0
    THEN round(coalesce(s.revenue_brl, 0) / s.orders, 2)
    ELSE NULL
  END                                         AS avg_ticket_d1
FROM warehouse.dim_store ds
LEFT JOIN sales s ON s.store_id = ds.store_id
LEFT JOIN spend sp ON sp.store_id = ds.store_id
WHERE ds.active
ORDER BY
  CASE ds.tier WHEN 'S' THEN 1 WHEN 'OWN' THEN 2 ELSE 3 END,
  ds.brand_name;
