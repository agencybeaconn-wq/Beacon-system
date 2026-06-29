# Orçamentos (Budgets)

Defina orçamentos diários ou vitalícios no nível do conjunto de anúncios.

## Conceitos Básicos

- **Unidade Monetária:** Os valores são definidos na menor denominação da moeda (ex: centavos para USD/BRL). `100` = $1.00.
- **`daily_budget` (Orçamento Diário):**
  - Valor médio que você deseja gastar por dia.
  - **Flexibilidade:** O sistema pode gastar até **25% a mais** em dias com melhores oportunidades (ex: se o orçamento é $10, pode gastar até $12.50), compensando em outros dias para manter a média.
- **`lifetime_budget` (Orçamento Vitalício):**
  - Valor total a ser gasto durante toda a duração do conjunto de anúncios.
  - O sistema distribui o gasto conforme as oportunidades ao longo do período (pacing).
  - Nunca excederá o valor total definido.

## Exemplos de Configuração

### Orçamento Diário ($20.00)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Daily Budget AdSet' \
  -F 'daily_budget=2000' \
  -F 'start_time="2025-11-11T14:25:17-0800"' \
  -F 'end_time="2025-11-18T14:25:17-0800"' \
  -F 'campaign_id="<CAMPAIGN_ID>"' \
  -F 'bid_amount=100' \
  -F 'billing_event="LINK_CLICKS"' \
  -F 'optimization_goal="LINK_CLICKS"' \
  -F 'status="PAUSED"' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Orçamento Vitalício ($200.00 para 10 dias)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Lifetime Budget AdSet' \
  -F 'lifetime_budget=20000' \
  -F 'start_time="2025-11-11T14:26:09-0800"' \
  -F 'end_time="2025-11-21T14:26:09-0800"' \
  -F 'campaign_id="<CAMPAIGN_ID>"' \
  -F 'bid_amount=100' \
  -F 'billing_event="LINK_CLICKS"' \
  -F 'optimization_goal="LINK_CLICKS"' \
  -F 'status="PAUSED"' \
  -F 'access_token=<ACCESS_TOKEN>'
```
