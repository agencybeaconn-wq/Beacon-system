# Objetos de Negócio de Container de Sinal Offsite Compartilhados Pendentes (Business Pending Shared Offsite Signal Container Business Objects)

Recupera objetos de negócio de container de sinal offsite que foram compartilhados com o negócio e estão pendentes.

## Leitura
**Endpoint:** `GET /{business_id}/pending_shared_offsite_signal_container_business_objects`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `OffsiteSignalContainerBusinessObject`.
Também suporta o campo `summary` para totais (ex: `summary=total_count`).

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
| **368** | Ação considerada abusiva ou não permitida. |
