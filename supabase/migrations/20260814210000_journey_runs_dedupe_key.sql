-- Auditoria 2026-08-14 (achados #7/#19): runs de jornada eram criadas por
-- select-then-insert SEM constraint — dois ticks concorrentes (ou a base além
-- do cap 1000 do PostgREST) duplicavam boas-vindas/carrinho. dedupe_key vira
-- coluna com índice único: insertRunIdempotente (que já trata 23505) passa a
-- proteger TODAS as jornadas, não só as de rastreio (que já usavam a chave só
-- no jsonb, sem constraint real).

alter table public.journey_runs
  add column if not exists dedupe_key text;

-- backfill das runs de rastreio que já traziam a chave no context
update public.journey_runs
  set dedupe_key = context->>'dedupe_key'
  where dedupe_key is null and context ? 'dedupe_key';

create unique index if not exists journey_runs_dedupe_uidx
  on public.journey_runs (dedupe_key)
  where dedupe_key is not null;
