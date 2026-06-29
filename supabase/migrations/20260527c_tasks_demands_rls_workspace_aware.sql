-- ═══════════════════════════════════════════════════════════════════════
-- RLS workspace-aware: client_tasks, demand_requests, task_comments,
--                      client_assigned_tasks
-- ═══════════════════════════════════════════════════════════════════════
-- Substitui as policies anteriores `USING (true)` (anti-padrão JEB) por
-- isolamento real multi-tenant. Padrão Lever (RLS Multi-tenant na Prática):
--
--   - CLIENTE  → vê apenas o próprio linked_client_id
--   - FUNCIONÁRIO → vê todo o workspace
--   - OWNER → vê tudo do workspace dele
--   - SERVICE_ROLE → bypassa RLS automaticamente (mantido)
--
-- Performance:
--   - TO authenticated (não avalia pra anon)
--   - (SELECT auth.email()) cacheado via initPlan
--   - subquery única em team_members (sem JOIN linha-a-linha)
--   - filtro status='active' evita membros pendentes
--   - índices auxiliares no fim
-- ═══════════════════════════════════════════════════════════════════════

-- ─── client_tasks ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_access" ON public.client_tasks;

CREATE POLICY "client_tasks_workspace_read"
ON public.client_tasks FOR SELECT TO authenticated
USING (
    client_id IN (
        SELECT tm.linked_client_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND tm.user_type = 'client'
          AND tm.linked_client_id IS NOT NULL
    )
    OR workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid())
    )
);

CREATE POLICY "client_tasks_staff_write"
ON public.client_tasks FOR ALL TO authenticated
USING (
    workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
)
WITH CHECK (
    workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
);

-- ─── demand_requests ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "demand_requests_authenticated_select" ON public.demand_requests;
DROP POLICY IF EXISTS "demand_requests_authenticated_update" ON public.demand_requests;
DROP POLICY IF EXISTS "demand_requests_authenticated_delete" ON public.demand_requests;
DROP POLICY IF EXISTS "demand_requests_authenticated_insert" ON public.demand_requests;

CREATE POLICY "demand_requests_workspace_read"
ON public.demand_requests FOR SELECT TO authenticated
USING (
    client_id IN (
        SELECT tm.linked_client_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND tm.user_type = 'client'
          AND tm.linked_client_id IS NOT NULL
    )
    OR workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
);

CREATE POLICY "demand_requests_insert"
ON public.demand_requests FOR INSERT TO authenticated
WITH CHECK (
    client_id IN (
        SELECT tm.linked_client_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND tm.linked_client_id IS NOT NULL
    )
    OR workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
);

CREATE POLICY "demand_requests_staff_update"
ON public.demand_requests FOR UPDATE TO authenticated
USING (
    workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
);

CREATE POLICY "demand_requests_staff_delete"
ON public.demand_requests FOR DELETE TO authenticated
USING (
    workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
);

-- ─── client_assigned_tasks ───────────────────────────────────────────
DROP POLICY IF EXISTS "client_assigned_tasks_authenticated_all" ON public.client_assigned_tasks;

CREATE POLICY "client_assigned_tasks_read"
ON public.client_assigned_tasks FOR SELECT TO authenticated
USING (
    client_id IN (
        SELECT tm.linked_client_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND tm.user_type = 'client'
          AND tm.linked_client_id IS NOT NULL
    )
    OR workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
);

CREATE POLICY "client_assigned_tasks_staff_write"
ON public.client_assigned_tasks FOR ALL TO authenticated
USING (
    workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
)
WITH CHECK (
    workspace_id IN (
        SELECT tm.workspace_id FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
    )
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
);

-- ─── task_comments ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "task_comments_authenticated_select" ON public.task_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.task_comments;

CREATE POLICY "task_comments_read"
ON public.task_comments FOR SELECT TO authenticated
USING (
    task_id IN (
        SELECT ct.id FROM public.client_tasks ct
        WHERE ct.client_id IN (
            SELECT tm.linked_client_id FROM public.team_members tm
            WHERE lower(tm.email) = lower((SELECT auth.email()))
              AND tm.status = 'active' AND tm.user_type = 'client'
              AND tm.linked_client_id IS NOT NULL
        )
        OR ct.workspace_id IN (
            SELECT tm.workspace_id FROM public.team_members tm
            WHERE lower(tm.email) = lower((SELECT auth.email()))
              AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
        )
        OR ct.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
    )
);

CREATE POLICY "task_comments_insert"
ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND task_id IN (
        SELECT ct.id FROM public.client_tasks ct
        WHERE ct.client_id IN (
            SELECT tm.linked_client_id FROM public.team_members tm
            WHERE lower(tm.email) = lower((SELECT auth.email()))
              AND tm.status = 'active' AND tm.linked_client_id IS NOT NULL
        )
        OR ct.workspace_id IN (
            SELECT tm.workspace_id FROM public.team_members tm
            WHERE lower(tm.email) = lower((SELECT auth.email()))
              AND tm.status = 'active' AND (tm.user_type = 'agency' OR tm.user_type IS NULL)
        )
        OR ct.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid()))
    )
);

-- ─── Índices auxiliares pra perf das subqueries ──────────────────────
CREATE INDEX IF NOT EXISTS idx_client_tasks_workspace_id ON public.client_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_client_id ON public.client_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_demand_requests_workspace_id ON public.demand_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_demand_requests_client_id ON public.demand_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assigned_tasks_workspace_id ON public.client_assigned_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
