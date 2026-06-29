# Regras de Público (Audience Rules)

As regras de público definem critérios dinâmicos para incluir ou excluir pessoas de públicos personalizados (Site, App, Offline).

## Estrutura da Regra
Uma regra é composta por conjuntos de inclusão e exclusão, fornecidos como strings JSON.

```json
{
   "inclusions": <RULE_SET>,
   "exclusions": <RULE_SET>
}
```

### Sintaxe do Conjunto de Regras (`RULE_SET`)
```json
{
  "operator": "or", // ou "and"
  "rules": [ ... ]  // Matriz de regras de inclusão/exclusão
}
```

### Sintaxe da Regra Individual
```json
{
  "event_sources": [
    { "type": "pixel", "id": "<PIXEL_ID>" }
  ],
  "retention_seconds": 2592000, // Janela de retenção (ex: 30 dias)
  "filter": { ... },            // Definição dos filtros
  "aggregation": { ... }        // Opcional: Funções de agregação
}
```
- **`event_sources`**: Define a origem (pixel, app, store_visits).
- **`retention_seconds`**: Tempo em segundos que o usuário permanece no público (Máx: 365 dias).

## Filtros
Estrutura para filtrar eventos ou metadados.

```json
"filter": {
  "operator": "and", // ou "or"
  "filters": [
    {
      "field": "url",
      "operator": "i_contains",
      "value": "shoes"
    }
  ]
}
```

### Operadores de Comparação
| Operador | Descrição |
| :--- | :--- |
| `i_contains` / `i_not_contains` | Contém substring (case-insensitive). |
| `contains` / `not_contains` | Contém substring (case-sensitive). |
| `eq` / `neq` | Igual / Diferente. |
| `gt` / `gte` / `lt` / `lte` | Maior/Menor que (numérico). |
| `is_any` / `is_not_any` | Corresponde a qualquer valor de uma lista. |
| `starts_with` | Começa com a string. |
| `regex_match` | Expressão Regular (PCRE). |

### Campos de Dados (`field`)
- **Web:** `url`, `domain`, `path`, `event` (ex: 'ViewContent'), `device_type`.
- **Custom Data:** Qualquer parâmetro enviado no pixel (ex: `price`, `category`, `productId`).

## Agregação (`aggregation`)
Permite filtrar baseando-se na frequência ou intensidade (soma, média).

```json
"aggregation": {
  "type": "count",
  "operator": ">",
  "value": 1
}
```
- **Tipos Web:** `count`, `sum`, `avg`, `min`, `max`, `time_spent`, `last_event_time_field`.
- **Tipos App:** `count`, `sum`, `avg`, `min`, `max`.

## Exemplos

### 1. Visitantes de URLs com "shoes" (30 dias)
```json
{
    "inclusions": {
        "operator": "or",
        "rules": [
            {
                "event_sources": [{ "type": "pixel", "id": "<PIXEL_ID>" }],
                "retention_seconds": 2592000,
                "filter": {
                    "operator": "and",
                    "filters": [
                        { "field": "url", "operator": "i_contains", "value": "shoes" }
                    ]
                }
            }
        ]
    }
}
```

### 2. Evento `ViewContent` com Preço >= 100
```json
{
    "inclusions": {
        "operator": "or",
        "rules": [
            {
                "event_sources": [{ "type": "pixel", "id": "<PIXEL_ID>" }],
                "retention_seconds": 2592000,
                "filter": {
                    "operator": "and",
                    "filters": [
                        { "field": "event", "operator": "eq", "value": "ViewContent" },
                        { "field": "price", "operator": ">=", "value": "100" }
                    ]
                }
            }
        ]
    }
}
```
