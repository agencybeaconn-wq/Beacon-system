# Shopify Webhooks — Topics úteis e exemplos

Cheatsheet pros webhooks que o Lever System usa ou pode usar. API **`2026-04`**.

Webhooks substituem polling → Lever fica reativo a mudanças no Shopify em tempo real.

## Infraestrutura

- **Edge function receiver**: `supabase/functions/shopify-webhook-receiver/index.ts`
  - URL: `https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/shopify-webhook-receiver`
  - Valida HMAC com `agency_clients.shopify_client_secret` (por cliente)
  - Persiste em `webhook_events` pra auditoria/retry
  - Dedup via `x-shopify-webhook-id`

- **Tabelas**: `webhook_subscriptions`, `webhook_events`
  - Migration: `supabase/migrations/20260411_webhook_subscriptions.sql`

- **Gerenciamento**: `.claude/skills/shopify/shopify-watch.mjs`
  - `watch <cliente>` — subscreve aos topics default
  - `unwatch <cliente>` — remove todas subscriptions
  - `list <cliente>` — lista subscriptions ativas no Shopify

## Topics essenciais (default do shopify-watch)

| Topic GraphQL | REST path | Quando dispara | Uso no Lever |
|---|---|---|---|
| `PRODUCTS_CREATE` | `products/create` | Produto novo criado | Re-rodar quality-gate/categorização |
| `PRODUCTS_UPDATE` | `products/update` | Produto editado (title, price, variants) | Re-rodar quality-gate, re-sincronizar client_pricing |
| `PRODUCTS_DELETE` | `products/delete` | Produto removido | Atualizar índice local |
| `COLLECTIONS_UPDATE` | `collections/update` | Collection mudou (rules, produtos, título) | Re-validar required collections |
| `ORDERS_PAID` | `orders/paid` | Pedido pago confirmado | Analytics, alertas, marcar para conciliação |
| `INVENTORY_LEVELS_UPDATE` | `inventory_levels/update` | Estoque mudou | Tracking de venda, alertas de ruptura |

## Topics úteis por caso de uso

### Catálogo
- `PRODUCTS_CREATE`, `PRODUCTS_UPDATE`, `PRODUCTS_DELETE`
- `COLLECTIONS_CREATE`, `COLLECTIONS_UPDATE`, `COLLECTIONS_DELETE`
- `VARIANTS_IN_STOCK`, `VARIANTS_OUT_OF_STOCK`

### Vendas
- `ORDERS_CREATE` — pedido novo (pode não estar pago ainda)
- `ORDERS_PAID` — pago confirmado
- `ORDERS_CANCELLED`, `ORDERS_FULFILLED`, `ORDERS_DELIVERED`
- `REFUNDS_CREATE` — reembolso

### Clientes (GDPR)
- `CUSTOMERS_DATA_REQUEST` — obrigatório (handled em `shopify-webhooks/`)
- `CUSTOMERS_REDACT` — obrigatório
- `SHOP_REDACT` — obrigatório (cliente desinstalou)

### Tema
- `THEMES_CREATE`, `THEMES_UPDATE`, `THEMES_DELETE`, `THEMES_PUBLISH`

### App lifecycle
- `APP_UNINSTALLED` — cliente desconectou (limpar token)

## Exemplo: subscrever manualmente via GraphQL

```js
import { webhookSubscriptionCreate } from '.claude/lib/shopify-api.mjs';

await webhookSubscriptionCreate(shop, token,
  'PRODUCTS_UPDATE',
  'https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/shopify-webhook-receiver'
);
```

## Exemplo: payload recebido

Headers enviados pelo Shopify:
```
X-Shopify-Topic: products/update
X-Shopify-Shop-Domain: 55138c-1b.myshopify.com
X-Shopify-Webhook-Id: abc-123
X-Shopify-Hmac-SHA256: <base64 HMAC>
X-Shopify-Api-Version: 2026-04
Content-Type: application/json
```

Body (produtos/update):
```json
{
  "id": 8762025935038,
  "title": "Camisa Flamengo Retrô 2009",
  "handle": "camisa-flamengo-retro-2009",
  "updated_at": "2026-04-11T12:00:00-03:00",
  "variants": [{ "id": 46580429684926, "price": "239.00", ... }]
}
```

## Validação HMAC (implementada no receiver)

```ts
async function verifyShopifyHmac(body: string, hmacHeader: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return computed === hmacHeader;
}
```

**Nunca processe um webhook sem validar HMAC** — qualquer um poderia injetar eventos.

## Rate limits

- Shopify garante delivery at-least-once
- Retries automáticos por 48h se o receiver retornar ≠ 200
- Receiver deve responder em ≤ 5s (timeout do Shopify)
- Idempotência via `x-shopify-webhook-id` — dedup no receiver

## Ver também

- [`.claude/reference/shopify-mutations.md`](./shopify-mutations.md) — `webhookSubscriptionCreate` wrapper
- [`.claude/skills/shopify/shopify-watch.mjs`](../skills/shopify/shopify-watch.mjs) — CLI
- [`shopify-docs/pages/api/webhooks/`](../../shopify-docs/pages/api/webhooks/) — doc completa
