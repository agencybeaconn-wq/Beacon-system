# Posts Promovidos (Boosting)

Use posts orgânicos do Instagram ou Facebook como criativos de anúncios.

## Posts do Instagram
Use `source_instagram_media_id` para promover um post existente (Feed, Stories, Reels).

### 1. Verificar Elegibilidade
Verifique se o post pode ser impulsionado.
```bash
curl -G \
  -d "fields=boost_eligibility_info" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/<IG_MEDIA_ID>"
```

### 2. Criar Criativo com Post do Instagram
```bash
curl -X POST \
  -F 'object_id=<PAGE_ID>' \
  -F 'instagram_user_id=<IG_USER_ID>' \
  -F 'source_instagram_media_id=<IG_MEDIA_ID>' \
  -F 'call_to_action={"type":"LEARN_MORE","value":{"link":"<LINK>"}}' \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives"
```

## Posts do Facebook
Use `object_story_id` para promover um post da Página no Instagram.

### 1. Verificar Elegibilidade
```bash
curl -G \
  -d "fields=is_instagram_eligible" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/<POST_ID>"
```

### 2. Criar Criativo com Post do Facebook
```bash
curl -X POST \
  -F 'object_story_id=<PAGE_ID>_<POST_ID>' \
  -F 'instagram_user_id=<IG_USER_ID>' \
  -F 'call_to_action={"type":"MESSAGE_PAGE","value":{"app_destination":"MESSENGER"}}' \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives"
```

## Chamadas para Ação (CTA) Específicas
- **Direct do Instagram:** `app_destination: "INSTAGRAM_DIRECT"`, `type: "MESSAGE_PAGE"`.
- **Messenger:** `app_destination: "MESSENGER"`, `type: "MESSAGE_PAGE"`.
