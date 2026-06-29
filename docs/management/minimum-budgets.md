# Orçamentos Mínimos (Minimum Budgets)

Recupera o valor mínimo de orçamento diário para um conjunto de anúncios em uma campanha de Leilão.

## Leitura
Retorna o orçamento mínimo necessário, considerando o valor do lance (se manual).

**Endpoint:** `GET /act_{ad_account_id}/minimum_budgets`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `bid_amount` | integer | Valor do lance manual (se aplicável). | Não |

### Campos Retornados
A resposta contém uma lista de nós `MinimumBudget`.

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
| **200** | Erro de permissão. |
