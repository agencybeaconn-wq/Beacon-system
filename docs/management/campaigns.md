# Campanhas de Anúncio (Ad Campaigns)

Gerenciamento de campanhas (`Campaign`) na conta de anúncios.

## Notas Importantes
*   **Marketing API v15.0+ (Set 2022):** Não é mais permitido criar campanhas de otimização de conversão incremental.
*   **Marketing API v15.0+:** Não é mais permitido criar Públicos de Anúncio Especial (Special Ad Audiences).
*   **Marketing API 3.0 (Maio 2018):** Campos `kpi_custom_conversion_id`, `kpi_type` e `kpi_results` foram removidos.

## Leitura
Retorna as campanhas sob esta conta de anúncios. Se nenhum filtro for aplicado, retorna apenas campanhas não arquivadas e não deletadas.

**Endpoint:** `GET /act_{ad_account_id}/campaigns`

### Parâmetros de Filtro
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `effective_status` | list<enum> | Filtra por status efetivo (ex: `ACTIVE`, `PAUSED`, `ARCHIVED`). Padrão: `ACTIVE`, `PAUSED`. |
| `is_completed` | boolean | Se `true`, retorna campanhas concluídas. |
| `date_preset` | enum | Predefinição de intervalo de datas para métricas de insights. |
| `time_range` | object | Intervalo de datas personalizado (`since`, `until`). |

### Campos Retornados
A resposta contém uma lista de nós `Campaign`.
*   `insights`: Resumo analítico (se solicitado via `summary=insights`).
*   `total_count`: Contagem total de objetos.

### Resposta
```json
{
    "data": [
        {
            "id": "123456789",
            "name": "My Campaign",
            "objective": "OUTCOME_TRAFFIC"
        }
    ],
    "paging": {},
    "summary": {}
}
```

## Criação
Cria uma nova campanha na conta de anúncios.

**Endpoint:** `POST /act_{ad_account_id}/campaigns`

### Parâmetros Principais
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome da campanha. | Sim |
| `objective` | enum | Objetivo da campanha (ex: `OUTCOME_TRAFFIC`, `OUTCOME_SALES`). | Sim |
| `special_ad_categories` | array<enum> | Categorias de anúncio especial (ex: `HOUSING`, `CREDIT`, `NONE`). | Sim |
| `status` | enum | Status inicial (`ACTIVE`, `PAUSED`). | Não |
| `daily_budget` | int64 | Orçamento diário (nível da campanha). | Não |
| `lifetime_budget` | int64 | Orçamento vitalício (nível da campanha). | Não |
| `bid_strategy` | enum | Estratégia de lances (ex: `LOWEST_COST_WITHOUT_CAP`, `COST_CAP`). | Não |
| `buying_type` | string | Tipo de compra (`AUCTION`, `RESERVED`). Padrão: `AUCTION`. | Não |
| `spend_cap` | int64 | Limite de gastos da campanha. | Não |
| `promoted_object` | Object | Objeto promovido (obrigatório para campanhas iOS 14+ app promotion). | Condicional |

### Exemplo de Criação
```bash
curl -X POST \
  -F "name=My Campaign" \
  -F "objective=OUTCOME_TRAFFIC" \
  -F "status=PAUSED" \
  -F "special_ad_categories=[]" \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns"
```

## Exclusão (Dissociação)
Remove ou dissocia campanhas da conta de anúncios.

**Endpoint:** `DELETE /act_{ad_account_id}/campaigns`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `delete_strategy` | enum | Estratégia de exclusão (`DELETE_ANY`, `DELETE_OLDEST`, `DELETE_ARCHIVED_BEFORE`). | Sim |
| `before_date` | datetime | Data limite para exclusão (usado com `DELETE_ARCHIVED_BEFORE`). | Não |
| `object_count` | integer | Quantidade de objetos a excluir. | Não |

### Retorno
```json
{
    "objects_left_to_delete_count": 0,
    "deleted_object_ids": ["123", "456"]
}
```

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **613** | Limite de taxa excedido. |
| **2635** | Versão da API depreciada. |
| **3018** | Data de início além do limite de 37 meses. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
