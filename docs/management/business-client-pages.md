# Páginas de Clientes do Negócio (Business Client Pages)

Recupera as Páginas do Facebook de propriedade de clientes às quais este negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/client_pages`

### Campos Retornados
A resposta contém uma lista de nós `Page`.

Campos adicionais incluídos em cada nó:
*   `permitted_tasks`: Lista de tarefas atribuíveis a esta página.

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
| **104** | Assinatura incorreta. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva. |
