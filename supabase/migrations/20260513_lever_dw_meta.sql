-- Lever DW — camada Meta Ads
-- Espelha campaigns/adsets/ads/insights do Meta no schema do DW,
-- linkando cada ad account a um client_id (ou NULL pra Lever-interna).

-- ============================================================================
-- AD ACCOUNTS — master de contas Meta visíveis ao token
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_meta_accounts (
  account_id TEXT PRIMARY KEY,             -- "892737631926022" (sem prefix act_)
  client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  name TEXT,
  business_name TEXT,
  currency TEXT,
  status INT,                              -- 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 9=PENDING
  ownership TEXT,                          -- 'client', 'lever_internal', 'jvf_owned', 'orphan'
  notes TEXT,
  last_synced_at TIMESTAMPTZ,
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_dw_meta_accounts_client ON dw_meta_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_dw_meta_accounts_ownership ON dw_meta_accounts(ownership);

-- ============================================================================
-- CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_meta_campaigns (
  campaign_id TEXT PRIMARY KEY,            -- gid do Meta
  account_id TEXT NOT NULL REFERENCES dw_meta_accounts(account_id) ON DELETE CASCADE,
  client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  effective_status TEXT,
  daily_budget NUMERIC(12,2),
  lifetime_budget NUMERIC(12,2),
  created_time TIMESTAMPTZ,
  updated_time TIMESTAMPTZ,
  start_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,
  raw_payload JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dw_meta_camps_account ON dw_meta_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_dw_meta_camps_client ON dw_meta_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_dw_meta_camps_status ON dw_meta_campaigns(effective_status);

-- ============================================================================
-- ADSETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_meta_adsets (
  adset_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES dw_meta_campaigns(campaign_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES dw_meta_accounts(account_id) ON DELETE CASCADE,
  client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT,
  effective_status TEXT,
  daily_budget NUMERIC(12,2),
  lifetime_budget NUMERIC(12,2),
  bid_amount NUMERIC(12,2),
  bid_strategy TEXT,
  optimization_goal TEXT,
  targeting JSONB,                         -- snapshot do targeting (idade, geo, interesses)
  created_time TIMESTAMPTZ,
  updated_time TIMESTAMPTZ,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  raw_payload JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dw_meta_adsets_campaign ON dw_meta_adsets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dw_meta_adsets_client ON dw_meta_adsets(client_id);

-- ============================================================================
-- ADS — granularidade de criativo
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_meta_ads (
  ad_id TEXT PRIMARY KEY,
  adset_id TEXT NOT NULL REFERENCES dw_meta_adsets(adset_id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES dw_meta_campaigns(campaign_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES dw_meta_accounts(account_id) ON DELETE CASCADE,
  client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT,
  effective_status TEXT,
  creative_id TEXT,
  creative_body TEXT,                      -- texto principal do criativo
  creative_title TEXT,                     -- headline
  creative_description TEXT,
  creative_image_url TEXT,
  creative_video_id TEXT,
  destination_url TEXT,                    -- pra parsear UTMs
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  call_to_action_type TEXT,
  created_time TIMESTAMPTZ,
  updated_time TIMESTAMPTZ,
  raw_payload JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dw_meta_ads_adset ON dw_meta_ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_dw_meta_ads_client ON dw_meta_ads(client_id);
CREATE INDEX IF NOT EXISTS idx_dw_meta_ads_utm_campaign ON dw_meta_ads(utm_campaign);

-- ============================================================================
-- INSIGHTS DIÁRIOS — grão fato (entity × date)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dw_meta_insights_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NOT NULL,                 -- ad_id, adset_id ou campaign_id
  entity_type TEXT NOT NULL,               -- 'ad', 'adset', 'campaign'
  account_id TEXT NOT NULL REFERENCES dw_meta_accounts(account_id) ON DELETE CASCADE,
  client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  date DATE NOT NULL,

  -- Métricas
  impressions INT,
  reach INT,
  clicks INT,
  unique_clicks INT,
  spend NUMERIC(12,2),
  cpm NUMERIC(12,2),
  cpc NUMERIC(12,4),
  ctr NUMERIC(8,4),
  frequency NUMERIC(8,2),

  -- Conversões (do Meta — separado das vendas Shopify reais)
  purchases INT,
  purchases_value NUMERIC(12,2),
  add_to_carts INT,
  initiate_checkouts INT,
  landing_page_views INT,
  video_views INT,

  -- Derivados
  roas NUMERIC(8,2),                       -- purchases_value / spend (Meta-reported)
  cpa NUMERIC(12,2),

  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB,

  CONSTRAINT dw_meta_insights_unique UNIQUE (entity_id, entity_type, date)
);

CREATE INDEX IF NOT EXISTS idx_dw_meta_ins_date ON dw_meta_insights_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_dw_meta_ins_client_date ON dw_meta_insights_daily(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_dw_meta_ins_account_date ON dw_meta_insights_daily(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_dw_meta_ins_entity ON dw_meta_insights_daily(entity_type, entity_id);

-- ============================================================================
-- VIEWS canônicas
-- ============================================================================

-- Gasto Meta vs receita Shopify (atribuição Meta-reported vs ground truth)
CREATE OR REPLACE VIEW dw_v_meta_vs_shopify_daily AS
SELECT
  ac.name AS client_name,
  i.client_id,
  i.date,
  SUM(i.spend) AS meta_spend,
  SUM(i.purchases_value) AS meta_reported_revenue,
  SUM(i.purchases) AS meta_reported_purchases,
  (SELECT SUM(o.total_price) FROM dw_orders o
    WHERE o.client_id = i.client_id
      AND o.financial_status = 'paid'
      AND DATE(o.created_at) = i.date) AS shopify_revenue,
  (SELECT COUNT(*) FROM dw_orders o
    WHERE o.client_id = i.client_id
      AND o.financial_status = 'paid'
      AND DATE(o.created_at) = i.date) AS shopify_orders
FROM dw_meta_insights_daily i
JOIN agency_clients ac ON ac.id = i.client_id
WHERE i.entity_type = 'campaign'
GROUP BY i.client_id, ac.name, i.date;

-- Top ads por ROAS (Meta-reported) últimos 30d
CREATE OR REPLACE VIEW dw_v_top_ads_30d AS
SELECT
  ac.name AS client_name,
  a.client_id,
  a.ad_id,
  a.name AS ad_name,
  a.campaign_id,
  a.creative_title,
  a.creative_image_url,
  SUM(i.spend) AS spend_30d,
  SUM(i.purchases) AS purchases_30d,
  SUM(i.purchases_value) AS revenue_30d,
  CASE WHEN SUM(i.spend) > 0 THEN SUM(i.purchases_value) / SUM(i.spend) ELSE NULL END AS roas_30d,
  SUM(i.impressions) AS impressions_30d,
  SUM(i.clicks) AS clicks_30d
FROM dw_meta_ads a
JOIN dw_meta_insights_daily i ON i.entity_id = a.ad_id AND i.entity_type = 'ad'
JOIN agency_clients ac ON ac.id = a.client_id
WHERE i.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ac.name, a.client_id, a.ad_id, a.name, a.campaign_id, a.creative_title, a.creative_image_url
HAVING SUM(i.spend) > 0;

COMMENT ON TABLE dw_meta_accounts IS 'Lever DW — todas as ad accounts Meta visíveis pelo token, com ownership (cliente / lever interna / jvf)';
COMMENT ON TABLE dw_meta_insights_daily IS 'Lever DW — fato diário Meta. Grão (entity_id, entity_type, date). Junto com dw_orders pra calcular ROAS real.';
