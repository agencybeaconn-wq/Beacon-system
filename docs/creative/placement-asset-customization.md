# Personalização de Ativo por Posicionamento (Placement Asset Customization)

Entregue o criativo ideal para cada posicionamento (ex: Vídeo Vertical para Stories, Quadrado para Feed) em um único anúncio.

## Estrutura
Use `asset_customization_rules` dentro de `asset_feed_spec`.

### 1. Rotule os Ativos
Atribua `adlabels` aos seus ativos (vídeos, imagens) para identificá-los.
```json
"videos": [
  { "video_id": "<ID_FEED>", "adlabels": [{"name": "video_feed"}] },
  { "video_id": "<ID_STORY>", "adlabels": [{"name": "video_story"}] }
]
```

### 2. Defina as Regras
Crie regras que vinculam `customization_spec` (o posicionamento) ao rótulo do ativo.

#### Campos de Posicionamento (`customization_spec`)
- `publisher_platforms`: `facebook`, `instagram`, `messenger`, `audience_network`, `threads`.
- `facebook_positions`: `feed`, `story`, `marketplace`, etc.
- `instagram_positions`: `stream` (feed), `story`, `explore`, `reels`, etc.
- `threads_positions`: `threads_stream`.

### Exemplo Completo (Feed vs. Stories)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Placement Customization Creative' \
  -F 'object_story_spec={ "page_id": "<PAGE_ID>" }' \
  -F 'asset_feed_spec={
       "ad_formats": ["SINGLE_VIDEO"],
       "optimization_type": "PLACEMENT",
       "videos": [
         { "video_id": "<ID_SQUARE>", "adlabels": [{"name": "square_video"}] },
         { "video_id": "<ID_VERTICAL>", "adlabels": [{"name": "vertical_video"}] }
       ],
       "asset_customization_rules": [
         {
           "customization_spec": {
             "publisher_platforms": ["facebook", "instagram"],
             "facebook_positions": ["feed"],
             "instagram_positions": ["stream"]
           },
           "video_label": { "name": "square_video" }
         },
         {
           "customization_spec": {
             "publisher_platforms": ["facebook", "instagram"],
             "facebook_positions": ["story"],
             "instagram_positions": ["story"]
           },
           "video_label": { "name": "vertical_video" }
         }
       ]
     }' \
  ...
```

## Threads
Para incluir Threads, use `publisher_platforms: ["threads"]` e `threads_positions: ["threads_stream"]`.
*Nota: Requer `instagram` e `instagram_positions: ["stream"]` também selecionados.*
