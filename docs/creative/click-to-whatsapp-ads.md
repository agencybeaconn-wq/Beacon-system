# Anúncios de Clique para o WhatsApp

Direcione usuários para conversas no WhatsApp.

## 1. Campanha
- **Objetivos Suportados:** `OUTCOME_ENGAGEMENT` (recomendado), `OUTCOME_TRAFFIC`, `OUTCOME_LEADS`, `OUTCOME_SALES`.
- **Nota:** Para campanhas de "Chamada" (Call), use `OUTCOME_ENGAGEMENT`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Click to WhatsApp Campaign' \
  -F 'objective=OUTCOME_ENGAGEMENT' \
  -F 'status=PAUSED' \
  -F 'special_ad_categories=[]' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Conjunto de Anúncios
- **Destination Type:** `WHATSAPP`.
- **Billing Event:** `IMPRESSIONS`.
- **Promoted Object:** Deve incluir `page_id`. Opcionalmente `whatsapp_phone_number`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'destination_type=WHATSAPP' \
  -F 'optimization_goal=IMPRESSIONS' \
  -F 'promoted_object={"page_id": "<PAGE_ID>"}' \
  ...
```

## 3. Criativo do Anúncio
Requer CTA `WHATSAPP_MESSAGE`.

### Configuração Básica
```json
"call_to_action": {
  "type": "WHATSAPP_MESSAGE",
  "value": {
    "app_destination": "WHATSAPP"
  }
}
```

### Mensagem de Boas-Vindas (Autofill & CTAs)
Personalize a mensagem que aparece no WhatsApp do usuário.

#### Exemplo: Saudação com Botão de Site
```json
"page_welcome_message": {
  "type": "VISUAL_EDITOR",
  "version": 2,
  "landing_screen_type": "welcome_message",
  "media_type": "text",
  "text_format": {
    "customer_action_type": "autofill_message",
    "message": {
      "text": "Olá! Veja nosso site:",
      "automated_greeting_message_cta": {
        "type": "url",
        "url": "https://www.exemplo.com"
      },
      "autofill_message": {
        "content": "Gostaria de saber mais."
      }
    }
  }
}
```
*Outros tipos de CTA:* `call` (Ligar), `catalog` (Ver Catálogo), `flow` (WhatsApp Flows).

### WhatsApp Flows
Integre fluxos interativos (formulários, agendamento).
- Requer WhatsApp Flows v5.1+.
- Fluxo deve ser estático e de tela única.

```json
"automated_greeting_message_cta": {
  "type": "flow",
  "flow_data": {
    "call_to_action": "Inscreva-se",
    "flow_id": "<FLOW_ID>"
  }
}
```

### Exemplo Completo (Imagem)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Click to WhatsApp Creative' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "link_data": {
         "message": "Fale conosco no Zap!",
         "image_hash": "<IMAGE_HASH>",
         "call_to_action": {
           "type": "WHATSAPP_MESSAGE",
           "value": { "app_destination": "WHATSAPP" }
         },
         "page_welcome_message": { ... }
       }
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```
