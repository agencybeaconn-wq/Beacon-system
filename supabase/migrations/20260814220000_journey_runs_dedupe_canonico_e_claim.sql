-- Auditoria 2026-08-14, Fase 1 P0 (#3/#7/#19). NÃO edita a migration
-- 20260814210000 (aplicada) — corrige em cima dela.
--
-- Contexto: 20260814210000 tentou criar `journey_runs_dedupe_uidx` sobre a
-- coluna, mas o nome já existia (índice antigo sobre `context->>'dedupe_key'`,
-- de 20260814180200) e o `IF NOT EXISTS` virou no-op. Resultado real no banco:
-- coluna `dedupe_key` existe, mas o índice único ainda é o de context.
-- Aqui: backfill da coluna, índice único NOVO sobre a coluna (nome próprio),
-- e drop do índice antigo de context (agora redundante).

-- 1. backfill da coluna a partir do context (idempotente)
update public.journey_runs
  set dedupe_key = context->>'dedupe_key'
  where dedupe_key is null and context ? 'dedupe_key';

-- 2. índice único canônico sobre a COLUNA (parcial: runs sem chave ficam livres).
--    parcial é ok aqui — o dispatcher usa insert + captura 23505, não ON CONFLICT.
create unique index if not exists journey_runs_dedupe_col_uidx
  on public.journey_runs (journey_id, dedupe_key)
  where dedupe_key is not null;

-- 3. índice antigo sobre context vira redundante (a coluna é a fonte agora)
drop index if exists public.journey_runs_dedupe_uidx;

-- 4. #7 claim atômico: coluna de tentativas pra observabilidade do lease
--    (o claim em si é feito por UPDATE condicional no next_step_at pelo dispatcher).
alter table public.journey_runs
  add column if not exists attempts integer not null default 0;
