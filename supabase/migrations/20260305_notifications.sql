-- ============================================================================
-- Notifications System
-- ============================================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_workspace 
    ON public.notifications (workspace_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications
    FOR ALL USING (auth.uid() = user_id);

-- 4. Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
    p_workspace_id UUID,
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT DEFAULT NULL,
    p_link TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.notifications (workspace_id, user_id, type, title, message, link, metadata)
    VALUES (p_workspace_id, p_user_id, p_type, p_title, p_message, p_link, p_metadata)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger: notify assignee when task is assigned or reassigned
CREATE OR REPLACE FUNCTION public.notify_on_task_assign()
RETURNS TRIGGER AS $$
DECLARE
    v_client_name TEXT;
BEGIN
    -- Only fire when assignee changes and new assignee is not null
    IF NEW.assignee_id IS NOT NULL AND (OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
        SELECT name INTO v_client_name FROM public.agency_clients WHERE id = NEW.client_id LIMIT 1;
        
        PERFORM public.create_notification(
            NEW.workspace_id,
            NEW.assignee_id,
            'task_assigned',
            'Nova tarefa atribuída',
            COALESCE(NEW.title, 'Sem título') || ' — ' || COALESCE(v_client_name, ''),
            '/tasks',
            jsonb_build_object('task_id', NEW.id, 'client_id', NEW.client_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_task_assign ON public.client_tasks;
CREATE TRIGGER tr_notify_task_assign
    AFTER INSERT OR UPDATE OF assignee_id ON public.client_tasks
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_assign();

-- 6. Trigger: notify team when task is completed
CREATE OR REPLACE FUNCTION public.notify_on_task_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_client_name TEXT;
    v_ws_member RECORD;
BEGIN
    -- Only fire when status changes to done/completed/concluido.
    IF NEW.status IN ('done', 'completed', 'concluido.') AND OLD.status NOT IN ('done', 'completed', 'concluido.') THEN
        SELECT name INTO v_client_name FROM public.agency_clients WHERE id = NEW.client_id LIMIT 1;
        
        -- Notify workspace admins (owner)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_task_complete ON public.client_tasks;
CREATE TRIGGER tr_notify_task_complete
    AFTER UPDATE OF status ON public.client_tasks
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_complete();
