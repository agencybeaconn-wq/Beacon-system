# Páginas Atribuídas ao Usuário do Negócio (Business User Assigned Pages)

Recupera as Páginas do Facebook que foram atribuídas a este usuário no escopo do negócio.

## Leitura
**Endpoint:** `GET /{business_user_id}/assigned_pages`

### Parâmetros
Este endpoint não possui parâmetros específicos além dos padrões de paginação e resumo.

### Campos Retornados
A resposta contém uma lista de nós `Page`.
Os seguintes campos são adicionados a cada nó retornado:

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `permitted_tasks` | list<string> | Tarefas que podem ser atribuídas neste objeto. |
| `tasks` | list<string> | Todas as funções/tarefas descompactadas deste usuário específico neste objeto. |

Também suporta o campo `summary` para totais (ex: `summary=total_count`).

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 3
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
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
