-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: fb_connections RLS — multi-tenant via workspace
-- ═══════════════════════════════════════════════════════════════════════════
-- Problema: a policy de SELECT anterior era `user_id = auth.uid() OR user_id IS NULL`.
--           Clientes (team_members.user_type = 'client') NUNCA são donos de fb_connection,
--           então sempre caíam no fallback `user_id IS NULL` — connection global antiga
--           (96 dias, token Meta long-lived expirado, max = 60d). Resultado: dashboard
--           do cliente mostrava R$ 0,00 em Faturamento/Gasto/ROAS, enquanto o admin
--           (dono da connection do próprio workspace, token novo) via os dados corretos.
--
-- Fix: policy multi-tenant — cliente lê fb_connections do MESMO workspace que ele
--      pertence (via team_members.workspace_id). Padrão Lever (RLS Multi-tenant na Prática):
--        - `TO authenticated` (não avalia pra anon)
--        - `(SELECT auth.email())` cacheado (perf: initPlan)
--        - subquery única em team_members (sem JOIN linha-a-linha)
--        - filtro `status = 'active'` evita membros pendentes/desativados
--
-- Impacto: 32 clientes ativos do workspace `3cb9ac39-d833-449e-a4ae-77197a5eba3b`
--          passam a ler corretamente o token Meta do owner do workspace, em vez do
--          fallback global expirado.
--
-- Backward compat: INSERT/UPDATE/DELETE policies não mudam (continuam restritas a dono).
--                  A policy "Service role can manage all fb_connections" continua
--                  funcionando intacta — service_role bypassa RLS por padrão.
--
-- Rollback: ver bloco no final do arquivo.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Remove a policy de SELECT antiga (com fallback global perigoso)
DROP POLICY IF EXISTS "Users can view their own fb_connections" ON public.fb_connections;

-- 2) Cria policy SELECT workspace-aware
CREATE POLICY "fb_connections_workspace_read"
ON public.fb_connections
FOR SELECT
TO authenticated
USING (
    workspace_id IN (
        SELECT tm.workspace_id
        FROM public.team_members tm
        WHERE lower(tm.email) = lower((SELECT auth.email()))
          AND tm.status = 'active'
    )
);

-- 3) Index pra acelerar a subquery (caso ainda não exista)
CREATE INDEX IF NOT EXISTS idx_team_members_email_lower_status
    ON public.team_members (lower(email), status);

CREATE INDEX IF NOT EXISTS idx_fb_connections_workspace_id
    ON public.fb_connections (workspace_id);

-- ─── Rollback (caso precise reverter manualmente) ─────────────────────────
-- DROP POLICY IF EXISTS "fb_connections_workspace_read" ON public.fb_connections;
-- CREATE POLICY "Users can view their own fb_connections"
-- ON public.fb_connections FOR SELECT TO public
-- USING (((user_id = auth.uid()) OR (user_id IS NULL)));
