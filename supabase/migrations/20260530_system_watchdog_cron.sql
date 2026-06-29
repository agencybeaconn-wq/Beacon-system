-- Cron do system-watchdog: a cada 5 min detecta "o que deveria ter acontecido
-- e nao aconteceu" (falhas silenciosas) e grava em system_logs. Mesmo padrao do
-- system-alert-dispatcher (net.http_post, function com --no-verify-jwt).

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'system-watchdog') THEN
        PERFORM cron.unschedule('system-watchdog');
    END IF;
END $$;

SELECT cron.schedule(
    'system-watchdog',
    '*/5 * * * *',
    $cron$
    SELECT net.http_post(
        url := 'https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/system-watchdog',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
    $cron$
);
