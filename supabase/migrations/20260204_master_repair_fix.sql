-- ==========================================
-- MASTER REPAIR SQL (NON-RECURSIVE)
-- ==========================================

-- 1. LIMPEZA TOTAL DE POLÍTICAS PROBLEMÁTICAS
-- Vamos resetar as políticas das tabelas principais para garantir um estado limpo
DROP POLICY IF EXISTS "Workspaces visibility" ON public.workspaces;
DROP POLICY IF EXISTS "Team members access" ON public.team_members;
DROP POLICY IF EXISTS "Clients access" ON public.agency_clients;
DROP POLICY IF EXISTS "Direct access to own record" ON public.team_members;
DROP POLICY IF EXISTS "Agency users can view all members in workspace" ON public.team_members;
DROP POLICY IF EXISTS "Workspace access to clients" ON public.agency_clients;

-- 2. POLÍTICAS NÃO-RECURSIVAS (FONTES DA VERDADE)

-- 2.1 WORKSPACES: Dono vê pelo ID, Membros veem pelo e-mail (sem subquery circular)
-- Nota: Usamos o email do auth.users para evitar circularidade com team_members.user_id
CREATE POLICY "Workspaces select policy" ON public.workspaces
FOR SELECT TO authenticated
USING (
    owner_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.workspace_id = public.workspaces.id 
        AND lower(team_members.email) = lower(auth.email())
    )
);

-- 2.2 TEAM_MEMBERS: Dono vê tudo do seu workspace, membros veem a si mesmos
CREATE POLICY "Team members master policy" ON public.team_members
FOR ALL TO authenticated
USING (
    lower(email) = lower(auth.email())
    OR 
    workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
);

-- 2.3 AGENCY_CLIENTS: Dono vê tudo, membros veem pelo vínculo de workspace
CREATE POLICY "Agency clients master policy" ON public.agency_clients
FOR ALL TO authenticated
USING (
    workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
    OR
    workspace_id IN (
        -- Aqui usamos o email para evitar olhar para team_members.user_id que poderia ser lento/circular
        SELECT workspace_id FROM public.team_members 
        WHERE lower(email) = lower(auth.email())
    )
);

-- 2.4 AGENCY_EXPENSES: Garantir que também tenha política (evita erro financeiro)
DROP POLICY IF EXISTS "Expenses access" ON public.agency_expenses;
CREATE POLICY "Expenses access" ON public.agency_expenses
FOR ALL TO authenticated
USING (
    workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
    OR
    workspace_id IN (
        SELECT workspace_id FROM public.team_members 
        WHERE lower(email) = lower(auth.email())
    )
);

-- 3. GARANTIR QUE O DONO ESTEJA NA TEAM_MEMBERS (Restauração final)
-- Isso garante que as queries que dependem de team_members funcionem para o admin
INSERT INTO public.team_members (workspace_id, user_id, email, role, status, user_type)
SELECT 
    w.id, 
    w.owner_id, 
    u.email, 
    'admin', 
    'active', 
    'agency'
FROM workspaces w
JOIN auth.users u ON u.id = w.owner_id
ON CONFLICT (workspace_id, email) 
DO UPDATE SET 
    user_id = EXCLUDED.user_id,
    role = 'admin',
    status = 'active',
    user_type = 'agency';

-- 4. REPARAÇÃO FINAL DO RPC (Versão simplificada e performática)
CREATE OR REPLACE FUNCTION public.resolve_client_identity(user_email TEXT)
RETURNS TABLE (p_client_id UUID, p_workspace_id UUID, p_client_name TEXT, p_user_type TEXT) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- 1. Prioridade: Dono de Workspace
    RETURN QUERY SELECT NULL::UUID, w.id, NULL::TEXT, 'agency'::TEXT 
    FROM public.workspaces w 
    JOIN auth.users u ON u.id = w.owner_id 
    WHERE u.email ILIKE user_email LIMIT 1;
    
    -- 2. Segunda: Membro (Cliente ou Staff)
    IF NOT FOUND THEN
        RETURN QUERY SELECT tm.linked_client_id, tm.workspace_id, c.name, tm.user_type 
        FROM public.team_members tm 
        LEFT JOIN public.agency_clients c ON c.id = tm.linked_client_id 
        WHERE tm.email ILIKE user_email 
        ORDER BY tm.created_at DESC LIMIT 1;
    END IF;
END;
$$;
