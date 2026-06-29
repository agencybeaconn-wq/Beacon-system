# Criar um Conjunto de Anúncios

Depois de criar sua campanha, o próximo passo é criar um conjunto de anúncios para fazer parte dela. O conjunto de anúncios contém as informações de lances, direcionamento e orçamento da sua campanha.

Para criar um conjunto de anúncios dentro da sua campanha, envie uma solicitação `POST` ao ponto de extremidade `/act_<AD_ACCOUNT_ID>/adsets`.

## Exemplo de solicitação da API

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets \
  -F 'name=My Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'daily_budget=1000' \
  -F 'targeting={"geo_locations":{"countries":["US"]}}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Parâmetros necessários

| Nome | Descrição |
| :--- | :--- |
| **campaign_id** | A identificação da campanha à qual o conjunto de anúncios pertence. |
| **daily_budget** | O orçamento diário especificado em centavos. |
| **targeting** | O público-alvo baseado em localizações geográficas. |
