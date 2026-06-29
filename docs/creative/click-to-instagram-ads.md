# Anúncios de Clique para o Instagram (Instagram Direct)

Direcione usuários para conversas no Instagram Direct.

## 1. Campanha
- **Objetivos Suportados:** `OUTCOME_ENGAGEMENT`, `OUTCOME_SALES`, `OUTCOME_TRAFFIC`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Click to Instagram Campaign' \
  -F 'objective=OUTCOME_ENGAGEMENT' \
  -F 'status=PAUSED' \
  -F 'special_ad_categories=[]' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Conjunto de Anúncios
- **Destination Type:** `INSTAGRAM_DIRECT`.
- **Optimization Goal:** `CONVERSATIONS` (ou `LINK_CLICKS`, `IMPRESSIONS`, etc., dependendo do objetivo).
- **Billing Event:** `IMPRESSIONS`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'destination_type=INSTAGRAM_DIRECT' \
  -F 'optimization_goal=CONVERSATIONS' \
  -F 'promoted_object={"page_id": "<PAGE_ID>"}' \
  ...
```

## 3. Criativo do Anúncio
Requer `instagram_user_id` e uma CTA específica.

> **Nota:** Use `instagram_user_id` em vez de `instagram_actor_id` (depreciado na v24.0).

### Configuração da CTA
```json
"call_to_action": {
  "type": "INSTAGRAM_MESSAGE",
  "value": {
    "app_destination": "INSTAGRAM_DIRECT"
  }
}
```

### Mensagem de Boas-Vindas (Ice Breakers)
Personalize a experiência inicial.
```json
"page_welcome_message": {
  "type": "VISUAL_EDITOR",
  "version": 2,
  "landing_screen_type": "welcome_message",
  "media_type": "text",
  "text_format": {
    "customer_action_type": "ice_breakers",
    "message": {
      "text": "Olá! Como podemos ajudar?",
      "ice_breakers": [
        { "title": "Ver catálogo", "response": "Aqui está..." },
        { "title": "Falar com suporte", "response": "Um momento..." }
      ]
    }
  }
}
```

### Exemplo Completo (Imagem)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Click to IG Direct Creative' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "instagram_user_id": "<IG_USER_ID>",
       "link_data": {
         "message": "Fale conosco no Direct!",
         "image_hash": "<IMAGE_HASH>",
         "call_to_action": {
           "type": "INSTAGRAM_MESSAGE",
           "value": { "app_destination": "INSTAGRAM_DIRECT" }
         },
         "page_welcome_message": { ... }
       }
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 4. Usando Posts Existentes
Você pode usar posts do Instagram ou Facebook como anúncios de clique para o Direct.
- **Instagram Post:** Use `source_instagram_media_id`.
- **Facebook Post:** Use `object_story_id`.

Em ambos os casos, certifique-se de definir a `call_to_action` como `INSTAGRAM_MESSAGE`.
