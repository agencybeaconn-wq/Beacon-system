# Contas de Anúncios Atribuídas ao Usuário do Negócio (Business User Assigned Ad Accounts)

Recupera as contas de anúncios que foram atribuídas a este usuário no escopo do negócio.

> **Nota:** A partir do final de setembro de 2024, a API `POST /{pixel-id}/shared_accounts` não suportará o compartilhamento de pixels com uma conta de anúncios se a conta empresarial não tiver acesso a ambos. Utilize `POST /{pixel-id}/agencies` ou `POST {ad_account}/agencies` para compartilhar com uma conta empresarial antes de vincular.

## Leitura
**Endpoint:** `GET /{business_user_id}/assigned_ad_accounts`

### Parâmetros
Este endpoint não possui parâmetros específicos além dos padrões de paginação e resumo.

### Campos Retornados
A resposta contém uma lista de nós `AdAccount`.
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
| **100** | Parâmetro inválido. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
