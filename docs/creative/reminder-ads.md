# Anúncios com Lembrete (Instagram)

Crie anúncios que permitem aos usuários definir lembretes para eventos futuros.

## Pré-requisitos
- Evento criado via Upcoming Event Management API ou Gerenciador de Anúncios.
- Permissão `ads_management`.

## 1. Campanha
- **Objetivo:** `OUTCOME_ENGAGEMENT` (recomendado), `OUTCOME_AWARENESS`, ou `OUTCOME_SALES`.
- **Nota:** Nem todos os objetivos são compatíveis.

## 2. Conjunto de Anúncios
- **Destination Type:** `ON_REMINDER`.
- **Optimization Goal:** `REMINDERS_SET` (ou `THRUPLAY`, `REACH`, `OFFSITE_CONVERSIONS` dependendo do objetivo).
- **Posicionamentos:** `stream`, `story`, `reels`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'destination_type=ON_REMINDER' \
  -F 'optimization_goal=REMINDERS_SET' \
  ...
```

## 3. Criativo com Evento
Use `asset_feed_spec` para vincular o `upcoming_events`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'object_story_spec={
      "page_id": "<PAGE_ID>",
      "instagram_user_id": "<IG_USER_ID>",
      "link_data": {
          "call_to_action": { "type": "LEARN_MORE" },
          "image_hash": "<IMAGE_HASH>",
          "link": "https://fb.com/" 
      }
  }' \
  -F 'asset_feed_spec={
      "upcoming_events": [
          {
              "event_id": <EVENT_ID>,
              "event_title": "Season Premiere",
              "start_time": "2024-05-11T16:00:00+0000"
          }
      ]
  }' \
  ...
```
**Nota:** Use `https://fb.com/` como link falso se não quiser um link externo visível.
