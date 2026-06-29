# Bloco: Fix Sitelinks órfãos (URL Redirects 301 pra handles renomeados/canônicos)

## Operação
- **Data:** 2026-05-20
- **Loja:** Mantos do PH (`a9dc24-2.myshopify.com`) — UUID `053f7258-95f4-4ca9-81ad-4032b18829ba` — domínio público `mantosdoph.com.br`
- **Modo:** SHOPIFY ADMIN (URL Redirects via GraphQL `urlRedirectCreate`) — sem tocar em tema, produto, DNS
- **Status:** Aplicado — 2 URL Redirects 301 criados · smoke test 4/4 OK
- **Agente:** lever-catalogo (escopo SEO / coleções)

## Contexto

Google estava listando 2 sitelinks da loja apontando pra paths que retornavam 404 — derruba CTR e queima crédito SEO. Demanda Pedro travou a decisão Atlético MG (redirect direto pra `atletico-mineiro`) e delegou o caso Cruzeiro pro agente decidir (cenário A/B/C). Resultado: cenário B confirmado — `cabuloso` (smart collection com title "Cruzeiro" e 119 produtos) é o handle canônico real, então redirect pra ele em vez de criar nova coleção redundante.

## Investigação prévia (zero suposição)

### Step 1 — GraphQL snapshot
- `collectionByHandle("atletico-mineiro")` retornou **null** (suspeito — Pedro disse que funciona)
- `collectionByHandle("cruzeiro")` retornou null (esperado)
- `collections(query: "title:*cruzeiro*")` retornou 2 hits: `cabuloso` (119 prods, title "Cruzeiro") e `lancamentos-cruzeiro` (11 prods)
- `products(query: "tag:cruzeiro AND status:active")` retornou 50+ produtos (tag bagunçada — muitos com título Palmeiras/Flamengo/São Paulo)
- URL Redirects pré-existentes pros paths alvo: **0** (sem duplicação)

### Step 1b — HTTP probe + listagem completa
- HTTP HEAD `/collections/atletico-mineiro` → **200** (existe na storefront!)
- HTTP HEAD `/collections/atletico-mg` → 404
- HTTP HEAD `/collections/cruzeiro` → 404
- HTTP HEAD `/collections/cabuloso` → **200**
- Listei 140 coleções via paginação completa, filtrei por regex `/atletic|mineiro|galo/i`:
  - `galao` — title "Atlético MG" (66 prods, template_suffix `galao`)
  - `atletico-mineiro` — title "Atlético Mineiro" (66 prods)
  - `atletico-de-madrid` (não relevante — La Liga)
  - `lancamentos-atletico-mineiro` (6 prods)

### Step 1c — REST fallback
GraphQL não achou `atletico-mineiro` mas storefront 200 → fallback pra REST `smart_collections.json?handle=`:
- `atletico-mineiro` → smart, id 342953132227, **publicada** (`published_at: 2026-02-07`), rule simples `title contains "Atlético Mineiro"`, sort `best-selling`, 66 prods
- `galao` → smart, id 331115724995, publicada, rules **disjunctive=true** (`title contains "Atlético MG"` OR `title contains "Mineiro"`), template_suffix `galao` (template customizado com promo "Pague 2 Leve 3" no body_html)
- `cabuloso` → smart, id 330245537987, publicada, rule simples `title contains "Cruzeiro"`, template_suffix `cruzeiro`, 119 prods

**Lição:** quando GraphQL `collectionByHandle` retorna null mas HTTP público devolve 200, NÃO concluir "não existe" — fallback pra REST `/admin/api/<v>/smart_collections.json?handle=`. Pode ser scope/publishing diff da app.

## Decisões

| URL órfã | Cenário | Ação |
|---|---|---|
| `/collections/atletico-mg` | Pedro travou — handle renomeado | 301 → `/collections/atletico-mineiro` |
| `/collections/cruzeiro` | **B** — handle diferente do óbvio (`cabuloso` cobre) | 301 → `/collections/cabuloso` |

Cenário A (criar smart collection nova `cruzeiro`) descartado porque criaria duplicata redundante de `cabuloso` que já existe há quase 2 anos com 119 produtos e template customizado.

## Ações aplicadas (step 2)

```graphql
mutation urlRedirectCreate($urlRedirect: UrlRedirectInput!) {
  urlRedirectCreate(urlRedirect: $urlRedirect) {
    urlRedirect { id path target }
    userErrors { field message }
  }
}
```

| # | Path | Target | ID criado | userErrors |
|---|---|---|---|---|
| 1 | `/collections/atletico-mg` | `/collections/atletico-mineiro` | `gid://shopify/UrlRedirect/438855991491` | 0 |
| 2 | `/collections/cruzeiro` | `/collections/cabuloso` | `gid://shopify/UrlRedirect/438856024259` | 0 |

Writes serializados (`delay(800)` entre mutations) — memory `feedback_rate_limit_serialize_same_shop`.

## Smoke test (step 3)

| URL | Status esperado | Resultado |
|---|---|---|
| `https://mantosdoph.com.br/collections/atletico-mg` | 301 → `/atletico-mineiro` | **301** → `/collections/atletico-mineiro` OK |
| `https://mantosdoph.com.br/collections/cruzeiro` | 301 → `/cabuloso` | **301** → `/collections/cabuloso` OK |
| `https://mantosdoph.com.br/collections/atletico-mineiro` | 200 (target ileso) | **200** OK |
| `https://mantosdoph.com.br/collections/cabuloso` | 200 (target ileso) | **200** OK |

4/4 passes. Cache CDN do Shopify pegou os redirects imediatamente (sem precisar de purge).

## Flags pro Boss (não-acionados nesta sessão)

### 1. Atlético MG tem 2 coleções vivas — provável duplicata

- `galao` (title "Atlético MG", 66 prods, template promocional `galao`, body_html "PAGUE 2 LEVE 3 / PAGUE 3 LEVE 5", rules disjunctive `Atlético MG OR Mineiro`)
- `atletico-mineiro` (title "Atlético Mineiro", 66 prods, sort best-selling, rule simples `Atlético Mineiro`)

Memory `feedback_collection_dedupe_prefer_lever` diz: deletar a com menos `vendor=Lever Ecomm`, manter a com mais Lever, renomear pro handle canônico. **Não rodei aqui** porque escopo era só os 2 sitelinks órfãos e Pedro travou Atlético MG. Vale revisar com Pedro depois: `galao` parece ter mais valor (template promo + body_html elaborado) mas o sitelink do Google e a memória de busca apontam pra "atletico-mineiro". Decisão depende do que o cliente quer vitrinizar.

### 2. Tags Shopify bagunçadas (confirma memory `feedback_filtro_titulo_nao_tag`)

50+ produtos com tag `cruzeiro` mas título de outros times (Palmeiras, Flamengo, São Paulo, Atlético Mineiro). Por isso `cabuloso` usa **rule por título** em vez de tag — única fonte confiável. Limpar as tags seria escopo `bulk-product-meta` (não rodei — fora do pedido).

### 3. `template_suffix` customizado em smart collections

- `galao` → `templates/collection.galao.json` (provável)
- `cabuloso` → `templates/collection.cruzeiro.json` (suffix é `cruzeiro`)

Se alguém tentar deletar/renomear essas collections sem checar os templates, layout dedicado do time quebra. Memory candidata: "antes de deletar smart_collection com template_suffix, confirmar templates/collection.<suffix>.json não tem outros consumidores".

## Cenários canônicos pra fix de sitelink órfão (registrar pra próxima)

| Cenário | Detecção | Ação |
|---|---|---|
| A — coleção realmente não existe + tem volume (5+ prods active) | tag/title match retorna >= 5, nenhuma collection cobre | criar smart collection `published:true` com rule simples por título |
| B — handle diferente do óbvio | collection existe com title igual mas handle inesperado | URL Redirect 301 pro handle real |
| C — sem volume relevante | tag/title match < 5, sem collection equivalente | URL Redirect 301 pra `/collections/all` (catch-all) |
| D — handle apenas renomeado | collection existe com handle quase igual (typo/abreviação) | URL Redirect 301 pro novo (Pedro pode travar a decisão se souber) |

**Esta sessão:** caso D (Atlético MG) + caso B (Cruzeiro).

## Reversão

Se algum redirect der ruim:
```js
import { shopifyGraphQL, getCreds } from './.claude/lib/shopify-api.mjs';
const { shop, token } = await getCreds('053f7258-95f4-4ca9-81ad-4032b18829ba');
const M = `mutation($id: ID!) { urlRedirectDelete(id: $id) { deletedUrlRedirectId userErrors { field message } } }`;
await shopifyGraphQL(shop, token, M, { id: 'gid://shopify/UrlRedirect/438855991491' }); // atletico-mg
await shopifyGraphQL(shop, token, M, { id: 'gid://shopify/UrlRedirect/438856024259' }); // cruzeiro
```

## Artefatos

- `.claude/tmp/mantos-sitelinks-fix/step1-snapshot.json` — GraphQL snapshot (coleções alvo, produtos cruzeiro, redirects pré-existentes)
- `.claude/tmp/mantos-sitelinks-fix/step1b-atletico-deep.json` — HTTP probes + listagem 140 coleções + matches Atlético
- `.claude/tmp/mantos-sitelinks-fix/step1c-verify-handles.json` — REST fallback confirmando atletico-mineiro/galao/cabuloso
- `.claude/tmp/mantos-sitelinks-fix/step2-apply-redirects.json` — 2 URL Redirects criados, 0 userErrors
- `.claude/tmp/mantos-sitelinks-fix/step3-smoke-test.json` — 4 probes HTTP pós-fix
- Scripts: `step1-snapshot.mjs` · `step1b-atletico-deep.mjs` · `step1c-verify-handles.mjs` · `step2-apply-redirects.mjs` · `step3-smoke-test.mjs`

## Lições / candidato a propagar?

- **Sim — pattern "fix sitelink órfão"** vale virar skill `fix-orphan-sitelinks` ou subseção do `audit-smart-collections`. Fluxo canônico:
  1. HTTP HEAD na URL órfã + na variantes plausíveis do handle
  2. GraphQL `collectionByHandle` + fallback REST `smart_collections.json?handle=` se null
  3. Contagem de produtos por tag E título (não confiar em só uma)
  4. Decidir cenário A/B/C/D pela tabela acima
  5. Aplicar e smoke-test HTTP
- **GraphQL collectionByHandle pode mentir** (retornar null pra handle publicado e funcionando) — sempre cross-check com REST quando HTTP público diverge da response.
- **Não inflar catálogo** — antes de criar coleção, sempre buscar por título via REST/GraphQL pra ver se já não existe sob outro handle.
