-- ═══════════════════════════════════════════════════════════════════════
-- Reverte a duplicata for_client (client_tasks) e porta o WhatsApp pro
-- mecanismo que JÁ existia: client_assigned_tasks ("Atribuir ao Cliente").
-- ═══════════════════════════════════════════════════════════════════════
-- Contexto: a feature 20260601c (for_client) duplicou client_assigned_tasks.
-- Reverter + manter só o ganho real (notificação WhatsApp ao atribuir tarefa).
-- Já aplicada em prod (pxhmz) 2026-06-01 via Supabase MCP.

-- 1) REVERTER for_client em client_tasks
DROP TRIGGER IF EXISTS tr_notify_on_client_demand ON public.client_tasks;
DROP FUNCTION IF EXISTS public.notify_on_client_demand();
DROP POLICY IF EXISTS client_reads_own_for_client_tasks ON public.client_tasks;
DROP POLICY IF EXISTS client_updates_own_for_client_tasks ON public.client_tasks;
DROP INDEX IF EXISTS public.idx_client_tasks_for_client;
ALTER TABLE public.client_tasks DROP COLUMN IF EXISTS for_client;
DROP TABLE IF EXISTS public._backup_client_tasks_20260601c;

-- 2) PORTAR: WhatsApp ao atribuir tarefa pro cliente (client_assigned_tasks)
CREATE OR REPLACE FUNCTION public.notify_on_assigned_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_secret TEXT;
    v_request_id BIGINT;
BEGIN
    IF NEW.status IN ('done', 'concluido', 'completed') THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.status NOT IN ('done', 'concluido', 'completed') THEN
        RETURN NEW;
    END IF;

    v_secret := public._get_internal_secret();
    IF v_secret IS NULL OR v_secret = '' THEN
        RAISE LOG '[notify_on_assigned_task] internal secret missing — skip WhatsApp';
        RETURN NEW;
    END IF;

    BEGIN
        SELECT net.http_post(
            url := public._edge_function_url('notify-client-demand'),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'X-Internal-Auth', v_secret
            ),
            body := jsonb_build_object('taskId', NEW.id),
            timeout_milliseconds := 15000
        ) INTO v_request_id;
        RAISE LOG '[notify_on_assigned_task] task=% pg_net request_id=%', NEW.id, v_request_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[notify_on_assigned_task] http_post falhou: %', SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_notify_on_assigned_task ON public.client_assigned_tasks;
CREATE TRIGGER tr_notify_on_assigned_task
    AFTER INSERT OR UPDATE OF status ON public.client_assigned_tasks
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_assigned_task();
