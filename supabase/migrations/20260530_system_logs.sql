-- ════════════════════════════════════════════════════════════════════════════
-- system_logs — Tabela central de observabilidade do Lever-System.
--
-- O "diario" do sistema: cada edge function (e o vigia system-watchdog) grava
-- aqui o que tentou fazer, com qual resultado, contexto e erro. Formato unico,
-- pesquisavel, e ja no shape que um agente de IA futuro consome direto via SQL.
--
-- Escopo: SO erros de RUNTIME em PRODUCAO. O campo `environment` separa
-- producao de dev/local; o dispatcher de alerta so olha environment='production'.
-- Erros de build/compilacao NAO entram aqui (acontecem antes do deploy).
--
-- Gravacao: exclusivamente via service_role (edge functions). Sem policy de
-- INSERT/UPDATE — espelha o padrao de `paperclip_action_log`.
-- Leitura: somente admins (dono do workspace OU team_member com role='admin'),
-- pois a tabela e cross-tenant (dados de todos os workspaces).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.system_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name   TEXT NOT NULL,
    action          TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
    severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'critical')),
    workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    message         TEXT NOT NULL,
    context         JSONB NOT NULL DEFAULT '{}'::jsonb,
    error           JSONB,
    error_signature TEXT,
    request_id      TEXT,
    environment     TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'local')),
    duration_ms     INTEGER,
    alerted_at      TIMESTAMPTZ,
    alert_status    TEXT NOT NULL DEFAULT 'pending' CHECK (alert_status IN ('pending', 'sent', 'skipped')),
    resolved        BOOLEAN NOT NULL DEFAULT false,
    resolution      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indices ──────────────────────────────────────────────────────────────────
-- Painel filtra por severidade/funcao/workspace e ordena por data desc.
CREATE INDEX IF NOT EXISTS system_logs_severity_idx
    ON public.system_logs (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_function_idx
    ON public.system_logs (function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_signature_idx
    ON public.system_logs (error_signature, created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_workspace_idx
    ON public.system_logs (workspace_id, created_at DESC);
-- Parcial: o dispatcher varre so pendentes de producao a cada minuto.
CREATE INDEX IF NOT EXISTS system_logs_pending_alert_idx
    ON public.system_logs (created_at)
    WHERE alert_status = 'pending';

-- ── Quem e admin (fonte unica) ───────────────────────────────────────────────
-- "admin da agencia" = dono do workspace (fast path da PermissionsContext) OU
-- team_member ativo com role='admin'. Clientes (role='client'/linked_client_id)
-- e funcionarios nao sao admins. Funcao reusada nas RLS de system_logs e
-- system_settings. SECURITY INVOKER: as RLS de workspaces/team_members ja
-- permitem o usuario ver a propria linha (owner_id/user_id = auth.uid()), entao
-- nao precisa de DEFINER — e isso zera os advisors de seguranca.
CREATE OR REPLACE FUNCTION public.is_agency_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.owner_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.user_id = auth.uid()
          AND lower(tm.role) = 'admin'
    );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas admins da agencia (tabela e cross-tenant).
DROP POLICY IF EXISTS "system_logs admin read" ON public.system_logs;
CREATE POLICY "system_logs admin read"
    ON public.system_logs
    FOR SELECT
    USING (public.is_agency_admin());

-- Sem policy de INSERT/UPDATE/DELETE: gravacao e limpeza so via service_role
-- (edge functions e jobs pg_cron), que faz bypass de RLS.
