-- Cron job: disparo a cada minuto da edge function `send-meeting-reminders`.
--
-- A edge function foi deployada com --no-verify-jwt (sem Authorization obrigatoria) porque:
--  - E idempotente: rows com sent_X_at IS NOT NULL sao ignoradas
--  - Nao aceita body parameters
--  - Internamente ja usa SUPABASE_SERVICE_ROLE_KEY (envvar auto-injetada pelo Supabase)
--  - A URL e publica (project URL) mas chamar nao acelera envios (reminders respeitam remind_X_at)
-- Essa escolha evita commitar o service_role_key em SQL ou depender de ALTER DATABASE settings.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-meeting-reminders') THEN
        PERFORM cron.unschedule('send-meeting-reminders');
    END IF;
END $$;

SELECT cron.schedule(
    'send-meeting-reminders',
    '* * * * *',
    $cron$
    SELECT net.http_post(
        url := 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/send-meeting-reminders',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
    $cron$
);
