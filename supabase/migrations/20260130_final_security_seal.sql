-- 🔒 RE-ATIVANDO SEGURANÇA COM REGRAS DEFINITIVAS 🔒
-- Agora que confirmamos que os dados existem, vamos travar o banco novamente,
-- mas com as chaves corretas para você (Dono) e seus clientes.

-- 1. Re-abilitar Segurança (RLS)
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_step_status ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas/conflitantes
DROP POLICY IF EXISTS "agency_staff_manage_tasks" ON public.client_tasks;
DROP POLICY IF EXISTS "agency_owner_and_staff_manage_tasks" ON public.client_tasks;
DROP POLICY IF EXISTS "clients_view_own_tasks" ON public.client_tasks;
DROP POLICY IF EXISTS "client_portal_tasks_isolation" ON public.client_tasks;
DROP POLICY IF EXISTS "Users can manage client tasks" ON public.client_tasks;

-- 3. POLÍTICA MESTRA PARA TAREFAS (client_tasks)
-- Permite leitura e escrita para Dono, Equipe e Cliente (no seu próprio escopo)
CREATE POLICY "master_tasks_policy" ON public.client_tasks
FOR ALL USING (
    -- Nível 1: Dono do Workspace (Permissão Total)
    EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = auth.uid()) 
    OR
    -- Nível 2: Equipe da Agência (identificada por e-mail)
    EXISTS (SELECT 1 FROM public.team_members WHERE lower(email) = lower(auth.email()) AND user_type = 'agency') 
    OR
    -- Nível 3: Cliente (Apenas seus próprios dados)
    client_id IN (SELECT linked_client_id FROM public.team_members WHERE lower(email) = lower(auth.email()))
);

-- 4. POLÍTICA MESTRA PARA DEMANDAS (demand_requests)
DROP POLICY IF EXISTS "agency_manage_demands" ON public.demand_requests;
DROP POLICY IF EXISTS "agency_owner_and_staff_manage_demands" ON public.demand_requests;
DROP POLICY IF EXISTS "clients_manage_own_demands" ON public.demand_requests;
DROP POLICY IF EXISTS "Users can manage workspace demands" ON public.demand_requests;

CREATE POLICY "master_demands_policy" ON public.demand_requests
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = auth.uid()) 
    OR
    EXISTS (SELECT 1 FROM public.team_members WHERE lower(email) = lower(auth.email()) AND user_type = 'agency') 
    OR
    client_id IN (SELECT linked_client_id FROM public.team_members WHERE lower(email) = lower(auth.email()))
);

-- 5. Atualizar Cache de Permissões
NOTIFY pgrst, 'reload schema';
