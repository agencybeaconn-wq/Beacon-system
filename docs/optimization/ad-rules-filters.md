# Filtros de Especificação de Avaliação (Ad Rules Filters)

Documentação sobre filtros avançados para regras baseadas em cronograma (`SCHEDULE`), incluindo prefixos, agregação e fórmulas.

## Prefixos de Campos
Permitem filtragem multinível, especificando nível do objeto, janela de atribuição e predefinição de tempo.

**Formato:** `{object_level_prefix?} {attribution_window_prefix?} {time_preset_prefix?} {field_name}`

### 1. Prefixos de Nível de Objeto
| Prefixo | Descrição |
| :--- | :--- |
| `ad.` | Dados do nível do anúncio. |
| `adset.` | Dados do nível do conjunto de anúncios. |
| `campaign.` | Dados do nível da campanha. |

### 2. Prefixos de Janela de Atribuição
Exemplos: `1d_view`, `28d_click`, `7d_view_1d_click`, `account_default`.

### 3. Prefixos de Predefinição de Tempo
Exemplos: `today_`, `yesterday_`, `lifetime_`, `last_7_days_`.
> **Nota:** Devem ser em minúsculas e terminar com `_`.

### Exemplos de Uso
- **Bom:** `adset.yesterday_spent` (Gasto do conjunto de anúncios ontem).
- **Bom:** `campaign.lifetime_spent` (Gasto vitalício da campanha).
- **Ruim:** `lifetime_campaign.spent` (Ordem incorreta).

## Agregação (`aggregate`)
Permite somar métricas de vários objetos definidos por `aggregation_id`.

**Formato:** `aggregate({field})`

### Requisitos
- Filtro `aggregation_id` (operador `IN` com lista de IDs).
- IDs devem ser do mesmo nível.

### Exemplo
```json
{
  "field": "aggregation_id",
  "operator": "IN",
  "value": [1234, 5678]
},
{
  "field": "aggregate(reach)",
  "operator": "GREATER_THAN",
  "value": 100
}
```

## Campos de Fórmula
Permitem expressões aritméticas (`+`, `-`, `*`, `/`) entre campos e constantes.

**Limites:** Até 6 campos não constantes.

### Exemplos
- `today_spent / adset.daily_budget` (% do orçamento diário gasto).
- `today_impressions / yesterday_impressions` (Crescimento de impressões).
- `0.8 * cpc + 0.2 * cpm` (Métrica composta ponderada).

### Campos Numéricos de Metadados Suportados
- `bid_amount`
- `daily_budget`
- `lifetime_budget`
- `spend_cap`
