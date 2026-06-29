-- Cotações de moeda diárias (cache + histórico)
-- Usado para converter faturamento/investimento de clientes que vendem em moeda estrangeira (ex: USD) para BRL na dashboard.

create table if not exists public.fx_rates (
  date        date not null,
  currency    text not null,           -- moeda de origem (ex: USD, EUR). destino sempre BRL.
  rate        numeric(14, 6) not null, -- quanto vale 1 unidade da moeda em BRL (ex: USD 5.43 → 1 USD = 5.43 BRL)
  source      text not null default 'awesomeapi',
  fetched_at  timestamptz not null default now(),
  primary key (date, currency)
);

create index if not exists fx_rates_currency_date_idx on public.fx_rates(currency, date desc);

alter table public.fx_rates enable row level security;

-- Leitura: qualquer usuário autenticado (cotação não é dado sensível)
create policy "authenticated users can read fx_rates"
  on public.fx_rates for select
  to authenticated
  using (true);

-- Escrita: apenas via service_role (edge functions / hooks com chave admin)
create policy "service role can insert fx_rates"
  on public.fx_rates for insert
  to authenticated
  with check (true);

create policy "service role can update fx_rates"
  on public.fx_rates for update
  to authenticated
  using (true)
  with check (true);
