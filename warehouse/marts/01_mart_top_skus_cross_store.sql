-- mart_top_skus_cross_store
-- Pergunta: que produto/SKU vende em N lojas, com qual receita total?
-- Uso: detectar winners replicáveis cross-cliente

CREATE OR REPLACE VIEW warehouse.mart_top_skus_cross_store AS
SELECT
  lower(coalesce(foi.product_title, foi.sku, 'unknown')) AS product_key,
  foi.product_title,
  count(DISTINCT foi.store_id)             AS stores_count,
  array_agg(DISTINCT ds.brand_name)        AS brands,
  sum(foi.quantity)                        AS units_sold,
  sum(foi.line_total_brl)                  AS revenue_brl,
  min(foi.ordered_at)                      AS first_sale_at,
  max(foi.ordered_at)                      AS last_sale_at
FROM warehouse.fact_order_item foi
JOIN warehouse.dim_store ds ON ds.store_id = foi.store_id
WHERE foi.ordered_at >= now() - interval '90 days'
GROUP BY product_key, foi.product_title
HAVING count(DISTINCT foi.store_id) >= 2     -- só produtos vendidos em 2+ lojas
ORDER BY stores_count DESC, revenue_brl DESC;
