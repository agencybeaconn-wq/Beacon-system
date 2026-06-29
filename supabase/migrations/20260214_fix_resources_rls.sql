-- Atualizar políticas de RLS para client_resources
-- Garantir que donos de workspace e criadores do recurso sempre tenham acesso

DROP POLICY IF EXISTS "manage_client_resources" ON public.client_resources;

CREATE POLICY "manage_client_resources_v2" ON public.client_resources
    FOR ALL
    USING (
        -- É o criador do recurso
        created_by = auth.uid()
        OR 
        -- É membro do workspace do recurso
        auth.uid() IN (
            SELECT user_id FROM public.team_members 
            WHERE workspace_id = client_resources.workspace_id
        )
        OR
        -- É o dono do workspace do recurso
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE id = client_resources.workspace_id
            AND owner_id = auth.uid()
        )
    )
    WITH CHECK (
        -- Mesmas regras para inserção/edição
        created_by = auth.uid()
        OR 
        auth.uid() IN (
            SELECT user_id FROM public.team_members 
            WHERE workspace_id = client_resources.workspace_id
        )
        OR
        EXISTS (
            SELECT 1 FROM public.workspaces
            WHERE id = client_resources.workspace_id
            AND owner_id = auth.uid()
        )
    );

COMMENT ON POLICY "manage_client_resources_v2" ON public.client_resources IS 'Permite acesso a criadores, membros e donos do workspace';
