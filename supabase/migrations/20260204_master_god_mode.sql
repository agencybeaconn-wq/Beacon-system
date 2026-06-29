-- ==========================================
-- MASTER GOD-MODE RESTORATION SCRIPT
-- ==========================================

-- PARTE 1: GARANTIR QUE OS DONOS ESTEJAM NA TEAM_MEMBERS
-- Isso evita "pontos cegos" onde o dono não se vê no sistema
INSERT INTO public.team_members (workspace_id, user_id, email, role, status, user_type)
SELECT 
    w.id as workspace_id, 
    w.owner_id as user_id, 
    u.email, 
    'admin' as role, 
    'active' as status, 
    'agency' as user_type
FROM workspaces w
JOIN auth.users u ON u.id = w.owner_id
ON CONFLICT (workspace_id, email) 
DO UPDATE SET 
    user_id = EXCLUDED.user_id,
    role = 'admin',
    status = 'active',
    user_type = 'agency';

-- PARTE 2: RESCREVER POLÍTICAS DE RLS (FONTE DA VERDADE = WORKSPACES)

-- 2.1 WORKSPACES: Dono sempre vê, membros veem se estiverem vinculados
DROP POLICY IF EXISTS "Workspaces visibility" ON public.workspaces;
CREATE POLICY "Workspaces visibility" ON public.workspaces
FOR SELECT TO authenticated
USING (
    owner_id = auth.uid() OR 
    id IN (SELECT workspace_id FROM public.team_members WHERE user_id = auth.uid())
);

-- 2.2 TEAM_MEMBERS: Donos veem todos, membros veem a si mesmos e colegas
DROP POLICY IF EXISTS "Team members access" ON public.team_members;
CREATE POLICY "Team members access" ON public.team_members
FOR ALL TO authenticated
USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()) OR
    lower(email) = lower(auth.email()) OR
    workspace_id IN (SELECT workspace_id FROM team_members WHERE user_id = auth.uid())
);

-- 2.3 AGENCY_CLIENTS: Acesso total para o Dono, acesso filtrado para membros
DROP POLICY IF EXISTS "Clients access" ON public.agency_clients;
CREATE POLICY "Clients access" ON public.agency_clients
FOR ALL TO authenticated
USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()) OR
    workspace_id IN (SELECT workspace_id FROM team_members WHERE user_id = auth.uid())
);

-- PARTE 3: RPC DE IDENTIDADE SUPREMA
CREATE OR REPLACE FUNCTION public.resolve_client_identity(user_email TEXT)
RETURNS TABLE (
    p_client_id UUID,
    p_workspace_id UUID,
    p_client_name TEXT,
    p_user_type TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- 1. Primeiro checa se é Dono de algum workspace (Admin Supremo)
    SELECT 
        NULL::UUID as p_client_id,
        w.id as p_workspace_id,
        NULL::TEXT as p_client_name,
        'agency'::TEXT as p_user_type
    FROM workspaces w
    JOIN auth.users u ON u.id = w.owner_id
    WHERE u.email ILIKE user_email
    LIMIT 1;

    -- 2. Se não for dono, checa se é Cliente vinculado
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            tm.linked_client_id as p_client_id,
            tm.workspace_id as p_workspace_id,
            c.name as p_client_name,
            tm.user_type as p_user_type
        FROM team_members tm
        LEFT JOIN agency_clients c ON c.id = tm.linked_client_id
        WHERE tm.email ILIKE user_email
          AND tm.linked_client_id IS NOT NULL
        ORDER BY tm.created_at DESC
        LIMIT 1;
    END IF;

    -- 3. Se não for nenhum dos dois, checa se é membro comum da agência
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            NULL::UUID as p_client_id,
            tm.workspace_id as p_workspace_id,
            NULL::TEXT as p_client_name,
            tm.user_type as p_user_type
        FROM team_members tm
        WHERE tm.email ILIKE user_email
        ORDER BY tm.created_at DESC
        LIMIT 1;
    END IF;
END;
$$;
