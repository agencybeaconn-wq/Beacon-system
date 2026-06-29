---
name: ads-health-daily
description: Verificação diária de saúde dos anúncios Meta dos clientes Lever. Detecta saldos críticos (Meta pré-pago), campanhas pausadas, criativos cansados (>14d), conta desabilitada, spend zero inesperado. Gera relatório em Lever QI/04-data-rituals/ads-health/. Wesley + Campanhã consomem todo dia.
argument-hint: [--client X] [--dry]
---

# Skill: ads-health-daily

Diagnóstico operacional diário das contas Meta dos clientes Lever. Pensado pro **Wesley** e **Campanhã** rodarem todo dia de manhã, antes de mexer em campanha, pra saber onde tem fogo.

## Pré-requisitos

- `.env.local` Lever com `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `fb_connections` table com tokens Meta válidos (status `connected`)
- `agency_clients.selected_ad_accounts` populado por cliente
- Node 18+ (built-in fetch)

## Quando usar

- **Toda manhã 8-9h BRT** (manual por enquanto, cron na v2)
- Antes de qualquer reunião com cliente top (saber estado real)
- Quando cliente mandar mensagem "minha campanha parou" — checa em 30s

## Uso

```bash
# Roda em todos clientes fixos ativos, gera relatório em Lever QI
node lever/scripts/lever-mcp/ads-health-daily.mjs

# 1 cliente específico
node lever/scripts/lever-mcp/ads-health-daily.mjs --client "Mantos do PH"

# Sem escrever arquivo (só console output)
node lever/scripts/lever-mcp/ads-health-daily.mjs --dry
```

## O que detecta

### 🔴 Alertas críticos (RED — ação hoje)

- **Conta Meta DESABILITADA** (`account_status` 2 ou 3) — Meta bloqueou conta
- **ZERO campanhas ativas** num cliente que paga fee fixo
- **Spend hoje = 0 mas avg 7d > R$ 50/dia** — algo quebrou
- **Saldo cobre < 3 dias** de daily spend — Meta pré-pago, conta vai pausar

### 🟡 Avisos (YELLOW — ação essa semana)

- **Todos criativos ativos têm >14d** — fadiga garantida, trocar
- **Zero criativos novos últimos 7d** com 5+ ads ativos — volume insuficiente

### 🟢 OK (GREEN)

- Tudo dentro dos parâmetros esperados.

## O que NÃO faz (ainda)

- **Google Ads** — fica pra v2. Hoje só Meta.
- **WhatsApp push automático** — manual por enquanto. Wesley/Campanhã leem o report.
- **Anomaly detection ML** — só regra simples (3-day cover, comparação spend hoje vs avg). Não detecta drift fino.
- **Cron automático** — manual hoje. Quando virar edge function Supabase, dispara 8h BRT.

## Output

### Console

Resumo por linha, 1 linha por conta Meta com flag color:
```
🟢 Mantos do PH · Mantos do PH · BRL · spend hoje 1772.28 · 7d 10860.68 · camps 19A/31P · ads 21 (19 novos)
🔴 Coringão Shop · Coringão Shop · BRL · spend hoje 324.28 · 7d 4650.54 · saldo R$ 3,93 (0 dias)
```

### Relatório markdown

`Lever QI/04-data-rituals/ads-health/ads-health-YYYY-MM-DD.md` — versionado, comparável dia a dia, navegável no Obsidian.

### JSON

Mesma pasta, `ads-health-YYYY-MM-DD.json` — pra análise histórica ou input de outras skills.

## Quirks importantes

- **Meta retorna balance em "menor unidade"** (centavos pra BRL/USD). Script divide por 100.
- **Memory `reference_meta_accounts_postpaid`** diz contas Kron são pós-pagas. Pros clientes Lever BR, são quase todas PRÉ-PAGAS — saldo crítico = pausa real.
- **`account_status` valores**: 1 active · 2 disabled · 3 unsettled · 7 pending_risk_review · 9 in_grace_period · 100 pending_closure · 101 closed · 102 pending_settlement · 201 any_active · 202 any_closed
- **Spend dimensions**: hoje (`today`) usa filter `date_preset=today` que é -03:00 timezone Meta default.

## Próximos passos roadmap

- **v1.1** (hoje feito): Meta detection completa
- **v1.2** (próxima semana): Google Ads add (`mcp__google-ads` ou direct API)
- **v2** (próximo mês): cron Supabase edge function 8h BRT → WhatsApp push pra Wesley
- **v3** (mês 2): anomaly detection com baseline rolling 28d (CPM/CTR/CPA drift detection)

## Conexões

- Script: `lever/scripts/lever-mcp/ads-health-daily.mjs`
- Output histórico: `Lever QI/04-data-rituals/ads-health/`
- Memory: `reference_meta_accounts_postpaid` (Kron post-paid vs cliente Lever pré-pago)
- Skill complementar: `client-snapshot` (revenue Shopify daily) — cruza com spend pra ROAS real
- Skill complementar: `portfolio-analysis` (visão consolidada)
- Cliente list canônica: `Lever QI/00-operating-brain/clientes-taxonomia-real.md`
