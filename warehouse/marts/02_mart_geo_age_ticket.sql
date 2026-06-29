-- mart_geo_age_ticket
-- Pergunta: como persona (geo × idade) se distribui por ticket médio?
-- Uso: descobrir bolsões de comprador por loja e cross-loja

CREATE OR REPLACE VIEW warehouse.mart_geo_age_ticket AS
SELECT
  ds.brand_name,
  ds.tier,
  dc.geo_country,
  dc.geo_city,
  dc.age_bucket,
  count(DISTINCT fo.order_pk)              AS orders,
  count(DISTINCT fo.customer_id)           AS unique_customers,
  sum(fo.total_amount_brl)                 AS revenue_brl,
  round(avg(fo.total_amount_brl), 2)       AS avg_ticket_brl,
  round(sum(fo.total_amount_brl) / nullif(count(DISTINCT fo.customer_id), 0), 2) AS revenue_per_customer
FROM warehouse.fact_order fo
JOIN warehouse.dim_store ds ON ds.store_id = fo.store_id
LEFT JOIN warehouse.dim_customer dc ON dc.customer_id = fo.customer_id
WHERE fo.ordered_at >= now() - interval '90 days'
  AND fo.financial_status = 'paid'
GROUP BY ds.brand_name, ds.tier, dc.geo_country, dc.geo_city, dc.age_bucket
ORDER BY revenue_brl DESC;
