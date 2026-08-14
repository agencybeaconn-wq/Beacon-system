-- Agregado de CRM atualizado atomicamente depois que app_orders aceita um
-- pedido novo. A unicidade de app_orders é a chave de idempotência.

create or replace function public.app_customer_add_order(
  p_client_id uuid,
  p_shopify_customer_id text,
  p_display_name text,
  p_email text,
  p_total numeric,
  p_order_at timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.app_customers (
    client_id,
    shopify_customer_id,
    display_name,
    email,
    orders_app_count,
    total_spent_app,
    last_order_at
  ) values (
    p_client_id,
    p_shopify_customer_id,
    nullif(p_display_name, ''),
    nullif(p_email, ''),
    1,
    p_total,
    p_order_at
  )
  on conflict (client_id, shopify_customer_id) do update set
    display_name = coalesce(excluded.display_name, app_customers.display_name),
    email = coalesce(excluded.email, app_customers.email),
    orders_app_count = app_customers.orders_app_count + 1,
    total_spent_app = app_customers.total_spent_app + excluded.total_spent_app,
    last_order_at = greatest(app_customers.last_order_at, excluded.last_order_at);
$$;

revoke all on function public.app_customer_add_order(uuid, text, text, text, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.app_customer_add_order(uuid, text, text, text, numeric, timestamptz)
  to service_role;
