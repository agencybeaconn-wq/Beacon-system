-- Migration: Add Microsoft Clarity integration to agency_clients
-- Clarity Data Export API: 10 req/day/project — precisa de cache agressivo

-- Colunas em agency_clients pra credenciais Clarity
ALTER TABLE agency_clients
ADD COLUMN IF NOT EXISTS clarity_project_id TEXT,
ADD COLUMN IF NOT EXISTS clarity_api_token TEXT,
ADD COLUMN IF NOT EXISTS clarity_status TEXT DEFAULT 'disconnected' CHECK (clarity_status IN ('disconnected', 'pending', 'connected', 'error')),
ADD COLUMN IF NOT EXISTS clarity_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clarity_snippet_installed BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agency_clients_clarity_project_id
  ON agency_clients(clarity_project_id) WHERE clarity_project_id IS NOT NULL;

COMMENT ON COLUMN agency_clients.clarity_project_id IS 'Microsoft Clarity project ID (string curto tipo abc123xyz)';
COMMENT ON COLUMN agency_clients.clarity_api_token IS 'JWT Bearer token gerado em Settings > Data Export do Clarity';
COMMENT ON COLUMN agency_clients.clarity_status IS 'disconnected, pending, connected, error';
COMMENT ON COLUMN agency_clients.clarity_connected_at IS 'Quando o token foi validado com sucesso';
COMMENT ON COLUMN agency_clients.clarity_snippet_installed IS 'Se o snippet de tracking foi auto-injetado no tema do cliente';

-- Cache de insights — Clarity API limita a 10 req/dia, então cacheamos cada combinação de (cliente, days, dimensões)
CREATE TABLE IF NOT EXISTS clarity_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  num_of_days INT NOT NULL CHECK (num_of_days IN (1, 2, 3)),
  dimension1 TEXT,
  dimension2 TEXT,
  dimension3 TEXT,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT clarity_insights_cache_unique_key UNIQUE (client_id, num_of_days, dimension1, dimension2, dimension3)
);

CREATE INDEX IF NOT EXISTS idx_clarity_insights_cache_client_id ON clarity_insights_cache(client_id);
CREATE INDEX IF NOT EXISTS idx_clarity_insights_cache_expires_at ON clarity_insights_cache(expires_at);

COMMENT ON TABLE clarity_insights_cache IS 'Cache de respostas da Clarity API (rate limit 10/dia/projeto). TTL típico 4-6h.';

-- Tabela auxiliar pra trackear quantas requests fizemos hoje (rate limit visibility)
CREATE TABLE IF NOT EXISTS clarity_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INT NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  last_status_code INT,
  last_error TEXT,
  CONSTRAINT clarity_api_usage_unique UNIQUE (client_id, request_date)
);

CREATE INDEX IF NOT EXISTS idx_clarity_api_usage_client_date ON clarity_api_usage(client_id, request_date);

COMMENT ON TABLE clarity_api_usage IS 'Track de quantas calls fizemos pra Clarity API hoje (rate limit 10/dia).';

-- RLS
ALTER TABLE clarity_insights_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_api_usage ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem cache dos seus próprios clientes
CREATE POLICY clarity_cache_select_own ON clarity_insights_cache
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM agency_clients
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY clarity_usage_select_own ON clarity_api_usage
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM agency_clients
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- service_role bypassa RLS naturalmente; edge functions usam service_role
