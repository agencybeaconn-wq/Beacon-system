# Anúncios do Reels (Reels Ads)

Crie anúncios imersivos em tela cheia (9:16) no Facebook e Instagram Reels.

## Pré-requisitos
- **Permissões:** `ads_management`, `ads_read`, `read_insights`.
- **Acesso:** Token de acesso ao sistema recomendado.

## 1. Campanha
Objetivos compatíveis com Reels:
- `OUTCOME_TRAFFIC`
- `OUTCOME_SALES`
- `OUTCOME_LEADS`
- `OUTCOME_ENGAGEMENT`
- `OUTCOME_AWARENESS`
- `OUTCOME_APP_PROMOTION`

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Reels Campaign' \
  -F 'objective=OUTCOME_TRAFFIC' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Conjunto de Anúncios (Posicionamento)
Para direcionar especificamente para Reels, configure `publisher_platforms` e `*_positions`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Reels Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'daily_budget=5000' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'optimization_goal=LINK_CLICKS' \
  -F 'targeting={
       "geo_locations": {"countries":["BR"]},
       "age_min": 18,
       "publisher_platforms": ["instagram", "facebook"],
       "instagram_positions": ["reels"],
       "facebook_positions": ["facebook_reels"]
     }' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 3. Criativo

### Reutilizar Reel Orgânico
Você pode promover um Reel orgânico existente (menos de 90s, 9:16, sem música com direitos autorais).

1.  Obtenha o ID da mídia do Instagram (`source_instagram_media_id`).
2.  Use `instagram_user_id` em vez de `instagram_actor_id`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "instagram_user_id": "<IG_USER_ID>",
       "video_data": {
         "call_to_action": {"type": "LEARN_MORE", "value": {"link": "<URL>"}}
       }
     }' \
  -F 'source_instagram_media_id=<IG_MEDIA_ID>' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Mídia Dinâmica (Catálogo)
Use vídeos de produtos do catálogo no Reels.
- **Requisito:** Vídeos 9:16 no catálogo.
- **Configuração:** Crie um conjunto de anúncios com `product_set_id` e use um criativo de Carrossel ou Vídeo Único.

## 4. Prévia (Preview)
Formatos de prévia para Reels:
- `FACEBOOK_REELS_MOBILE`
- `INSTAGRAM_REELS`

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adpreviews" \
  -F 'creative={ ... }' \
  -F 'ad_format=INSTAGRAM_REELS' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 5. Insights
Para analisar desempenho específico do Reels, use detalhamentos.

```bash
curl -G "https://graph.facebook.com/v24.0/<AD_ACCOUNT_ID>/insights" \
  -d 'level=campaign' \
  -d 'breakdowns=publisher_platform,platform_position' \
  -d 'filtering=[{"field":"platform_position","operator":"IN","value":["instagram_reels","facebook_reels"]}]' \
  -d 'access_token=<ACCESS_TOKEN>'
```
