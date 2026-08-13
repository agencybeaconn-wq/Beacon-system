-- Módulo Apps Mobile — view de gestão da agência (página /aplicativos).
-- security_invoker: a RLS das tabelas-base vale pra quem consulta (staff).
-- Obs.: reuso no portal do cliente exigiria policies de cliente em
-- webhook_events/webhook_subscriptions, que hoje são staff-only.
--
-- webhook_subscriptions/webhook_events são tabelas GENÉRICAS (a skill
-- /shopify watch também grava lá) — por isso as subqueries filtram SÓ os
-- 6 topics que o app-link instala, senão a saúde "6/6" e o "último evento"
-- mentem (ex.: PRODUCTS_UPDATE avulso mascarando ORDERS_PAID morto).
-- Formatos divergem por tabela: subscriptions usa enum GraphQL
-- (ORDERS_PAID), events usa o header x-shopify-topic (orders/paid).

create or replace view public.app_overview
with (security_invoker = true) as
select
  sa.id as app_id,
  sa.client_id,
  ac.name as client_name,
  ac.logo_url,
  sa.app_name,
  sa.bundle_id,
  sa.status,
  sa.created_at,
  (select count(*) from public.app_devices d where d.client_id = sa.client_id) as devices,
  (select count(*) from public.app_orders o where o.client_id = sa.client_id) as pedidos,
  (select coalesce(sum(o.total), 0) from public.app_orders o where o.client_id = sa.client_id) as receita,
  (select max(e.received_at) from public.webhook_events e
     where e.client_id = sa.client_id
       and e.topic in ('orders/paid','refunds/create','checkouts/create',
                       'checkouts/update','fulfillments/update','fulfillment_events/create')
  ) as ultimo_webhook,
  (select count(*) from public.webhook_subscriptions ws
     where ws.client_id = sa.client_id and ws.enabled
       and ws.topic in ('ORDERS_PAID','REFUNDS_CREATE','CHECKOUTS_CREATE',
                        'CHECKOUTS_UPDATE','FULFILLMENTS_UPDATE','FULFILLMENT_EVENTS_CREATE')
  ) as webhooks_ativos
from public.store_apps sa
join public.agency_clients ac on ac.id = sa.client_id
where coalesce(ac.is_archived, false) = false;
