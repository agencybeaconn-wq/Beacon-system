-- Fase 2 P1 (#12): rate-limit atômico pros endpoints públicos do app
-- (register-device, track-event, app-error). app_id está no binário e não é
-- segredo — sem freio, um curioso cria devices/eventos/logs ilimitados,
-- falseando métricas e inflando as tabelas (DoS barato).
--
-- Janela tumbling alinhada + upsert atômico: o UPDATE do ON CONFLICT serializa
-- o incremento, então dois requests concorrentes contam certo.

create table if not exists public.edge_rate_limit (
    bucket text not null,
    window_start timestamptz not null,
    count integer not null default 0,
    primary key (bucket, window_start)
);

alter table public.edge_rate_limit enable row level security;
-- só service role escreve/lê (as edge functions); nenhuma policy p/ authenticated

create or replace function public.rate_limit_hit(
    p_bucket text, p_limite integer, p_janela_seg integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_epoch bigint := floor(extract(epoch from now()))::bigint;
    v_window timestamptz := to_timestamp(v_epoch - (v_epoch % p_janela_seg));
    v_count integer;
begin
    insert into public.edge_rate_limit (bucket, window_start, count)
    values (p_bucket, v_window, 1)
    on conflict (bucket, window_start)
    do update set count = edge_rate_limit.count + 1
    returning count into v_count;
    return v_count <= p_limite; -- true = ainda dentro do limite
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;

-- limpeza: janelas com mais de 1h não servem mais
select cron.schedule(
    'edge-rate-limit-cleanup',
    '17 * * * *',
    $$ delete from public.edge_rate_limit where window_start < now() - interval '1 hour' $$
);
