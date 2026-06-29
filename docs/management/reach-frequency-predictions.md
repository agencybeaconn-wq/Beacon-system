# Previsão de Alcance e Frequência (Reach & Frequency Prediction)

Gerencia previsões de alcance e frequência para a conta de anúncios.

> **Mudança Importante (v24.0+):**
> O campo `instagram_destination_id` agora retorna o `ig_user_id` em vez do `instagram_actor_id`.
> O parâmetro `destination_ids` não suporta mais `instagram_actor_id`; use `ig_user_id`.

## Leitura
Recupera previsões de frequência de alcance para a conta.

**Endpoint:** `GET /act_{ad_account_id}/reachfrequencypredictions`

### Campos Retornados
A resposta contém uma lista de nós `ReachFrequencyPrediction`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Criação (Gerar Previsão)
Cria uma nova previsão de alcance e frequência.

**Endpoint:** `POST /act_{ad_account_id}/reachfrequencypredictions`

### Parâmetros Principais
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `prediction_mode` | int64 | `0`: Prever orçamento baseado no alcance.<br>`1`: Prever alcance baseado no orçamento. | Sim |
| `budget` | int64 | Orçamento vitalício esperado (em centavos). Obrigatório se `prediction_mode=1`. | Condicional |
| `reach` | int64 | Alcance desejado. Obrigatório se `prediction_mode=0`. | Condicional |
| `start_time` | int64 | Timestamp Unix de início. | Sim |
| `end_time` | int64 | Timestamp Unix de término (até 8 semanas à frente). | Sim |
| `destination_ids` | list<id> | IDs da Página ou App promovido. | Sim (Rec.) |
| `target_spec` | Object | Especificação de direcionamento. (Nota: Apenas 1 país permitido). | Sim |
| `objective` | string | Objetivo da campanha (ex: `REACH`, `BRAND_AWARENESS`, `VIDEO_VIEWS`). | Não (Padrão: REACH) |
| `frequency_cap` | int64 | Limite de frequência (vitalício ou por período se `interval` for definido). | Não |
| `interval_frequency_cap_reset_period` | int64 | Período de reset do cap em horas (múltiplos de 24). | Não |
| `story_event_type` | int64 | Inclusão de formatos mobile: `128` (vídeo), `256` (canvas), `384` (ambos). | Condicional |

### Objetivos Suportados
Apenas os seguintes objetivos são válidos para campanhas de Alcance e Frequência:
*   `BRAND_AWARENESS`
*   `LINK_CLICKS`
*   `POST_ENGAGEMENT`
*   `MOBILE_APP_INSTALLS`
*   `WEBSITE_CONVERSIONS`
*   `REACH`
*   `VIDEO_VIEWS`

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **2625** | Requisição inválida para campanha R&F. |
| **2641** | Localização restrita. |
| **80004** | Muitas chamadas para esta conta. |
