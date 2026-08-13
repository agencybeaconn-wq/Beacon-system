-- =============================================================================
-- Módulo Apps Mobile — E0.3 push + segmentos + motor de jornadas
-- push_campaigns, push_sends, segments, journeys, journey_runs
-- Jornadas são o motor único: boas-vindas, carrinho abandonado, conforto de
-- entrega e fluxos custom são todas linhas de `journeys` (definition JSONB
-- segue journeyDefinitionSchema dos contratos).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- segments — filtro salvo (definition JSONB interpretado pelo dispatcher)
-- -----------------------------------------------------------------------------
create table public.segments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  name text not null,
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, name)
);

create trigger segments_touch before update on public.segments
  for each row execute function public.app_mobile_touch_updated_at();

-- -----------------------------------------------------------------------------
-- push_campaigns — disparo manual/agendado criado no painel
-- -----------------------------------------------------------------------------
create table public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  app_id uuid not null references public.store_apps(id) on delete cascade,
  -- pushPayloadSchema
  payload jsonb not null,
  -- null = todos os devices; senão restringe ao segmento
  segment_id uuid references public.segments(id) on delete set null,
  scheduled_at timestamptz,
  status text not null default 'rascunho'
    check (status in ('rascunho','agendada','enviando','enviada','erro')),
  sent_count integer not null default 0,
  open_count integer not null default 0,
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger push_campaigns_touch before update on public.push_campaigns
  for each row execute function public.app_mobile_touch_updated_at();

create index push_campaigns_client_idx on public.push_campaigns (client_id, created_at desc);
create index push_campaigns_due_idx on public.push_campaigns (scheduled_at)
  where status = 'agendada';

-- -----------------------------------------------------------------------------
-- journeys — automações (motor único)
-- -----------------------------------------------------------------------------
create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  app_id uuid not null references public.store_apps(id) on delete cascade,
  name text not null,
  kind text not null default 'custom'
    check (kind in ('boas_vindas','carrinho_abandonado','conforto_entrega','custom')),
  -- journeyDefinitionSchema
  definition jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger journeys_touch before update on public.journeys
  for each row execute function public.app_mobile_touch_updated_at();

create index journeys_client_idx on public.journeys (client_id, active);

-- -----------------------------------------------------------------------------
-- journey_runs — execução por device (o tick do pg_cron processa next_step_at)
-- -----------------------------------------------------------------------------
create table public.journey_runs (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  device_id uuid not null references public.app_devices(id) on delete cascade,
  current_step integer not null default 0,
  state text not null default 'ativa'
    check (state in ('ativa','concluida','saida','erro')),
  -- contexto do gatilho (ex.: checkout_token, shopify_order_id)
  context jsonb not null default '{}'::jsonb,
  next_step_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- o tick busca por aqui — índice parcial só do que está devido
create index journey_runs_due_idx on public.journey_runs (next_step_at)
  where state = 'ativa';
create index journey_runs_device_idx on public.journey_runs (device_id, journey_id, state);

-- -----------------------------------------------------------------------------
-- push_sends — recibo individual de cada push (campanha, jornada ou rastreio)
-- -----------------------------------------------------------------------------
create table public.push_sends (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  device_id uuid not null references public.app_devices(id) on delete cascade,
  campaign_id uuid references public.push_campaigns(id) on delete set null,
  journey_run_id uuid references public.journey_runs(id) on delete set null,
  kind text not null check (kind in ('campanha','jornada','rastreio','teste')),
  payload jsonb not null,
  expo_ticket_id text,
  status text not null default 'enviado'
    check (status in ('enviado','entregue','aberto','falha')),
  error text,
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);

create index push_sends_campaign_idx on public.push_sends (campaign_id)
  where campaign_id is not null;
create index push_sends_device_idx on public.push_sends (device_id, sent_at desc);
-- teto anti-spam: conta pushes de marketing do device no dia
create index push_sends_quota_idx on public.push_sends (device_id, kind, sent_at);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.segments enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_runs enable row level security;
alter table public.push_sends enable row level security;

-- Config de marketing: staff tudo; cliente gerencia as PRÓPRIAS campanhas,
-- segmentos e jornadas (é o produto — lojista dispara push pelo painel).

create policy segments_staff_all on public.segments
  for all using (
    client_id in (
      select ac.id from public.agency_clients ac
      where ac.workspace_id in (
        select tm.workspace_id from public.team_members tm
        where lower(tm.email) = lower((select auth.email()))
          and tm.status = 'active'
          and (tm.user_type = 'agency' or tm.user_type is null)
      )
      or ac.workspace_id in (
        select w.id from public.workspaces w where w.owner_id = (select auth.uid())
      )
    )
  );

create policy segments_client_all on public.segments
  for all using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  ) with check (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

create policy push_campaigns_staff_all on public.push_campaigns
  for all using (
    client_id in (
      select ac.id from public.agency_clients ac
      where ac.workspace_id in (
        select tm.workspace_id from public.team_members tm
        where lower(tm.email) = lower((select auth.email()))
          and tm.status = 'active'
          and (tm.user_type = 'agency' or tm.user_type is null)
      )
      or ac.workspace_id in (
        select w.id from public.workspaces w where w.owner_id = (select auth.uid())
      )
    )
  );

create policy push_campaigns_client_all on public.push_campaigns
  for all using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  ) with check (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

create policy journeys_staff_all on public.journeys
  for all using (
    client_id in (
      select ac.id from public.agency_clients ac
      where ac.workspace_id in (
        select tm.workspace_id from public.team_members tm
        where lower(tm.email) = lower((select auth.email()))
          and tm.status = 'active'
          and (tm.user_type = 'agency' or tm.user_type is null)
      )
      or ac.workspace_id in (
        select w.id from public.workspaces w where w.owner_id = (select auth.uid())
      )
    )
  );

create policy journeys_client_all on public.journeys
  for all using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  ) with check (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

-- Execuções e recibos: somente leitura no painel (runtime escreve via service role)

create policy journey_runs_staff_read on public.journey_runs
  for select using (
    client_id in (
      select ac.id from public.agency_clients ac
      where ac.workspace_id in (
        select tm.workspace_id from public.team_members tm
        where lower(tm.email) = lower((select auth.email()))
          and tm.status = 'active'
          and (tm.user_type = 'agency' or tm.user_type is null)
      )
      or ac.workspace_id in (
        select w.id from public.workspaces w where w.owner_id = (select auth.uid())
      )
    )
  );

create policy journey_runs_client_read on public.journey_runs
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

create policy push_sends_staff_read on public.push_sends
  for select using (
    client_id in (
      select ac.id from public.agency_clients ac
      where ac.workspace_id in (
        select tm.workspace_id from public.team_members tm
        where lower(tm.email) = lower((select auth.email()))
          and tm.status = 'active'
          and (tm.user_type = 'agency' or tm.user_type is null)
      )
      or ac.workspace_id in (
        select w.id from public.workspaces w where w.owner_id = (select auth.uid())
      )
    )
  );

create policy push_sends_client_read on public.push_sends
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );
