---
name: shopify-mcp-evolve
description: Roadmap e padrões pra evoluir o lever-shopify MCP (lever/tools/shopify-mcp) — adicionar tools de alto leverage, infra de cache/rate-limit/logging, webhook receiver. Filosofia híbrida (genérico + opinionado quando padrão repete 3+ vezes). Consultar antes de adicionar qualquer tool nova ao MCP ou propor mudança de arquitetura.
---

# Skill: shopify-mcp-evolve

Guia mestre pra evoluir o `lever-shopify` MCP de forma coerente. Hoje (2026-05-19) está em **v0.2.0** com 5 tools genéricas e 38 lojas conectadas, todas com token carregado, deploy Vercel HTTP em `lever-shopify-mcp.vercel.app/api/mcp`.

---

## Estado atual (snapshot 2026-05-19)

**Localização:** [lever/tools/shopify-mcp/](../../../tools/shopify-mcp/)

**Tools existentes** (`src/tools/`):
- `list_shops` — descobre aliases configurados
- `get_shop_info` — info básica de 1 loja
- `graphql_query` — read 1 loja
- `graphql_mutation` — write 1 loja (exige `confirm: true`)
- `bulk_query` — fan-out read paralelo cross-shop (concurrency default 5, max 20)

**Arquitetura:**
- Dispatcher JSON-RPC 2.0 transport-agnóstico (`src/dispatch.ts`)
- Entry points: `src/index.ts` (stdio local) + `api/mcp.ts` (HTTP Vercel)
- Cliente Shopify cacheado em memória por `${alias}:${apiVersion}` (`src/client.ts`)
- Config em `shops.json` (gitignored) + tokens em env vars `SHOPIFY_<ALIAS>_TOKEN`
- Schema Zod validado no dispatcher antes de chamar handler
- Erros de tool retornam `{ isError: true, content: [...] }` (não throw HTTP)

**Padrão pra tool nova:**
```ts
// src/tools/<name>.ts
import { z } from "zod";
import type { Tool } from "./types.js";

export const myTool: Tool = {
  name: "my_tool",
  description: "...",
  inputSchema: z.object({ ... }),
  async handler(input) { return { ... }; },
};
```
Depois registrar em `src/tools/index.ts`.

---

## Filosofia de design (decidida 2026-05-19)

**Híbrido com viés genérico.** Não cair na armadilha de transformar o MCP num framework opinionado de 30 tools. Regras:

1. **Default = genérico**. `bulk_query` + `graphql_query` cobrem 80% dos casos. O LLM compõe.
2. **Promover pra tool dedicada SÓ se:**
   - O padrão repetiu 3+ vezes em sessões diferentes, **OU**
   - A composição custa muito token (query GraphQL complexa de >50 linhas), **OU**
   - O LLM erra a query consistentemente sem o helper.
3. **Tools opinionadas têm output schema fixo** — o LLM precisa saber o shape sem inferir.
4. **Tudo que muda (write) exige `confirm: true`** — copiar padrão de `graphql_mutation`.

---

## Roadmap priorizado

### Fase 1 — Tools de alto leverage (próximo passo)

#### 1.1 `daily_snapshot`
KPIs cross-shop num shape fixo. Substitui 90% das análises diárias.

**Input:** `{ shops?: string[], date?: ISO8601, currency?: 'native'|'usd'|'brl' }`
**Output por shop:**
```ts
{
  shop: string,
  currency: string,
  revenue: { today, yesterday, mtd, last7d, last30d },
  orders: { today, yesterday, last7d },
  aov: number,
  topProducts: Array<{ title, sku, units, revenue }>,
  conversion: number | null  // null se não tiver visitor data
}
```
**Implementação:** internamente roda 1 query GraphQL (`orders` + `products` filtrados) por shop em paralelo, agrega. Reusar lógica de `bulk_query`.

**Cuidado:** USD vs BRL — ver `reference_lever_clients_usd_stores`. Brasileirissimo é GB/USD ≠ BR. Default `native` pra não inventar conversão.

#### 1.2 `find_anomalies`
Diff D vs janela base (D-7 ou D-30). Dispara alertas.

**Input:** `{ shops?: string[], metrics: ('revenue'|'orders'|'aov'|'conversion')[], baseline: '7d'|'30d', threshold: number /* % */ }`
**Output:** `Array<{ shop, metric, current, baseline, deltaPct, severity: 'critical'|'warning'|'info' }>`

Severidade: `critical` = -50%+ ou +100%+; `warning` = ±25%; `info` = ±10%.

#### 1.3 `cross_shop_search`
Busca produto/SKU/customer em N lojas em paralelo. Útil pra pattern replication (achar SKU equivalente em outro cliente).

**Input:** `{ resource: 'product'|'sku'|'customer'|'order', query: string, shops?: string[], limit?: number }`
**Output:** `Array<{ shop, matches: Array<{ id, title|name, ... }> }>`

#### 1.4 `bulk_mutation`
Write paralelo cross-shop. Exige `confirm: true` + lista explícita de shops (não permite fan-out a TODAS).

**Input:** `{ mutation: string, variables?: object, shops: string[] /* obrigatório */, confirm: true, concurrency?: number /* max 3 default 2 */ }`

**Guard rails:**
- Rejeita se `shops.length > 10` sem flag `confirmBulkBroadcast: true`
- Loga TODA chamada antes de executar (audit trail)
- Concurrency default baixo (2) pra dar margem de cancelar
- Retorna per-shop result com `dryRun?` preview opcional

### Fase 2 — Infra robusta

#### 2.1 Cache (Vercel KV / Upstash Redis)
- TTL curto (300s) pra reads idempotentes (`get_shop_info`, `daily_snapshot` da mesma data passada)
- Chave: `sha256(toolName + JSON.stringify(input))`
- Bypass via `noCache: true` no input
- Adicionar `_cache: { hit: boolean, age: number }` no output

**Não cachear:** queries com `now()` implícito, mutations, `bulk_query` sem date filter.

#### 2.2 Rate limit tracker
Shopify Admin GraphQL: **50 cost points/s por loja** (não 50 req/s — é cost-based).

- Ler `extensions.cost.throttleStatus.currentlyAvailable` que já vem na resposta
- Manter mapa em memória `{ shop: { available, lastUpdate } }`
- Se < 20% disponível, fazer backoff exponencial antes da próxima call
- Em `bulk_query`/`bulk_mutation`, throttle por-shop dinâmico (não global)

#### 2.3 Logging estruturado
- Log line JSON por tool call: `{ ts, user, tool, shopCount, durationMs, ok, cacheHit }`
- Pra `mutation`: incluir `input` (variables) sanitizado — NUNCA token
- Stdout em prod (Vercel captura), arquivo em dev
- Futuro: enviar pro DW (tabela `mcp_call_log`) pra análise de uso

#### 2.4 Webhook receiver
**Novo endpoint:** `api/webhooks/[topic].ts` (Vercel)

- Recebe `orders/create`, `orders/updated`, `products/update`, `inventory_levels/update` das 38 lojas
- Valida HMAC (`X-Shopify-Hmac-SHA256`) com secret por shop
- Escreve raw payload em Supabase (`shopify_webhook_events` tabela) com idempotência por `X-Shopify-Webhook-Id`
- Outro worker (cron Vercel ou edge fn) consome a fila e popula DW dim/fact tables
- **Reduz escopo do conector Shopify do Pedro** — webhooks substituem ELT batch pra near-real-time

Setup: cada shop precisa de webhook subscription via `webhookSubscriptionCreate` mutation, apontando pro endpoint Vercel. Skill `webhook_subscribe` opcional pra automatizar.

### Fase 3 — Opcional / futuro

- `dry_run` flag em mutations (validação sem executar)
- Schema versioning — pinar `apiVersion` por shop com teste de regressão antes de bumpar
- Cliente MCP de browser pra UI de comparação cross-shop (Pedro/Wesley acessam sem CLI)
- Tools especializadas Copa Brasil 2026 (janela 11/jun-19/jul) — `copa_dashboard`, `copa_stockouts`

---

## Cuidados gerais

1. **Nunca quebrar tools existentes.** Adicionar é safe, mudar schema de tool publicada quebra prompts de skill/agent que já usam.
2. **Limpar MCP duplicado.** Hoje tem `lever-shopify` (HTTP) + `claude.ai Lever MCP Shopify` (HTTP, mesmo URL, registrado via setup.shopify.com) — funcional mas redundante. Decidir qual fica oficial.
3. **shops.json sempre gitignored.** Tokens vivem em env vars.
4. **Vercel deploy:** `git push` na branch deployment → vercel-build roda `tsc` → endpoint atualiza. Smoke test com `list_shops` depois de cada deploy.
5. **Migration mode:** novas tools entram com `description` marcado `(beta)` por 1 semana, depois remover prefix se estável.

---

## Como contribuir uma tool nova

1. Ler este SKILL.md inteiro + código de uma tool existente similar (`bulk_query` é boa referência)
2. Criar `src/tools/<name>.ts` seguindo o type `Tool`
3. Registrar em `src/tools/index.ts`
4. `npm run typecheck` local
5. Testar via stdio: `npm run dev` + mandar JSON-RPC manual
6. Commit em branch separada, PR pra `joao-vithor`
7. Deploy Vercel, smoke test com `list_shops` + tool nova
8. Documentar uso real em outro SKILL.md (ex: `daily-briefing.md` consumindo `daily_snapshot`)

---

## Contexto adicional

- **MCP-first** é regra workspace (ver memory `feedback_mcp_first_rule`) — qualquer Shopify op tenta MCP antes de CLI/script
- **Lever System consolidation** em curso (ver memory `project_lever_system_consolidation_2026_05_18`) — MCP pode substituir parte das 40 edge functions de leitura
- **João é arquiteto** do Lever System (memory `feedback_joao_is_architect_of_lever_system`) — decisões de schema/contrato passam por ele

Doc canônico extra (se existir): `Lever QI/00-operating-brain/shopify-mcp-evolution.md`
