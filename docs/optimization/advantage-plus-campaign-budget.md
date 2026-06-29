# Orçamento de Campanha Advantage+ (Advantage+ Campaign Budget)

Otimiza automaticamente a distribuição do orçamento entre os conjuntos de anúncios da campanha (antigo CBO).

## Configuração da Campanha

Ao usar o Orçamento Advantage+, você define o orçamento e a estratégia de lance no nível da **Campanha**, não do conjunto de anúncios.

- **`daily_budget`** ou **`lifetime_budget`**: Definido na campanha.
- **`bid_strategy`**: Compartilhada por todos os conjuntos de anúncios.
- **`pacing_type`**: Compartilhado por todos os conjuntos de anúncios.

### Exemplo: Campanha com Orçamento Diário e Custo Mais Baixo
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Advantage+ Budget Campaign' \
  -F 'objective=OUTCOME_TRAFFIC' \
  -F 'daily_budget=100000' \
  -F 'bid_strategy=LOWEST_COST_WITHOUT_CAP' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Controles no Nível do Conjunto de Anúncios

Mesmo com o orçamento na campanha, você pode definir limites e metas para conjuntos de anúncios individuais.

- **`daily_min_spend_target`**: Meta mínima de gasto diário (esforço, não garantido).
- **`daily_spend_cap`**: Limite máximo de gasto diário.
- **`lifetime_min_spend_target`**: Meta mínima de gasto total.
- **`lifetime_spend_cap`**: Limite máximo de gasto total.

### Exemplo: Conjunto de Anúncios com Limite de Lance
Se a campanha usa `LOWEST_COST_WITH_BID_CAP`, você define o `bid_amount` no conjunto de anúncios.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'name=Ad Set with Bid Cap' \
  -F 'bid_amount=100' \
  -F 'optimization_goal=LINK_CLICKS' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'access_token=<ACCESS_TOKEN>' \
  ...
```

## Atualização e Reequilíbrio

### Desativar Orçamento Advantage+
Para voltar a usar orçamentos nos conjuntos de anúncios, você deve remover o orçamento da campanha e definir `adset_budgets`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/<CAMPAIGN_ID>" \
  -F 'daily_budget=' \
  -F 'adset_budgets=[
       {"adset_id": <AD_SET_ID1>, "daily_budget": 5000},
       {"adset_id": <AD_SET_ID2>, "daily_budget": 7000}
     ]' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Atualizar Lances em Massa
```bash
curl -X POST "https://graph.facebook.com/v24.0/<CAMPAIGN_ID>" \
  -F 'bid_strategy=LOWEST_COST_WITH_BID_CAP' \
  -F 'adset_bid_amounts={
       "<AD_SET_ID1>": 1500,
       "<AD_SET_ID2>": 2000
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```
