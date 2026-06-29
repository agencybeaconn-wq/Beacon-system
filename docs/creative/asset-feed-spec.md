# Especificação do Feed de Ativos (Asset Feed Spec)

O campo `asset_feed_spec` permite fornecer múltiplos ativos criativos (imagens, vídeos, textos) para que o sistema gere combinações otimizadas automaticamente (Criativo Dinâmico) ou baseado em regras.

## Criando um Feed de Ativos (Criativo Dinâmico)
Forneça listas de ativos. O sistema testará combinações para encontrar a melhor performance.

### Limitações
- Para Criativo Dinâmico, não use regras de personalização.
- Use `ad_formats: ["AUTOMATIC_FORMAT"]` ou especifique formatos como `["SINGLE_IMAGE"]`.

### Exemplo (Imagens e Textos)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Dynamic Ad Creative' \
  -F 'object_story_spec={ "page_id": "<PAGE_ID>" }' \
  -F 'asset_feed_spec={
       "images": [
         { "hash": "<IMAGE_HASH_1>" },
         { "hash": "<IMAGE_HASH_2>" }
       ],
       "bodies": [
         { "text": "Comece sua aventura" },
         { "text": "Texto alternativo aqui" }
       ],
       "titles": [
         { "text": "Título Principal" },
         { "text": "Outra Opção de Título" }
       ],
       "descriptions": [
         { "text": "Descrição do link" }
       ],
       "ad_formats": ["SINGLE_IMAGE"],
       "call_to_action_types": ["SHOP_NOW"],
       "link_urls": [
         { "website_url": "https://www.exemplo.com/" }
       ]
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Exemplo (Vídeos)
```bash
curl -X POST ... \
  -F "asset_feed_spec={
       'videos': [
         {'video_id':'<VIDEO_ID_1>', 'thumbnail_url':'<URL>', 'url_tags':'video=v1'},
         {'video_id':'<VIDEO_ID_2>', 'thumbnail_url':'<URL>', 'url_tags':'video=v2'}
       ],
       'bodies': [...],
       'titles': [...],
       'ad_formats': ['SINGLE_VIDEO'],
       ...
     }"
```

## Lendo o Feed
Para verificar os ativos configurados:
```bash
curl -X GET -G \
  -d 'fields=asset_feed_spec' \
  -d 'access_token=<ACCESS_TOKEN>' \
  "https://graph.facebook.com/v25.0/<CREATIVE_ID>"
```

## Editando
Para "editar", você deve criar um novo criativo com a nova `asset_feed_spec` e atualizar o anúncio para usar esse novo `creative_id`.
- Você pode adicionar, remover ou substituir ativos.
- **Não** pode mudar formatos de anúncio drasticamente (ex: de Imagem Única para Vídeo) ou remover a natureza dinâmica do criativo.
