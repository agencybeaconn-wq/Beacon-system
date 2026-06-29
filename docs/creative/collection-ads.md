# Anúncios de Coleção

O formato de anúncio de coleção inclui uma experiência instantânea e exibe três produtos abaixo de uma imagem ou vídeo principal (Hero Image/Video).

## Estrutura
Requer uma **Experiência Instantânea** contendo:
1. **Hero Media:** Imagem, Vídeo ou Vídeo de Modelo.
2. **Conjunto de Produtos:** `canvas_product_set` com `show_in_feed=true`.
3. **Rodapé:** Link ou botão.

## Fluxo de Criação

### 1. Criar Elementos da Experiência Instantânea

**Hero Image:**
```bash
curl -F 'canvas_photo={ "photo_id": "<PHOTO_ID>" }' \
  https://graph.facebook.com/v24.0/<PAGE_ID>/canvas_elements
```

**Conjunto de Produtos:**
```bash
curl -F 'canvas_product_set={ 
  "product_set_id": "<PRODUCT_SET_ID>", 
  "show_in_feed": true 
}' \
  https://graph.facebook.com/v24.0/<PAGE_ID>/canvas_elements
```

**Rodapé:**
```bash
curl -F 'canvas_button={ 
  "rich_text": { "plain_text": "See more" }, 
  "open_url_action": { "url": "https://site.com" } 
}' \
  https://graph.facebook.com/v24.0/<PAGE_ID>/canvas_elements
```

### 2. Criar a Experiência Instantânea
```bash
curl -F 'body_element_ids=[ <HERO_ID>, <PRODUCT_SET_ID>, <FOOTER_ID> ]' \
  -F 'is_published=true' \
  https://graph.facebook.com/v24.0/<PAGE_ID>/canvases
```

### 3. Criar o Criativo do Anúncio (Coleção)
Use o `CANVAS_ID` gerado. Se o hero for imagem, use `object_type=SHARE`. Se for vídeo, `object_type=VIDEO`.

```bash
curl -F 'name=Collection Ad Creative' \
  -F 'object_story_spec={ 
    "link_data": { 
      "link": "https://fb.com/canvas_doc/<CANVAS_ID>", 
      "message": "Confira nossa coleção!", 
      "name": "Título do Anúncio" 
    }, 
    "page_id": "<PAGE_ID>" 
  }' \
  -F 'object_type=SHARE' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

## Públicos de Engajamento
Crie públicos de pessoas que abriram ou clicaram na coleção.
- **Abriram:** `event_name: "instant_shopping_document_open"`
- **Clicaram:** `event_name: "instant_shopping_element_click"`
