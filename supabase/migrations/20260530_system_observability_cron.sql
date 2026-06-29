-- ════════════════════════════════════════════════════════════════════════════
-- Cron da observabilidade:
--   • system-alert-dispatcher — a cada 1 min, manda erros pendentes pro WhatsApp.
--   • system-logs-retention   — diario as 04h, apaga logs com mais de 90 dias.
--
-- Mesmo padrao de 20260416_meeting_reminders_cron.sql: net.http_post pra URL
-- publica do projeto, function deployada com --no-verify-jwt (usa service_role
-- interno e e idempotente). O cron do system-watchdog vem em migration propria
-- (fase D), pra nao agendar uma function ainda nao deployada.
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Dispatcher de alertas (1 min) ────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'system-alert-dispatcher') THEN
        PERFORM cron.unschedule('system-alert-dispatcher');
    END IF;
END $$;

SELECT cron.schedule(
    'system-alert-dispatcher',
    '* * * * *',
    $cron$
    SELECT net.http_post(
        url := 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/system-alert-dispatcher',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
    $cron$
);

-- ── Retencao de logs (diaria, 04:00) ─────────────────────────────────────────
-- JEB: minimo 30 dias quente / 90 frio. Apaga direto no banco (sem edge function).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'system-logs-retention') THEN
        PERFORM cron.unschedule('system-logs-retention');
    END IF;
END $$;

SELECT cron.schedule(
    'system-logs-retention',
    '0 4 * * *',
    $cron$
    DELETE FROM public.system_logs WHERE created_at < now() - interval '90 days';
    $cron$
);
