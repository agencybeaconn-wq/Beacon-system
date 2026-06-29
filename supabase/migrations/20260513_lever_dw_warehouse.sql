-- Lever Data Warehouse — schema cross-cliente
--
-- Objetivo: armazenar pedidos, itens, clientes finais e enriquecimento (time,
-- categoria, temporada, personalização) de TODAS as lojas Shopify dos clientes Lever,
-- pra cruzar e responder "que produto vende em qual perfil em qual geo" cross-loja.
--
-- Convenção:
--   - Prefixo dw_ separa do operacional.
--   - Service role only — sem RLS (back-office da agência).
--   - shopify_*_id é BIGINT (Shopify usa int64).
--   - email_hash = lower(trim(email)) → SHA-256 hex, dedup cross-loja sem expor PII no join.
--   - raw_payload JSONB guardado pra reprocessar enriquecimento se regras mudarem.

-- ============================================================================
-- ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,

  -- IDs Shopify
  shopify_order_id BIGINT NOT NULL,
  order_number TEXT,                       -- "#9478"

  -- Tempo
  created_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,

  -- Valores
  currency TEXT NOT NULL,                  -- "BRL", "USD"
  total_price NUMERIC(12,2) NOT NULL,
  subtotal_price NUMERIC(12,2),
  total_discounts NUMERIC(12,2),
  total_tax NUMERIC(12,2),
  total_shipping NUMERIC(12,2),
  ticket_band TEXT,                        -- "<100", "100-300", "300-500", "500-1000", "1000+"

  -- Status
  financial_status TEXT,                   -- paid, pending, refunded, voided, etc
  fulfillment_status TEXT,                 -- fulfilled, partial, null

  -- Origem
  source_name TEXT,                        -- web, pos, draft_order, ou ID de app
  referring_site TEXT,
  landing_site TEXT,
  channel TEXT,                            -- enriquecido: meta, google, organic, direct, unknown
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Cliente
  shopify_customer_id BIGINT,
  email_hash TEXT,                         -- SHA-256(lower(trim(email))) pra cross-loja join

  -- Geo (snapshot do shipping_address)
  ship_country TEXT,
  ship_country_code TEXT,                  -- "BR", "US"
  ship_province TEXT,                      -- "São Paulo"
  ship_province_code TEXT,                 -- "SP"
  ship_city TEXT,
  ship_zip TEXT,

  -- Counts (derivado, pra query rápida)
  items_count INT NOT NULL DEFAULT 0,
  units_count INT NOT NULL DEFAULT 0,

  -- Marketing consent
  email_marketing_consent BOOLEAN,
  sms_marketing_consent BOOLEAN,

  raw_payload JSONB,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enriched_at TIMESTAMPTZ,

  CONSTRAINT dw_orders_unique UNIQUE (client_id, shopify_order_id)
);

CREATE INDEX IF NOT EXISTS idx_dw_orders_client_created ON dw_orders(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dw_orders_email_hash ON dw_orders(email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dw_orders_geo ON dw_orders(ship_country_code, ship_province_code);
CREATE INDEX IF NOT EXISTS idx_dw_orders_ticket ON dw_orders(ticket_band);
CREATE INDEX IF NOT EXISTS idx_dw_orders_channel ON dw_orders(channel);

-- ============================================================================
-- ORDER ITEMS — granularidade onde mora o BI cross-loja
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES dw_orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,

  -- Shopify
  shopify_line_item_id BIGINT NOT NULL,
  shopify_product_id BIGINT,
  shopify_variant_id BIGINT,

  -- Identificação básica
  title TEXT NOT NULL,                     -- "Camisa Cruzeiro Titular 93/94 - Versão Retrô"
  variant_title TEXT,                      -- "G / Personalizar"
  sku TEXT,
  vendor TEXT,                             -- "Stoom", "Lever Ecomm" — fornecedor / dropship

  -- Quantidades e valores
  quantity INT NOT NULL,
  price NUMERIC(12,2) NOT NULL,            -- unit price
  total_discount NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL,       -- price * quantity - discount

  -- ENRIQUECIMENTO (chave do BI cross-loja)
  team TEXT,                               -- "Cruzeiro", "Brasil", "Real Madrid"
  team_country TEXT,                       -- "BR", "ES", "AR" — pra cortar por nacionalidade
  category TEXT,                           -- "Retrô", "Atual", "Seleção", "Treino", "Infantil", "Plus size", "Acessório"
  season TEXT,                             -- "93/94", "2024/25", "2026"
  season_year INT,                         -- 1993, 2024, 2026 — pra range
  model TEXT,                              -- "Titular", "Reserva", "Goleiro", "Treino"

  -- Personalização (upsell)
  is_personalized BOOLEAN DEFAULT FALSE,   -- tem nome ou número
  personalization_name TEXT,
  personalization_number TEXT,

  -- Patches (upsell)
  has_patches BOOLEAN DEFAULT FALSE,
  patches_count INT DEFAULT 0,
  patch_titles TEXT[],                     -- array dos patches anexos

  -- Tamanho
  size TEXT,                               -- "P", "M", "G", "GG", "G3", "10 anos"
  is_plus_size BOOLEAN DEFAULT FALSE,

  -- Pairing (camisa + patch normalmente vêm com mesmo _pairing_id)
  pairing_id TEXT,
  is_attached BOOLEAN DEFAULT FALSE,       -- linha é patch anexa a outra linha?
  attached_to TEXT,                        -- "Camisa"

  properties_json JSONB,                   -- raw line_item.properties[] pra debug

  CONSTRAINT dw_order_items_unique UNIQUE (order_id, shopify_line_item_id)
);

CREATE INDEX IF NOT EXISTS idx_dw_items_client ON dw_order_items(client_id);
CREATE INDEX IF NOT EXISTS idx_dw_items_team ON dw_order_items(team);
CREATE INDEX IF NOT EXISTS idx_dw_items_category ON dw_order_items(category);
CREATE INDEX IF NOT EXISTS idx_dw_items_season_year ON dw_order_items(season_year);
CREATE INDEX IF NOT EXISTS idx_dw_items_product ON dw_order_items(client_id, shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_dw_items_personalized ON dw_order_items(is_personalized) WHERE is_personalized = TRUE;
CREATE INDEX IF NOT EXISTS idx_dw_items_patches ON dw_order_items(has_patches) WHERE has_patches = TRUE;

-- ============================================================================
-- CUSTOMERS (por loja, com agregados pré-calculados)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  shopify_customer_id BIGINT NOT NULL,

  -- PII (Supabase é privado, mas hash separado pra cross-loja)
  email TEXT,
  email_hash TEXT,                         -- SHA-256(lower(trim(email)))
  phone TEXT,
  phone_hash TEXT,                         -- SHA-256(numérico-only do phone)
  first_name TEXT,
  last_name TEXT,

  -- Geo do endereço default
  country_code TEXT,
  province_code TEXT,
  city TEXT,

  -- Marketing
  email_marketing_consent BOOLEAN,
  sms_marketing_consent BOOLEAN,

  -- Agregados (atualizados após cada backfill/sync)
  shopify_created_at TIMESTAMPTZ,
  first_order_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  total_orders INT NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_ticket NUMERIC(12,2),

  raw_payload JSONB,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dw_customers_unique UNIQUE (client_id, shopify_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_dw_customers_email_hash ON dw_customers(email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dw_customers_client ON dw_customers(client_id);
CREATE INDEX IF NOT EXISTS idx_dw_customers_recency ON dw_customers(client_id, last_order_at DESC);

-- ============================================================================
-- CUSTOMER IDENTITY — dedup cross-loja por email_hash
-- ============================================================================
-- Cada email único vira 1 identity. Aponta pra todas as (client_id, customer_id)
-- onde esse email apareceu. É a tabela mágica do "quem compra em N lojas".

CREATE TABLE IF NOT EXISTS dw_customer_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT NOT NULL UNIQUE,

  -- Agregados cross-loja
  stores_count INT NOT NULL DEFAULT 0,
  total_orders_all_stores INT NOT NULL DEFAULT 0,
  total_spent_all_stores_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,

  -- Lista de client_ids onde apareceu (pra query rápida sem join)
  client_ids UUID[] NOT NULL DEFAULT '{}',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dw_identity_stores_count ON dw_customer_identity(stores_count DESC);
CREATE INDEX IF NOT EXISTS idx_dw_identity_total_spent ON dw_customer_identity(total_spent_all_stores_brl DESC);

-- ============================================================================
-- SYNC STATE — rastreia onde parou o backfill de cada loja
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_sync_state (
  client_id UUID PRIMARY KEY REFERENCES agency_clients(id) ON DELETE CASCADE,
  resource TEXT NOT NULL DEFAULT 'orders', -- "orders", "customers", "products"
  backfill_started_at TIMESTAMPTZ,
  backfill_completed_at TIMESTAMPTZ,
  backfill_from_date TIMESTAMPTZ,
  last_synced_order_created_at TIMESTAMPTZ,
  total_orders_synced INT NOT NULL DEFAULT 0,
  last_error TEXT,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- VIEWS canônicas pra BI (atalhos pra queries comuns)
-- ============================================================================

-- Top SKU por loja (volume × receita)
CREATE OR REPLACE VIEW dw_v_sku_velocity AS
SELECT
  c.name AS client_name,
  i.client_id,
  i.shopify_product_id,
  MIN(i.title) AS title,
  i.team,
  i.category,
  i.season,
  COUNT(DISTINCT i.order_id) AS orders,
  SUM(i.quantity) AS units,
  SUM(i.line_total) AS revenue_brl,
  MIN(o.created_at) AS first_sold_at,
  MAX(o.created_at) AS last_sold_at
FROM dw_order_items i
JOIN dw_orders o ON o.id = i.order_id
JOIN agency_clients c ON c.id = i.client_id
WHERE o.financial_status = 'paid'
GROUP BY i.client_id, c.name, i.shopify_product_id, i.team, i.category, i.season;

-- Cross-loja: time × categoria × país do cliente
CREATE OR REPLACE VIEW dw_v_geo_team_heatmap AS
SELECT
  o.ship_country_code,
  o.ship_province_code,
  i.team,
  i.category,
  COUNT(DISTINCT o.id) AS orders,
  SUM(i.quantity) AS units,
  SUM(i.line_total) AS revenue_brl
FROM dw_order_items i
JOIN dw_orders o ON o.id = i.order_id
WHERE o.financial_status = 'paid' AND i.team IS NOT NULL
GROUP BY o.ship_country_code, o.ship_province_code, i.team, i.category;

-- RFM por cliente (no nível loja)
CREATE OR REPLACE VIEW dw_v_customer_rfm AS
SELECT
  c.client_id,
  ac.name AS client_name,
  c.id AS customer_id,
  c.email_hash,
  c.first_name,
  c.country_code,
  c.province_code,
  c.total_orders AS frequency,
  c.total_spent AS monetary,
  c.last_order_at AS last_purchase,
  EXTRACT(DAY FROM (now() - c.last_order_at))::INT AS days_since_last_order,
  c.avg_ticket
FROM dw_customers c
JOIN agency_clients ac ON ac.id = c.client_id
WHERE c.total_orders > 0;

-- Clientes cross-loja (top valor combinado)
CREATE OR REPLACE VIEW dw_v_cross_store_customers AS
SELECT
  id.email_hash,
  id.stores_count,
  id.total_orders_all_stores,
  id.total_spent_all_stores_brl,
  id.first_seen_at,
  id.last_seen_at,
  id.client_ids,
  ARRAY(
    SELECT name FROM agency_clients WHERE id = ANY(id.client_ids)
  ) AS store_names
FROM dw_customer_identity id
WHERE id.stores_count >= 2
ORDER BY id.total_spent_all_stores_brl DESC;

COMMENT ON TABLE dw_orders IS 'Lever DW — pedidos normalizados de todas as lojas Shopify dos clientes da agência';
COMMENT ON TABLE dw_order_items IS 'Lever DW — itens enriquecidos (time, categoria, temporada, personalização) — granularidade do BI cross-loja';
COMMENT ON TABLE dw_customer_identity IS 'Lever DW — dedup cross-loja por SHA-256(email) — responde "quem compra em N lojas Lever"';
