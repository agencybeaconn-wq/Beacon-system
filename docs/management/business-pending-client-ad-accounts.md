# Contas de Anúncios de Clientes Pendentes (Business Pending Client Ad Accounts)

Recupera as contas de anúncios para as quais o negócio solicitou acesso e ainda está aguardando aprovação de um cliente.

## Leitura
**Endpoint:** `GET /{business_id}/pending_client_ad_accounts`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `BusinessAdAccountRequest`.
Cada nó retornado inclui o campo:
*   `permitted_tasks`: Lista de tarefas (strings) que podem ser atribuídas a usuários neste ativo.

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
| **190** | Token de acesso OAuth 2.0 inválido. |
| **368** | Ação considerada abusiva ou não permitida. |
