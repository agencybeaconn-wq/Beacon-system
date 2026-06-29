-- Triage result pros demand_requests (classificação do Claude antes da aprovação do gerente).
-- Ref: .claude/skills/triage/SKILL.md

-- 1. Coluna JSONB pra armazenar o resultado completo da triage
ALTER TABLE demand_requests
  ADD COLUMN IF NOT EXISTS triage_result JSONB;

-- 2. Índices pros campos mais consultados (filtrar por tipo/role no kanban)
CREATE INDEX IF NOT EXISTS idx_demand_requests_triage_type
  ON demand_requests ((triage_result->>'type'));

CREATE INDEX IF NOT EXISTS idx_demand_requests_triage_role
  ON demand_requests ((triage_result->>'suggestedRole'));

CREATE INDEX IF NOT EXISTS idx_demand_requests_triage_complexity
  ON demand_requests ((triage_result->>'complexity'));

-- 3. Timestamp de quando foi classificada (pra saber se está stale)
ALTER TABLE demand_requests
  ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ;

-- 4. Comentários pra documentar o shape do JSONB
COMMENT ON COLUMN demand_requests.triage_result IS
'Classificação automática feita pelo skill /triage. Shape:
{
  "type": "pricing | discount | theme-fix | theme-config | new-section | product-import | product-edit | collection | page | image | qa | deploy | integration | design-creative | content-copy | other",
  "complexity": "trivial | medium | complex | unknown",
  "suggestedSkill": "update-prices | null",
  "canAutoExecute": true | false,
  "suggestedRole": "claude | junior | senior | lead",
  "confidence": 0.0-1.0,
  "matchedPattern": "regex snippet" (debug)
}';

COMMENT ON COLUMN demand_requests.triaged_at IS
'Timestamp da última classificação. NULL = nunca triada.';

-- 5. View conveniente pra listar demandas pendentes com triage
CREATE OR REPLACE VIEW v_demand_requests_triaged AS
SELECT
  d.*,
  (d.triage_result->>'type') AS triage_type,
  (d.triage_result->>'complexity') AS triage_complexity,
  (d.triage_result->>'suggestedRole') AS triage_role,
  (d.triage_result->>'suggestedSkill') AS triage_skill,
  (d.triage_result->>'canAutoExecute')::boolean AS triage_auto,
  (d.triage_result->>'confidence')::numeric AS triage_confidence
FROM demand_requests d;

COMMENT ON VIEW v_demand_requests_triaged IS
'View achatada do demand_requests com triage_result expandido em colunas. Usar no frontend pra filtros/sorting.';
