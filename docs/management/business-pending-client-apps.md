# Aplicativos de Clientes Pendentes (Business Pending Client Apps)

Recupera os aplicativos de clientes para os quais o negócio solicitou acesso e está aguardando aprovação.

## Leitura
**Endpoint:** `GET /{business_id}/pending_client_apps`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `BusinessApplicationRequest`.
Cada nó retornado inclui os campos:
*   `is_requested`: Booleano. `true` se o negócio solicitou acesso ao app, `false` se o app está sendo compartilhado com o negócio.
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
