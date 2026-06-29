---
name: clarity
description: Consulta dados do Microsoft Clarity (heatmap, sessions, dead clicks, rage clicks, scroll depth) de uma loja conectada. Usa cache de 6h pra economizar quota (Clarity API limita a 10 req/dia).
argument-hint: <cliente> [--days=1|2|3] [--dimension=Browser|Device|Country|OS|Source|Medium|Campaign|Channel|URL] [--metric=Traffic|ScrollDepth|...] [--force] [--usage]
---

# Microsoft Clarity Insights

Lê dados do Clarity Data Export API via edge function `clarity-proxy` (com cache).

## Uso

```bash
# Insights gerais dos últimos 1, 2 ou 3 dias
node .claude/skills/clarity/clarity.mjs MontRoyal --days=1

# Quebra por dimensão (Browser, Device, Country, OS, Source, Medium, Campaign, Channel, URL)
node .claude/skills/clarity/clarity.mjs MontRoyal --days=3 --dimension=URL

# Forçar refresh (ignora cache, gasta 1 request da quota diária)
node .claude/skills/clarity/clarity.mjs MontRoyal --days=1 --force

# Ver quanto gastou hoje (não consome request)
node .claude/skills/clarity/clarity.mjs MontRoyal --usage
```

## Métricas disponíveis (Clarity)

- **Traffic** — sessions, bots, distinct users, pages/session
- **ScrollDepth** — quanto da página os usuários scrollaram
- **EngagementTime** — tempo médio engajado
- **DeadClickCount** — cliques sem efeito
- **RageClickCount** — cliques rápidos repetidos (frustração)
- **ExcessiveScroll** — scroll exagerado (busca confusa)
- **QuickbackClick** — voltou na página rápido
- **ScriptErrorCount**, **ErrorClickCount**

## Limites importantes

- **10 requests/dia/projeto** — cache de 6h é agressivo de propósito.
- Janela de dados: só últimos **1-3 dias**.
- 3 dimensões max por request.
- 1000 rows max por response.

## Quando usar

- "Qual produto teve mais rage clicks na última semana?"
- "Como está o scroll depth da home?"
- "Que país está convertendo mais?"
- Combinar com analytics da Shopify pra entender funnel.

## Token

Cliente conecta em **Conexões > Microsoft Clarity** com:
- Project ID (em Clarity dashboard URL: `clarity.microsoft.com/projects/view/<PROJECT_ID>/`)
- API Token (Clarity > Settings > Data Export > Generate new API token)
