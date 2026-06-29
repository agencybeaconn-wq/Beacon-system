# Prévias de Anúncios (Instagram e Threads)

Gere prévias de anúncios existentes ou simule novos criativos.

## Formatos de Prévia (`ad_format`)
- `INSTAGRAM_STANDARD` (Feed)
- `INSTAGRAM_STORY` (Stories)
- `INSTAGRAM_EXPLORE_CONTEXTUAL` (Explorar Feed)
- `INSTAGRAM_EXPLORE_IMMERSIVE` (Explorar Vídeo)
- `INSTAGRAM_REELS` (Reels)
- `THREADS_STREAM` (Threads Feed)

## 1. Prévia de Anúncio Existente
```bash
curl -G \
  -d 'ad_format=INSTAGRAM_STANDARD' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/<AD_ID>/previews
```

## 2. Prévia Antes de Criar (Simulação)
Envie o `object_story_spec` para gerar uma prévia sem salvar o criativo.

```bash
curl -G \
  --data-urlencode 'creative={ 
    "object_story_spec": { 
      "instagram_user_id": "<IG_USER_ID>", 
      "link_data": { 
        "call_to_action": {"type":"LEARN_MORE","value":{"link":"<URL>"}}, 
        "image_hash": "<IMAGE_HASH>", 
        "message": "Ad Message" 
      }, 
      "page_id": "<PAGE_ID>" 
    } 
  }' \
  -d 'ad_format=INSTAGRAM_STANDARD' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/generatepreviews
```

## 3. Permalink do Instagram (Pós-Criação)
Obtenha o link direto para o post do anúncio no Instagram (não disponível para Stories ou Catálogo Advantage+).

```bash
curl -G \
  -d 'fields=instagram_permalink_url' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/<CREATIVE_ID>
```
**Nota:** O post visualizado via permalink não mostra o rótulo "Patrocinado" nem o botão de CTA.
