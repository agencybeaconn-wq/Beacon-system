-- 1. Redefinir a Função de Resolução de Identidade para ser mais abrangente
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
    -- Prioridade 1: Membro com vínculo de cliente
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

    -- Se não encontrou cliente, tenta encontrar se é membro da agência (admin/op)
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

    -- Se ainda não encontrou, tenta ver se é o DONO do workspace (caso não esteja na team_members)
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            NULL::UUID as p_client_id,
            w.id as p_workspace_id,
            NULL::TEXT as p_client_name,
            'agency'::TEXT as p_user_type
        FROM workspaces w
        JOIN auth.users u ON u.id = w.owner_id
        WHERE u.email ILIKE user_email
        LIMIT 1;
    END IF;
END;
$$;

-- 2. Corrigir RLS da team_members para permitir que Owners vejam seus membros
DROP POLICY IF EXISTS "Direct access to own record" ON public.team_members;
CREATE POLICY "Direct access to own record" ON public.team_members
FOR ALL TO authenticated USING (lower(email) = lower(auth.email()));

DROP POLICY IF EXISTS "Agency users can view all members in workspace" ON public.team_members;
CREATE POLICY "Agency users can view all members in workspace" 
ON public.team_members
FOR SELECT 
TO authenticated 
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  )
  OR 
  workspace_id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  )
);

-- 3. Garantir que a tabela agency_clients também seja visível para quem tem acesso ao workspace
DROP POLICY IF EXISTS "Workspace access to clients" ON public.agency_clients;
CREATE POLICY "Workspace access to clients" ON public.agency_clients
FOR SELECT TO authenticated
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  )
  OR
  workspace_id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  )
);
