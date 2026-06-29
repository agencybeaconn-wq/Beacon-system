# Regras de Anúncios Baseadas em Gatilho (Trigger Based Ad Rules)

Regras baseadas em gatilho monitoram o estado dos seus anúncios em **tempo real**. Elas são avaliadas imediatamente quando metadados ou insights são alterados.

> **Nota:** Não suportam `schedule_spec`. Disponíveis apenas via API.

## Objeto `trigger`
Define como a regra é avaliada. Deve ser incluído dentro de `evaluation_spec`.

| Campo | Descrição |
| :--- | :--- |
| **`type`** | Tipo do gatilho (`METADATA_CREATION`, `METADATA_UPDATE`, `STATS_CHANGE`, `STATS_MILESTONE`). |
| **`field`** | O campo subjacente a ser monitorado. |
| **`value`** | Valor de comparação (opcional para alguns tipos). |
| **`operator`** | Operador de comparação (opcional para alguns tipos). |

## Tipos de Gatilho

### 1. Relacionados a Metadados

#### `METADATA_CREATION`
Dispara quando um objeto de anúncio é criado.
- **Exemplo:** Enviar um ping quando um novo anúncio é criado em uma campanha de `APP_INSTALLS`.

```json
"trigger": { "type": "METADATA_CREATION" }
```

#### `METADATA_UPDATE`
Dispara quando um campo de metadados é atualizado.
- **Exemplo:** Notificar quando o `daily_budget` de um conjunto de anúncios é alterado (e opcionalmente excede um valor).

```json
"trigger": {
  "type": "METADATA_UPDATE",
  "field": "daily_budget",
  "value": 1000,
  "operator": "GREATER_THAN"
}
```

### 2. Relacionados a Insights (Estatísticas)

#### `STATS_MILESTONE`
Dispara quando um campo atinge um **múltiplo** do valor especificado.
- **Requisitos:** Operador deve ser `EQUAL`, `time_preset` deve ser `LIFETIME`.
- **Exemplo:** Enviar ping a cada novo comentário (`post_comment` múltiplo de 1).

```json
"trigger": {
  "type": "STATS_MILESTONE",
  "field": "post_comment",
  "value": 1,
  "operator": "EQUAL"
}
```

#### `STATS_CHANGE`
Dispara quando a condição lógica (Trigger AND Filters) muda de **falso para verdadeiro**.
- **Operadores:** `GREATER_THAN`, `LESS_THAN`, `IN_RANGE`, `NOT_IN_RANGE`.
- **Exemplo:** Pausar anúncio se `cost_per_purchase_fb` > 1000 (cents) E `reach` > 5000 nos últimos 3 dias.

```json
"trigger": {
  "type": "STATS_CHANGE",
  "field": "cost_per_purchase_fb",
  "value": 1000,
  "operator": "GREATER_THAN"
}
```

## Configuração de Webhooks (`PING_ENDPOINT`)
Para usar o tipo de execução `PING_ENDPOINT`, configure uma assinatura de Webhooks para `ads_rules_engine` no seu aplicativo Facebook.

1.  Configure uma URL de callback.
2.  Adicione o produto Webhooks ao seu App.
3.  Assine o campo `ads_rules_engine` para o objeto `application`.

**Payload do Webhook:**
```json
{
  "object": "application",
  "entry": [{
    "changes": [{
      "field": "ads_rules_engine",
      "value": {
        "rule_id": 1234,
        "object_id": 5678,
        "trigger_type": "STATS_CHANGE",
        "current_value": "15.8"
      }
    }]
  }]
}
```
