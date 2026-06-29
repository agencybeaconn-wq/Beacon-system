-- ═══════════════════════════════════════════════════════════════════════
-- Ciclo de vida das tarefas concluídas (board → Finalizadas → some)
-- ═══════════════════════════════════════════════════════════════════════
-- Já aplicada em prod (pxhmz) 2026-06-01 via Supabase MCP — arquivo .sql
-- registrado pra rastreabilidade.
--
-- Decisão (João, 2026-06-01): dar ciclo de vida às concluídas no kanban.
--   • Board → coluna "Concluído" mostra só as dos ÚLTIMOS 7 DIAS.
--   • Aba "Finalizadas" → concluídas entre 7 e 14 dias.
--   • > 14 dias → somem (auto-arquivadas, computado por idade no front).
--
-- A separação é feita no FRONT (src/components/lever-os/TasksView.tsx): ele
-- renderiza a coluna 'concluido' EXPLICITAMENTE, filtrada por completed_at.
-- Por isso `task_columns.concluido` segue com **hidden=true** de propósito —
-- assim o loader genérico (TasksContext usa hidden=false) e qualquer front
-- antigo NÃO despejam as ~390 concluídas no board; quem controla a exibição
-- das concluídas é o front, por data.
--
-- Esta migration garante só a INFRA DE DADOS: completed_at confiável + backfill.
-- (Reverte na prática o sumiço total do hidden=true da 20260527b, mas via front.)
-- ═══════════════════════════════════════════════════════════════════════

-- 0) Backup
CREATE TABLE IF NOT EXISTS _backup_client_tasks_20260601 AS SELECT * FROM public.client_tasks;

-- 1) completed_at confiável via trigger (não depender do front setar)
CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'concluido' THEN
    IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM 'concluido') THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    END IF;
  ELSE
    NEW.completed_at := NULL;
    NEW.archived_at := NULL;  -- sair de concluído desarquiva
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_task_completed_at ON public.client_tasks;
CREATE TRIGGER tr_set_task_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.client_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_completed_at();

-- 2) Backfill: concluídas sem completed_at usam updated_at/created_at como proxy
UPDATE public.client_tasks
SET completed_at = COALESCE(updated_at, created_at, now())
WHERE status = 'concluido' AND completed_at IS NULL;
