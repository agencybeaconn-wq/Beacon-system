-- ═══════════════════════════════════════════════════════════════
-- BRIEFINGS — Refinar RLS para suportar portal do cliente
-- ═══════════════════════════════════════════════════════════════
-- Contexto: o briefing agora é preenchido pelo cliente final dentro de
-- /portal/briefing. RLS precisa isolar: cliente só lê/escreve o próprio
-- briefing (client_group_id = linked_client_id do team_members dele).
-- Agência (owner do workspace ou team_member com user_type='agency')
-- mantém acesso total ao workspace.

-- Remove policies antigas (que davam acesso total a qualquer team_member)
DROP POLICY IF EXISTS "briefings_select" ON public.briefings;
DROP POLICY IF EXISTS "briefings_manage" ON public.briefings;

-- Função helper: retorna TRUE se o user atual é da agência (tem acesso full).
-- Considera: owner do workspace OU team_member com user_type agency
-- (ou sem user_type definido — legado = tratado como agency).
CREATE OR REPLACE FUNCTION public.is_agency_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = ws_id AND w.owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.workspace_id = ws_id
            AND tm.user_id = auth.uid()
            AND (tm.user_type IS NULL OR tm.user_type = 'agency')
    );
$$;

-- Função helper: retorna o linked_client_id do user atual no workspace.
CREATE OR REPLACE FUNCTION public.get_linked_client_id(ws_id UUID)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT linked_client_id FROM public.team_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_agency_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_linked_client_id(UUID) TO authenticated;

-- SELECT: agência vê tudo do workspace; cliente vê só o próprio
CREATE POLICY "briefings_select" ON public.briefings
    FOR SELECT USING (
        public.is_agency_member(workspace_id)
        OR client_group_id = public.get_linked_client_id(workspace_id)
    );

-- INSERT: agência cria livremente; cliente só pode criar o próprio
CREATE POLICY "briefings_insert" ON public.briefings
    FOR INSERT WITH CHECK (
        public.is_agency_member(workspace_id)
        OR client_group_id = public.get_linked_client_id(workspace_id)
    );

-- UPDATE: mesmas regras — cliente só mexe no próprio
CREATE POLICY "briefings_update" ON public.briefings
    FOR UPDATE USING (
        public.is_agency_member(workspace_id)
        OR client_group_id = public.get_linked_client_id(workspace_id)
    ) WITH CHECK (
        public.is_agency_member(workspace_id)
        OR client_group_id = public.get_linked_client_id(workspace_id)
    );

-- DELETE: só agência (cliente não deleta o próprio briefing)
CREATE POLICY "briefings_delete" ON public.briefings
    FOR DELETE USING (
        public.is_agency_member(workspace_id)
    );
