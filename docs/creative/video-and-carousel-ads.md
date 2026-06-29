# Anúncios em Vídeo e Carrossel

## 1. Anúncios em Vídeo

### Fluxo de Criação
1. **Fornecer Criativo:** Use um `video_id` existente (carregado via `/advideos`).
2. **Criar Campanha:** Objetivo `OUTCOME_ENGAGEMENT` (ou `VIDEO_VIEWS` legado).
3. **Criar Conjunto de Anúncios:** Otimize para `THRUPLAY` ou `IMPRESSIONS`.
4. **Criar Anúncio:** Vincule o criativo ao conjunto.

**Exemplo de Criativo de Vídeo:**
```bash
curl \
  -F 'name=Sample Creative' \
  -F 'object_story_spec={ 
  "page_id": "<PAGE_ID>", 
  "video_data": {"image_url":"<THUMBNAIL_URL>","video_id":"<VIDEO_ID>"} 
  }' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

### Remarketing de Vídeo
Crie públicos personalizados baseados em visualizações (3s, 10s, 25%, 50%, 75%, 95%).
- **Subtype:** `ENGAGEMENT`
- **Regras:** `video_watched`, `video_completed`, etc.

### Métricas de Vídeo
Use a API de Insights para métricas como `video_avg_pct_watched_actions` e `video_complete_watched_actions`.

---

## 2. Anúncios em Carrossel

Permite exibir múltiplas imagens ou vídeos em um único anúncio.

### Estrutura (`child_attachments`)
Uma matriz de objetos onde cada um contém:
- `link`: URL de destino.
- `name`: Título.
- `description`: Preço ou descrição curta.
- `picture` ou `image_hash`: Imagem do cartão.
- `video_id`: (Opcional) Para carrossel de vídeo.
- `call_to_action`: Botão de ação.

**Exemplo de Criação (Carrossel):**
```bash
curl \
  -F 'name=Sample Creative' \
  -F 'object_story_spec={ 
    "link_data": { 
      "child_attachments": [ 
        { 
          "name": "Product 1", 
          "link": "https://site.com/p1", 
          "image_hash": "<HASH_1>" 
        }, 
        { 
          "name": "Product 2", 
          "link": "https://site.com/p2", 
          "image_hash": "<HASH_2>" 
        }
      ], 
      "link": "<URL_FINAL>", 
      "message": "Confira nossos produtos!"
    }, 
    "page_id": "<PAGE_ID>" 
  }' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

### Métricas de Carrossel
Use `action_breakdowns=['action_carousel_card_id', 'action_carousel_card_name']` para ver o desempenho por cartão individual.
