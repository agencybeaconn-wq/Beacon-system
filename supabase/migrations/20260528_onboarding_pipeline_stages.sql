-- Onboarding pipeline — máquina de estados (Fase 1)
-- Evolui onboarding_jobs pra dirigir o pipeline COMPLETO de onboarding de cliente:
--   briefing → solicitar acesso → aguardar aceite → onboard (app+distribuição+token) → conectado
-- Runner (VM Playwright) avança os estágios; control plane (Lever System UI) coordena/revisa.
-- Aplicar com: supabase db push  (ou via MCP apply_migration). Não-destrutivo (só adiciona).

-- ─── Estágio atual no pipeline ──────────────────────────────────────────────
alter table public.onboarding_jobs
  add column if not exists stage text not null default 'access_requested';

comment on column public.onboarding_jobs.stage is
  'Estágio do pipeline: access_requested | access_pending | access_granted | onboarding | connected | failed';

-- Quando o estágio mudou (auditoria + SLA por etapa)
alter table public.onboarding_jobs
  add column if not exists stage_updated_at timestamptz not null default now();

-- Histórico de eventos do runner. Cada item: {ts, stage, level, msg, screenshot?}
alter table public.onboarding_jobs
  add column if not exists logs jsonb not null default '[]'::jsonb;

-- Backoff do monitor de aceite (estágio access_pending): o runner só re-checa após este horário
alter table public.onboarding_jobs
  add column if not exists next_check_at timestamptz;

-- Índice pro worker pegar o próximo job elegível por estágio + horário de checagem
create index if not exists onboarding_jobs_stage_idx
  on public.onboarding_jobs (stage, next_check_at);

-- ─── Saúde dos runners (pra a UI do Pedro saber se a VM está viva) ──────────
create table if not exists public.onboarding_runners (
  runner_id          text primary key,
  hostname           text,
  last_heartbeat_at  timestamptz not null default now(),
  session_ok         boolean not null default true,  -- false = 2FA/sessão Shopify esfriou (precisa re-verificar)
  note               text,
  created_at         timestamptz not null default now()
);

comment on table public.onboarding_runners is
  'Heartbeat dos runners Playwright (VM dedicada). session_ok=false sinaliza ao control plane que precisa re-verificar o 2FA.';

-- TODO (Pedro): evoluir o RPC claim_onboarding_job pra reservar por `stage`
-- (ex: pegar próximos jobs em onboarding/access_pending respeitando next_check_at).
