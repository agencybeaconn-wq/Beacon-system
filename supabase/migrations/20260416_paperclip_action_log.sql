-- Tabela de auditoria e idempotência para ações executadas pelo Paperclip (multi-agent)
-- via Edge Function `paperclip-inbound`.
--
-- Cada requisição do Paperclip grava um registro. A UNIQUE em idempotency_key
-- permite replay seguro: o mesmo idempotency_key retorna o mesmo resultado sem
-- executar a ação duas vezes.

CREATE TABLE IF NOT EXISTS public.paperclip_action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL,
    actor TEXT,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    result JSONB,
    error JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paperclip_action_log_action_idx
    ON public.paperclip_action_log (action, created_at DESC);

CREATE INDEX IF NOT EXISTS paperclip_action_log_created_at_idx
    ON public.paperclip_action_log (created_at DESC);

ALTER TABLE public.paperclip_action_log ENABLE ROW LEVEL SECURITY;

-- Tabela só é gravada pela Edge Function (service role). Leitura somente para
-- owners de workspace (para auditoria futura via UI). Sem INSERT/UPDATE via RLS.
DROP POLICY IF EXISTS "paperclip_action_log read for workspace owners"
    ON public.paperclip_action_log;
CREATE POLICY "paperclip_action_log read for workspace owners"
    ON public.paperclip_action_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.owner_id = auth.uid()
        )
    );
