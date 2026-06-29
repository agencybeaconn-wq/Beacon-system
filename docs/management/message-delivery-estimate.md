# Estimativa de Entrega de Mensagens (Message Delivery Estimate)

Recupera estimativas de entrega para campanhas de mensagens de marketing.

## Leitura
Retorna estimativas de entrega baseadas nos parâmetros da campanha.

**Endpoint:** `GET /act_{ad_account_id}/message_delivery_estimate`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `targeting_spec` | Object | Especificações de direcionamento da campanha. | **Sim** |
| `promoted_object` | Object | Objeto promovido da campanha. | **Sim** |
| `optimization_goal` | enum | Meta de otimização (ex: `CONVERSATIONS`, `IMPRESSIONS`). | Não |
| `bid_amount` | int64 | Valor do lance. | Não |
| `lifetime_budget` | int64 | Orçamento vitalício da campanha. | Não |
| `lifetime_in_days` | int64 | Duração da campanha em dias. | Não |
| `pacing_type` | enum | Tipo de ritmo (ex: `STANDARD`, `NO_PACING`). | Não |

### Campos Retornados
A resposta contém uma lista de nós `MessageDeliveryEstimate`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
