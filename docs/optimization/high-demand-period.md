# Período de Alta Demanda (High Demand Period)

O agendamento de orçamento permite programar aumentos no orçamento da sua campanha ou conjunto de anúncios com base em dias ou horários em que você prevê maiores oportunidades de vendas, períodos de pico de tráfego ou outros períodos promocionais, agendando períodos de alta demanda.

## Sobre o Agendamento de Orçamento

Você pode agendar aumentos de orçamento em certas partes do dia, certos dias da semana ou com base em uma promoção futura quando prevê um aumento na demanda.

### Requisitos e Limitações
*   O usuário deve ter a capacidade `CAN_USE_BUDGET_SCHEDULING_API` na conta.
*   O agendamento de orçamento só pode ser usado para campanhas com **orçamento diário**.
*   Máximo de **50** períodos de alta demanda por campanha ou conjunto de anúncios.
*   O orçamento total durante o aumento não pode exceder **8 vezes** o orçamento diário. (Ex: Se o diário é $100, o máximo no período de alta demanda é $800).
*   Os períodos de alta demanda devem ter **3 horas ou mais** de duração.
*   Disponível para todos os objetivos de leilão, exceto campanhas de App Advantage+.

### Quando usar
*   **Eventos baseados em tempo:** Sazonalidade, dias específicos da semana ou horas.
*   **Macro eventos:** Festivais, eventos esportivos, ofertas de fim de semana.
*   **Eventos promocionais:** Vendas, lançamentos de produtos, datas de lançamento de jogos.

### Diferença entre Agendamento de Anúncios e Orçamento
*   **Agendamento de Anúncios:** Controla *quando* os anúncios são entregues. Requer orçamento vitalício.
*   **Agendamento de Orçamento:** Aumenta o orçamento em dias/horários específicos. Requer orçamento diário.

### Como funciona com o Orçamento Diário
O agendamento de orçamento usa seu orçamento diário como ponto de referência. Você pode aumentar seu orçamento inserindo um valor absoluto ou uma porcentagem.
Quando chega o momento do aumento, a Meta ajusta automaticamente o orçamento. Após o término do período de alta demanda, o orçamento volta automaticamente ao valor diário original.

## Leitura
Recupera informações sobre um período de alta demanda específico.

**Endpoint:** `GET /{high_demand_period_id}`

### Campos do Objeto (HighDemandPeriod)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | numeric string | ID do período de alta demanda. |
| `budget_value` | integer | Valor do aumento do orçamento. Pode ser um valor absoluto ou um multiplicador, definido por `budget_value_type`. |
| `budget_value_type` | enum | Tipo do valor do orçamento: `ABSOLUTE` ou `MULTIPLIER`. |
| `recurrence_type` | enum | Tipo de recorrência. Atualmente suporta apenas períodos não recorrentes. |
| `time_end` | datetime | Hora de término do período de alta demanda. |
| `time_start` | datetime | Hora de início do período de alta demanda. |

## Criação
Para criar um `HighDemandPeriod`:
*   Faça uma requisição `POST` para `/{ad-set-or-campaign-id}/budget_schedules`.
*   Ou use o parâmetro `budget_schedule_specs` ao criar conjuntos de anúncios (`/act_{id}/adsets`) ou campanhas (`/act_{id}/campaigns`).

## Atualização
Atualiza um período de alta demanda existente.

**Endpoint:** `POST /{high_demand_period_id}`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `budget_value` | int64 | Aumento real do orçamento. A unidade é definida por `budget_value_type` (ex: 140 pode ser $140 ou 140%). |
| `budget_value_type` | enum | Tipo de valor do orçamento (`ABSOLUTE`, `MULTIPLIER`). |
| `time_end` | int64 | Timestamp de término do período. |
| `time_start` | int64 | Timestamp de início do período. |

### Retorno
```json
{
    "success": true
}
```

## Exclusão
Remove um período de alta demanda.

**Endpoint:** `DELETE /{high_demand_period_id}`

### Parâmetros
Este endpoint não possui parâmetros.

### Retorno
```json
{
    "success": true
}
```

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
