# Ad Creative

O objeto `AdCreative` define o layout e o conteúdo de um anúncio. Ele contém informações visuais (imagens, vídeos), textos (título, corpo), links e chamadas para ação.

## Visão Geral
*   **Limite de Retorno:** A API retorna no máximo 50.000 criativos; paginação além disso não está disponível.
*   **Anúncios Políticos/Sociais:** Exigem `authorization_category` (ex: `POLITICAL`, `POLITICAL_WITH_DIGITALLY_CREATED_MEDIA`) e `special_ad_categories` na campanha.

## Limites de Texto e Formatação
| Campo | Mínimo | Máximo (Recomendado) | Notas |
| :--- | :--- | :--- | :--- |
| Título (`title`) | 1 | 25 chars | Palavras máx 30 chars. |
| Corpo (`body`) | 1 | 90 chars | Palavras máx 30 chars. |
| URL | - | 1000 chars | |

**Restrições:**
*   Pontuação excessiva ou consecutiva (ex: `!!`, `...` permitido apenas como reticências).
*   Caracteres especiais não permitidos em Link Ads (ex: `^`, `~`, `_`, `{`, `}`).

## Leitura
Recupera detalhes de um criativo específico.

**Endpoint:** `GET /v24.0/{creative_id}`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `thumbnail_width` | int64 | Largura da thumbnail (padrão: 64). |
| `thumbnail_height` | int64 | Altura da thumbnail (padrão: 64). |

### Campos Principais
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | string | ID do criativo. |
| `name` | string | Nome do criativo na biblioteca. |
| `object_story_spec` | Object | Especificação para criar um post não publicado (Link Ad, Carousel, Video, etc.). |
| `object_story_id` | string | ID de um post existente (orgânico ou não) usado no anúncio. |
| `effective_object_story_id` | string | ID efetivo do post (mesmo se criado via `object_story_spec`). |
| `asset_feed_spec` | Object | Usado para Criativos Dinâmicos (DCO). |
| `call_to_action_type` | enum | Tipo de botão (ex: `LEARN_MORE`, `SHOP_NOW`, `SIGN_UP`). |
| `image_hash` | string | Hash da imagem na biblioteca. |
| `image_url` | string | URL da imagem (se não usar hash). |
| `video_id` | string | ID do vídeo. |
| `status` | enum | `ACTIVE`, `IN_PROCESS`, `WITH_ISSUES`, `DELETED`. |

## Criação
Cria um novo criativo na biblioteca da conta.

**Endpoint:** `POST /act_{ad_account_id}/adcreatives`

### Exemplos de Criação

#### 1. Link Ad (Post Não Publicado)
```bash
curl \
  -F 'name=Sample Creative' \
  -F 'object_story_spec={ 
    "link_data": { 
      "image_hash": "<IMAGE_HASH>", 
      "link": "<URL>", 
      "message": "Texto do anúncio",
      "call_to_action": {"type":"SIGN_UP","value":{"link":"<URL>"}}
    }, 
    "page_id": "<PAGE_ID>" 
  }' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

#### 2. Usando Post Existente
```bash
curl \
  -F 'name=Promoted Post' \
  -F 'object_story_id=<POST_ID>' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

#### 3. Carrossel
```bash
curl \
  -F 'name=Carousel Creative' \
  -F 'object_story_spec={ 
    "link_data": { 
      "child_attachments": [ 
        { "name": "Prod 1", "link": "...", "image_hash": "..." },
        { "name": "Prod 2", "link": "...", "image_hash": "..." }
      ], 
      "link": "<URL>",
      "message": "Veja nossos produtos"
    }, 
    "page_id": "<PAGE_ID>" 
  }' \
  ...
```

## Atualização
Atualiza propriedades básicas de um criativo (nome, status). **Nota:** A maioria dos campos de conteúdo (imagem, texto) não pode ser alterada após a criação; crie um novo criativo.

**Endpoint:** `POST /v24.0/{creative_id}`

| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `name` | string | Novo nome. |
| `status` | enum | Novo status. |

## Exclusão
Remove um criativo da conta.

**Endpoint:** `DELETE /v24.0/{creative_id}`

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **613** | Limite de taxa excedido. |
| **2635** | Versão da API depreciada. |
| **80004** | Muitas chamadas para esta conta. |
