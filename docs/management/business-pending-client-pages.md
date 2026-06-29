# Páginas de Clientes Pendentes (Business Pending Client Pages)

Recupera as páginas para as quais o negócio solicitou acesso e está aguardando aprovação do cliente.

## Leitura
**Endpoint:** `GET /{business_id}/pending_client_pages`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `BusinessPageRequest`.
Cada nó retornado inclui o campo:
*   `permitted_tasks`: Lista de tarefas (strings) permitidas.

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
