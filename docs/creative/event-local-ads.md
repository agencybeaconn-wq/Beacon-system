# Anúncios de Eventos e Locais

Promova eventos ou negócios locais com objetivos específicos.

## Anúncios de Evento

### 1. Respostas ao Evento (Event Responses)
- **Objetivo:** `EVENT_RESPONSES`.
- **Optimization Goal:** `EVENT_RESPONSES`.
- **Criativo:** `object_type=EVENT`, `link_data` com `event_id`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'object_type=EVENT' \
  -F 'object_story_spec={ "page_id": "<PAGE_ID>", "link_data": { "link": "<EVENT_LINK>", "event_id": <EVENT_ID> } }' \
  ...
```

### 2. Venda de Ingressos (Cliques ou Conversões)
- **Objetivo:** `OUTCOME_TRAFFIC` ou `CONVERSIONS`.
- **CTA:** `BUY_TICKETS`.
- **Link:** URL externo de venda de ingressos.

```json
"call_to_action": {
  "type": "BUY_TICKETS",
  "value": { "link": "<TICKET_URL>" }
}
```

## Anúncios Locais (Local Awareness)

### 1. Alcance Local
- **Objetivo:** `OUTCOME_AWARENESS`.
- **Optimization Goal:** `REACH`.
- **Targeting:** Use `custom_locations` com raio (ex: 10 milhas).

```json
"geo_locations": {
  "custom_locations": [
    { "latitude": 37.48, "longitude": -122.15, "radius": 10, "distance_unit": "mile" }
  ]
}
```

### 2. CTAs Específicas
- **Como Chegar (`GET_DIRECTIONS`):** Abre mapa.
  - Link: `fbgeo:<LAT>,<LONG>,"<ADDRESS>"`
- **Ligar Agora (`CALL_NOW`):** Abre discador.
  - Link: `tel:+<COUNTRY_CODE><NUMBER>`
  - *Restrição:* Idade 18+, mesmo país.
- **Enviar Mensagem (`MESSAGE_PAGE`):** Abre Messenger.

### Exemplo de Criativo Local (Como Chegar)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "video_data": {
         "call_to_action": {
           "type": "GET_DIRECTIONS",
           "value": { "link": "fbgeo://37.48,-122.15,\"Endereço\"" }
         },
         "video_id": "<VIDEO_ID>"
       }
     }' \
  ...
```
