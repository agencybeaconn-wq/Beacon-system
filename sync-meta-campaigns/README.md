# 🔄 Sync Meta Campaigns - Edge Function

## 📋 Descrição

Esta Edge Function sincroniza campanhas e métricas do Facebook Ads com o banco de dados Supabase, replicando a visualização "Vendas" do Gerenciador de Anúncios.

## 🎯 Funcionalidades

1. **Busca Estrutura de Campanhas**: `/campaigns` com campos estruturais
2. **Busca Insights/Métricas**: `/insights` com métricas de performance
3. **Processamento de Dados**: 
   - Extrai `purchase_roas` do array
   - Identifica conversões em `actions`
   - Calcula CPA (Spend / Conversions)
4. **Persistência**: UPSERT em `campaigns` e `insights`

## 📊 Estrutura de Tabelas Necessárias

### Tabela `campaigns`

```sql
CREATE TABLE public.campaigns (
  id TEXT PRIMARY KEY, -- ID da campanha do Facebook
  name TEXT NOT NULL,
  status TEXT,
  effective_status TEXT,
  objective TEXT,
  daily_budget TEXT, -- Em reais (ex: "5000.00")
  lifetime_budget TEXT,
  start_time TIMESTAMPTZ,
  platform TEXT DEFAULT 'Meta Ads',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_account_id ON public.campaigns(account_id);
```

### Tabela `insights`

```sql
CREATE TABLE public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  date DATE NOT NULL,
  spend TEXT, -- Em reais
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cpc TEXT,
  cpm TEXT,
  ctr TEXT,
  reach INTEGER DEFAULT 0,
  frequency TEXT,
  conversions INTEGER DEFAULT 0,
  conversion_value TEXT,
  purchase_roas NUMERIC,
  cpa TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX idx_insights_campaign_id ON public.insights(campaign_id);
CREATE INDEX idx_insights_user_id ON public.insights(user_id);
CREATE INDEX idx_insights_date ON public.insights(date);
```

## 🔧 Como Usar

### Chamada do Frontend

```typescript
const { data, error } = await supabase.functions.invoke('sync-meta-campaigns', {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});

if (data?.success) {
  console.log(`${data.count} campanhas sincronizadas`);
}
```

## 📡 Chamadas à Graph API

### 1. Estrutura de Campanhas

```
GET /act_{account_id}/campaigns
Fields: id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time
```

### 2. Insights/Métricas

```
GET /act_{account_id}/insights
Level: campaign
Date Preset: maximum
Fields: campaign_id,spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,actions,action_values,purchase_roas
```

## 🔄 Processamento de Dados

### Purchase ROAS

O Facebook retorna `purchase_roas` como array:
```json
{
  "purchase_roas": [
    { "value": "2.5" }
  ]
}
```

A função extrai o valor numérico: `2.5`

### Actions (Conversões)

O Facebook retorna `actions` como array:
```json
{
  "actions": [
    { "action_type": "purchase", "value": "10" },
    { "action_type": "lead", "value": "5" }
  ]
}
```

A função:
- Filtra ações de compra/lead
- Soma os valores: `conversions = 15`
- Calcula CPA: `spend / conversions`

### Action Values

Para `action_values`:
```json
{
  "action_values": [
    { "action_type": "purchase", "value": "500.00" }
  ]
}
```

A função soma os valores de compra: `conversion_value = 500.00`

## ✅ Retorno

```json
{
  "success": true,
  "count": 10,
  "campaigns": 10,
  "insights": 10
}
```

## ⚠️ Tratamento de Erros

- Se `campaigns` falhar: retorna erro
- Se `insights` falhar: loga warning mas continua (não quebra o fluxo)

## 🔐 Segurança

- Requer autenticação (JWT token)
- Busca conta do próprio usuário (RLS)
- Service Role Key apenas no servidor

