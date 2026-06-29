# Configuração do Supabase - Passo a Passo

## Problema Atual

Você está recebendo o erro: `{"code":"NOT_FOUND","message":"Requested function was not found"}`

Isso acontece porque as edge functions existem no seu código local, mas **não foram deployadas no Supabase**.

---

## PASSO 1: Deploy das Edge Functions

### Opção A: Via CLI (Recomendado)

1. Abra o terminal e instale a CLI do Supabase:
```bash
npm install -g supabase
```

2. Faça login:
```bash
supabase login
```

3. Link com seu projeto:
```bash
cd "/Users/joaovithorbauer/Documents/Lever System"
supabase link --project-ref pxhmzpwvxvlwngjbjkrg
```

4. Deploy todas as funções:
```bash
supabase functions deploy
```

### Opção B: Via Supabase Dashboard

Se preferir não usar CLI:

1. Vá para [Supabase Dashboard](https://supabase.com/dashboard/project/pxhmzpwvxvlwngjbjkrg/functions)
2. Clique em **"New Function"**
3. Crie cada função manualmente copiando o código de:
   - `supabase/functions/sync-meta-campaigns/index.ts`
   - `supabase/functions/shopify-auth-start/index.ts`
   - `supabase/functions/shopify-oauth-callback/index.ts`
   - `supabase/functions/list-ad-accounts/index.ts`
   - `supabase/functions/list-pixels/index.ts`

---

## PASSO 2: Configurar Variáveis de Ambiente

1. Vá para: **Dashboard > Project Settings > Edge Functions**
2. Na seção **"Environment Variables"**, adicione TODAS essas variáveis:

```env
# Meta/Facebook
VITE_FB_APP_ID=860109229817662
FB_APP_SECRET=022935f58a65fda60d40ad44e90746d2

# Shopify
VITE_SHOPIFY_CLIENT_ID=10a1022a2c2b97f0640846b0c0212eb3
SHOPIFY_CLIENT_SECRET=shpss_<SEU_CLIENT_SECRET_AQUI>
VITE_APP_URL=https://app.leverag.digital
```

**Nota**: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente.

---

## PASSO 3: Configurar Redirect URLs (Authentication)

1. Vá para: **Dashboard > Authentication > URL Configuration**

2. Em **"Redirect URLs"**, adicione estas URLs (clique em "Add URL" para cada uma):
   ```
   http://localhost:8080/*
   https://app.leverag.digital/*
   https://app.leverag.digital/auth/meta/callback
   ```

3. Em **"Site URL"**, coloque:
   ```
   https://app.leverag.digital
   ```

4. Clique em **"Save"**

**Screenshot do que você precisa ver:**
- A tela que você mostrou no print já estava correta com `http://localhost:8080/*`
- Você só precisa ADICIONAR as URLs acima

---

## PASSO 4: Executar Migration SQL

1. Vá para: **Dashboard > SQL Editor**
2. Clique em **"New Query"**
3. Cole este SQL:

```sql
-- Adiciona campos de Shopify à tabela de clientes
ALTER TABLE agency_clients
ADD COLUMN IF NOT EXISTS shopify_domain TEXT,
ADD COLUMN IF NOT EXISTS shopify_access_token TEXT,
ADD COLUMN IF NOT EXISTS shopify_status TEXT DEFAULT 'disconnected'
    CHECK (shopify_status IN ('disconnected', 'pending', 'connected', 'error')),
ADD COLUMN IF NOT EXISTS shopify_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shopify_shop_name TEXT;

-- Índice para buscas mais rápidas
CREATE INDEX IF NOT EXISTS idx_agency_clients_shopify_domain
ON agency_clients(shopify_domain) WHERE shopify_domain IS NOT NULL;
```

4. Clique em **"Run"**

---

## PASSO 5: Configurar Facebook App

1. Vá para: [Facebook for Developers](https://developers.facebook.com/apps/860109229817662/)

2. Navegue até: **Facebook Login > Settings**

3. Em **"Valid OAuth Redirect URIs"**, adicione:
   ```
   https://app.leverag.digital/auth/meta/callback
   ```

4. Em **"App Domains"** (Settings > Basic), adicione:
   ```
   app.leverag.digital
   localhost
   ```

5. Salve as alterações

---

## PASSO 6: Testar a Integração

### Testar Meta Connection:

1. Vá para o seu app: `http://localhost:8080` ou `https://app.leverag.digital`
2. Clique em "Conectar com Facebook"
3. Você será redirecionado para o Facebook
4. Autorize o app
5. Você deve voltar para o sistema com a conta conectada

### Verificar se funcionou:

Abra o console do navegador (F12) e veja se há erros. Se tudo estiver correto, você verá:
- Mensagem de sucesso: "Conectado!"
- Redirecionamento para a página de connections

---

## Troubleshooting

### ❌ Erro: "NOT_FOUND"
**Solução**: As funções não foram deployadas. Faça o PASSO 1.

### ❌ Erro: "Invalid redirect_uri"
**Solução**: Configure os redirect URIs no Facebook App (PASSO 5) e no Supabase (PASSO 3).

### ❌ Erro: "Missing environment variables"
**Solução**: Configure as variáveis de ambiente (PASSO 2).

### ❌ Conexão funciona mas dados não aparecem
**Solução**: Execute a migration SQL (PASSO 4).

---

## Verificar Status das Funções

Para verificar se as funções foram deployadas com sucesso:

1. Vá para: **Dashboard > Edge Functions**
2. Você deve ver todas estas funções listadas:
   - ✅ sync-meta-campaigns
   - ✅ shopify-auth-start
   - ✅ shopify-oauth-callback
   - ✅ list-ad-accounts
   - ✅ list-pixels

Se alguma função não aparecer, ela não foi deployada.

---

## URLs Importantes

- **Supabase Dashboard**: https://supabase.com/dashboard/project/pxhmzpwvxvlwngjbjkrg
- **Facebook App**: https://developers.facebook.com/apps/860109229817662/
- **App URL**: https://app.leverag.digital
- **Localhost**: http://localhost:8080

---

## Comandos Rápidos (Terminal)

```bash
# Navegar até o projeto
cd "/Users/joaovithorbauer/Documents/Lever System"

# Deploy todas as funções
supabase functions deploy

# Ver logs de uma função específica
supabase functions logs sync-meta-campaigns

# Listar funções deployadas
supabase functions list
```
