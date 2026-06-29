# Regras de Anúncios Baseadas em Cronograma (Schedule Based Ad Rules)

Regras baseadas em cronograma monitoram o status dos anúncios em intervalos definidos para verificar se cumprem os critérios da `evaluation_spec`.

## Especificação de Cronograma (`schedule_spec`)

Define a frequência de execução da regra.

### Tipos de Cronograma (`schedule_type`)

| Tipo | Descrição |
| :--- | :--- |
| **`DAILY`** | Executa à meia-noite (fuso horário da conta). |
| **`HOURLY`** | Executa no início de cada hora. |
| **`SEMI_HOURLY`** | Executa a cada 30 minutos (início da hora e aos 30 min). |
| **`CUSTOM`** | Executa em períodos personalizados definidos na lista `schedule`. |

### Configuração Personalizada (`schedule`)
Lista de objetos que definem os horários. Pelo menos um de `start_minute` ou `days` deve estar presente.

- **`start_minute`**: Minutos após a meia-noite (múltiplo de 30).
- **`end_minute`**: Minutos após a meia-noite (múltiplo de 30, > start). Define uma faixa de tempo.
- **`days`**: Lista de dias (0=Domingo, 6=Sábado). Se omitido, executa todos os dias.

#### Exemplo de Cronograma Personalizado
Executar às terças e sextas-feiras à meia-noite.

```json
"schedule_spec": {
  "schedule_type": "CUSTOM",
  "schedule": [
    {
      "start_minute": 0,
      "days": [2, 5]
    }
  ]
}
```

## Exemplos de Regras

### 1. Regra de Desempenho (Últimos 7 Dias)
Aplica-se a objetos específicos (IDs 101, 102, 103) que tiveram > 10.000 impressões nos últimos 7 dias.

```bash
curl \
-F 'name=Performance Rule' \
-F 'schedule_spec={ "schedule_type": "DAILY" }' \
-F 'evaluation_spec={
      "evaluation_type": "SCHEDULE",
      "filters": [
        { "field": "time_preset", "value": "LAST_7_DAYS", "operator": "EQUAL" },
        { "field": "effective_status", "value": ["ACTIVE"], "operator": "IN" },
        { "field": "id", "value": [101, 102, 103], "operator": "IN" },
        { "field": "impressions", "value": 10000, "operator": "GREATER_THAN" }
      ]
   }' \
-F 'execution_spec={ ... }' \
-F "access_token=<ACCESS_TOKEN>" \
https://graph.facebook.com/<VERSION>/<AD_ACCOUNT_ID>/adrules_library
```

### 2. Regra de Metadados (Tempo de Criação)
Aplica-se a conjuntos de anúncios em campanhas específicas, com orçamento vitalício, criados há menos de 48 horas.

```bash
curl \
-F 'name=New AdSets Rule' \
-F 'schedule_spec={ "schedule_type": "HOURLY" }' \
-F 'evaluation_spec={
      "evaluation_type": "SCHEDULE",
      "filters": [
        { "field": "entity_type", "value": "ADSET", "operator": "EQUAL" },
        { "field": "campaign.id", "value": [101, 102, 103], "operator": "IN" },
        { "field": "budget_reset_period", "value": ["LIFETIME"], "operator": "IN" },
        { "field": "hours_since_creation", "value": 48, "operator": "LESS_THAN" }
      ]
   }' \
-F 'execution_spec={ ... }' \
-F "access_token=<ACCESS_TOKEN>" \
https://graph.facebook.com/<VERSION>/<AD_ACCOUNT_ID>/adrules_library
```

### 3. Aumentar Orçamento com Limite de Execução
Aumenta o orçamento em 10% para objetos correspondentes, no máximo 5 vezes.

```json
"execution_spec": {
  "execution_type": "CHANGE_BUDGET",
  "execution_options": [
    {
      "field": "change_spec",
      "value": { "amount": 10, "unit": "PERCENTAGE" },
      "operator": "EQUAL"
    },
    {
      "field": "execution_count_limit",
      "value": 5,
      "operator": "EQUAL"
    }
  ]
}
```

### 4. Pausar e Notificar
Pausa objetos e notifica usuários específicos.

```json
"execution_spec": {
  "execution_type": "PAUSE",
  "execution_options": [
    {
      "field": "user_ids",
      "value": [1001, 1002],
      "operator": "EQUAL"
    }
  ]
}
```
