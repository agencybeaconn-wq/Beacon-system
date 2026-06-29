-- Gatilho nativo: briefing enviado com loja Shopify → enfileira job de onboarding.
-- O cliente preenche domínio .myshopify + código de colaborador no briefing; ao salvar,
-- este trigger cria o job em onboarding_jobs (stage access_requested) e o runner toca o resto.

create or replace function public.enqueue_onboarding_from_briefing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop text;
  v_code text;
begin
  v_shop := nullif(trim(new.answers->>'loja_myshopify'), '');
  v_code := nullif(trim(new.answers->>'loja_collab_code'), '');

  -- Briefing sem loja Shopify → não enfileira (ex: criação de loja do zero)
  if v_shop is null then
    return new;
  end if;

  -- Normaliza o domínio (garante o sufixo .myshopify.com)
  if position('.myshopify.com' in lower(v_shop)) = 0 then
    v_shop := v_shop || '.myshopify.com';
  end if;
  v_shop := lower(v_shop);

  -- Idempotência: não duplica se já há job ativo pra essa loja
  if exists (
    select 1 from public.onboarding_jobs
    where shop_domain = v_shop and status in ('pending', 'running')
  ) then
    return new;
  end if;

  insert into public.onboarding_jobs (client_name, shop_domain, stage, status, payload)
  values (
    coalesce(nullif(trim(new.client_name), ''), v_shop),
    v_shop,
    'access_requested',
    'pending',
    jsonb_build_object(
      'collab_code', v_code,
      'client_type', 'avulso',         -- runOnboard cria o cliente se ainda não existe
      'briefing_id', new.id,
      'source', 'briefing'
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_onboarding_from_briefing on public.briefings;
create trigger trg_enqueue_onboarding_from_briefing
  after insert on public.briefings
  for each row execute function public.enqueue_onboarding_from_briefing();
