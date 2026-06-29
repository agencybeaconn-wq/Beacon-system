-- Lever DW — Schema warehouse + tabelas base
-- Bootstrap: 2026-05-13
-- Aplicar via: Supabase Dashboard → SQL Editor → cola este arquivo → Run
-- ⚠️ Requer service_role. Não toca em tabelas existentes — só cria schema novo.

CREATE SCHEMA IF NOT EXISTS warehouse;

-- ─────────────────────────────────────────────────────────────────
-- DIM_STORE — uma linha por loja conectada
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse.dim_store (
  store_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_client_id      uuid REFERENCES public.agency_clients(id) ON DELETE SET NULL,
  brand_name            text NOT NULL,              -- "Mantos do PH", "Coringa On Shop", "Kron"
  tier                  text NOT NULL DEFAULT 'A',  -- 'S' (comissão), 'A' (pró-labore), 'OWN' (Kron/Nord/Respeita)
  market                text,                       -- 'BR', 'UK', 'EU', 'US'
  currency              text,                       -- 'BRL', 'GBP', 'EUR', 'USD'
  shopify_domain        text,
  cartpanda_account_id  text,
  meta_ad_account_id    text,
  google_customer_id    text,
  commission_rule       jsonb,                      -- {"type":"pct_revenue","value":3.5} ou {"type":"pct_profit","value":15}
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  active                boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_dim_store_tier ON warehouse.dim_store(tier) WHERE active;
CREATE INDEX IF NOT EXISTS idx_dim_store_market ON warehouse.dim_store(market) WHERE active;

-- ─────────────────────────────────────────────────────────────────
-- DIM_CUSTOMER — cliente final, anonimizado via hash
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse.dim_customer (
  customer_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash            text UNIQUE NOT NULL,       -- SHA-256(email lowercased + trimmed)
  first_seen_at         timestamptz NOT NULL,
  last_seen_at          timestamptz NOT NULL,
  total_orders          int DEFAULT 0,
  total_revenue_brl     numeric(14,2) DEFAULT 0,    -- normalizado pra BRL pra cross-store
  stores_purchased      int DEFAULT 1,              -- em quantas lojas comprou
  primary_market        text,                       -- mercado da 1ª compra
  age_bucket            text,                       -- '18-24','25-34','35-44','45-54','55+'
  geo_country           text,
  geo_city              text
);

CREATE INDEX IF NOT EXISTS idx_dim_customer_cross_store ON warehouse.dim_customer(stores_purchased) WHERE stores_purchased > 1;
CREATE INDEX IF NOT EXISTS idx_dim_customer_revenue ON warehouse.dim_customer(total_revenue_brl DESC);

-- ─────────────────────────────────────────────────────────────────
-- FACT_ORDER — grão pedido
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse.fact_order (
  order_pk              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid NOT NULL REFERENCES warehouse.dim_store(store_id),
  source_order_id       text NOT NULL,              -- ID nativo Shopify/CartPanda
  source_platform       text NOT NULL,              -- 'shopify' | 'cartpanda'
  customer_id           uuid REFERENCES warehouse.dim_customer(customer_id),
  ordered_at            timestamptz NOT NULL,
  total_amount          numeric(14,2) NOT NULL,
  total_amount_brl      numeric(14,2) NOT NULL,     -- convertido p/ comparação cross-loja
  currency              text NOT NULL,
  financial_status      text,                       -- paid/pending/refunded
  fulfillment_status    text,
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,
  attribution_source    text,                       -- 'meta' | 'google' | 'direct' | 'organic' | 'klaviyo'
  is_first_order        boolean DEFAULT false,
  raw_payload           jsonb,                      -- snapshot da API pra debug
  ingested_at           timestamptz DEFAULT now(),
  UNIQUE (store_id, source_order_id)
);

CREATE INDEX IF NOT EXISTS idx_fact_order_ordered_at ON warehouse.fact_order(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_order_store_date ON warehouse.fact_order(store_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_order_attribution ON warehouse.fact_order(attribution_source, ordered_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- FACT_ORDER_ITEM — grão linha (SKU)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse.fact_order_item (
  order_item_pk         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_pk              uuid NOT NULL REFERENCES warehouse.fact_order(order_pk) ON DELETE CASCADE,
  store_id              uuid NOT NULL REFERENCES warehouse.dim_store(store_id),
  sku                   text,
  product_id            text,
  product_title         text,
  variant_id            text,
  variant_title         text,
  quantity              int NOT NULL,
  unit_price            numeric(14,2) NOT NULL,
  line_total            numeric(14,2) NOT NULL,
  line_total_brl        numeric(14,2) NOT NULL,
  vendor                text,
  product_type          text,
  ordered_at            timestamptz NOT NULL        -- desnormalizado p/ queries rápidas
);

CREATE INDEX IF NOT EXISTS idx_foi_sku_date ON warehouse.fact_order_item(sku, ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_foi_product_title ON warehouse.fact_order_item USING gin (to_tsvector('portuguese', coalesce(product_title,'')));
CREATE INDEX IF NOT EXISTS idx_foi_store_date ON warehouse.fact_order_item(store_id, ordered_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- FACT_AD_SPEND_DAILY — grão dia × campanha
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse.fact_ad_spend_daily (
  spend_pk              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid NOT NULL REFERENCES warehouse.dim_store(store_id),
  platform              text NOT NULL,              -- 'meta' | 'google'
  account_id            text NOT NULL,
  campaign_id           text NOT NULL,
  campaign_name         text,
  adset_id              text,                       -- meta: adset, google: ad group
  adset_name            text,
  date                  date NOT NULL,
  spend                 numeric(14,2) DEFAULT 0,
  spend_brl             numeric(14,2) DEFAULT 0,
  impressions           int DEFAULT 0,
  clicks                int DEFAULT 0,
  purchases             int DEFAULT 0,              -- attributed pela plataforma
  purchase_value        numeric(14,2) DEFAULT 0,
  add_to_carts          int DEFAULT 0,
  initiate_checkouts    int DEFAULT 0,
  currency              text,
  ingested_at           timestamptz DEFAULT now(),
  UNIQUE (store_id, platform, campaign_id, adset_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_date ON warehouse.fact_ad_spend_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_spend_store_date ON warehouse.fact_ad_spend_daily(store_id, date DESC);

-- ─────────────────────────────────────────────────────────────────
-- INGESTION_LOG — auditoria do robôzinho
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse.ingestion_log (
  log_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid REFERENCES warehouse.dim_store(store_id),
  source                text NOT NULL,              -- 'shopify' | 'cartpanda' | 'meta' | 'google'
  run_started_at        timestamptz NOT NULL,
  run_finished_at       timestamptz,
  rows_inserted         int DEFAULT 0,
  rows_updated          int DEFAULT 0,
  status                text,                       -- 'ok' | 'partial' | 'error'
  error_message         text
);

-- ─────────────────────────────────────────────────────────────────
-- FX_RATE — câmbio diário para normalizar p/ BRL
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse.fx_rate (
  fx_date               date NOT NULL,
  currency              text NOT NULL,
  rate_to_brl           numeric(14,6) NOT NULL,
  PRIMARY KEY (fx_date, currency)
);

-- ─────────────────────────────────────────────────────────────────
-- RLS — service_role tem acesso total; default deny p/ outros
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE warehouse.dim_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.dim_customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.fact_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.fact_order_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.fact_ad_spend_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.ingestion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse.fx_rate ENABLE ROW LEVEL SECURITY;

-- service_role bypassa RLS por default; políticas p/ leitura via authenticated podem ser adicionadas depois
