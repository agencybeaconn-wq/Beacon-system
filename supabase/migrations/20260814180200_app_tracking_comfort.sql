-- E6: mudanças de status auditáveis, vínculo com fulfillment e presets
-- idempotentes de conforto configurados pelo painel.

alter table public.tracked_orders
  add column if not exists shopify_fulfillment_id text,
  add column if not exists status_changed_at timestamptz not null default now();

create index if not exists tracked_orders_fulfillment_idx
  on public.tracked_orders (client_id, shopify_fulfillment_id)
  where shopify_fulfillment_id is not null;

create or replace function public.app_tracking_mark_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists tracked_orders_status_change on public.tracked_orders;
create trigger tracked_orders_status_change
  before update on public.tracked_orders
  for each row execute function public.app_tracking_mark_status_change();

alter table public.journeys
  add column if not exists preset_key text;

create unique index if not exists journeys_client_preset_uidx
  on public.journeys (client_id, preset_key)
  where preset_key is not null;

-- Uma execução lógica por evento. Além de impedir duplicidade entre ticks,
-- protege contra duas invocações concorrentes do cron.
create unique index if not exists journey_runs_dedupe_uidx
  on public.journey_runs (journey_id, ((context ->> 'dedupe_key')))
  where context ? 'dedupe_key';

-- Pedidos atribuídos antes da ativação do E6 também passam a aparecer.
insert into public.tracked_orders (
  client_id, shopify_order_id, order_number, status, last_event_text,
  last_event_at, customer_shopify_id, device_id
)
select
  ao.client_id, ao.shopify_order_id, trim(leading '#' from ao.order_number),
  'confirmado', 'Recebemos seu pedido e ele está sendo preparado.',
  coalesce(ao.paid_at, ao.created_at), ao.customer_shopify_id, ao.device_id
from public.app_orders ao
where not exists (
  select 1 from public.tracked_orders tracked
  where tracked.client_id = ao.client_id
    and tracked.shopify_order_id = ao.shopify_order_id
);
