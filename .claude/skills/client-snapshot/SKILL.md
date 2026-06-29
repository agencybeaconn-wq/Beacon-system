---
name: client-snapshot
description: KPIs em tempo real de 1 cliente Lever — Shopify revenue (today/7d/MTD/30d), AOV, daily breakdown, geo (se EN store), currency-aware. Puxa direto do Shopify Admin API via token em agency_clients. Funciona em todos clientes do Supabase com token salvo.
argument-hint: <cliente: nome|shopify_domain|UUID> [--period 30d|7d|today|mtd|YYYY-MM-DD:YYYY-MM-DD] [--geo]
---

# Skill: client-snapshot

Pull em tempo real de KPIs Shopify de 1 cliente. Foi a base de várias análises da sessão 2026-05-19. Mata pergunta tipo "quanto Mantos do PH está faturando hoje?" em 5 segundos.

## Pré-requisitos

- `.env.local` do Lever com `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Cliente cadastrado em `agency_clients` com `shopify_access_token` válido
- Node 18+ (built-in fetch)

## Quando usar

- "Quanto X está faturando hoje?"
- "Como Mantos vs Coringão últimos 7d?"
- "AOV real de Brasileiríssimo em USD?"
- "Pedidos das últimas 24h da [cliente]?"
- Antes de qualquer reunião estratégica com cliente (Account Senior usa pra preparar)
- Cross-check de número que cliente reclamou ("nossa loja parou de vender")

## Uso

```bash
# Default: últimos 30d
node lever/scripts/lever-mcp/client-snapshot.mjs "Mantos do PH"

# Período específico
node lever/scripts/lever-mcp/client-snapshot.mjs "Coringão Shop" --period 7d
node lever/scripts/lever-mcp/client-snapshot.mjs "Brasileiríssimo" --period mtd

# Período custom
node lever/scripts/lever-mcp/client-snapshot.mjs "Diario Stores" --period 2026-05-01:2026-05-15

# Por shopify_domain (mais robusto quando nome tem acento)
node lever/scripts/lever-mcp/client-snapshot.mjs "nbdxec-gx.myshopify.com"

# Com breakdown geo (útil pra EN stores)
node lever/scripts/lever-mcp/client-snapshot.mjs "Brasileiríssimo" --geo
```

## O que retorna

```
▌ Brasileiríssimo  (jdheep-z7.myshopify.com)
  Loja: GB · Moeda: USD

  HOJE:    US$ 7493.92 ≈ R$ 37958.95  ·  85 pedidos
  7d:      US$ 24373.43 ≈ R$ 123458.73  ·  266 pedidos · R$ 17636.96/dia
  MTD:     US$ 36691.06 ≈ R$ 185851.23  ·  390 pedidos
  30d:     US$ 41178.28 ≈ R$ 208580.34  ·  444 pedidos · AOV US$ 92.74

  Top 3 países (se --geo):
    US: 102 ord (22.9%) · receita US$ 8815.87
    PT: 92 ord (20.6%) · receita US$ 8530.14
    CH: 51 ord (11.4%) · receita US$ 5508.40

  Última atualização: 2026-05-19T15:34:33Z (real-time, sem cache)
```

## Coisas a saber

- **Currency-aware obrigatório**: lojas EN (Brasileiríssimo, GM Sports, MatchWear, MontRoyal, Puskas) operam em USD. Skill detecta `shop.currency` e converte pra BRL via API real-time USD→BRL (awesomeapi.com.br).
- **Resolução de cliente**: aceita nome parcial (ILIKE), shopify_domain (eq), ou UUID. Se ambiguidade, prioriza match exato de nome.
- **Filter de status**: só `paid` + `partially_paid`. Carrinho abandonado não conta.
- **Timezone**: filter em `-03:00` (BRT). Pra USA/Europa pode subestimar dia atual em algumas horas.
- **Pagination**: pega tudo até 20 páginas (5000 pedidos). Pra cliente com >5k pedidos/30d (sortudo), aumentar `pages > 20` safety.

## Quando NÃO usar

- Pra comparar Meta spend × Shopify revenue → use `portfolio-analysis` ou Lever System MCP `lever_client_kpis`
- Pra cross-client (>1 cliente) → use `portfolio-analysis`
- Pra investigar cliente com 0 vendas → use `client-triage` (essa só fala "tem 0", aquela diagnostica por quê)

## Conexões

- [[../lever-mcp/]] — quando Lever System MCP estiver na sessão Claude (pós-restart), invocar via `lever_shopify_revenue` é mais ergonômico
- [[../portfolio-analysis]] — agregação multi-cliente
- [[../client-triage]] — diagnóstico complementar pra cliente zerado
- Memory: `reference_lever_clients_usd_stores` — quais lojas operam USD
- Doc: `lever/scripts/lever-mcp/client-snapshot.mjs` (a implementar)