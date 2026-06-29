-- Sessões de tempo gasto em demandas (cronômetro de produtividade)
-- Cada linha é uma sessão de trabalho de 1 usuário em 1 demanda.
-- ended_at = NULL significa sessão ainda em andamento.
-- duration_seconds é gravado no fechamento da sessão (app layer).

CREATE TABLE IF NOT EXISTS public.task_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.client_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_time_entries_task
    ON public.task_time_entries(task_id);

-- Índice parcial: lookup rápido de sessões abertas de cada usuário
CREATE INDEX IF NOT EXISTS idx_task_time_entries_user_open
    ON public.task_time_entries(user_id) WHERE ended_at IS NULL;

ALTER TABLE public.task_time_entries ENABLE ROW LEVEL SECURITY;

-- Cada usuário gerencia suas próprias sessões
DROP POLICY IF EXISTS "Users manage own time entries" ON public.task_time_entries;
CREATE POLICY "Users manage own time entries"
ON public.task_time_entries FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Owners/admins do workspace VEEM todas as sessões da workspace (analytics)
DROP POLICY IF EXISTS "Workspace admins see all time entries" ON public.task_time_entries;
CREATE POLICY "Workspace admins see all time entries"
ON public.task_time_entries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.client_tasks ct
        JOIN public.agency_clients ac ON ac.id = ct.client_id
        JOIN public.workspaces w ON w.id = ac.workspace_id
        WHERE ct.id = task_time_entries.task_id
        AND (
            w.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.team_members tm
                WHERE tm.workspace_id = w.id
                AND tm.user_id = auth.uid()
                AND tm.role IN ('admin', 'owner')
            )
        )
    )
);

COMMENT ON TABLE public.task_time_entries IS
    'Sessões de cronômetro por demanda/usuário. Base para analytics de tempo gasto.';
