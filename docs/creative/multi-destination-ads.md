# Anúncios de Clique com Vários Destinos (Multi-Destination)

Direcione usuários para o canal de mensagem preferido (Messenger, Instagram ou WhatsApp) em um único anúncio. O algoritmo entrega o destino mais provável de conversão.

## 1. Campanha
- **Objetivos:** `OUTCOME_ENGAGEMENT`, `OUTCOME_SALES`, `OUTCOME_TRAFFIC`.
- **Categorias Especiais:** Não suportadas (use `[]`).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Multi Destination Campaign' \
  -F 'objective=OUTCOME_ENGAGEMENT' \
  -F 'status=ACTIVE' \
  -F 'special_ad_categories=[]' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Conjunto de Anúncios
- **Optimization Goal:** `CONVERSATIONS`.
- **Billing Event:** `IMPRESSIONS`.
- **Destination Type:** Escolha a combinação desejada:
  - `MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP` (Todos)
  - `MESSAGING_INSTAGRAM_DIRECT_MESSENGER` (IG + Messenger)
  - `MESSAGING_MESSENGER_WHATSAPP` (Messenger + WhatsApp)
  - `MESSAGING_INSTAGRAM_DIRECT_WHATSAPP` (IG + WhatsApp)

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'destination_type=MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP' \
  -F 'optimization_goal=CONVERSATIONS' \
  -F 'promoted_object={"page_id": "<PAGE_ID>"}' \
  ...
```

## 3. Criativo do Anúncio
Use `asset_feed_spec` para definir os múltiplos destinos.

### Estrutura do `asset_feed_spec`
- **optimization_type:** `DOF_MESSAGING_DESTINATION`
- **call_to_actions:** Lista com os destinos correspondentes ao Ad Set.

```json
"asset_feed_spec": {
  "optimization_type": "DOF_MESSAGING_DESTINATION",
  "call_to_actions": [
    {
      "type": "MESSAGE_PAGE",
      "value": { "app_destination": "MESSENGER", "link": "https://fb.com/messenger_doc/" }
    },
    {
      "type": "WHATSAPP_MESSAGE",
      "value": { "app_destination": "WHATSAPP", "link": "https://api.whatsapp.com/send" }
    },
    {
      "type": "INSTAGRAM_MESSAGE",
      "value": { "app_destination": "INSTAGRAM_DIRECT", "link": "https://www.instagram.com" }
    }
  ]
}
```

### Exemplo de Criação
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Multi Dest Creative' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "instagram_user_id": "<IG_USER_ID>",
       "link_data": {
         "message": "Fale conosco onde preferir!",
         "image_hash": "<HASH>",
         "call_to_action": { "type": "MESSAGE_PAGE", "value": { "app_destination": "MESSENGER" } } 
       }
     }' \
  -F 'asset_feed_spec={...}' \
  -F 'degrees_of_freedom_spec={ "creative_features_spec": { "standard_enhancements": { "enroll_status": "OPT_IN" } } }' \
  -F 'access_token=<ACCESS_TOKEN>'
```
*Nota: O `call_to_action` dentro de `link_data` serve como fallback, mas o `asset_feed_spec` controla a otimização de destinos.*
