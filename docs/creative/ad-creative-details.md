# Detalhes do Criativo do Anúncio e Prévias

Um criativo do anúncio contém todos os dados necessários para renderizar visualmente o anúncio.

## Criar um Criativo (Exemplo: Post Promovido)

Para promover um post existente da Página, use `object_story_id`.

**Solicitação:**
```bash
curl -X POST \
  -F 'name="Sample Promoted Post"' \
  -F 'object_story_id="<PAGE_ID>_<POST_ID>"' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

**Resposta:** Retorna o `creative_id` necessário para criar o anúncio.

## Posicionamentos (Placements)

Um posicionamento é onde o anúncio aparece (Feed, Stories, Coluna da Direita, etc).

- **Recomendação:** Deixe em branco para "Posicionamentos Automáticos" (Meta otimiza para o menor custo).
- **Especificar:** Use `targeting` no Conjunto de Anúncios para filtrar `publisher_platforms` (facebook, instagram, audience_network).

## Ver Prévia de um Anúncio (`generatepreviews`)

Gere um iFrame de prévia para visualizar como o anúncio ficará em diferentes formatos.

**Endpoint:** `GET /act_<AD_ACCOUNT_ID>/generatepreviews`

**Parâmetros:**
- `creative`: Especificação do criativo (JSON) ou ID.
- `ad_format`: Formato desejado (ex: `DESKTOP_FEED_STANDARD`, `RIGHT_COLUMN_STANDARD`, `MOBILE_FEED_STANDARD`).

**Exemplo (Feed Desktop):**
```bash
curl -G \
  -d 'creative={"object_story_id":"<PAGE_ID>_<POST_ID>"}' \
  -d 'ad_format=DESKTOP_FEED_STANDARD' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/generatepreviews
```

**Resposta:** Um iFrame HTML válido por 24 horas.
