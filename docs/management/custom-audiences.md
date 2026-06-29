# Públicos Personalizados (Custom Audiences)

Gerenciamento de Públicos Personalizados (`CustomAudience`) na conta de anúncios.

## Leitura
Recupera os públicos personalizados associados à conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/customaudiences`

### Parâmetros de Filtro
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `fields` | list<string> | Campos a serem retornados. Padrão: apenas IDs. |
| `filtering` | list<Filter> | Filtros para os dados retornados. |
| `pixel_id` | numeric string | Filtra públicos associados a um pixel específico. |
| `business_id` | numeric string | Auxilia em filtros como "recentemente usados". |
| `fetch_primary_audience` | boolean | Se `true`, busca o público primário. |

### Campos Retornados
A resposta contém uma lista de nós `CustomAudience`.

### Resposta
```json
{
    "data": [
        {
            "id": "123456789",
            "name": "My Custom Audience"
        }
    ],
    "paging": {}
}
```

## Criação
Cria um novo público personalizado.

**Endpoint:** `POST /act_{ad_account_id}/customaudiences`

### Limites
*   Máximo de 500 públicos personalizados do tipo `CUSTOM`.
*   Máximo de 10.000 públicos semelhantes (`LOOKALIKE`).

### Parâmetros Principais
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do público personalizado. | Sim |
| `subtype` | enum | Tipo do público (ex: `CUSTOM`, `WEBSITE`, `APP`, `LOOKALIKE`). | Sim |
| `description` | string | Descrição do público. | Não |
| `customer_file_source` | enum | Origem dos dados (ex: `USER_PROVIDED_ONLY`). | Condicional |
| `pixel_id` | numeric string | Pixel associado (para públicos de site). | Condicional |
| `rule` | string | Regra de inclusão (JSON string). | Condicional |
| `retention_days` | int64 | Dias de retenção (1-180). Padrão: indefinido. | Não |
| `lookalike_spec` | JSON | Especificação para público semelhante. | Condicional |
| `origin_audience_id` | numeric string | ID do público de origem (para Lookalike). | Condicional |

### Exemplo de Criação
```bash
curl -X POST \
  -F "name=My new Custom Audience" \
  -F "subtype=CUSTOM" \
  -F "description=People who purchased" \
  -F "customer_file_source=USER_PROVIDED_ONLY" \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences"
```

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **2654** | Falha ao criar público personalizado. |
| **2663/2664** | Termos de serviço não aceitos. |
| **80003** | Limite de taxa excedido para Custom Audience. |
