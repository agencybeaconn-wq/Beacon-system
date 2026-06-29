# CPM Otimizado (Optimized CPM)

O CPM Otimizado prioriza suas metas de marketing, entregando anúncios automaticamente para alcançar esses objetivos da maneira mais eficaz possível, cobrando por impressões.

## Diferenças
- **CPM Tradicional:** Foca apenas em entregar impressões.
- **CPA (Custo por Ação):** Cobra por conversões realizadas.
- **CPM Otimizado:** Cobra por impressões (`billing_event=IMPRESSIONS`), mas o sistema dá lances dinâmicos para capturar as impressões com maior probabilidade de gerar o resultado desejado (`optimization_goal`).

## Como Funciona
O sistema dá lances em seu nome, restringido pelo orçamento da campanha. Lances mais altos são feitos quando a impressão tem alta probabilidade de gerar o resultado.

## Requisitos
- **Mobile App Installs:** Disponível apenas se o app reportou um evento de instalação nos últimos 28 dias (via Facebook SDK ou MMP).

## Configuração

Para criar um anúncio com CPM Otimizado:
1.  **`billing_event`**: Deve ser `IMPRESSIONS`.
2.  **`optimization_goal`**: A ação que você deseja otimizar (ex: `LINK_CLICKS`, `APP_INSTALLS`).
3.  **`bid_amount`**: O valor que você atribui a esse objetivo (em centavos).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Optimized CPM Ad Set' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'optimization_goal=LINK_CLICKS' \
  -F 'bid_amount=150' \
  -F 'daily_budget=1000' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'targeting={"geo_locations":{"countries":["US"]}}' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Orçamento e Preços
- Requer um orçamento definido.
- O ROI total tende a exceder campanhas tradicionais de CPC ou CPM devido à natureza dinâmica dos lances baseados em valor.
