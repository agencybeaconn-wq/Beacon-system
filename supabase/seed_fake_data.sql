-- INSTRUÇÕES:
-- Copie e cole este script no Editor SQL do Supabase (Dashboard > SQL Editor) e execute.
-- Ele irá inserir dados falsos para o seu usuário atual.

DO $$
DECLARE
  v_user_id uuid;
  v_account_id uuid;
  v_campaign_id_1 uuid;
  v_campaign_id_2 uuid;
  v_campaign_id_3 uuid;
BEGIN
  -- 1. Obter o ID do usuário atual (funciona no SQL Editor se logado, ou pode hardcoded)
  -- Se estiver rodando via dashboard, auth.uid() pode retornar null dependendo do contexto.
  -- TENTA PEGAR O PRIMEIRO USUÁRIO DA LISTA (Modo DEV) se auth.uid() for nulo
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
     SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  -- 2. Criar uma Conta de Anúncios Fave
  v_account_id := gen_random_uuid();

  INSERT INTO public.ad_accounts (id, user_id, name, status, created_at)
  VALUES (v_account_id, v_user_id, 'Conta Demo Shopify', 'ACTIVE', now())
  ON CONFLICT DO NOTHING; -- Evita erro se rodar de novo (mas gera novo ID se gerado aleatoriamente)

  -- 3. Criar Campanhas
  v_campaign_id_1 := gen_random_uuid();
  v_campaign_id_2 := gen_random_uuid();
  v_campaign_id_3 := gen_random_uuid();

  INSERT INTO public.campaigns (id, account_id, name, objective, status)
  VALUES 
    (v_campaign_id_1, v_account_id, 'Campanha de Vendas - Verão', 'OUTCOME_SALES', 'ACTIVE'),
    (v_campaign_id_2, v_account_id, 'Campanha de Branding', 'OUTCOME_AWARENESS', 'ACTIVE'),
    (v_campaign_id_3, v_account_id, 'Retargeting Carrinho', 'OUTCOME_SALES', 'ACTIVE');

  -- 4. Gerar Insights (Dados diários para os últimos 30 dias)
  
  -- Campanha 1 (Vendas - Alta performance)
  INSERT INTO public.insights (entity_id, entity_type, date, spend, revenue, impressions, clicks, conversions, roas)
  SELECT 
    v_campaign_id_1,
    'CAMPAIGN',
    CURRENT_DATE - (i || ' days')::interval,
    (random() * 500 + 200)::numeric(10,2), -- Spend: 200-700
    (random() * 2000 + 800)::numeric(10,2), -- Revenue: 800-2800
    floor(random() * 10000 + 5000), -- Impressions
    floor(random() * 500 + 100), -- Clicks
    floor(random() * 20 + 5), -- Conversions
    (random() * 3 + 2)::numeric(10,2) -- ROAS: 2-5
  FROM generate_series(0, 30) i;

  -- Campanha 2 (Branding - Baixo ROAS, muito imp)
  INSERT INTO public.insights (entity_id, entity_type, date, spend, revenue, impressions, clicks, conversions, roas)
  SELECT 
    v_campaign_id_2,
    'CAMPAIGN',
    CURRENT_DATE - (i || ' days')::interval,
    (random() * 300 + 100)::numeric(10,2),
    0, -- Branding gera pouca receita direta
    floor(random() * 50000 + 20000),
    floor(random() * 1000 + 500),
    0,
    0
  FROM generate_series(0, 30) i;

  -- Campanha 3 (Retargeting - Alto ROAS)
  INSERT INTO public.insights (entity_id, entity_type, date, spend, revenue, impressions, clicks, conversions, roas)
  SELECT 
    v_campaign_id_3,
    'CAMPAIGN',
    CURRENT_DATE - (i || ' days')::interval,
    (random() * 150 + 50)::numeric(10,2),
    (random() * 1500 + 500)::numeric(10,2),
    floor(random() * 2000 + 1000),
    floor(random() * 100 + 50),
    floor(random() * 10 + 2),
    (random() * 5 + 5)::numeric(10,2) -- ROAS: 5-10
  FROM generate_series(0, 30) i;

END $$;
