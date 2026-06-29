-- 🚨 FIX DE EMERGÊNCIA PARA O DONO (AGÊNCIA) 🚨
-- O problema: As regras anteriores exigiam que você fosse um "membro da equipe", 
-- mas como Dono, você às vezes não tem esse registro explícito.
-- Esta correção abre as portas explicitamente para o Dono do Workspace.

-- 1. Garantir que o Dono tenha um registro em team_members (Redundância de Segurança)
INSERT INTO public.team_members (workspace_id, user_id, email, role, status, user_type)
SELECT 
    id as workspace_id, 
    owner_id as user_id, 
    (SELECT email FROM auth.users WHERE id = workspaces.owner_id) as email,
    'owner' as role,
    'active' as status,
    'agency' as user_type
FROM 
    public.workspaces
WHERE 
    NOT EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.user_id = workspaces.owner_id
    );

-- 2. Atualizar Políticas de Tasks para Incluir Explicitaente o Dono
DROP POLICY IF EXISTS "agency_staff_manage_tasks" ON public.client_tasks;

CREATE POLICY "agency_owner_and_staff_manage_tasks" ON public.client_tasks
FOR ALL USING (
    -- Permite se for Dono do Workspace de algum cliente
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE owner_id = auth.uid()
    )
    OR
    -- OU se for Staff da Agência (regra anterior)
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
        AND user_type = 'agency'
    )
);

-- 3. Atualizar Políticas de Demandas para Incluir Explicitaente o Dono
DROP POLICY IF EXISTS "agency_manage_demands" ON public.demand_requests;

CREATE POLICY "agency_owner_and_staff_manage_demands" ON public.demand_requests
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
        AND user_type = 'agency'
    )
);

-- 4. Forçar atualização do user_type para 'agency' caso esteja nulo para não-clientes
UPDATE public.team_members
SET user_type = 'agency'
WHERE linked_client_id IS NULL AND (user_type IS NULL OR user_type = '');

-- 5. Recarregar Permissões
NOTIFY pgrst, 'reload schema';
