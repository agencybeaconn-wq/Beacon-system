# Criativo Dinâmico (Dynamic Creative)

Automatize testes de criativos entregando diferentes combinações de ativos (imagens, vídeos, textos) para encontrar a melhor performance.

## 1. Campanha
- **Objetivos Suportados:** `OUTCOME_SALES`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_AWARENESS`, `OUTCOME_TRAFFIC`, `OUTCOME_APP_PROMOTION`.
- **Buying Type:** `AUCTION`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Dynamic Creative Campaign' \
  -F 'objective=OUTCOME_SALES' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Conjunto de Anúncios
- **Flag Obrigatória:** `is_dynamic_creative=true`.
- **Optimization Goal:** Geralmente `OFFSITE_CONVERSIONS` ou `APP_INSTALLS`.
- **Limitação:** Apenas 1 anúncio permitido por conjunto de anúncios de criativo dinâmico.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Dynamic Creative Ad Set' \
  -F 'is_dynamic_creative=true' \
  -F 'optimization_goal=OFFSITE_CONVERSIONS' \
  -F 'promoted_object={"pixel_id": "<PIXEL_ID>", "custom_event_type": "PURCHASE"}' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'targeting={"geo_locations": {"countries": ["US"]}}' \
  ...
```

## 3. Criativo (Asset Feed)
Use `asset_feed_spec` para fornecer os ativos.
*Nota: Veja o documento `asset-feed-spec.md` para detalhes da estrutura.*

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Dynamic Creative Assets' \
  -F 'object_story_spec={ "page_id": "<PAGE_ID>" }' \
  -F 'asset_feed_spec={
       "images": [{"hash": "<HASH1>"}, {"hash": "<HASH2>"}],
       "bodies": [{"text": "Texto A"}, {"text": "Texto B"}],
       "titles": [{"text": "Título A"}, {"text": "Título B"}],
       "ad_formats": ["SINGLE_IMAGE"],
       "link_urls": [{"website_url": "https://site.com"}]
     }' \
  ...
```

## 4. Anúncio
Crie o anúncio vinculando o criativo. Lembre-se: o Ad Set deve estar vazio (sem outros anúncios).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Dynamic Creative Ad' \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={"creative_id": "<CREATIVE_ID>"}' \
  ...
```

## Verificação de Análise
Verifique se os ativos foram aprovados ou rejeitados (ex: por regras de álcool ou texto).
```bash
curl -G "https://graph.facebook.com/v24.0/<ADSET_ID>?fields=review_feedback"
```
