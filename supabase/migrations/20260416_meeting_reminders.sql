-- Meeting Reminders — tabela de agendamento de lembretes de reuniao via WhatsApp.
--
-- Funcionamento:
--  - Cada row representa (meeting x team_member x ocorrencia).
--  - Para eventos recorrentes, a edge function google-calendar expande ate 90 dias de
--    ocorrencias futuras e insere uma row por ocorrencia.
--  - Dois timestamps alvo: remind_30_at e remind_10_at. O pg_cron dispara a edge function
--    `send-meeting-reminders` a cada minuto; ela busca rows pendentes e envia via Evolution API.
--  - phone_snapshot isola o envio de mudancas tardias em team_members.phone.
--
-- Isolamento multi-tenant: RLS garantido por workspace_id. Nenhuma policy permite escrita
-- direta — apenas edge functions via service_role escrevem.

CREATE TABLE IF NOT EXISTS public.meeting_reminders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    google_event_id   TEXT NOT NULL,
    team_member_id    UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    occurrence_start  TIMESTAMPTZ NOT NULL,
    remind_30_at      TIMESTAMPTZ NOT NULL,
    remind_10_at      TIMESTAMPTZ NOT NULL,
    sent_30_at        TIMESTAMPTZ,
    sent_10_at        TIMESTAMPTZ,
    phone_snapshot    TEXT NOT NULL,
    meet_link         TEXT,
    summary           TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meeting_reminders_unique_occurrence
        UNIQUE (workspace_id, google_event_id, team_member_id, occurrence_start)
);

-- Indexes voltados ao job do pg_cron (busca so rows pendentes).
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_pending_30
    ON public.meeting_reminders (remind_30_at)
    WHERE sent_30_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_reminders_pending_10
    ON public.meeting_reminders (remind_10_at)
    WHERE sent_10_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_reminders_event
    ON public.meeting_reminders (workspace_id, google_event_id);

-- Trigger de updated_at (funcao update_updated_at_column() ja existe em migration anterior).
DROP TRIGGER IF EXISTS tr_meeting_reminders_updated_at ON public.meeting_reminders;
CREATE TRIGGER tr_meeting_reminders_updated_at
    BEFORE UPDATE ON public.meeting_reminders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.meeting_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'meeting_reminders'
          AND policyname = 'ver reminders do proprio workspace'
    ) THEN
        CREATE POLICY "ver reminders do proprio workspace"
            ON public.meeting_reminders
            FOR SELECT
            USING (
                workspace_id IN (
                    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
                )
                OR workspace_id IN (
                    SELECT workspace_id FROM public.team_members WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- INSERT / UPDATE / DELETE intencionalmente sem policy: somente service_role (edge functions) escreve.

COMMENT ON TABLE public.meeting_reminders IS
    'Lembretes agendados de reunioes (30min / 10min antes). Gerados pela edge function google-calendar e consumidos por send-meeting-reminders via pg_cron.';
