# Especificação de Avaliação de Regras de Anúncios (`evaluation_spec`)

A `evaluation_spec` define **quais objetos** a regra deve avaliar e **quais condições** devem ser atendidas para que a ação seja executada.

## Tipos de Avaliação (`evaluation_type`)
- **`SCHEDULE`**: Para regras baseadas em cronograma (verificações periódicas).
- **`TRIGGER`**: Para regras baseadas em gatilho (tempo real). Requer um campo `trigger`.

## Filtros (`filters`)
Lista de objetos de filtro combinados com lógica **AND**.

### Estrutura do Filtro
```json
{
  "field": "spent",
  "value": 1000,
  "operator": "GREATER_THAN"
}
```

### Operadores Lógicos
- Numéricos: `GREATER_THAN`, `LESS_THAN`, `EQUAL`, `NOT_EQUAL`, `IN_RANGE`, `NOT_IN_RANGE`
- Listas: `IN`, `NOT_IN`, `ANY`, `ALL`, `NONE`
- String: `CONTAIN`, `NOT_CONTAIN`

## Filtros Especiais

### `time_preset`
Define o período de agregação das métricas.
- **Operador:** `EQUAL`
- **Valores Comuns:** `TODAY`, `LIFETIME`, `LAST_3_DAYS`, `LAST_7_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`.
- **Nota:** Regras `TRIGGER` suportam apenas presets que incluem `TODAY`.

### `attribution_window`
Define a janela de atribuição.
- **Valor:** `ACCOUNT_DEFAULT` (único valor permitido).

## Filtros de Metadados
Filtram objetos pelo seu estado ou propriedades. Suportam filtragem multinível (ex: `campaign.objective`).

### Compatíveis com SCHEDULE e TRIGGER
- **Identificação:** `id`, `entity_type` (AD, ADSET, CAMPAIGN), `name`, `adlabel_ids`.
- **Configuração:** `objective`, `buying_type`, `billing_event`, `optimization_goal`.
- **Orçamento/Lance:** `daily_budget`, `lifetime_budget`, `spend_cap`, `bid_amount`.
- **Tempo:** `start_time`, `stop_time`, `created_time`, `updated_time`.

### Compatíveis Apenas com SCHEDULE
- **Status/Entrega:** `effective_status`, `active_time`.
- **Posicionamento:** `placement.page_types`.
- **Métricas Derivadas:** `hours_since_creation`, `estimated_budget_spending_percentage`, `audience_reached_percentage`.

## Filtros de Insights (Métricas)
Filtram com base em dados de desempenho retornados pela API de Insights.

### Métricas Comuns (Compatíveis com TRIGGER)
- `impressions`, `clicks`, `spent`, `results`.
- `cpc`, `cpm`, `ctr`, `cpa`, `cpp`.
- `reach`, `frequency`.
- Eventos de Pixel/App: `offsite_conversion.fb_pixel_purchase`, `mobile_app_install`, `cost_per_purchase_fb`.

### Métricas NÃO Compatíveis com TRIGGER (Apenas SCHEDULE)
- `offline_conversion` (e derivados).
- `lifetime_impressions`, `lifetime_spent`.
- `today_spent`, `yesterday_spent`.

## Filtros Avançados (Aliases)
Apenas para regras `SCHEDULE`.
- **`daily_ratio_spent`**: `today_spent / adset.daily_budget`
- **`lifetime_ratio_spent`**: `lifetime_spent / adset.lifetime_budget`
