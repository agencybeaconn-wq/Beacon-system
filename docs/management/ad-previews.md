# Prévias de Anúncios (Ad Previews)

Gera prévias visuais de anúncios ou criativos em diferentes formatos (Feed Desktop, Mobile, Instagram, etc.).

## Visão Geral
As prévias são retornadas como strings HTML (geralmente contendo um `<iframe>`) que renderizam a aparência do anúncio.

Existem três formas principais de gerar prévias:
1.  **Por ID do Anúncio:** Para anúncios já existentes.
2.  **Por ID do Criativo:** Para criativos já existentes.
3.  **Por Especificação (Ad Hoc):** Passando a especificação do criativo (`object_story_spec`) diretamente, sem criar o objeto na conta.

## Endpoints

### 1. Prévia de Anúncio Existente
**Endpoint:** `GET /v24.0/{ad_id}/previews`

| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `ad_format` | enum | Formato da prévia (ex: `DESKTOP_FEED_STANDARD`, `INSTAGRAM_EXPLORE_GRID_HOME`). |

### 2. Prévia de Criativo Existente
**Endpoint:** `GET /v24.0/{creative_id}/previews`

| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `ad_format` | enum | Formato da prévia. |

### 3. Gerar Prévia (Ad Hoc)
**Endpoint:** `GET /v24.0/act_{ad_account_id}/generatepreviews`
**Endpoint:** `GET /v24.0/generatepreviews` (sem conta associada)

| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `creative` | JSON/String | Especificação do criativo (`object_story_spec`) ou ID do criativo (`{"object_story_id": "..."}`). |
| `ad_format` | enum | Formato da prévia. |

## Formatos de Anúncio (`ad_format`)
Alguns formatos comuns incluem:
*   `DESKTOP_FEED_STANDARD`
*   `MOBILE_FEED_STANDARD`
*   `RIGHT_COLUMN_STANDARD`
*   `INSTAGRAM_STANDARD`
*   `INSTAGRAM_STORY`
*   `INSTAGRAM_EXPLORE_GRID_HOME`
*   `INSTAGRAM_SEARCH_CHAIN`
*   `AUDIENCE_NETWORK_OUTSTREAM_VIDEO`
*   (Consulte a documentação oficial para a lista completa e atualizada)

## Exemplos

### Gerar prévia com `object_story_spec` (Link Ad)
```bash
curl -G \
  --data-urlencode 'creative={
    "object_story_spec": {
      "link_data": {
        "call_to_action": {"type":"SIGN_UP","value":{"link":"<URL>"}},
        "description": "Descrição do Link",
        "link": "<URL>",
        "message": "Texto do Post",
        "name": "Título do Link"
      },
      "page_id": "<PAGE_ID>"
    }
  }' \
  -d 'ad_format=DESKTOP_FEED_STANDARD' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/generatepreviews
```

### Gerar prévia de App Ad
```bash
curl -G \
  --data-urlencode 'creative={
    "object_story_spec": {
      "link_data": {
        "call_to_action": {"type":"USE_APP","value":{"link":"<URL>"}},
        "message": "Instale agora!",
        "picture": "<IMAGE_URL>"
      },
      "page_id": "<PAGE_ID>"
    }
  }' \
  -d 'ad_format=MOBILE_FEED_STANDARD' \
  ...
```

### Prévia do Instagram Explore
```bash
curl -G \
  -d 'ad_format=INSTAGRAM_EXPLORE_GRID_HOME' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/<AD_ID>/previews
```

## Resposta
A resposta contém uma lista com o corpo HTML da prévia.

```json
{
  "data": [
    {
      "body": "<iframe src=\"https://www.facebook.com/ads/api/preview_iframe.php?...\" ...></iframe>"
    }
  ]
}
```

## Notas Importantes
*   **Visibilidade:** Prévias geradas via `/generatepreviews` são públicas (visíveis para qualquer pessoa com o link). Prévias de contas (`/act_...`) requerem permissão na conta.
*   **Token:** Use um User Access Token (não Page Token) para visualizar as prévias.
*   **Anúncios de Catálogo (Advantage+):** Use `product_item_ids` junto com `object_story_spec`.
