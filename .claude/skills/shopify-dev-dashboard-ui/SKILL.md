---
name: shopify-dev-dashboard-ui
description: Automate Shopify Dev Dashboard operations via Playwright. Replaces the deprecated `Admin → Develop apps` flow (legacy custom apps EOL 2026-01-01). Login persists ~14d in `./profile/`. Main use case — create Custom App + assign Lever default scopes + install on target shop + capture Admin API access token in one command. Run from `.claude/skills/shopify-dev-dashboard-ui/`.
---

# shopify-dev-dashboard-ui

Playwright skill pra operar o Shopify Dev Dashboard (`dev.shopify.com/dashboard`) — onde Custom Apps são criadas/instaladas/gerenciadas a partir de 2026.

## Por que existe

Em 1/jan/2026 a Shopify descontinuou a criação de Custom Apps "legacy" via `Admin → Develop apps`. O novo caminho oficial é Dev Dashboard. **Mas ele continua sendo UI manual** — não tem `appCreate` no Admin GraphQL nem no Partner API.

Como Lever onboarda cliente novo direto (cada cliente = 1 app + scopes + install + token), automatizar esse loop economiza ~20min por cliente novo. Mesmo padrão da skill [klaviyo-ui](../klaviyo-ui/SKILL.md) (persist profile + Playwright).

## Setup (uma vez)

```bash
cd .claude/skills/shopify-dev-dashboard-ui
npm install
npx playwright install chromium
npm run login          # abre Chromium, loga 1x manual com conta Partner, session persiste
```

Profile fica em `.claude/skills/shopify-dev-dashboard-ui/profile/` (gitignored). Sessão dura ~14d.

**Requisitos pra rodar create-app**:
- Usuário tem permissão no Dev Dashboard (Partner ou collaborator com app dev rights)
- Usuário tem permissão na loja target (collaborator/staff/owner) — sem isso o OAuth install screen rejeita

## Uso

### `login`
```bash
npm run login
```
Abre Chromium, você loga manualmente no Dev Dashboard (com 2FA), pressiona ENTER no terminal. Session salva em `profile/`.

### `doctor`
```bash
npm run flow -- doctor
```
Valida que sessão está ativa + lista apps visíveis no Dev Dashboard. Screenshot em `runs/`.

### `create-app` — flow principal
```bash
# Caminho feliz com scopes Lever default (41 scopes)
npm run flow -- create-app --client "Mantos do PH" --shop "a9dc24-2.myshopify.com"

# Scope mínimo (12 scopes — só read no essencial)
npm run flow -- create-app --client "Cliente X" --shop "loja.myshopify.com" --scopes min

# Custom scopes
npm run flow -- create-app --client "Y" --shop "loja.myshopify.com" \
  --scopes custom --extra-scopes "read_orders,write_orders,read_themes,write_themes"

# Dry-run: só simula, não cria nada
npm run flow -- create-app --client "Z" --shop "loja.myshopify.com" --dry-run

# Revelar token no stdout/JSON (use só pra debug ou quando colar imediato no Vault)
npm run flow -- create-app --client "Mantos" --shop "..." --reveal-token
```

O que acontece passo a passo:

1. **Apps → Create app** no Dev Dashboard
2. **Start from Dev Dashboard** (não App Store nem CLI)
3. Preenche **App name** = `<Cliente> — Lever MCP`
4. **Versions tab** → cria nova version, app URL default Shopify
5. **Marca os scopes** (default = 41 scopes Lever validados em Kron+MATIGNON)
6. **Release** a version
7. **Install on store** → digita `<shop>.myshopify.com`
8. **Autoriza OAuth** na loja (você precisa estar logado como collab/owner)
9. Volta pro Dev Dashboard → **API credentials** → **Reveal token once**
10. Captura `shpat_...` token via DOM
11. Salva resultado em `runs/<ts>_create-app_<cliente>/result.json`

Output sample (`result.json`):
```json
{
  "client": "Mantos do PH",
  "shop": "a9dc24-2.myshopify.com",
  "appId": "abc123xyz",
  "appName": "Mantos do PH — Lever MCP",
  "scopes": ["read_themes", "write_themes", ...],
  "token": "[REDACTED — use --reveal-token pra mostrar no JSON]",
  "tokenLength": 38,
  "tokenPrefix": "shpat_abcd"
}
```

Sem `--reveal-token`, valor fica REDACTED no JSON (default seguro). Cada run salva screenshots numerados (`01_apps_list.png` ... `12_token_revealed.png`) pra debug.

## Scopes padrão Lever

Definidos em `src/lib/scopes.ts`. Validado em 2026-05-20 contra Kron (73 scopes) e MATIGNON (42 scopes) — superset de tudo que skills+edge fns Lever precisam:

- read+write em: themes, products, orders, customers, discounts, files, inventory, metaobjects, online_store_pages, online_store_navigation, content, locales, markets, shipping, translations, publications, locations, fulfillments, assigned_fulfillment_orders, legal_policies, checkout_branding_settings

Total: 41 scopes. Versão `min` tem 12 (só read no essencial — usar quando cliente quer aprovar granularmente).

## Próximos passos pós-create-app

1. Anota o token (do `result.json` ou da run `--reveal-token`)
2. Adiciona alias no `lever/tools/shopify-mcp/shops.json`:
   ```json
   "<alias>": { "label": "<Cliente>", "domain": "<shop>.myshopify.com", "tokenEnv": "SHOPIFY_<UPPER>_TOKEN" }
   ```
3. Adiciona env var no Vercel: `SHOPIFY_<UPPER>_TOKEN=<token>`
4. Commit + push → Vercel auto-deploy
5. `mcp__lever-shopify__list_shops` agora retorna o novo alias

Esse último mile (alias + env var + push) **pode ser próxima skill** (`shopify-mcp-register-client`) — fica como TODO.

## Estrutura

```
.claude/skills/shopify-dev-dashboard-ui/
  src/
    cli.ts                  ← entry, roteia pra cada flow
    lib/
      session.ts            ← persistent profile, helpers de browser
      log.ts                ← timestamp + screenshot helpers
      scopes.ts             ← Lever default + min scopes
      selectors.ts          ← seletores centralizados (TODO: refinar ao primeiro run real)
    flows/
      login.ts
      doctor.ts
      create-app.ts         ← flow principal
  profile/                  ← gitignored: cookies, localStorage
  runs/                     ← gitignored: logs + screenshots por run
  package.json
  tsconfig.json
```

## Estado atual (2026-05-20)

- **v0.1** scaffolded e tipado (TypeScript compila)
- Login + doctor implementados
- `create-app` flow completo, mas **alguns seletores podem precisar refinar no primeiro run ao vivo** — o Dev Dashboard usa Polaris, e o DOM exato dos modais e tabs pode variar. Todos os steps têm fallback de locator + `log.snap()` em cada etapa pra debug visual.
- Primeira run real recomendada: client de teste antes de cliente produção.

## Cross-link

- Memory `project_klaviyo_playwright_skill_2026_05_19` — pattern Playwright UI
- Memory `reference_klaviyo_chrome_cdp_limitation` — perfil dedicado pq Chrome 130+ bloqueia
- Memory `project_lever_mcp_clone_theme_tool_2026_05_20` — tool clone_theme criada hoje
- Memory `feedback_verify_capability_before_assuming_limitation` — verificar capability antes de assumir
- Skill irmã: [klaviyo-ui](../klaviyo-ui/SKILL.md)
