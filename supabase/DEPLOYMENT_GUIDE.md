# Guia de Deploy das Edge Functions no Supabase

Este guia mostra como fazer o deploy das edge functions criadas para o Supabase.

## Pré-requisitos

1. Instale a CLI do Supabase:
```bash
npm install -g supabase
```

2. Faça login na sua conta Supabase:
```bash
supabase login
```

3. Link com seu projeto (substitua pelo ID do seu projeto):
```bash
supabase link --project-ref pxhmzpwvxvlwngjbjkrg
```

## Deploy das Edge Functions

Para fazer deploy de TODAS as funções de uma vez:

```bash
cd /Users/joaovithorbauer/Documents/Lever\ System
supabase functions deploy
```

Ou para fazer deploy de funções individuais:

```bash
# Meta sync function
supabase functions deploy sync-meta-campaigns

# Shopify OAuth
supabase functions deploy shopify-auth-start
supabase functions deploy shopify-oauth-callback

# Meta account functions
supabase functions deploy list-ad-accounts
supabase functions deploy list-pixels
```

## Configurar Variáveis de Ambiente no Supabase

Vá para **Supabase Dashboard > Project Settings > Edge Functions** e adicione:

### Para Meta/Facebook:
```
VITE_FB_APP_ID=860109229817662
FB_APP_SECRET=022935f58a65fda60d40ad44e90746d2
```

### Para Shopify:
```
VITE_SHOPIFY_CLIENT_ID=10a1022a2c2b97f0640846b0c0212eb3
SHOPIFY_CLIENT_SECRET=shpss_<SEU_CLIENT_SECRET_AQUI>
VITE_SHOPIFY_SCOPES=read_products,read_orders,read_customers,write_products
VITE_APP_URL=https://app.leverag.digital
```

### Variáveis do Supabase (já devem existir automaticamente):
```
SUPABASE_URL=https://pxhmzpwvxvlwngjbjkrg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[sua-service-role-key]
```

## Configurar Redirect URLs no Supabase

### 1. Authentication URLs

Vá para **Supabase Dashboard > Authentication > URL Configuration**

Adicione estas URLs em **Redirect URLs**:
```
http://localhost:8080/*
https://app.leverag.digital/*
https://app.leverag.digital/auth/meta/callback
```

### 2. Site URL

Configure o **Site URL** como:
```
https://app.leverag.digital
```

## Configurar Facebook App

Vá para [Facebook Developers](https://developers.facebook.com/apps/860109229817662/):

1. **Valid OAuth Redirect URIs** (em Facebook Login > Settings):
   ```
   https://app.leverag.digital/auth/meta/callback
   ```

2. **App Domains**:
   ```
   app.leverag.digital
   localhost
   ```

## Configurar Shopify App

Vá para Shopify Partners > Seu App:

1. **App URL**:
   ```
   https://app.leverag.digital
   ```

2. **Allowed redirection URL(s)**:
   ```
   https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/shopify-oauth-callback
   ```

## Testar as Funções

Após o deploy, você pode testar cada função:

### Testar sync-meta-campaigns:
```bash
curl -X POST https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/sync-meta-campaigns \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Testar shopify-auth-start (no navegador):
```
https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/shopify-auth-start?shop=loja.myshopify.com&clientId=uuid-do-cliente&returnUrl=https://app.leverag.digital
```

## Executar Migration SQL

Vá para **Supabase Dashboard > SQL Editor** e execute:

```sql
-- Arquivo: supabase/migrations/20260120_add_shopify_to_agency_clients.sql
ALTER TABLE agency_clients
ADD COLUMN IF NOT EXISTS shopify_domain TEXT,
ADD COLUMN IF NOT EXISTS shopify_access_token TEXT,
ADD COLUMN IF NOT EXISTS shopify_status TEXT DEFAULT 'disconnected' CHECK (shopify_status IN ('disconnected', 'pending', 'connected', 'error')),
ADD COLUMN IF NOT EXISTS shopify_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shopify_shop_name TEXT;

CREATE INDEX IF NOT EXISTS idx_agency_clients_shopify_domain
ON agency_clients(shopify_domain) WHERE shopify_domain IS NOT NULL;
```

## Troubleshooting

### Erro "NOT_FOUND" ao chamar função
- Verifique se a função foi deployed: `supabase functions list`
- Verifique se as variáveis de ambiente estão configuradas
- Verifique os logs: `supabase functions logs sync-meta-campaigns`

### Erro de autenticação
- Verifique se o redirect URI está configurado corretamente no Facebook/Shopify
- Verifique se as URLs estão na whitelist do Supabase Auth

### Erro de CORS
- As funções já incluem headers CORS corretos
- Verifique se está usando HTTPS em produção

## Comandos Úteis

```bash
# Ver logs de uma função
supabase functions logs sync-meta-campaigns --follow

# Listar todas as funções
supabase functions list

# Deletar uma função
supabase functions delete nome-da-funcao
```
