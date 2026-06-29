# Mantos do PH — Cadastrar `www.mantosdoph.com.br` como secondary domain

**Data:** 2026-05-20
**Loja:** Mantos do PH (`a9dc24-2.myshopify.com`) — UUID `053f7258-95f4-4ca9-81ad-4032b18829ba`
**Agente:** lever-catalogo
**Severidade:** atenção (bloqueio operacional, sem violação de regra Lever)

---

## Missão

Cadastrar `www.mantosdoph.com.br` como secondary domain no Admin Shopify. DNS já apontava pra Shopify (CNAME `shops.myshopify.com`, IP `23.227.38.74`), apex (`mantosdoph.com.br`) já é primary, falta só o Admin reconhecer o host do www. Sintoma reportado: `https://www.mantosdoph.com.br/` retorna HTTP 404 "This store is unavailable".

## Resultado

**Bloqueio operacional: API não suporta cadastro de domain em loja plano `basic` (e tampouco em Plus na API pública).** Pendência transferida pro Pedro fazer via UI Admin.

## Investigação

### Pré-fix (smoke test)
- `HEAD https://www.mantosdoph.com.br/` → **404** (Cloudflare server, sem location, sem x-shopid) — Shopify rejeita por host desconhecido
- `HEAD https://mantosdoph.com.br/` → **200** (apex saudável)

### Estado atual de domains
- `shop.primaryDomain` (GraphQL):
  - id: `gid://shopify/Domain/115345326275`
  - host: `mantosdoph.com.br`
  - url: `https://mantosdoph.com.br`
  - sslEnabled: `true`
- `shop.myshopifyDomain`: `a9dc24-2.myshopify.com`
- `plan_name`: `basic`
- **Field `Shop.domains` (list)**: NÃO disponível na API com o escopo atual (introspect retornou `undefined`)
- **REST `GET /admin/api/2026-04/domains.json`**: HTTP 404 "Not Found" — endpoint não existe

### Introspection (definitiva)
Verificado o schema GraphQL Admin API 2026-04 do app instalado:
- **477 mutations totais** disponíveis pro token
- **Filtro `/domain/i` em mutations → 0 resultados.** Não existe `domainCreate`, nem `domainUpdate`, nem `setShopPrimaryDomain`, nem `shopAddDomain`, nada.
- Mutations relacionadas existentes são só de URL Redirect (`urlRedirectCreate`, `urlRedirectUpdate`, etc.) — não servem
- Tentativa forçada com mutation `domainCreate(domain: { host: "www.mantosdoph.com.br" })`:
  ```json
  {"errors":[{"message":"Field 'domainCreate' doesn't exist on type 'Mutation'",
    "extensions":{"code":"undefinedField","typeName":"Mutation","fieldName":"domainCreate"}}]}
  ```
- Tentativa com `shopAddDomain(host:)`: mesmo erro `undefinedField`
- Type `Domain` existe no schema (read-only via `domain(id:)`) — campos: `host`, `id`, `localization`, `marketWebPresence`, `sslEnabled`, `url`. **Nenhum input type pareado pra create/update.**
- QueryRoot tem `domain(id:)` (read singular) mas zero list/create

### Scopes do token (não é problema de scope)
77 scopes ativos no token, incluindo `write_themes`, `write_online_store_pages`, `write_online_store_navigation`, `write_files`, etc. **Não existe um scope `write_domains` no leque de access_scopes oferecido pelo Shopify pra apps Custom/Public** — domain management nunca foi exposto via API Admin pra planos não-Plus, e mesmo em Plus a documentação pública não lista `domainCreate` (operação é UI-only ou via Plus partner channel).

## Conclusão técnica

Cadastro de domain secundário em loja Shopify `basic` é **exclusivamente UI Admin**. Não é falta de scope nem bug — é decisão de produto Shopify. Plus tem APIs internas pra domain via partner channel mas não estão expostas na Admin API pública 2026-04.

## Ação requerida do Pedro (UI manual — 30s)

1. Acessa `https://admin.shopify.com/store/a9dc24-2/settings/domains`
2. Clica em **"Connect existing domain"** (NÃO "Buy new domain")
3. Insere: `www.mantosdoph.com.br`
4. Shopify verifica DNS (já válido — CNAME pronto, vai detectar na hora)
5. Após reconhecer, configura redirect:
   - **Primary domain**: continua `mantosdoph.com.br` (apex)
   - `www.mantosdoph.com.br` entra como secondary com toggle "Redirect all traffic to primary domain" ligado (default) → gera 301 → apex
6. SSL provisiona automaticamente em ~30s-2min via Let's Encrypt

## Smoke test pós-fix (pra Pedro rodar depois)

```powershell
curl -sI https://www.mantosdoph.com.br/
# Esperado:
# HTTP/2 301
# location: https://mantosdoph.com.br/
```

Se ainda der 404 após 3min, esperar mais 5min (SSL provision do Shopify pode demorar em DNS Cloudflare-proxied).

## Olhos (catálogo)

- olho-precificacao: N/A (zero alteração de preço/produto)
- olho-variants-br-en: N/A
- olho-duplicatas: N/A
- olho-smart-collections: N/A
- olho-domain-config: **falhou por design da API Shopify, não por configuração**

## Lições

1. **Domain management Shopify é UI-only em planos abaixo de Plus.** Não tentar de novo via Admin API — é hard limit. Pra Plus, é via partner channel.
2. **Introspecção em vez de adivinhar:** rodar `__schema.mutationType.fields` filtrando por substring é mais rápido que tentar 5 nomes de mutation hipotéticos.
3. **Distinção scope vs feature:** ter `write_themes`, `write_online_store_pages` etc não implica `write_domains`. Listar `/oauth/access_scopes.json` confirma o que o app pode tocar.
4. **Pedindo aval Pedro pra padrão recorrente:** vale criar tag `requires_admin_ui` no kanban de demandas pra ações que sempre dependem dele.
5. **DNS já estava certo** (cliente fez direito) — falha 404 era puro descompasso Shopify Admin × DNS. Cadastro UI resolve em 30s.

## Arquivos

- `.claude/tmp/mantos-domain-www/step1-snapshot.mjs` (introspect shop + mutations)
- `.claude/tmp/mantos-domain-www/step1b-rest-domains.mjs` (REST probe + types/mutations dump)
- `.claude/tmp/mantos-domain-www/step1b-rest-domains.json` (resultado introspection: 477 mutations, 0 com "domain")
- `.claude/tmp/mantos-domain-www/step1c-try-mutation.mjs` (forçar mutation pra capturar erro oficial)
- `.claude/tmp/mantos-domain-www/step1c-try-mutation.json` (scopes 77 handles + erro `undefinedField` + smoke pre-fix)
- `.claude/tmp/mantos-domain-www/step1d-domain-type-introspect.mjs` (confirmar Domain type read-only)
- `.claude/tmp/mantos-domain-www/step1d-domain-type.json` (Domain type fields + QueryRoot.domain único acesso)

## Verificação visual (pós-fix Pedro)

- Antes: `https://www.mantosdoph.com.br/` → 404
- Depois: `https://www.mantosdoph.com.br/` → 301 → `https://mantosdoph.com.br/` → 200
