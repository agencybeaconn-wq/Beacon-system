-- ════════════════════════════════════════════════════════════════════════════
-- system_settings — Configuracao global (linha unica) da observabilidade.
--
-- Guarda PRA ONDE os alertas de erro vao no WhatsApp: qual instancia Evolution
-- envia e qual grupo (JID ...@g.us) recebe. Escolhido na UI admin reusando a
-- edge function `list-whatsapp-groups` (mesmo picker do grupo de cliente).
--
-- Linha unica garantida por CHECK (id = 1). Leitura/escrita so para admins.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.system_settings (
    id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    alert_enabled       BOOLEAN NOT NULL DEFAULT false,
    alert_instance_name TEXT,
    alert_group_jid     TEXT,
    alert_group_name    TEXT,
    rate_limit_per_min  INTEGER NOT NULL DEFAULT 10 CHECK (rate_limit_per_min > 0),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semente da linha unica (idempotente).
INSERT INTO public.system_settings (id, alert_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- updated_at automatico — reusa a funcao ja existente (whatsapp_connections).
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Reusa public.is_agency_admin() (definida na migration system_logs, que roda
-- antes por ordem alfabetica): dono de workspace OU team_member role='admin'.
DROP POLICY IF EXISTS "system_settings admin read" ON public.system_settings;
CREATE POLICY "system_settings admin read"
    ON public.system_settings
    FOR SELECT
    USING (public.is_agency_admin());

DROP POLICY IF EXISTS "system_settings admin update" ON public.system_settings;
CREATE POLICY "system_settings admin update"
    ON public.system_settings
    FOR UPDATE
    USING (public.is_agency_admin())
    WITH CHECK (public.is_agency_admin());
