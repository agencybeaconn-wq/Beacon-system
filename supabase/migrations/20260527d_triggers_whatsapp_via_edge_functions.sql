-- Reescreve notify_on_task_assign e notify_on_task_complete pra:
-- 1) Manter create_notification (sino in-app) — não muda.
-- 2) ADICIONAR chamada async pra edge function via net.http_post — passa
--    Authorization X-Internal-Auth lido do Vault. Aceita pelo bypass interno
--    das edge functions deployed na sessão de 2026-05-27.
--
-- Por que trigger SQL e não invoke do front:
-- - Solicitacoes.tsx, PortalNewDemand.tsx, AgencyNewDemand.tsx e qualquer
--   feature futura que altere assignee_id ou status='concluido' passam a
--   notificar WhatsApp sem depender do front lembrar.
-- - Padrão JEB "single source of truth no banco".
-- - pg_net é async — UPDATE não bloqueia se Evolution API estiver lenta.

-- Helper: lê o secret do Vault uma vez por execução do trigger
CREATE OR REPLACE FUNCTION public._get_internal_secret()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'vault', 'public', 'pg_temp'
STABLE
AS $$
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'lever_mcp_internal_secret' LIMIT 1
$$;

-- Constante do project_url da edge function. Hardcode aqui é OK porque é
-- público (qualquer cliente do Supabase já tem). Mudou de projeto = nova migration.
CREATE OR REPLACE FUNCTION public._edge_function_url(_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/' || _name
$$;

-- ─────────────────────────────────────────────────────────────────
-- notify_on_task_assign
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_task_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_client_name TEXT;
    v_secret TEXT;
    v_request_id BIGINT;
BEGIN
    -- Só dispara em mudança real de assignee
    IF NEW.assignee_id IS NULL OR (TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id) THEN
        RETURN NEW;
    END IF;

    SELECT name INTO v_client_name FROM public.agency_clients WHERE id = NEW.client_id LIMIT 1;

    -- 1. Notificação in-app (sino) — mantém comportamento anterior
    PERFORM public.create_notification(
        NEW.workspace_id,
        NEW.assignee_id,
        'task_assigned',
        'Nova tarefa atribuída',
        COALESCE(NEW.title, 'Sem título') || ' — ' || COALESCE(v_client_name, ''),
        '/tasks',
        jsonb_build_object('task_id', NEW.id, 'client_id', NEW.client_id)
    );

    -- 2. WhatsApp via edge function notify-task-assigned (async, não bloqueia)
    v_secret := public._get_internal_secret();
    IF v_secret IS NULL OR v_secret = '' THEN
        RAISE LOG '[notify_on_task_assign] internal secret missing — skip WhatsApp';
        RETURN NEW;
    END IF;

    BEGIN
        SELECT net.http_post(
            url := public._edge_function_url('notify-task-assigned'),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'X-Internal-Auth', v_secret
            ),
            body := jsonb_build_object(
                'assignee_id', NEW.assignee_id,
                'task_title', NEW.title,
                'task_description', NEW.description,
                'client_name', v_client_name,
                'workspace_id', NEW.workspace_id,
                'due_date', NEW.due_date,
                'priority', NEW.priority,
                'area', NEW.area,
                'images', COALESCE(NEW.images, '[]'::jsonb),
                'drive_links', COALESCE(NEW.drive_links, '[]'::jsonb)
            ),
            timeout_milliseconds := 15000
        ) INTO v_request_id;
        RAISE LOG '[notify_on_task_assign] task=% assignee=% pg_net request_id=%', NEW.id, NEW.assignee_id, v_request_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[notify_on_task_assign] http_post falhou: %', SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────
-- notify_on_task_complete
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_task_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_client_name TEXT;
    v_ws_member RECORD;
    v_secret TEXT;
    v_request_id BIGINT;
BEGIN
    -- Status canônico agora é 'concluido' (alinhado com task_columns).
    -- Mantém compat com 'done', 'completed', 'concluido.' caso legacy.
    IF NEW.status NOT IN ('concluido', 'done', 'completed', 'concluido.')
       OR OLD.status IN ('concluido', 'done', 'completed', 'concluido.') THEN
        RETURN NEW;
    END IF;

    SELECT name INTO v_client_name FROM public.agency_clients WHERE id = NEW.client_id LIMIT 1;

    -- 1. Notificação in-app (sino) pra owners do workspace exceto quem concluiu
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

    -- 2. WhatsApp no grupo do cliente via edge function (async)
    v_secret := public._get_internal_secret();
    IF v_secret IS NULL OR v_secret = '' THEN
        RAISE LOG '[notify_on_task_complete] internal secret missing — skip WhatsApp';
        RETURN NEW;
    END IF;

    BEGIN
        SELECT net.http_post(
            url := public._edge_function_url('notify-task-completed'),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'X-Internal-Auth', v_secret
            ),
            body := jsonb_build_object('taskId', NEW.id),
            timeout_milliseconds := 15000
        ) INTO v_request_id;
        RAISE LOG '[notify_on_task_complete] task=% pg_net request_id=%', NEW.id, v_request_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG '[notify_on_task_complete] http_post falhou: %', SQLERRM;
    END;

    RETURN NEW;
END;
$function$;
