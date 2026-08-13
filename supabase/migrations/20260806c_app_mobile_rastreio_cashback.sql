-- =============================================================================
-- Módulo Apps Mobile — E0.4 rastreio + cashback
-- tracked_orders, cashback_rules, cashback_ledger
-- Rastreio: fonte primária = webhooks fulfillment da Shopify; fallback 17TRACK
-- (função track-17-* já existe no projeto). Status é NORMALIZADO — o motor de
-- conforto e os templates do lojista operam sobre esse vocabulário fechado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tracked_orders — 1 linha por (pedido, tracking). Pedido pode ter N fulfillments.
-- -----------------------------------------------------------------------------
create table public.tracked_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  shopify_order_id text not null,
  order_number text not null default '',
  tracking_number text,
  carrier text not null default '',
  status text not null default 'confirmado'
    check (status in (
      'confirmado','postado','transito_internacional','alfandega',
      'transito_nacional','saiu_para_entrega','entregue','problema','desconhecido'
    )),
  last_event_text text not null default '',
  last_event_at timestamptz,
  source text not null default 'shopify' check (source in ('shopify','17track')),
  customer_shopify_id text,
  device_id uuid references public.app_devices(id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tracked_orders_touch before update on public.tracked_orders
  for each row execute function public.app_mobile_touch_updated_at();

create unique index tracked_orders_tracking_uidx
  on public.tracked_orders (client_id, tracking_number)
  where tracking_number is not null;
create unique index tracked_orders_order_uidx
  on public.tracked_orders (client_id, shopify_order_id)
  where tracking_number is null;
create index tracked_orders_customer_idx
  on public.tracked_orders (client_id, customer_shopify_id);
-- motor de conforto: acha pedidos não entregues com rastreio mudo
create index tracked_orders_silent_idx
  on public.tracked_orders (client_id, last_event_at)
  where delivered_at is null;

-- -----------------------------------------------------------------------------
-- cashback_rules — 1 regra por cliente (config segue cashbackRuleSchema)
-- -----------------------------------------------------------------------------
create table public.cashback_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  config jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

create trigger cashback_rules_touch before update on public.cashback_rules
  for each row execute function public.app_mobile_touch_updated_at();

-- -----------------------------------------------------------------------------
-- cashback_ledger — extrato imutável (amount COM sinal; saldo = soma)
-- credito(+) | debito(-, resgate) | estorno(-, refund do pedido) | expiracao(-)
-- -----------------------------------------------------------------------------
create table public.cashback_ledger (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agency_clients(id) on delete cascade,
  customer_shopify_id text not null,
  app_order_id uuid references public.app_orders(id) on delete set null,
  kind text not null check (kind in ('credito','debito','estorno','expiracao')),
  amount numeric(12,2) not null,
  -- crédito é positivo; os demais negativos — o check trava inconsistência
  constraint cashback_ledger_sign check (
    (kind = 'credito' and amount > 0) or (kind <> 'credito' and amount < 0)
  ),
  -- crédito: quando expira; resgate: código do cupom gerado
  expires_at timestamptz,
  discount_code text,
  related_ledger_id uuid references public.cashback_ledger(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index cashback_ledger_customer_idx
  on public.cashback_ledger (client_id, customer_shopify_id, created_at desc);
-- job de expiração: acha créditos vencidos ainda não expirados
create index cashback_ledger_expiry_idx
  on public.cashback_ledger (expires_at)
  where kind = 'credito' and expires_at is not null;

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.tracked_orders enable row level security;
alter table public.cashback_rules enable row level security;
alter table public.cashback_ledger enable row level security;

-- tracked_orders: leitura painel; escrita só via edge (service role)
create policy tracked_orders_staff_read on public.tracked_orders
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

create policy tracked_orders_client_read on public.tracked_orders
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );

-- cashback_rules: staff tudo; cliente configura a própria regra
create policy cashback_rules_staff_all on public.cashback_rules
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

create policy cashback_rules_client_all on public.cashback_rules
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

-- ledger: leitura painel; escrita exclusiva do runtime (service role)
create policy cashback_ledger_staff_read on public.cashback_ledger
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

create policy cashback_ledger_client_read on public.cashback_ledger
  for select using (
    client_id in (
      select tm.linked_client_id from public.team_members tm
      where lower(tm.email) = lower((select auth.email()))
        and tm.status = 'active' and tm.user_type = 'client'
        and tm.linked_client_id is not null
    )
  );
