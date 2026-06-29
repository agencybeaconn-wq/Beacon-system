-- Lever DW — catálogo de produtos (master) por loja
-- Diferente de dw_order_items (produtos VENDIDOS), aqui tem TUDO que tá no catálogo
-- ativo de cada loja — vendeu ou não. Gap entre os dois = oportunidade.

CREATE TABLE IF NOT EXISTS dw_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  shopify_product_id BIGINT NOT NULL,
  handle TEXT,
  title TEXT NOT NULL,
  vendor TEXT,
  product_type TEXT,
  status TEXT,                         -- active, draft, archived
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  tags TEXT[],

  -- Enriquecimento (mesmas regras de line items)
  team TEXT,
  team_country TEXT,
  category TEXT,
  season TEXT,
  season_year INT,
  model TEXT,

  -- Preços (variantes)
  price_min NUMERIC(12,2),
  price_max NUMERIC(12,2),
  compare_at_min NUMERIC(12,2),
  compare_at_max NUMERIC(12,2),
  variants_count INT,
  has_personalization BOOLEAN DEFAULT FALSE,  -- detectado por options

  -- Imagens
  image_url TEXT,
  images_count INT,

  raw_payload JSONB,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dw_products_unique UNIQUE (client_id, shopify_product_id)
);

CREATE INDEX IF NOT EXISTS idx_dw_products_client ON dw_products(client_id);
CREATE INDEX IF NOT EXISTS idx_dw_products_team ON dw_products(team);
CREATE INDEX IF NOT EXISTS idx_dw_products_category ON dw_products(category);
CREATE INDEX IF NOT EXISTS idx_dw_products_status ON dw_products(status);

-- View: produtos NO CATÁLOGO mas NÃO VENDIDOS (gap = oportunidade de tráfego)
CREATE OR REPLACE VIEW dw_v_catalog_gap AS
SELECT
  c.name AS client_name,
  p.client_id,
  p.shopify_product_id,
  p.title,
  p.team,
  p.category,
  p.price_min,
  p.created_at AS produto_criado_em
FROM dw_products p
JOIN agency_clients c ON c.id = p.client_id
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM dw_order_items i
    WHERE i.client_id = p.client_id
      AND i.shopify_product_id = p.shopify_product_id
  );

-- View: produtos VENDIDOS em algumas lojas mas FORA do catálogo de outras
-- (= oportunidade de replicação que o relatório cross-loja sugeriu)
CREATE OR REPLACE VIEW dw_v_product_replication_gap AS
WITH sold AS (
  SELECT DISTINCT i.title, i.team, i.category, i.client_id, COUNT(*) AS times_sold
  FROM dw_order_items i
  WHERE i.team IS NOT NULL
  GROUP BY i.title, i.team, i.category, i.client_id
)
SELECT
  s.title,
  s.team,
  s.category,
  COUNT(DISTINCT s.client_id) AS lojas_vendendo,
  SUM(s.times_sold) AS total_vendas,
  ARRAY_AGG(DISTINCT ac.name) AS lojas
FROM sold s
JOIN agency_clients ac ON ac.id = s.client_id
GROUP BY s.title, s.team, s.category
HAVING COUNT(DISTINCT s.client_id) >= 2
ORDER BY total_vendas DESC;

COMMENT ON TABLE dw_products IS 'Lever DW — catálogo ativo de cada loja Shopify. Cruzar com dw_order_items pra ver gap de catálogo vs vendas.';
