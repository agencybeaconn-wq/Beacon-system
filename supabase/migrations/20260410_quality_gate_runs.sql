-- Migration: quality-gate runs tracking + per-client config
-- Adds: client_quality_runs (histórico de execuções) + client_quality_config (thresholds e flags)

-- Per-client thresholds & flags
CREATE TABLE IF NOT EXISTS client_quality_config (
  client_id UUID PRIMARY KEY REFERENCES agency_clients(id) ON DELETE CASCADE,
  gate_on_write BOOLEAN DEFAULT false,
  max_price_variance NUMERIC DEFAULT 0.01,
  min_products_per_collection INTEGER DEFAULT 3,
  required_collections JSONB DEFAULT '[]'::jsonb, -- ex: ["Brasileirão", "Copa do Mundo", ...]
  enabled_checks JSONB DEFAULT '[]'::jsonb,       -- [] = all, ou ["prices", "soldout", "images", ...]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Execution history
CREATE TABLE IF NOT EXISTS client_quality_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ DEFAULT now(),
  score INTEGER NOT NULL,                -- 0-100
  counts JSONB NOT NULL,                 -- { "PASS": N, "WARN": N, "FAIL": N, "SKIP": N }
  results JSONB NOT NULL,                -- array completo de check results
  elapsed_seconds NUMERIC,
  triggered_by TEXT DEFAULT 'manual',    -- 'manual' | 'weekly' | 'pre-flight'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_runs_client_date
  ON client_quality_runs(client_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_runs_score
  ON client_quality_runs(score);

-- RLS
ALTER TABLE client_quality_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_quality_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quality config"
  ON client_quality_config FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage quality config"
  ON client_quality_config FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view quality runs"
  ON client_quality_runs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert quality runs"
  ON client_quality_runs FOR INSERT WITH CHECK (true);
