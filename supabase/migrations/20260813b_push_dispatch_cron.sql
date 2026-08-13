-- Módulo Apps Mobile — E3.2: tick do dispatcher a cada minuto.
-- Campanha 'agendada' com scheduled_at vencido é enviada pelo push-dispatch
-- (o corpo {tick:true} varre até 20 por rodada; a trava otimista de status
-- impede envio dobrado mesmo se dois ticks colidirem).
--
-- O secret vem de vault-less env: fica no comando do cron (schema cron não é
-- exposto a usuários authenticated — só service role/admin enxerga).

do $$
begin
  if exists (select 1 from cron.job where jobname = 'push-dispatch-tick') then
    perform cron.unschedule('push-dispatch-tick');
  end if;
end $$;

select cron.schedule(
  'push-dispatch-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://gbmbrjvkayzwhdwnqjpi.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', '__DISPATCH_SECRET__'
    ),
    body := '{"tick": true}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
