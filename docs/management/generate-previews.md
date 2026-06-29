# Gerar Prévias de Anúncios (Generate Previews)

Gera prévias de anúncios para uma especificação de criativo (`creative spec`).

## Visão Geral
A API retorna um iframe contendo a prévia do anúncio, válido por 24 horas.
Ao usar um Page Post que linka para um app na Google Play Store ou Apple App Store, o Facebook sobrescreve o nome e ícone com dados da loja.

## Leitura (Geração)
Gera prévias baseadas em especificações de criativo.

**Endpoint:** `GET /act_{ad_account_id}/generatepreviews`

### Parâmetros Principais
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `creative` | AdCreative | Especificação do criativo do anúncio. | Sim |
| `ad_format` | enum | Formato do anúncio/posicionamento (ex: `MOBILE_FEED_STANDARD`, `INSTAGRAM_STANDARD`). | Sim |
| `dynamic_creative_spec` | Object | Especificação para anúncios dinâmicos. | Não |
| `post` | Object | Especificações para um post de página (usado quando `creative` tem apenas `object_id`). | Não |
| `height` | int64 | Altura do iframe (recomendado: 280+). | Não |
| `width` | int64 | Largura do iframe (recomendado: 280+). | Não |

### Formatos de Anúncio Suportados (`ad_format`)
Uma lista extensa de formatos é suportada, incluindo:
*   **Facebook:** `DESKTOP_FEED_STANDARD`, `MOBILE_FEED_STANDARD`, `RIGHT_COLUMN_STANDARD`, `FACEBOOK_REELS_MOBILE`, `FACEBOOK_STORY_MOBILE`.
*   **Instagram:** `INSTAGRAM_STANDARD` (Feed), `INSTAGRAM_STORY`, `INSTAGRAM_REELS`, `INSTAGRAM_EXPLORE_GRID_HOME`.
*   **Audience Network:** `AUDIENCE_NETWORK_INSTREAM_VIDEO`, `AUDIENCE_NETWORK_REWARDED_VIDEO`.
*   **Messenger:** `MESSENGER_MOBILE_INBOX_MEDIA`.

### Combinações Específicas (Criativo + Formato)
*   **Link ad (sem página):** `RIGHT_COLUMN_STANDARD`
*   **Page like ad:** `RIGHT_COLUMN_STANDARD`, `DESKTOP_FEED_STANDARD`, `MOBILE_FEED_STANDARD`
*   **Event ad:** `RIGHT_COLUMN_STANDARD`
*   **Page post ad:** `RIGHT_COLUMN_STANDARD`, `DESKTOP_FEED_STANDARD`, `MOBILE_FEED_STANDARD`, `INSTAGRAM_STANDARD`
*   **App ad:** `MOBILE_FEED_STANDARD`, `INSTAGRAM_STANDARD`, `MOBILE_BANNER`

### Exemplo de Uso
```javascript
FB.api(
    "/act_<AD_ACCOUNT_ID>/generatepreviews",
    {
        "creative": "<CREATIVE_SPEC>",
        "ad_format": "MOBILE_FEED_STANDARD"
    },
    function (response) {
        if (response && !response.error) {
            console.log(response);
        }
    }
);
```

### Campos Retornados
A resposta contém uma lista de nós `AdPreview`.

### Resposta
```json
{
    "data": [
        {
            "body": "<iframe ...></iframe>"
        }
    ],
    "paging": {}
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado (este endpoint é apenas para leitura/geração).
*   **Atualização:** Não suportado.
*   **Exclusão:** Não suportado.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **194** | Falta parâmetro obrigatório. |
| **200** | Erro de permissão. |
| **1500** | URL fornecida inválida. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
