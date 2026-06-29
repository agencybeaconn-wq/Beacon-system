
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

