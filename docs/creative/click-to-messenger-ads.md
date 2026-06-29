# Anúncios de Clique para o Messenger

Direcione usuários para iniciar conversas no Messenger.

## 1. Campanha
- **Objetivo:** `OUTCOME_TRAFFIC` (Tráfego) ou `OUTCOME_LEADS` (Leads).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -d '{
    "name": "Messenger Campaign",
    "objective": "OUTCOME_TRAFFIC",
    "special_ad_categories": ["NONE"],
    "status": "PAUSED"
  }'
```

## 2. Conjunto de Anúncios
- **Destination Type:** `MESSENGER`.
- **Optimization Goal:** `CONVERSATIONS`, `IMPRESSIONS`, `LEAD_GENERATION` (para leads).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'destination_type=MESSENGER' \
  -F 'optimization_goal=CONVERSATIONS' \
  -F 'billing_event=IMPRESSIONS' \
  ...
```

## 3. Criativo do Anúncio
Configure a mensagem de boas-vindas (`page_welcome_message`) ou conecte um fluxo de leads.

### Imagem com Mensagem de Boas-Vindas (Ice Breakers)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -d '{
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "link_data": {
        "link": "<IMAGE_URL>",
        "image_hash": "<HASH>",
        "call_to_action": { "type": "LEARN_MORE", "value": { "app_destination": "MESSENGER" } },
        "page_welcome_message": {
          "text_format": {
            "message": {
              "text": "Olá! Como podemos ajudar?",
              "ice_breakers": [
                { "title": "Ver preços", "response": "Nossos preços começam em..." },
                { "title": "Falar com atendente", "response": "Um momento..." }
              ]
            }
          }
        }
      }
    }
  }'
```

### Geração de Leads (Messenger Lead Gen)
Use um template de formulário existente (`ctm_lead_gen_template_id`).
*Nota: A criação de templates via API está sendo descontinuada na v24.0, use o Gerenciador de Anúncios para criar e pegue o ID.*

```json
"page_welcome_message": {
  "ctm_lead_gen_template_id": "<TEMPLATE_ID>"
}
```

### Clique para Assinar (Marketing Messages)
Convide o usuário para receber mensagens recorrentes.
```json
"page_welcome_message": {
  "landing_screen_type": "marketing_messages",
  "image_format": {
    "message": {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "notification_messages",
          "elements": [{
            "title": "Receba ofertas diárias",
            "buttons": [{ "type": "postback", "title": "Receber mensagens", "payload": "OPT_IN" }]
          }]
        }
      }
    }
  }
}
```

## 4. Extensões de Produto
Exiba produtos abaixo do anúncio (Advantage+).
- Requer catálogo conectado.
- Adicione `product_extensions: { enroll_status: "OPT_IN" }` em `degrees_of_freedom_spec`.
