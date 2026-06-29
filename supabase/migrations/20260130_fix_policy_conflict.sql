-- 🛠️ CORREÇÃO DEFINITIVA DE CONFLITOS E SEGURANÇA 🛠️

-- 1. LIMPEZA TOTAL DE POLÍTICAS (Para corrigir o erro "already exists")
DO $$ 
BEGIN
    -- Tasks
    DROP POLICY IF EXISTS "robust_tasks_policy" ON public.client_tasks;
    DROP POLICY IF EXISTS "master_tasks_policy" ON public.client_tasks;
    DROP POLICY IF EXISTS "agency_owner_and_staff_manage_tasks" ON public.client_tasks;
    DROP POLICY IF EXISTS "clients_view_own_tasks" ON public.client_tasks;
    DROP POLICY IF EXISTS "agency_staff_manage_tasks" ON public.client_tasks; -- Antiga
    
    -- Demands
    DROP POLICY IF EXISTS "robust_demands_policy" ON public.demand_requests;
    DROP POLICY IF EXISTS "master_demands_policy" ON public.demand_requests;
    DROP POLICY IF EXISTS "agency_owner_and_staff_manage_demands" ON public.demand_requests;
    DROP POLICY IF EXISTS "clients_manage_own_demands" ON public.demand_requests;
    DROP POLICY IF EXISTS "agency_manage_demands" ON public.demand_requests; -- Antiga
END $$;

-- 2. REFINAR FUNÇÕES DE SEGURANÇA (Para garantir que o Dono seja encontrado)
CREATE OR REPLACE FUNCTION public.check_is_agency_or_owner(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- A. Check Rápido: É o Dono do Workspace (pelo ID de autenticação atual)?
    -- Isso resolve o caso do Dono imediatamente sem depender de tabelas auxiliares
    IF EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = auth.uid()) THEN
        RETURN TRUE;
    END IF;

    -- B. Check de Backup: Está na lista de membros como Agência?
    IF EXISTS (SELECT 1 FROM public.team_members WHERE lower(email) = lower(check_email) AND user_type = 'agency') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 3. APLICAR POLÍTICAS (Agora sem conflito)
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "robust_tasks_policy" ON public.client_tasks
FOR ALL USING (
    public.check_is_agency_or_owner(auth.email())
    OR
    client_id = public.get_user_client_id(auth.email())
);

ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "robust_demands_policy" ON public.demand_requests
FOR ALL USING (
    public.check_is_agency_or_owner(auth.email())
    OR
    client_id = public.get_user_client_id(auth.email())
);

-- 4. REFRESH
NOTIFY pgrst, 'reload schema';
