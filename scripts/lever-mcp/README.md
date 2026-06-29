# Lever System MCP — MVP v0.1

> **Status:** funcional, admin-only (service role). Versão definitiva (Sprint 1 com JWT/RLS user-level) pendente — ver `Lever QI/00-operating-brain/lever-system-mcp/scope.md`.

## O que é

Stdio MCP server local que expõe 5 tools sobre o Supabase Lever:

| Tool | O que faz | Status |
|---|---|---|
| `lever_list_clients` | Lista clientes (active/fixed/all/archived) | ✅ OK |
| `lever_shopify_revenue` | Faturamento Shopify por cliente + período + quebra diária | ✅ OK |
| `lever_meta_spend` | Spend Meta por cliente (DW) | ⏳ aguarda DW populado |
| `lever_cross_view` | Query views DW (meta×shopify daily etc) | ⏳ aguarda DW populado |
| `lever_client_kpis` | KPIs consolidados Shopify+Meta + ROAS real vs Meta-attributed | 🟡 Shopify funciona, Meta aguarda DW |

## Auth

Lê `SUPABASE_SERVICE_ROLE_KEY` do `.env` do Lever (admin, bypassa RLS).
**Pendente:** JWT user-level via Supabase Auth + RLS automática (no scope final do João).

## Setup

```bash
cd lever/scripts/lever-mcp
npm install
```

Já registrado no Claude Code local:
```bash
claude mcp add lever-system --scope local -- node ./index.mjs
```

**Pra usar na sessão:** reiniciar Claude Code (tools aparecem após restart).

## Smoke test

```bash
node smoke-test.mjs
```

Testa as 5 tools via JSON-RPC direto sem precisar de cliente MCP.

## Pendências conhecidas

1. **DW Meta vazio**: `dw_meta_insights_daily` sem rows. Precisa rodar `dw-daily-sync` edge function com Meta data antes de `lever_meta_spend` retornar números reais.
2. **Service role**: bypassa RLS. OK pra dev/admin, mas precisa migrar pra JWT user-level antes de squad usar.
3. **Sem audit log**: chamadas MCP não são logadas. Versão definitiva terá tabela `mcp_calls`.
4. **Sem write tools**: só read-only. Sprint 2 do scope.md tem create_task, shopify_admin_proxy, etc.

## Quando virar deprecated

Quando João implementar o Lever System MCP definitivo (scope.md Sprint 1+), esse MVP vira referência histórica. Pode deletar tudo.

## Aprendizados pro scope final

Coisas que descobri durante o build do MVP:

- `agency_clients.selected_ad_accounts` é JSON array de account_ids (não `client_ad_accounts` table — ela não existe)
- `dw_meta_accounts.client_id` é onde mapeia ad_account → cliente (fallback do `selected_ad_accounts`)
- `dw_meta_insights_daily.revenue` **NÃO EXISTE** — col real provável é `purchase_value` ou `action_purchase_value` (a investigar)
- PostgREST filter syntax: `campo=op.valor`, NÃO `campo.op.valor`
- View `dw_v_meta_vs_shopify_daily` existe mas vazia (depende de insights_daily)
- Existem 79 edge functions (não 40 como scope.md cita) — Pedro/João acumularam mais

## Refs

- Scope final: `Lever QI/00-operating-brain/lever-system-mcp/scope.md`
- Arquiteto: João Vithor (não Pedro — ver memory `feedback-joao-is-architect-of-lever-system`)
- Esse MVP foi piloto pra validar a abordagem antes de escrever a versão "feita certo"
