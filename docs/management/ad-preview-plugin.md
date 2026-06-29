# Plugin de Prévia do Anúncio (Ad Preview Plugin)

O plugin de prévia do anúncio permite que anunciantes visualizem como seus anúncios aparecerão diretamente em seus próprios sites ou ferramentas, incorporando a prévia via HTML5 (Social Plugin) ou gerando-a via Graph API.

## Visão Geral
Permite gerar prévias para:
*   Coluna da direita (`RIGHT_COLUMN_STANDARD`)
*   Feed Desktop (`DESKTOP_FEED_STANDARD`)
*   Feed Mobile (`MOBILE_FEED_STANDARD`)
*   Stories (`FACEBOOK_STORY_MOBILE`)

**Requisitos:**
*   Login do Facebook (para autenticação).
*   Permissões de acesso ao objeto especificado (`creative_id`, `adgroup_id` ou `ad_account_id`).

## Parâmetros de Configuração
Estes parâmetros podem ser usados como atributos HTML5 (`data-*`) no plugin ou passados na chamada da API.

| Parâmetro | Atributo HTML5 | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `creative` | `data-creative` | Especificação do criativo (JSON). | Sim* |
| `creative_id` | `data-creative-id` | ID de um criativo existente. | Sim* |
| `adgroup_id` | `data-adgroup-id` | ID de um grupo de anúncios existente. | Sim* |
| `ad_format` | `data-ad-format` | Formato da prévia (ex: `DESKTOP_FEED_STANDARD`). Substitui `page_type`. | **Sim** |
| `ad_account_id` | `data-ad-account-id` | ID da conta de anúncios. Obrigatório se o criativo usar `image_hash`. | Condicional |
| `targeting` | `data-targeting` | Especificação de direcionamento (JSON). | Não |
| `post` | `data-post` | Especificação de publicação (JSON). | Não |

*\* Um dos três (`creative`, `creative_id`, `adgroup_id`) deve ser fornecido.*

## Uso via Graph API
Para gerar uma prévia compatível com o estilo do plugin via API, utilize os endpoints de geração de prévia (`/generatepreviews`) e especifique o parâmetro `ad_format` com um dos valores suportados pelo plugin.

Exemplo:
```bash
curl -G \
  -d 'creative_id=<CREATIVE_ID>' \
  -d 'ad_format=DESKTOP_FEED_STANDARD' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/generatepreviews
```
