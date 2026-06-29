# Anúncios de Ligação (Call Ads)

Crie anúncios que incentivam o usuário a ligar para sua empresa (Click-to-Call).

## Pré-requisitos
- **Permissões:** `ads_management`, `pages_manage_ads`, `pages_read_engagement`, `pages_show_list`.
- **Limitação:** Público deve ter 18+ anos. Número de telefone deve ser do mesmo país do público.

## 1. Campanha
Objetivos compatíveis:
- `OUTCOME_TRAFFIC`
- `OUTCOME_LEADS`
- `OUTCOME_SALES`
- `OUTCOME_AWARENESS`
- `OUTCOME_ENGAGEMENT`

## 2. Conjunto de Anúncios
Configurações específicas para ligações:
- **`destination_type`**: `PHONE_CALL`
- **`optimization_goal`**: `QUALITY_CALL` (para otimizar por ligações de qualidade)

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Call Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'destination_type=PHONE_CALL' \
  -F 'optimization_goal=QUALITY_CALL' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'targeting={
       "geo_locations": {"countries":["US"]},
       "device_platforms": ["mobile"]
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 3. Criativo
Use o CTA `CALL_NOW` com o número de telefone.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Call Ad Creative' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "link_data": {
         "picture": "<IMAGE_URL>",
         "link": "<PAGE_URL>",
         "call_to_action": {
           "type": "CALL_NOW",
           "value": {"link": "tel:+15551234567"}
         }
       }
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 4. Recurso de Retorno de Ligação (Callback)
Permite que o usuário solicite que a empresa retorne a ligação.
Adicione `asset_feed_spec` ao criativo.

```json
"asset_feed_spec": {
  "call_ads_configuration": {
    "callback_type": "FORM"
  }
}
```

### Baixar Leads de Retorno
Use o endpoint de leads no nível do anúncio.
```bash
curl -G "https://graph.facebook.com/v24.0/<AD_ID>/leads" \
  -d 'access_token=<ACCESS_TOKEN>'
```
