# Usuários Pendentes (Business Pending Users)

Lista todos os usuários convidados para acessar este negócio que ainda não aceitaram o convite.

## Leitura
**Endpoint:** `GET /{business_id}/pending_users`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `email` | string | Email da pessoa convidada para acessar este negócio. |

### Campos Retornados
A resposta contém uma lista de nós `BusinessRoleRequest`.
Também suporta o campo `summary` para totais (ex: `summary=total_count`).

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 5
    }
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **104** | Assinatura incorreta. |
