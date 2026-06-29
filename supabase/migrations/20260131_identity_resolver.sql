-- FUNÇÃO DE RESOLUÇÃO DE IDENTIDADE UNIVERSAL (LEVER OS)
-- Objetivo: Garantir que o sistema encontre o Cliente ID e Workspace ID baseado no e-mail, sem falhas de cache.

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
    ORDER BY tm.created_at DESC
    LIMIT 1;
END;
$$;

-- Permitir que usuários autenticados chamem a função
GRANT EXECUTE ON FUNCTION resolve_client_identity(TEXT) TO authenticated;
