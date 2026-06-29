# Contas do WhatsApp Business Atribuídas ao Usuário (Business User Assigned Whatsapp Business Accounts)

Recupera as contas do WhatsApp Business (WABA) que foram atribuídas a este usuário no escopo do negócio.

## Leitura
**Endpoint:** `GET /{business_user_id}/assigned_whatsapp_business_accounts`

### Parâmetros
Este endpoint não possui parâmetros específicos além dos padrões de paginação e resumo.

### Campos Retornados
A resposta contém uma lista de nós `WhatsAppBusinessAccount`.
Os seguintes campos são adicionados a cada nó retornado:

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `tasks` | list<string> | Tarefas que o usuário possui na WABA. |

Também suporta o campo `summary` para totais (ex: `summary=total_count`).

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 1
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
| **100** | Parâmetro inválido. |
