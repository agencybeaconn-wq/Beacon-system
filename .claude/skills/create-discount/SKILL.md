---
name: create-discount
description: Cria descontos (cupons) na Shopify do cliente. Suporta presets Pague X Leve Y (PAGUE2LEVE3, PAGUE3LEVE5, etc) e configurações customizadas. Usa GraphQL discountCodeBxgyCreate.
argument-hint: [preset ou descrição livre] [nome do cliente/loja]
---

# Criar Descontos na Shopify

Cria cupons via GraphQL Admin API. Suporta presets comuns e configurações customizadas.

## ⚠️ Requisito de escopo

App precisa ter **`write_discounts`** (e `read_discounts`). Se 403/`Access denied`:
1. Verificar `SHOPIFY_SCOPES` no Supabase — precisa conter `write_discounts`
2. Cliente precisa **reconectar a loja** (tokens antigos não herdam escopos novos)
3. Fallback de escopos em [shopify-auth-start/index.ts](supabase/functions/shopify-auth-start/index.ts)

## Presets disponíveis

| Código | Tipo | Compra | Recebe grátis | Uso comum |
|---|---|---|---|---|
| `PAGUE1LEVE2` | BXGY | 1 | 1 | Compre 1 Leve 2 |
| `PAGUE2LEVE3` | BXGY | 2 | 1 | **Compre 2 Leve 3** (mais usado) |
| `PAGUE3LEVE4` | BXGY | 3 | 1 | Compre 3 Leve 4 |
| `PAGUE3LEVE5` | BXGY | 3 | 2 | Compre 3 Leve 5 |
| `PAGUE4LEVE6` | BXGY | 4 | 2 | Compre 4 Leve 6 |
| `PAGUE5LEVE7` | BXGY | 5 | 2 | Compre 5 Leve 7 |

**Configuração padrão de todos os presets:**
- Coleções alvo: `Todas as Camisas` (All Jerseys) + `Conjuntos Infantis` (resolve por título) — **NUNCA "All Products"** (inclui patches/acessórios e quebra a promo)
- Valor: `Grátis` (100% off)
- Uso: sem limite total, sem limite por cliente
- Combinável: NÃO combina com outros descontos
- Início: agora (`startsAt = new Date().toISOString()`)
- Sem data fim
- Elegibilidade: todos os clientes
- Método: Código de desconto (não automático)

## ⚠️ Pitfalls críticos (Goal Nations 2026-04-16)

### 1. Coleção: "All Jerseys" ≠ "All Products"
Patches são extensões da camisa — **nunca** entram na BxGy. Se apontar pra "All Products":
- Patch pode contar como 1 dos "buys" (bagunça o total de camisas)
- Patch pode ser o "get free" (dá patch grátis em vez de camisa)

Sempre usar collection que contém **só camisas** (ex: `todas-as-camisas` / `all-jerseys` / smart com title contains "jersey").

### 2. Variante Customize DEVE custar MAIS que No-customize
Shopify BxGy aplica o desconto na variante MAIS BARATA. Se `S/No` e `S/Customize` têm o mesmo preço, Shopify pode dar grátis a personalizada (que o cliente quis pagar mais por). Pre-check:
- Para cada produto, variante `Customize` deve ter preço ≥ `No` + fee de personalização
- Rodar `update-prices` antes de criar o desconto garante isso

### 3. Patches não contam como "buys"
Se cliente tem 2 patches + 1 camisa no carrinho, NÃO deveria ativar "Buy 2 Get 3" (só 1 camisa). Collection da promoção precisa excluir patches — garantido se usar "All Jerseys" smart collection filtrando por título.

## API (GraphQL 2026-01)

```graphql
mutation createBxgy($bxgyCodeDiscount: DiscountCodeBxgyInput!) {
  discountCodeBxgyCreate(bxgyCodeDiscount: $bxgyCodeDiscount) {
    codeDiscountNode { id codeDiscount { ... on DiscountCodeBxgy { title summary } } }
    userErrors { field message }
  }
}
```

**Input `PAGUE2LEVE3`:**
```json
{
  "title": "PAGUE2LEVE3", "code": "PAGUE2LEVE3",
  "startsAt": "<ISO 8601 now>",
  "customerSelection": { "all": true },
  "customerBuys": {
    "items": { "collections": { "add": ["gid://shopify/Collection/XXX","gid://shopify/Collection/YYY"] } },
    "value": { "quantity": "2" }
  },
  "customerGets": {
    "items": { "collections": { "add": ["gid://shopify/Collection/XXX","gid://shopify/Collection/YYY"] } },
    "value": { "discountOnQuantity": { "quantity": "1", "effect": { "percentage": 1.0 } } }
  },
  "usesPerOrderLimit": "1",
  "appliesOncePerCustomer": false,
  "combinesWith": { "orderDiscounts": false, "productDiscounts": false, "shippingDiscounts": false }
}
```

- `percentage: 1.0` = 100% off (grátis)
- `usesPerOrderLimit: "1"` = aplica 1× por pedido (mais conservador; remova pra ilimitado)
- `PAGUE3LEVE5`: `customerBuys.value.quantity="3"`, `customerGets.value.discountOnQuantity.quantity="2"`

## Processo

### 1. Identificar cliente + verificar escopo
```js
const creds = await supaGet(`/agency_clients?select=shopify_domain,shopify_access_token&id=eq.${clientId}`);
const { shopify_domain: shop, shopify_access_token: token } = creds[0];

const scopeRes = await shReq(shop, token, 'GET', '/admin/oauth/access_scopes.json');
const hasWriteDiscounts = scopeRes.body.access_scopes.some(s => s.handle === 'write_discounts');
if (!hasWriteDiscounts) throw new Error('Loja sem escopo write_discounts. Reconectar via OAuth.');
```

### 2. Resolver IDs das coleções por título
```js
const [sm, cu] = await Promise.all([
  shReq(shop, token, 'GET', '/admin/api/2026-01/smart_collections.json?limit=250'),
  shReq(shop, token, 'GET', '/admin/api/2026-01/custom_collections.json?limit=250'),
]);
const all = [...(sm.body.smart_collections||[]), ...(cu.body.custom_collections||[])];

function findByTitles(titles) {
  return titles.map(t => {
    const col = all.find(c => c.title.toLowerCase() === t.toLowerCase());
    if (!col) throw new Error(`Coleção "${t}" não encontrada`);
    return `gid://shopify/Collection/${col.id}`;
  });
}
const colIds = findByTitles(['Todas as Camisas', 'Conjuntos Infantis']);
```

### 3. Criar via GraphQL
```js
const input = {
  title: 'PAGUE2LEVE3', code: 'PAGUE2LEVE3',
  startsAt: new Date().toISOString(),
  customerSelection: { all: true },
  customerBuys: { items: { collections: { add: colIds } }, value: { quantity: '2' } },
  customerGets: {
    items: { collections: { add: colIds } },
    value: { discountOnQuantity: { quantity: '1', effect: { percentage: 1.0 } } }
  },
  appliesOncePerCustomer: false,
  combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: false },
};
const r = await shopifyGraphQL(shop, token, MUT, { bxgyCodeDiscount: input });
const errs = r.data?.discountCodeBxgyCreate?.userErrors || [];
if (errs.length) throw new Error(JSON.stringify(errs));
```

Salvar como `.tmp_create_discount.mjs`, rodar:
```bash
node .tmp_create_discount.mjs <clientId> PAGUE2LEVE3
```
Conteúdo do script: ver [create-discount.mjs](create-discount.mjs).

## Variações comuns

### Desconto automático (sem código)
Troque a mutation por `discountAutomaticBxgyCreate` e remova o campo `code`:
```graphql
mutation { discountAutomaticBxgyCreate(automaticBxgyDiscount: $input) { ... } }
```

### Desconto com data fim
Adicione `endsAt: "2026-05-10T23:59:59Z"` ao input.

### Limitar por cliente
`appliesOncePerCustomer: true` + `usageLimit: "100"` (total de usos).

### Desconto percentual (não BXGY)
Use `discountCodeBasicCreate` com:
```json
{
  "customerGets": {
    "value": { "percentage": 0.15 }
  }
}
```
Isso seria 15% off em tudo.

## Fixar promoção EXISTENTE que pega patches (Voltz 2026-04-30)

Sintoma: `PAGUE 1 LEVE 2` ativa com 1 camisa + 1 patch — patch contou como camisa. Solução:

1. **Tag patches**: `tagsAdd` em produtos com `title.startsWith('Patch')`/`'Patches'` — tag `excluded-from-promo`. **Filtrar por title, não handle** (`handle:patch*` pega camisas tipo `camisa-flamengo-patchs-libertadores`).
2. **Smart collection** `Camisas Promo`: `rules: [{ column:'tag', relation:'not_equals', condition:'excluded-from-promo' }]` (todos produtos exceto patches).
3. **`discountAutomaticBxgyUpdate`** em cada Bxgy ativo: paginar `customerBuys/Gets.items.collections` (pode ter 50-100+), remove TODAS, add SÓ `Camisas Promo`. Mesmo pattern em `discountCodeBxgyUpdate` pra cupons.

Query pra listar Bxgy ativos:
```graphql
{ automaticDiscountNodes(first:50){nodes{id automaticDiscount{... on DiscountAutomaticBxgy{title status}}}} }
```

## Erros comuns

- **`Access denied`**: escopo `write_discounts` ausente. Reconectar loja.
- **`Collection not found`**: o título da coleção não bate. Verifique exato (case-insensitive no script, mas precisa existir).
- **`Discount code already exists`**: já existe cupom com esse código. Mude ou delete o anterior.
- **`Invalid startsAt`**: use ISO 8601 (`new Date().toISOString()`).
- **`combinesWith is required`**: sempre passe `combinesWith` com os 3 campos booleanos.

## Fluxo padrão quando o usuário pede

1. Identificar o cliente/loja (pergunte se não for óbvio)
2. Identificar o preset ou extrair parâmetros (quantidades + coleções)
3. Verificar escopo `write_discounts` — se faltar, avisar e parar
4. Resolver IDs das coleções
5. Mostrar preview do que vai ser criado (preset + coleções + código)
6. Pedir confirmação
7. Executar a mutation
8. Retornar o ID criado + link pro admin: `https://{shop}/admin/discounts/{numericId}`
