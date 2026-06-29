# Objetos de Negócio de Container de Sinais Offsite de Clientes (Business Client Offsite Signal Container Business Objects)

Recupera os objetos de negócio de container de sinais offsite de clientes aos quais este negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/client_offsite_signal_container_business_objects`

### Campos Retornados
A resposta contém uma lista de nós `OffsiteSignalContainerBusinessObject`.

Campos adicionais incluídos em cada nó:
*   `permitted_tasks`: Lista de tarefas atribuíveis a usuários neste ativo.

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 10
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
| **368** | Ação considerada abusiva. |
