---
name: portfolio-analysis
description: Análise consolidada de TODOS clientes fixos da Lever — GMV 30d, AOV, trend 7d vs prev 7d, geo, top/bottom por receita, sinais vitais. Currency-aware (USD ↔ BRL). Salva JSON pra inspeção. Base canônica pra diagnóstico estratégico.
argument-hint: (sem args — roda em todos clientes fixos ativos)
---

# Skill: portfolio-analysis

Snapshot consolidado de **TODOS** os 16+ clientes fixos da Lever em uma execução. Foi a base da Camada 3 do diagnóstico do setor de marketing.

## Pré-requisitos

- `.env.local` do Lever com `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Conexão Shopify ativa em `agency_clients` (token + status connected)
- Node 18+

## Quando usar

- **Toda segunda-feira de manhã** — input pra reunião semanal squad
- Antes de reunião com cliente top ("como ele tá vs portfolio?")
- Análise de impacto de evento sazonal (Copa BR, Black Friday, Champions)
- Pitch pra sócios — quanto a Lever realmente movimenta
- Pré-trabalho do Account Senior em qualquer reunião estratégica

## Uso

```bash
node lever/scripts/lever-mcp/analyze-all-clients.mjs
```

Roda 18 clientes em paralelo (6 concurrent). ~60-90 segundos.

## O que retorna

**Console:**
- Lista cliente por cliente: GMV 30d (BRL eq), pedidos, trend 7d vs prev 7d
- Resumo consolidado: GMV total, AOV médio, fee Lever total
- Top 5 por GMV
- Bottom 3 por GMV (potenciais zerados)
- Trend winners + losers (sinal vital crítico)

**Arquivo:**
- `analysis-YYYY-MM-DD.json` com dados completos pra inspeção/comparação histórica

## Sinais a procurar no output

1. **Pareto extremo**: top 4 carregam 90%+? → risco de concentração
2. **Zerados**: 0 pedidos em 30d → triagem urgente (use `client-triage`)
3. **Trends > +100%**: oportunidade de capturar momento (event-driven)
4. **Trends < -30%**: sinal de churn / problema técnico
5. **AOV cross-cliente**: lojas BR/BRL devem estar R$ 200-450; lojas EN/USD em US$ 50-120
6. **Currencies mistas**: se cliente aparece USD mas você assumia BRL → leia memory `reference_lever_clients_usd_stores`

## Coisas a saber

- **18 clientes ≠ 16 fixos**: inclui também Kron interna + alguns avulsos. Filter customizável editando query no script.
- **Concurrency 6**: balanceia velocidade vs rate limit Shopify (~6 req/s sem 429).
- **Output JSON persistente**: comparar entre semanas pra ver evolução.
- **USD→BRL real-time**: usa awesomeapi.com.br. Fallback hardcoded 5.05 se API offline.
- **trend null %**: significa que prev 7d teve 0 vendas (divisão por zero). Cliente novo ou parado.

## Quando NÃO usar

- Pra 1 cliente específico → `client-snapshot` é mais ergonômico
- Pra investigar PORQUE um cliente plateou → `client-triage` + Meta MCP
- Pra dashboard automático recorrente → wrap num cron + alerta (Daily Snapshot Automatizado, pendente)

## Ritual recomendado

**Toda segunda 8h** (manual ou cron):
1. Rodar `portfolio-analysis`
2. Olhar tops/bottoms/trends
3. Triagem mental: alguém precisa de ação esta semana?
4. Pop docs em Lever QI `04-data-rituals/weekly-team-retro.md`

## Conexões

- `client-snapshot` — drill-down de 1 cliente
- `client-triage` — diagnóstico de zerados
- `Lever QI/00-operating-brain/setor-marketing/03-camada3-portfolio-snapshot-2026-05-19.md` — exemplo de uso histórico
- Memory: `reference_lever_real_client_taxonomy` — taxonomia oficial fixo/avulso
- Memory: `reference_lever_clients_usd_stores` — quem é USD/EN