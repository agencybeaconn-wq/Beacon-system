# Shopify MCP Servers — AI Toolkit (Fase 6)

Shopify lançou em 2026 o **AI Toolkit**: um conjunto de MCP servers padronizados que permitem qualquer LLM operar como agente de comércio, executando queries, carrinho e checkout via protocolo JSON-RPC 2.0.

O Lever System integra via `.claude/lib/shopify-mcp.mjs` e expõe através da skill `/lever-agent`.

## Visão geral

| Server | Escopo | Endpoint | Auth | Lib helper |
|---|---|---|---|---|
| **Storefront MCP** | 1 loja | `https://{shop}/api/mcp` | nenhum | `storefrontMCP()` / `storefrontSearch()` |
| **Catalog MCP** | global (todas as lojas) | `https://discover.shopifyapps.com/global/mcp` | JWT (client_credentials) | `catalogMCP()` / `getCatalogJWT()` |
| **Checkout MCP (UCP)** | 1 loja | `https://{shop}/api/ucp/mcp` | JWT | `checkoutMCP()` |

Todos seguem JSON-RPC 2.0 com body:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": { "name": "<tool>", "arguments": { /* ... */ } }
}
```

## Storefront MCP (já integrado)

**Endpoint**: `POST https://{shop}/api/mcp`
**Auth**: nenhum (público)

### Tools disponíveis (obtidas via `tools/list` em 2026-04)

- `search_catalog` — busca produtos da loja (UCP shape com `catalog.query`, `catalog.context`, `catalog.filters`)
- `search_shop_policies_and_faqs` — responde dúvidas de política (legacy nome nos docs: `search_shop_catalog`)
- `get_cart`, `update_cart` — manipular carrinho (não-discovery, ver doc completa)

### Wrapper `storefrontSearch(shop, query, opts)`

```js
import { storefrontSearch } from '.claude/lib/shopify-mcp.mjs';

const r = await storefrontSearch('55138c-1b.myshopify.com', 'camisa flamengo', {
  language: 'pt-BR',
  currency: 'BRL',
  country: 'BR',
  intent: 'customer wants size M',
});
// r = { products: [...], pagination: { cursor } }
```

### CLI direto

```bash
# Busca produtos
node .claude/skills/lever-agent/lever-agent.mjs search "De Boleiro" "camisa flamengo"

# Lista tools disponíveis
node .claude/skills/lever-agent/lever-agent.mjs tools "De Boleiro"

# Consulta política
node .claude/skills/lever-agent/lever-agent.mjs policy "De Boleiro" "qual o prazo de entrega?"
```

### Response shape (do search)

```json
{
  "ucp": { "version": "2026-01-23", ... },
  "products": [
    {
      "id": "gid://shopify/Product/8762025935038",
      "title": "Camisa Flamengo Retrô 2009",
      "url": "https://...",
      "price_range": { "min": { "amount": 23900, "currency": "BRL" } },
      "variants": [ /* variants com options, media, availability */ ]
    }
  ]
}
```

**Nota**: `amount` vem em **centavos** (23900 = R$ 239,00).

## Catalog MCP (ainda não integrado)

**Endpoint**: `POST https://discover.shopifyapps.com/global/mcp`
**Auth**: JWT obtido via client_credentials

### Obter JWT

1. Obter `client_id` + `client_secret` no Dev Dashboard de Shopify Partners
2. Chamar:

```js
import { getCatalogJWT, catalogMCP } from '.claude/lib/shopify-mcp.mjs';

const { access_token } = await getCatalogJWT(CLIENT_ID, CLIENT_SECRET);
// TTL: 60 minutos
```

### Tools

- `search_global_products` — busca em todas as lojas Shopify (buyer-facing)
- `get_global_product_details` — detalhes de um produto específico via UPID

### Uso

```js
const r = await catalogMCP(access_token, 'search_global_products', {
  query: 'blue jeans',
  context: 'buyer in Brazil',
  limit: 10,
  ships_to: 'BR',
});
```

## Checkout MCP / UCP (ainda não integrado)

**Endpoint**: `POST https://{shop}/api/ucp/mcp`
**Auth**: JWT

### Tools

- `create_checkout` — cria checkout session com line items
- `update_checkout` — muda shipping, customer, discounts
- `complete_checkout` — finaliza a compra

### Fluxo típico

```
1. Discovery (Storefront MCP)
   ↓ produtos + variant IDs
2. Create checkout (Checkout MCP)
   ↓ checkout_session_id
3. Update checkout (shipping address, email)
   ↓
4. Complete checkout (payment token)
   ↓ order confirmation
```

## Protocolo JSON-RPC 2.0 — padrão

```json
POST /api/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": {
    "name": "search_catalog",
    "arguments": { "catalog": { "query": "camisa flamengo" } }
  }
}
```

Resposta de sucesso:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "{\"products\":[...]}" }
    ]
  }
}
```

**Nota**: o result vem normalmente como `content[0].text` (string JSON). Use `parseMCPTextContent(result)` pra extrair.

## Roadmap MCP no Lever

| Fase | Status | Descrição |
|---|---|---|
| Storefront MCP search | ✅ ativo | `storefrontSearch()` + skill `/lever-agent search` |
| Storefront MCP policies | ✅ lib pronta | skill `/lever-agent policy` (depende da tool estar ativa no shop) |
| Storefront MCP cart | 🟡 lib tem helper genérico | usar `storefrontMCP(shop, 'get_cart'/'update_cart', args)` |
| Catalog MCP | ⏳ código pronto | precisa configurar credentials no env |
| Checkout MCP | ⏳ código pronto | precisa config + fluxo completo |
| dev-mcp (doc server) | 💭 futuro | servidor local pra consultar doc via MCP (alternativa ao `/shopify-docs`) |

## Ver também

- [`.claude/lib/shopify-mcp.mjs`](../../.claude/lib/shopify-mcp.mjs) — cliente
- [`.claude/skills/lever-agent/SKILL.md`](../skills/lever-agent/SKILL.md) — skill wrapper
- [`shopify-docs/pages/agents/`](../../shopify-docs/pages/agents/) — doc completa MCP
- UCP protocol: https://ucp.dev/documentation/
