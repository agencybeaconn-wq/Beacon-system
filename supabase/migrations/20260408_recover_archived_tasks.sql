-- Recuperar tasks que foram auto-arquivadas indevidamente
-- Desfaz o archive de tasks concluídas nos últimos 60 dias
UPDATE public.client_tasks
SET archived_at = NULL
WHERE archived_at IS NOT NULL
  AND completed_at IS NOT NULL
  AND completed_at > NOW() - INTERVAL '60 days';
