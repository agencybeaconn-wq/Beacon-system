---
name: shopify
description: Gerencia qualquer aspecto da Shopify de um cliente via prompt — auditar preços, corrigir produtos, criar/editar coleções, páginas, menus e consultar pedidos.
argument-hint: "[cliente] [o que fazer]"
---

# Gerenciador Shopify (fallback)

Operações que NÃO têm skill dedicada. Se a tarefa bate com `/update-prices`, `/bulk-fix-prices`, `/sort-collections`, `/configure-theme`, `/create-discount`, `/fix-compare-at`, `/clean-titles`, `/bulk-descriptions`, `/audit-store`, `/quality-gate`, `/fix-theme-license`, `/fix-options` — **invocar a skill, NÃO usar este fallback.**

## Edge Function Proxy

Use Node.js `https` (NÃO `curl` — quebra UTF-8 no Windows). anon key como Authorization E apikey:

```js
const https = require('https');
const TOKEN = '<VITE_SUPABASE_ANON_KEY do .env>';

function proxy(body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'pxhmzpwvxvlwngjbjkrg.supabase.co',
      path: '/functions/v1/shopify-admin-proxy', method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8',
                 'Authorization': `Bearer ${TOKEN}`, 'apikey': TOKEN }
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.write(payload); req.end();
  });
}
```

## Identificar cliente
```sql
SELECT id, name, shopify_domain FROM agency_clients
WHERE name ILIKE '%NOME%' AND shopify_status = 'connected';
```
Pra credenciais diretas (Shopify API sem proxy): `getCreds(clientId)` da `shopify-api.mjs`.

## Operações via proxy()

Padrão: `{clientId, resource, method, resourceId, payload, params}`. Methods comuns: `list`, `list_all`, `list_prices`, `get`, `create`, `update`, `delete`, `graphql`.

### Produtos
```js
await proxy({clientId, resource: "products", method: "list_prices"})  // [{handle, title, variants:[{option1,option2,price,sku}]}]
await proxy({clientId, resource: "products", method: "list_all"})
await proxy({clientId, resource: "products", method: "update", resourceId: 123,
  payload: { product: { title, body_html } }})
// Bulk preços: edge function shopify-bulk-update — body: {clientId, changes:[{handle, productFields, variants:[...]}]}
```

### Coleções
```js
const custom = await proxy({clientId, resource: "custom_collections", method: "list_all"});
const smart  = await proxy({clientId, resource: "smart_collections",  method: "list_all"});
// Criar custom: payload { custom_collection: { title, body_html, published: true, published_scope: "global" } }
// Smart com regras: payload { smart_collection: { title:"Flamengo", rules:[{column:"title",relation:"contains",condition:"Flamengo"}], disjunctive:false, published:true, published_scope:"global" } }
```

**⚠️ Regras resilientes a typos** — substrings em vez de palavras completas:
- ❌ `contains "feminina"` (falha em "Feminino" typo)
- ✅ `contains "femin"` (pega feminina, Feminino, FEMININA)

EN: `woman/man` (sem fuzzy do Shopify).

**Deploy em batches:** edge function `store-deployment` step `collections`, máx 20/vez.

### Páginas (GraphQL)
```js
await proxy({clientId, resource: "graphql", method: "graphql",
  payload: { query: `mutation pageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) { page { id title } userErrors { message } } }`,
    variables: { page: { title, body, handle, isPublished: true } }
  }})
// Read: { pages(first: 50) { edges { node { id title handle body isPublished } } } }
// Update: pageUpdate(id, page: { body })
```

### Menus (GraphQL)
**Cada item PRECISA `type`:** `FRONTPAGE | HTTP | COLLECTION | PAGE | SHOP_POLICY | SEARCH`.
```js
// menuCreate(title, handle, items:[{ title, type, url, items:[...nested] }])
// menuUpdate / menuDelete(id)
// ⚠️ menus(query: "handle:foo") NÃO filtra (memory feedback_menu_query_filter_bug). Use menu(id:) ou JS filter.
// Menus default (main-menu, footer) NÃO deletam — só menuUpdate.
```

### Pedidos
```js
await proxy({clientId, resource: "orders", method: "list",
  params: { status: "any", limit: "250",
    fields: "id,name,total_price,financial_status,payment_gateway_names,created_at,customer",
    created_at_min: "2026-03-18T00:00:00-03:00",   // SEMPRE timezone -03:00
    created_at_max: "2026-03-18T23:59:59-03:00" }})
// financial_status: paid|pending|refunded|voided
// payment_gateway_names: ["appmax_cc"] (cartão), ["appmax_pix"] (pix)
```

### Temas
```js
// list / list_assets resourceId:THEME_ID / get_asset params:{"asset[key]":"config/settings_data.json"} / put_asset payload:{asset:{key,value}}
```

**Editar tema via API:** GraphQL `themeFilesUpsert` (NÃO REST `put_asset` que falha):
```js
mutation($files: [OnlineStoreThemeFilesUpsertFileInput!]!, $themeId: ID!) {
  themeFilesUpsert(files: $files, themeId: $themeId) {
    upsertedThemeFiles { filename } userErrors { message } } }
// variables: { themeId: "gid://shopify/OnlineStoreTheme/ID", files: [{ filename, body: { type: "TEXT", value } }] }
```

## Logos de Coleções (collection-list-tabs.liquid)

Tema mostra logos via `case block.settings.collection.handle`. Time sem logo = handle não mapeado.

```js
const newEntry = `              when 'novo-handle'\n                assign custom_team_image = 'URL_DO_LOGO'\n`;
// Inserir antes de 'endcase'
// CDN logos: https://pub-741e79c7a4b84c228594bbc296d1fbdd.r2.dev/Site Lever/Logos Clubes/...
// Aliases PT/EN: when 'bayern-de-munique' or 'bayern-munich'
```

**Causa comum:** coleções EN com handles em inglês mas tema feito com handles PT. Sempre alias `or` quando handle ≠ original.

## Licença de Tema (lever_license_key)

**Ver skill `/fix-theme-license`** pra diagnóstico/auto-fix.

Manual rápido:
1. Buscar credenciais → identificar tema (procurar "Lever" no nome ou role=main)
2. Gerar `licenseKey = 'LEVER-XXXX-XXXX'` (chars `A-Z0-9`)
3. Ler `config/settings_data.json` → `settings.current.lever_license_key = licenseKey` → PUT
4. Edge function `store-deployment` step `theme` cria no banco externo `ykctllrqygchllhxnkjh.supabase.co` tabela `licenses` (mas pode não aplicar no tema — sempre fazer passo 3 manual)

## Ordenar produtos
**Ver skill `/sort-collections`** (default canônico ou `--home-plan` interpretativo).

Manual: setar `sort_order: "manual"` na coleção, depois GraphQL `collectionReorderProducts(id, moves:[{id, newPosition}])`. Ordem canônica: **Ano** (2026/27>2026>2025/26>2025>retrô) → **Tipo** (jogador>feminina>infantil>manga longa>regata>treino>goleiro>short>retrô; default torcedor) → **Número** (I>II>III).

## Configuração do Tema
**Ver skill `/configure-theme`** (announcement bar, milestones, frete, contato, social).

Arquivos chave:
- `sections/header-group.json` — `header.support_phone`, `support_email`; announcement-bar blocks
- `sections/footer-group.json` — `footer.subtext` (horário/email/whatsapp)
- `config/settings_data.json` (BR) ou `templates/cart.json` (EN) — `milestone_1_quantity/badge/icon`, `milestone_2_*`, `message_0` a `message_6_plus`, `option_1_title`/`option_2_title` (frete BR)

Mapeamento briefing → tema:
| Briefing | Tema |
|---|---|
| email | header.support_email + footer.subtext |
| telefone | header.support_phone + footer.subtext |
| ofertas (Pague 2 Leve 3) | milestones + mensagens carrinho |
| frete_gratis_valor | announcement bar + opções frete |
| instagram/facebook/tiktok | settings globais social |

## Lojas conhecidas
| Nome | ID | Domínio |
|---|---|---|
| Template BR | 5e836736-7411-42d8-b99e-bcad1e55919d | testeloja-9899.myshopify.com |
| Template EN | 17089519-4779-41bb-96ca-9791e0677cf8 | loja-de-estruturacao-e-desenvolvimento-en.myshopify.com |
| Loja Antiga | cf225851-640d-409e-870f-139c42c2d3d8 | v5v0x0-0p.myshopify.com |
| Julico Sports | 6eb29c0e-7fcb-4404-9acc-393956d5a9f0 | julico-sports.myshopify.com |
| Mantos do PH | 053f7258-95f4-4ca9-81ad-4032b18829ba | a9dc24-2.myshopify.com |
| Loja da Torcida | 3a9a7bf6-e392-427c-ae73-0d2823dbe53f | xdppna-zt.myshopify.com |
| Brasileiríssimo | bc244b92-2737-456c-8a2c-71fa83e77256 | jdheep-z7.myshopify.com |
| Foot Kids | 83de1f3b-6a92-4d9a-982e-0cddd4a01899 | 5edf96.myshopify.com |
| Jersey Fanatics | c7340a84-47bf-4081-a61a-8a983c5d0e60 | bvpjeb-es.myshopify.com |
| Boutique do Boleiro 2.0 | 87fc308b-1676-4130-b356-227940f1427f | qpur7u-jp.myshopify.com |

## Categorização canônica (priority order)
1. retrô/retro → `camisa_retro`
2. jogador/authentic/player → `camisa_jogador`
3. infantil/kids (não "KidSuper") → `conjunto_infantil`
4. agasalho → `agasalho_viagem`
5. conjunto de treino → `conjunto_treino`
6. jaqueta/corta vento → `jaqueta`
7. moletom → `moletom`
8. short → `short`
9. **fallback** (camisa, camiseta, regata, treino) → `camisa_torcedor`

## Erros comuns
- **401 Invalid JWT** — edge functions usam `--no-verify-jwt`. Use anon key como Bearer.
- **UTF-8 quebrado** — Node.js + `https`, NÃO `curl`.
- **Menu sem `type`** — cada item de menuCreate PRECISA `type` (HTTP/FRONTPAGE/SHOP_POLICY/etc).
- **Coleções duplicadas** — sempre `list_all` antes de criar.
- **Timeout em bulk** — coleções batches 20, produtos batches 50.
- **Datas** — sempre `-03:00` Brasil em filtros de pedidos.
- **🔴 Coleções não publicadas** — REST cria como NÃO publicadas (`published_at: null`); storefront mostra placeholder. **SEMPRE** `published: true, published_scope: "global"`. Update igual. Memory `feedback_shopify_publish_collections`.
- **Tema Liquid vs handles** — `collection-list-tabs.liquid` mapeia handles a logos via `case`. Handle novo? Adicionar `when 'handle' or 'alias'`.
- **Menus default não deletam** — main-menu/footer só `menuUpdate`.
- **`themeFilesUpsert` é o caminho** pra editar tema via API (REST `put_asset` falha).

## Operações pontuais (1 exemplo cada)

### SEO meta title/description
```js
payload: { product: {
  metafields_global_title_tag: "Camisa Flamengo 2026/27 I | Loja Oficial",
  metafields_global_description_tag: "Compre a camisa oficial..."
}}
```
Padrão: `"{titulo} | {nome da loja}"` / `"Compre {titulo} com frete grátis. Entrega para todo o Brasil."`

### Compare At Price
**Ver skill `/fix-compare-at`** pra massa. Manual:
```js
payload: { product: { variants: [{ id: VID, compare_at_price: "299.90", price: "229.90" }] } }
```

### Adicionar variante
```js
// PRECISA TODAS as opções do produto
await shopifyReq(shop, token, 'POST', `/admin/api/2026-01/products/${PID}/variants.json`, {
  variant: { option1: "4GG", option2: "Não", price: "249.90", inventory_policy: "continue" }
});
// Herdar preço da anterior (3GG): ler product.variants, achar 3GG, usar mesmo price
```

### Adicionar nova opção
ATENÇÃO: requer recriar variantes. Buscar produto, duplicar cada variante com novos valores da opção, update REST com `options:[{name},{name:"Personalizar"}]` + `variants:[...todasNovas]`. Variante nova: id `undefined`.

### Trocar nome de opção (Size→Tamanho)
GraphQL `productOptionUpdate(productId, option:{id, name})`.

### Editar templates do tema
JSON: `templates/index.json` (Home), `templates/collection.json`, `templates/product.json`, `config/settings_data.json` (globais).
- Trocar coleção home → `templates/index.json` → seção com `settings.collection`
- Reorganizar seções → `order` array
- Trocar textos (announcement, footer) → `settings_data.json`
- Cores → esquemas em `settings_data.json`

### Alterar descrições em massa
**Ver skill `/bulk-descriptions`.** Manual: paginar produtos, `PUT /products/${id}.json` com `body_html`, delay 350ms.

### Inventory Policy (vender sem estoque)
```js
payload: { variant: { id: VID, inventory_policy: 'continue' } }
```
Define em todas pra vender sem checar estoque.

### Imagens
```js
GET    /products/${PID}/images.json
POST   /products/${PID}/images.json     { image: { src, alt, position } }
PUT    /products/${PID}/images/${IID}.json   { image: { id, alt, position } }
DELETE /products/${PID}/images/${IID}.json
```
Em massa: alt = `"{titulo} - Imagem {posição}"`.

### Estoque de variantes
```js
// 1. inventory_item_id (de variant)
// 2. location_id (locations.json — primeira)
// 3. POST /inventory_levels/set.json { location_id, inventory_item_id, available: 1000 }
```
Alternativa: `inventory_policy: 'continue'` (vende sem estoque, sem precisar definir qty).

## Fluxo padrão
1. Identificar cliente
2. Identificar intenção (auditar/corrigir/criar/listar)
3. Buscar dados (método compacto — `list_prices` melhor que `list_all`)
4. Analisar + montar mudanças
5. Preview com diff
6. Confirmar
7. Executar + reportar

## Otimização de tokens
- Scripts grandes em `.mjs`, rodar `node arquivo.mjs` em background
- Credenciais diretas (`getCreds()`) sem proxy edge function — mais rápido, sem timeout
- Paginar com Link header local
- NÃO trazer dados pro contexto — salvar em temp + processar Node.js

## Sistema
- `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Edge Functions: `shopify-admin-proxy` (CRUD), `shopify-bulk-update` (preços massa), `shopify-fetch-products` (CSV-like), `store-deployment` (deploy steps)
- Tabelas: `agency_clients`, `client_pricing`, `briefings`
- Licenças: Supabase externo `ykctllrqygchllhxnkjh.supabase.co` tabela `licenses`

Processe $ARGUMENTS conforme acima.
