# Anúncios Omnichannel (Omnichannel Ads)

Impulsione vendas na loja física e no site simultaneamente, utilizando catálogos e localização de lojas.

## Pré-requisitos
- **Permissões:** `ads_management`, `ads_read`.
- **Ativos:** Conta de Anúncios, Pixel da Meta, Conjunto de Dados Offline (Offline Conversion Dataset).

## 1. Campanha
- **Objetivo:** `OUTCOME_SALES`.
- **Catálogo (Opcional):** Inclua `promoted_object: {"product_catalog_id": "..."}` para Advantage+ Catalog Ads.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Omni Campaign' \
  -F 'objective=OUTCOME_SALES' \
  -F 'promoted_object={"product_catalog_id":"<CATALOG_ID>"}' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Conjunto de Anúncios
O segredo está no `omnichannel_object`.

- **Optimization Goal:** `OFFSITE_CONVERSIONS`.
- **Attribution Spec:** 7 dias clique, 1 dia visualização.
- **Promoted Object:** Deve conter `omnichannel_object` com `pixel` e `offline` datasets.

### Exemplo de Configuração
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Omni AdSet' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'optimization_goal=OFFSITE_CONVERSIONS' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'promoted_object={
       "omnichannel_object": {
         "offline": [{"offline_conversion_data_set_id": "<OFFLINE_ID>", "custom_event_type": "PURCHASE"}],
         "pixel": [{"pixel_id": "<PIXEL_ID>", "custom_event_type": "PURCHASE"}]
       }
     }' \
  -F 'attribution_spec=[
       {"event_type":"CLICK_THROUGH","window_days":"7"},
       {"event_type":"VIEW_THROUGH","window_days":"1"}
     ]' \
  ...
```

### Variações de Catálogo
- **Loja Física + Site:** `variation: "PRODUCT_SET_AND_IN_STORE"`
- **Loja + Site + App:** `variation: "PRODUCT_SET_WEBSITE_APP_AND_INSTORE"`

## 3. Criativo
Use `local_store_extension` para mostrar a loja mais próxima.

### Exemplo com Extensão de Loja Local
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Omni Creative' \
  -F 'object_story_spec={ ... }' \
  -F 'degrees_of_freedom_spec={
       "creative_features_spec": {
         "local_store_extension": {
           "enroll_status": "OPT_IN",
           "action_metadata": {"type": "MANUAL"}
         }
       }
     }' \
  ...
```

### Inventário Local (SBLI)
Para usar o catálogo de inventário local, adicione `recommender_settings`.
```bash
-F 'recommender_settings={"product_sales_channel": "omni"}'
```
