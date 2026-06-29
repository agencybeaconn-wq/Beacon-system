# Anúncios (Ads)

Gerenciamento de anúncios individuais (`Ad`) dentro de uma conta de anúncios. O anúncio é o nível final da estrutura, onde o criativo é associado ao conjunto de anúncios.

## Leitura
Recupera uma lista de anúncios da conta.

**Endpoint:** `GET /act_{ad_account_id}/ads`

### Parâmetros de Filtro e Insights
*   `effective_status`: Filtrar por status efetivo (ex: `["ACTIVE", "PAUSED"]`).
*   `date_preset`: Predefinição de data para métricas de insights (ex: `last_30d`, `this_month`).
*   `time_range`: Intervalo de datas personalizado (`{'since':'YYYY-MM-DD','until':'YYYY-MM-DD'}`).
*   `updated_since`: Timestamp Unix para buscar anúncios atualizados após essa data.

### Resposta
Retorna uma lista de nós `Ad`.
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 100
    }
}
```

## Criação
Cria um novo anúncio.

**Endpoint:** `POST /act_{ad_account_id}/ads`

### Parâmetros Obrigatórios
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `name` | string | Nome do anúncio. |
| `adset_id` | string | ID do conjunto de anúncios pai. |
| `creative` | object | ID ou especificação do criativo (`{"creative_id": "..."}`). |
| `status` | enum | Status inicial (`ACTIVE`, `PAUSED`). |

### Parâmetros Opcionais
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `ad_schedule_start_time` | datetime | Hora de início específica do anúncio (apenas campanhas de vendas/app). |
| `ad_schedule_end_time` | datetime | Hora de término específica do anúncio. |
| `adlabels` | list | Rótulos associados ao anúncio. |
| `conversion_domain` | string | Domínio de conversão (para Pixel). |
| `display_sequence` | int | Sequência de exibição dentro da campanha. |
| `tracking_specs` | object | Especificações de rastreamento (pixels, eventos). |
| `execution_options` | list | Opções como `validate_only` (para testar sem criar). |

### Exemplo de Requisição
```bash
curl -X POST \
  -F "name=My Ad" \
  -F "adset_id=<AD_SET_ID>" \
  -F "creative={'creative_id':'<CREATIVE_ID>'}" \
  -F "status=PAUSED" \
  -F "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads"
```

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **194** | Falta parâmetro obrigatório. |
| **500** | Conteúdo banido. |
| **613** | Limite de taxa excedido. |
| **3018** | Intervalo de datas inválido (máximo 37 meses). |
