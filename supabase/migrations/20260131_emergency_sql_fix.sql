-- FUNÇÃO DE RESOLUÇÃO DE IDENTIDADE UNIVERSAL (LEVER OS) - VERSÃO CORRIGIDA
-- Objetivo: Garantir que o sistema encontre o Cliente ID e Workspace ID baseado no e-mail, sem falhas de cache.
-- Versão 2.1: Corrigido o ORDER BY e removido dependência de created_at

CREATE OR REPLACE FUNCTION resolve_client_identity(user_email TEXT)
RETURNS TABLE (
    p_client_id UUID,
    p_workspace_id UUID,
    p_client_name TEXT,
    p_user_type TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões de admin para garantir a busca global
AS $$
BEGIN
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
    LIMIT 1;
END;
$$;

-- Permitir que usuários autenticados chamem a função
GRANT EXECUTE ON FUNCTION resolve_client_identity(TEXT) TO authenticated;

-- CORREÇÃO DE RECURSÃO INFINITA NO RLS DE TEAM_MEMBERS
-- Remove todas as políticas problemáticas e cria as básicas essenciais
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for all members" ON team_members;
DROP POLICY IF EXISTS "Members can view themselves" ON team_members;
DROP POLICY IF EXISTS "team_members_read_policy" ON team_members;

-- Política segura: Usuários podem ver seu próprio registro (baseado no e-mail ou user_id)
-- Sem usar subqueries recursivas na mesma tabela
CREATE POLICY "team_members_self_read" 
ON team_members 
FOR SELECT 
TO authenticated 
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR 
    user_id = auth.uid()
);

-- Política para Admins: Ver tudo no workspace
CREATE POLICY "team_members_admin_read" 
ON team_members 
FOR SELECT 
TO authenticated 
USING (
    workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
