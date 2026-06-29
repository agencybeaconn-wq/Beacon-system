-- 🛠️ REPARO UNIVERSAL DE PERMISSÕES DO PORTAL 🛠️

-- Este SQL remove as políticas antigas baseadas apenas em user_id
-- e implementa a lógica robusta baseada no e-mail do usuário autenticado.

-- 1. Permissões para CLIENT_TASKS (Kanban e Portal)
DROP POLICY IF EXISTS "Users can manage client tasks" ON public.client_tasks;
DROP POLICY IF EXISTS "client_portal_tasks_isolation" ON public.client_tasks;

CREATE POLICY "agency_staff_manage_tasks" ON public.client_tasks
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
        AND user_type = 'agency'
    )
);

CREATE POLICY "clients_view_own_tasks" ON public.client_tasks
FOR SELECT USING (
    client_id IN (
        SELECT linked_client_id 
        FROM public.team_members 
        WHERE lower(email) = lower(auth.email())
    )
);

-- 2. Permissões para DEMAND_REQUESTS
DROP POLICY IF EXISTS "Users can manage workspace demands" ON public.demand_requests;
DROP POLICY IF EXISTS "client_portal_isolation" ON public.demand_requests;
DROP POLICY IF EXISTS "Clients can view their own demand_requests" ON public.demand_requests;
DROP POLICY IF EXISTS "Clients can create their own demand_requests" ON public.demand_requests;
DROP POLICY IF EXISTS "Agency can manage all demand_requests" ON public.demand_requests;

CREATE POLICY "agency_manage_demands" ON public.demand_requests
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
        AND user_type = 'agency'
    )
);

CREATE POLICY "clients_manage_own_demands" ON public.demand_requests
FOR ALL USING (
    client_id IN (
        SELECT linked_client_id 
        FROM public.team_members 
        WHERE lower(email) = lower(auth.email())
    )
);

-- 3. Permissões para AGENCY_CLIENTS
DROP POLICY IF EXISTS "agency_clients_client_view" ON public.agency_clients;
CREATE POLICY "agency_clients_portal_view" ON public.agency_clients
FOR SELECT USING (
    id IN (
        SELECT linked_client_id 
        FROM public.team_members 
        WHERE lower(email) = lower(auth.email())
    )
    OR
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
        AND user_type = 'agency'
    )
);

-- 4. Permissões para CLIENT_STEP_STATUS
DROP POLICY IF EXISTS "Users can manage step status" ON public.client_step_status;
DROP POLICY IF EXISTS "client_portal_steps_isolation" ON public.client_step_status;

CREATE POLICY "agency_manage_steps" ON public.client_step_status
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
        AND user_type = 'agency'
    )
);

CREATE POLICY "clients_view_steps" ON public.client_step_status
FOR SELECT USING (
    client_id IN (
        SELECT linked_client_id 
        FROM public.team_members 
        WHERE lower(email) = lower(auth.email())
    )
);

-- 5. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
