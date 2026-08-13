-- =============================================================================
-- Módulo Apps Mobile — E0.2 núcleo
-- store_apps, app_devices, app_customers, app_events, app_orders
-- Tenancy: client_id -> agency_clients. Staff resolve workspace via join.
-- Escrita de runtime (devices/events/orders) é SEMPRE via edge function
-- (service role); o painel só lê — exceto config, que o cliente edita.
-- =============================================================================

create or replace function public.app_mobile_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- store_apps — 1 app white-label por cliente
-- -----------------------------------------------------------------------------
create table public.store_apps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  bundle_id text not null unique,
  app_name text not null,
  status text not null default 'rascunho'
    check (status in ('rascunho','em_revisao','publicado','transferido')),
  -- appConfigSchema (src/contracts/app-mobile.ts)
  config jsonb not null default '{}'::jsonb,
  -- pushLimitsSchema — teto anti-spam de marketing por device/dia
  push_limits jsonb not null default '{"max_marketing_per_day":3}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

create trigger store_apps_touch before update on public.store_apps
  for each row execute function public.app_mobile_touch_updated_at();

-- -----------------------------------------------------------------------------
-- app_devices — instalações com token de push
-- -----------------------------------------------------------------------------
create table public.app_devices (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.store_apps(id) on delete cascade,
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('android','ios')),
  app_version text not null default '',
  os_version text not null default '',
  device_model text not null default '',
  locale text not null default 'pt-BR',
  shopify_customer_id text,
  push_enabled boolean not null default true,
  disabled_reason text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (app_id, expo_push_token)
);

create index app_devices_client_idx on public.app_devices (client_id, last_seen_at desc);
create index app_devices_customer_idx on public.app_devices (client_id, shopify_customer_id)
  where shopify_customer_id is not null;

-- -----------------------------------------------------------------------------
-- app_customers — espelho mínimo do customer Shopify visto pelo app (CRM)
-- -----------------------------------------------------------------------------
create table public.app_customers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  shopify_customer_id text not null,
  display_name text,
  email text,
  orders_app_count integer not null default 0,
  total_spent_app numeric(12,2) not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, shopify_customer_id)
);

create trigger app_customers_touch before update on public.app_customers
  for each row execute function public.app_mobile_touch_updated_at();

-- -----------------------------------------------------------------------------
-- app_events — telemetria (dash, segmentos, gatilhos de jornada)
-- -----------------------------------------------------------------------------
create table public.app_events (
  id bigint generated always as identity primary key,
  app_id uuid not null references public.store_apps(id) on delete cascade,
  device_id uuid not null references public.app_devices(id) on delete cascade,
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  type text not null
    check (type in ('install','open','push_open','add_to_cart','checkout_start','login')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index app_events_client_type_idx on public.app_events (client_id, type, occurred_at desc);
create index app_events_device_idx on public.app_events (device_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- app_orders — pedidos atribuídos ao app (via cart attribute -> orders/paid)
-- -----------------------------------------------------------------------------
create table public.app_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  app_id uuid not null references public.store_apps(id) on delete cascade,
  shopify_order_id text not null,
  order_number text not null default '',
  total numeric(12,2) not null,
  currency text not null default 'BRL',
  financial_status text not null default '',
  customer_shopify_id text,
  device_id uuid references public.app_devices(id) on delete set null,
  attributed_via text not null default 'cart_attribute',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, shopify_order_id)
);

create index app_orders_client_idx on public.app_orders (client_id, created_at desc);

-- =============================================================================
-- RLS — padrão do sistema: team_members por email (client) e workspace (staff)
-- =============================================================================

alter table public.store_apps enable row level security;
alter table public.app_devices enable row level security;
alter table public.app_customers enable row level security;
alter table public.app_events enable row level security;
alter table public.app_orders enable row level security;

-- ---- store_apps -------------------------------------------------------------
create policy store_apps_staff_all on public.store_apps
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

create policy store_apps_client_read on public.store_apps
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

-- cliente edita o próprio config (personalização), não cria nem apaga app
create policy store_apps_client_update on public.store_apps
  for update using (
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

-- ---- app_devices / app_customers / app_events / app_orders ------------------
-- Painel lê; escrita é exclusiva do service role (edge functions), que bypassa RLS.

create policy app_devices_staff_read on public.app_devices
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

create policy app_devices_client_read on public.app_devices
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

create policy app_customers_staff_read on public.app_customers
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

create policy app_customers_client_read on public.app_customers
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

create policy app_events_staff_read on public.app_events
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

create policy app_events_client_read on public.app_events
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

create policy app_orders_staff_read on public.app_orders
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

create policy app_orders_client_read on public.app_orders
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );
