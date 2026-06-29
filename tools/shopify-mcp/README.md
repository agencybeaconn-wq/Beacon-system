# @lever/shopify-mcp

Multi-shop Shopify Admin MCP server. One process, N stores, parallel queries, per-user auth — agency-grade.

Built because the official Shopify Admin MCP is single-shop by design (`switch-shop` revokes the active token). This server proxies the Admin GraphQL API for every configured shop in parallel, with per-shop access tokens and per-user API keys.

## Two transports

| Mode | When | Auth |
|---|---|---|
| **stdio** | Local dev on João's machine | None (user=`local`) |
| **HTTP** (Vercel) | Lever squad uses from anywhere | Bearer API key per user |

Same dispatcher, same tools — only the transport changes.

## Tools (v0.2)

| Tool | What it does |
|---|---|
| `list_shops` | List configured shops + token-loaded status. |
| `get_shop_info` | Smoke test one shop — name, plan, currency, timezone. |
| `graphql_query` | Read-only GraphQL against one shop. |
| `graphql_mutation` | Write GraphQL against one shop. Requires `confirm: true`. |
| `bulk_query` | Same read-only query fanned out across N shops in parallel. |

GraphQL is the primitive. Wrappers (`list_orders`, `top_products`, ...) land when patterns repeat.

## Position vs official Shopify MCP

| Need | Tool |
|---|---|
| Rich UI ops on one shop (widgets, docs search, schema validation) | Official `claude_ai_Shopify` + `switch-shop` |
| Cross-store reads, bulk reporting, DW ELT, team-wide agency ops | **This server** |

They coexist. Use official for hands-on; use this for breadth.

---

## Setup — Local stdio (João dev)

### 1. Install + build

```bash
cd lever/tools/shopify-mcp
npm install
npm run build
```

### 2. Create `shops.json`

Copy `shops.example.json` to `shops.json` (gitignored — never commit). Edit aliases.

### 3. Get Admin API tokens per shop

In each Shopify admin: **Settings → Apps and sales channels → Develop apps → Create app → Configure Admin API scopes → Install → Reveal Admin API access token**.

Recommended starter scopes (read everything):
`read_orders, read_all_orders, read_products, read_customers, read_inventory, read_discounts, read_price_rules, read_fulfillments, read_analytics, read_reports`

### 4. Set env vars

Edit `~/.claude.json` `mcpServers.lever-shopify.env`:

```json
{
  "mcpServers": {
    "lever-shopify": {
      "command": "node",
      "args": ["c:/Users/João Vithor/Documents/João Workspace/lever/tools/shopify-mcp/dist/index.js"],
      "env": {
        "SHOPIFY_KRON_TOKEN": "shpat_...",
        "SHOPIFY_SUPREMO_TOKEN": "shpat_..."
      }
    }
  }
}
```

Restart Claude Code. Tools appear as `mcp__lever-shopify__*`.

---

## Setup — HTTP on Vercel (squad)

### 1. Deploy

```bash
cd lever/tools/shopify-mcp
vercel deploy --prod
```

Vercel detects `vercel.json` and `api/mcp.ts` and ships a Node 20 function at `https://<project>.vercel.app/api/mcp` (and `/`, `/mcp` via rewrites).

### 2. Set production env vars

In Vercel project settings → Environment Variables, add **all** of:

**Shopify tokens** (one per shop in `shops.json`):
```
SHOPIFY_KRON_TOKEN     shpat_xxx
SHOPIFY_SUPREMO_TOKEN  shpat_xxx
SHOPIFY_FG_TOKEN       shpat_xxx
...
```

**Per-user API keys** (one per Lever collaborator):
```
LEVER_MCP_API_KEY_JOAO     <random-string-1>
LEVER_MCP_API_KEY_PEDRO    <random-string-2>
LEVER_MCP_API_KEY_WESLEY   <random-string-3>
LEVER_MCP_API_KEY_FELIPE   <random-string-4>
```

Generate keys with:
```bash
openssl rand -hex 32
# or: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Mark them as **encrypted** and applied to **Production** environment.

Redeploy after adding env vars (Vercel doesn't hot-reload them).

### 3. Onboard a team member (30 seconds)

Send them:
- Their API key (1Password / secure channel — NEVER Slack/email)
- Their MCP entry:

```json
{
  "mcpServers": {
    "lever-shopify": {
      "type": "http",
      "url": "https://lever-shopify-mcp.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <their-api-key>"
      }
    }
  }
}
```

They paste into `~/.claude.json`, restart Claude Code. Done — they get all 5 tools, all shops, all parallelism.

### 4. Revoke access

Remove (or rotate) the `LEVER_MCP_API_KEY_<USER>` env var in Vercel and redeploy. Their key stops working in ~30s. Tokens in their `~/.claude.json` become inert.

---

## Audit log

Every HTTP call writes to stderr (Vercel function logs):

```
[audit] user=joao method=tools/call tool=bulk_query ok=true ms=1432
[http]  user=joao batch=1 totalMs=1433
```

View live in Vercel dashboard → Function logs. v0.2 → Sprint 2 will pipe these to Supabase `mcp_audit_log` for queryable history.

---

## Examples

### Orders today across every configured shop

```graphql
query OrdersToday {
  orders(first: 250, query: "created_at:>=2026-05-19") {
    edges {
      node {
        id
        totalPriceSet { shopMoney { amount currencyCode } }
      }
    }
  }
}
```

→ `bulk_query` with that query, no `shops` filter → fans out to all shops.

### Last 7 days revenue per shop, polite concurrency

→ `bulk_query` with `concurrency: 3` and `shops: ["kron","mantos","coringao","diario"]`.

### Pause an oversold variant on one shop

→ `graphql_mutation` with `shop: "mantos"`, `confirm: true`, `mutation: productVariantUpdate(...)`.

---

## Design choices

- **GraphQL-first.** Admin GraphQL covers everything. REST wrappers add maintenance for zero capability.
- **Token per shop in env, never in repo.** `shops.json` holds structure (committable when it's just aliases + domains); tokens stay in Vercel env / `~/.claude.json env`.
- **Mutations require `confirm: true`.** Surfaces intent to model and human.
- **`bulk_query` is read-only by design.** Bulk writes need dedicated tool with dry-run + rollback rails — not v0.2.
- **Own dispatcher, no MCP SDK Server class.** Stdio and HTTP share 100% of logic. Easier to reason about, easier to deploy serverless.
- **Stateless HTTP.** No sessions. Every request is independent → trivially scales on Vercel functions.
- **Web-standard Request/Response.** Same `handleHttpRequest` works on Cloudflare Workers, Deno, Bun if we want to switch.

## Roadmap

**Sprint 2 (Supabase integration)**
- Move `shops.json` → Supabase table `shopify_shops` (alias, domain, label, api_version)
- Move Shopify tokens → Supabase Vault, fetched on demand via service role
- Move API keys → Supabase table `mcp_api_keys` (hashed, revocable, scoped per shop)
- Audit log → Supabase table `mcp_audit_log` (queryable, retention policy)

**Sprint 3 (capabilities)**
- `bulk_query` cursor pagination helper (auto-page edges/nodes)
- `analytics_query` ShopifyQL wrapper for Plus shops
- `bulk_operation_run_query` + polling for large exports → S3/Supabase Storage
- Hot-query cache layer (shop info, plan, currency — they don't change daily)

**Sprint 4 (DW + UX)**
- Direct streaming from `bulk_query` results → Supabase `dw.*` schema
- Tool-level scopes per user (Wesley only `bulk_query`, Felipe full access, etc)
- Web admin UI for managing shops + keys + audit log (`/admin` in same Vercel project)
