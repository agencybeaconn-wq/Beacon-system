# Deploy `mcp-shopify-proxy`

Edge function pra MCP Lever System destravar `lever_shopify_revenue` em JWT mode (colaboradores sem service role).

## Deploy

```bash
cd lever
supabase functions deploy mcp-shopify-proxy
```

(default verify_jwt=true — requer Authorization Bearer com JWT válido)

## Verificar

```bash
supabase functions list | grep mcp-shopify-proxy
```

## Testar localmente antes de deploy

```bash
supabase functions serve mcp-shopify-proxy --env-file .env.local
```

Em outro terminal:

```bash
# Get JWT do user (rodar antes: node scripts/lever-mcp/login.mjs)
JWT=$(cat ~/.lever-mcp/credentials.json | jq -r .access_token)

curl -X POST http://localhost:54321/functions/v1/mcp-shopify-proxy \
  -H "Authorization: Bearer $JWT" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"revenue","client_id":"5ec9b68a-328d-4266-b293-4256f51aaaad","period":"7d"}'
```

Esperado: `{"success":true,"data":{...}}`

## Pendências futuras (v0.2 da edge fn)

- Cache de 5min em resultados de revenue (evita N chamadas Shopify quando squad usa simultâneo)
- Audit log em tabela `mcp_calls` (quem chamou, quando, qual cliente, qual action)
- Rate limiting per user
- Mais actions: `top_products`, `customer_segments`, `funnel_conversion`
