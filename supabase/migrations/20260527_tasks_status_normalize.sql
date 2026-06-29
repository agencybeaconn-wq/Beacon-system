-- ═══════════════════════════════════════════════════════════════════════
-- Tasks: normalize status + adicionar coluna 'concluido' + backfill ws
-- ═══════════════════════════════════════════════════════════════════════
-- Já aplicada em prod em 2026-05-27 via Supabase MCP — arquivo .sql
-- registrado no repo pra rastreabilidade.
--
-- Decisão arquitetural: task_columns.id é source of truth pros status.
-- Antes: DB tinha 8 status diferentes; 88% das tasks ficavam invisíveis no
-- kanban (status que não existia em task_columns).
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Backup (não-transacional pra preservar mesmo se falhar)
CREATE TABLE IF NOT EXISTS _backup_client_tasks_20260527 AS SELECT * FROM public.client_tasks;
CREATE TABLE IF NOT EXISTS _backup_task_columns_20260527 AS SELECT * FROM public.task_columns;

-- 2) Atualizar função do trigger pra reconhecer novo status canônico
CREATE OR REPLACE FUNCTION public.notify_on_task_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_client_name TEXT;
    v_ws_member RECORD;
BEGIN
    -- Status canônico = 'concluido' (alinhado com task_columns). Aceita também
    -- os antigos pra compat retroativa caso algum legacy ainda envie.
    IF NEW.status IN ('concluido', 'done', 'completed', 'concluido.')
       AND OLD.status NOT IN ('concluido', 'done', 'completed', 'concluido.') THEN
        SELECT name INTO v_client_name FROM public.agency_clients WHERE id = NEW.client_id LIMIT 1;

        FOR v_ws_member IN
            SELECT owner_id AS uid FROM public.workspaces WHERE id = NEW.workspace_id
        LOOP
            IF v_ws_member.uid IS NOT NULL AND v_ws_member.uid != COALESCE(NEW.assignee_id, '00000000-0000-0000-0000-000000000000') THEN
                PERFORM public.create_notification(
                    NEW.workspace_id,
                    v_ws_member.uid,
                    'task_completed',
                    'Tarefa concluída',
                    COALESCE(NEW.title, 'Sem título') || ' — ' || COALESCE(v_client_name, ''),
                    '/tasks',
                    jsonb_build_object('task_id', NEW.id, 'client_id', NEW.client_id)
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$function$;

-- 3) Renomear 'alteração_/_revisão' (acentos+barra) → 'alteracao_revisao'
UPDATE public.client_tasks SET status='alteracao_revisao' WHERE status='alteração_/_revisão';
UPDATE public.task_columns SET id='alteracao_revisao' WHERE id='alteração_/_revisão';

-- 4) Adicionar coluna 'concluido' (88% das tasks ganham home no kanban)
INSERT INTO public.task_columns (id, title, position, color)
VALUES ('concluido', 'Concluído', 4, 'bg-emerald-500')
ON CONFLICT (id) DO NOTHING;

-- 5) Backfill workspace_id NULL (9 tasks: Loja da torcida 5 + foot kids 3 + Golaço 1)
UPDATE public.client_tasks t
   SET workspace_id = c.workspace_id
  FROM public.agency_clients c
 WHERE t.client_id = c.id
   AND t.workspace_id IS NULL;

-- 6) Normalize status (source of truth = task_columns.id)
UPDATE public.client_tasks SET status='todo' WHERE status IN ('pending','backlog');
UPDATE public.client_tasks SET status='em_progresso' WHERE status='in_progress';
UPDATE public.client_tasks SET status='concluido' WHERE status IN ('completed','done','concluido.');
