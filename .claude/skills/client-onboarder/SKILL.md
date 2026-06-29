---
name: client-onboarder
description: Onboard novo cliente Lever end-to-end via Playwright. Cria app no Shopify Dev Dashboard (escopos Lever + URLs de callback), captura Client ID + Secret das Configurações, preenche Conexões do cliente no Lever System (domínio + ID + secret), salva credenciais, instala app na loja do cliente, dispara Verificar Conexão e valida que token OAuth foi salvo via callback. Auto-disparo backfill DW pós-conexão. Run `.claude/skills/client-onboarder/`.
---

# client-onboarder

Playwright skill pra automatizar o onboarding completo de um cliente novo no Lever System (Shopify). Reproduz o fluxo manual de 15 passos em 1 comando.

> **Arquitetura & roadmap completos em [ARCHITECTURE.md](ARCHITECTURE.md)** — runner headless no
> servidor + orquestração via Claude Code + fila no Supabase. Validado end-to-end (Ninja Games, 2026-05-28).
> Comandos: `login` · `doctor` · `status` (fila + saúde) · `onboard` · `enqueue` · `worker`.

## Fluxo manual que automatiza

1. Cliente já aceito no Partners (você envia convite manual antes — não automatizamos)
2. **Dev Dashboard** (`dev.shopify.com/dashboard`) → Criar app → "Lever System — `<Cliente>`"
3. Lançar nova versão com 42 escopos Lever + URLs de redirecionamento padrão
4. Pegar **Client ID** + **Client Secret** nas Configurações do app
5. **Lever System** (`app.leverag.digital` ou local dev) → Cliente selecionado → Conexões → Shopify
6. Preencher domínio `<loja>.myshopify.com` + Client ID + Client Secret → Salvar Credenciais
7. Instalar app na loja (link do Dev Dashboard ou direto do Lever)
8. Verificar Conexão → callback `shopify-oauth-callback` salva token permanente em `agency_clients.shopify_access_token`
9. (skill extra) Disparar `dw-daily-sync` com `client_id` + `days: 90` pra backfill imediato

## Setup (uma vez)

```bash
cd .claude/skills/client-onboarder
npm install
npx playwright install chromium
npm run login        # login manual no Dev Dashboard + 2FA; salva a sessão no storage-state.json
```

A sessão fica no `storage-state.json` (gitignored — JSON portável cross-OS: cookies + localStorage). Dura ~14d. Você loga 1x no Shopify Dev Dashboard (`npm run login`) — depois disso a skill só executa.

## Variáveis de ambiente (.env na pasta da skill)

```
LEVER_SYSTEM_URL=https://app.leverag.digital
# Para dev local: http://localhost:8081
SUPABASE_URL=https://pxhmzpwvxvlwngjbjkrg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # pra ler/escrever agency_clients direto
```

## Uso

### `login`
```bash
npm run login
```
Abre Chromium, você loga em `dev.shopify.com/dashboard` E em `app.leverag.digital` (mesma sessão). ENTER no terminal salva.

### `doctor`
```bash
npm run flow -- doctor
```
Valida: (a) Dev Dashboard acessível, (b) Lever System acessível, (c) Supabase credentials OK, (d) lista apps Lever System já existentes no Dev Dashboard.

### `onboard` — flow principal

```bash
# Ninja Games (cliente já existe em agency_clients, dev store já em Partners)
npm run flow -- onboard --client "Ninja Games" --shop "0e0qgn-mr.myshopify.com"

# Cliente novo (cria em agency_clients se não existir)
npm run flow -- onboard --client "Cliente X" --shop "loja.myshopify.com" --client-type fixo --fee 3000 --commission 3

# Dry-run: simula tudo, não salva
npm run flow -- onboard --client "Ninja Games" --shop "0e0qgn-mr.myshopify.com" --dry-run

# Só cria app no Dev Dashboard, não mexe no Lever (debug)
npm run flow -- onboard --client "Y" --shop "loja.myshopify.com" --only-app

# Pula criar app, assume que já existe — só faz Conexões + Verificar
npm run flow -- onboard --client "Y" --shop "loja.myshopify.com" --skip-app --client-id "abc..." --client-secret "shpss_..."
```

### Steps executados (`onboard`)

1. **Pré-check DB**
   - SELECT `agency_clients` WHERE name=`<client>`
   - Se não existir → INSERT com defaults (precisa `--client-type`, `--fee`, `--commission`)
   - Se existir → captura `client_id` e segue
   - Se já tem `shopify_access_token` válido → aborta (`--force` pra sobrescrever)

2. **Criar app no Dev Dashboard**
   - `https://dev.shopify.com/dashboard` → Apps → Criar app
   - Nome: `Lever System — <Cliente>`
   - Criar versão com escopos (ver `src/lib/scopes.ts`)
   - URLs de redirecionamento: `https://app.leverag.digital/api/shopify/callback,https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/shopify-oauth-callback`
   - URL do app: `https://app.leverag.digital`
   - Webhooks API: `2026-04`
   - Lançar versão

3. **Capturar credenciais**
   - App → Configurações → Credenciais
   - Extrai `Client ID` (visível) + `Chave secreta` (clica Olho → reveal → copia)
   - Screenshot pra `runs/<ts>/credentials.png` (token redacted)

4. **Lever System → Conexões**
   - `<LEVER_SYSTEM_URL>/client-config` (cliente selecionado via context — usa `selectedClientId` localStorage hack OU navega `/clients/<id>/connections`)
   - Switcher de cliente: troca pro alvo
   - Aba "Conexões" → card Shopify
   - Preenche: Domínio `<shop>` + Client ID + Client Secret
   - Click "Salvar Credenciais"

5. **Instalar app na loja + OAuth (unificado)**
   - A "instalação" do app É o OAuth authorize — não é passo separado no Dev Dashboard.
   - A skill **monta o authorize URL própria** com os **42 escopos canônicos** (`scopes.ts`),
     `state=<client.id>`, `redirect_uri` whitelistado, e navega direto:
     `https://<shop>/admin/oauth/authorize?client_id=...&scope=<42>&redirect_uri=.../api/shopify/callback&state=<clientId>`
   - **NÃO clica no botão "Verificar Conexão" do front** — ele pede só 13 escopos (bug, ver abaixo).
   - Se a tela de Install/Autorizar aparecer → clica (best-effort, fallbacks PT/EN). Se o app já
     estiver instalado com os mesmos escopos, o Shopify auto-redireciona sem tela.
   - Callback `shopify-oauth-callback` (via rewrite `/api/shopify/callback`) troca o code pelo
     token permanente e salva em `agency_clients.shopify_access_token` (status=connected).

6. **Aguardar token (polling do DB)**
   - Em vez de `waitForTimeout` cego, a skill polla `agency_clients` (`waitForToken`, até 120s)
     até `shopify_access_token != null` — o DB é a fonte de verdade, independe de onde o browser parou.

> **⚠️ Bug de escopos (corrigido):** o botão "Verificar Conexão" do front (`ConnectionsHub.tsx`)
> pedia só 13 escopos hardcoded → tokens capados. Corrigido pra usar a lista canônica de 42
> (`src/constants/shopifyScopes.ts`). As três fontes (skill `scopes.ts`, front
> `shopifyScopes.ts`, edge `shopify-auth-start`) devem ficar sincronizadas.

7. **Validar no DB**
   - SELECT `agency_clients` WHERE id=...
   - Confirma `shopify_status='connected'`, `shopify_domain=<shop>`, `shopify_access_token IS NOT NULL`, `shopify_connected_at` recente
   - Faz 1 ping GraphQL `{ shop { name myshopifyDomain } }` com token salvo → confirma 200

8. **Trigger backfill DW**
   - POST pra `dw-daily-sync` com `client_id` + `days: 90`
   - Salva `request_id` no result.json pra rastreamento

9. **Result final**
   - `runs/<ts>_onboard_<cliente>/result.json` com tudo (app id, scopes, status conexão, request_id backfill)
   - Screenshots numerados de cada etapa (gitignored)

## Escopos padrão

42 escopos Lever (validados em Mantos do PH, Mega Mantos, Coringão, etc):

```
read_assigned_fulfillment_orders, write_assigned_fulfillment_orders,
read_checkout_branding_settings, write_checkout_branding_settings,
read_content, write_content,
read_customers, write_customers,
read_discounts, write_discounts,
read_files, write_files,
read_fulfillments, write_fulfillments,
read_inventory, write_inventory,
read_legal_policies, write_legal_policies,
read_locales, write_locales,
read_locations, write_locations,
read_markets, write_markets,
read_metaobjects, write_metaobjects,
read_online_store_navigation, write_online_store_navigation,
read_online_store_pages, write_online_store_pages,
read_orders, write_orders,
read_products, write_products,
read_publications, write_publications,
read_shipping, write_shipping,
read_themes, write_themes,
read_translations, write_translations
```

Lista canônica em `src/lib/scopes.ts`.

## URLs canônicas (não mudar sem combinar)

| URL | Uso |
|---|---|
| `https://app.leverag.digital/api/shopify/callback` | Callback OAuth do app Lever (prod) |
| `https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/shopify-oauth-callback` | Callback OAuth via Edge Function (Supabase) |
| `https://app.leverag.digital` | URL do app (Dev Dashboard config) |

## Próximas evoluções (TODO pós-MVP)

- **Auto-detectar shop domain** via MCP `lever-shopify list_shops` (se cliente já tem alias)
- **Convite Partners** automatizar passo 1 (envio do collab request) — atualmente manual
- **Bulk onboard** — arquivo CSV com N clientes, processa em série
- **Validar selectors do Dev Dashboard na 1ª run real** — `selectors.ts` ainda são palpites Polaris
- **Promover skill pra Lever-System core** — adicionar botão "Onboard via Skill" na UI de Clientes

> ✅ Resolvido: passo de instalação/OAuth (authorize próprio 42 escopos + polling DB) e bug de
> escopos no front. Falta validar os selectors do **Dev Dashboard** (criar app) contra a UI real.

## Estrutura

```
.claude/skills/client-onboarder/
  SKILL.md
  package.json
  tsconfig.json
  .env.example
  .gitignore
  src/
    cli.ts                  ← entry, roteia pra cada flow
    lib/
      session.ts            ← Playwright persistent context + helpers
      scopes.ts             ← 42 escopos Lever
      db.ts                 ← Supabase service-role client
      log.ts                ← timestamp + screenshot helpers
      selectors.ts          ← seletores Dev Dashboard + Lever System
    flows/
      login.ts              ← login interativo (Dev Dashboard + Lever)
      doctor.ts             ← sanity check
      onboard.ts            ← flow principal end-to-end
  storage-state.json        ← gitignored — sessão (cookies+localStorage), portável cross-OS
  runs/                     ← gitignored — logs + screenshots por run
```

## Cross-links

- Skill irmã `shopify-dev-dashboard-ui` — só create-app + token direto (sem OAuth, não usar pra cliente novo)
- Skill irmã `klaviyo-ui` — pattern de session.ts
- Tabela canônica `agency_clients` em Lever System Supabase
- Edge function `shopify-oauth-callback` é onde o token chega
- Memory `reference_klaviyo_chrome_cdp_limitation` — pq usar profile dedicado
