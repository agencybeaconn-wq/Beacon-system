-- =============================================================================
-- FIX: Remover tasks duplicadas e prevenir futuras duplicações
-- =============================================================================

-- 1. Identificar e deletar duplicatas (manter a mais recente por client_id + step_id)
DELETE FROM client_tasks a
USING client_tasks b
WHERE a.client_id = b.client_id
  AND a.step_id = b.step_id
  AND a.step_id IS NOT NULL
  AND a.id != b.id
  AND a.created_at < b.created_at;

-- 2. Criar constraint UNIQUE parcial (só para tasks com step_id preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS unique_client_step_task
ON client_tasks (client_id, step_id)
WHERE step_id IS NOT NULL;
