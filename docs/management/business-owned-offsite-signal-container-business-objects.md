# Objetos de Negócio de Container de Sinal Externo Próprios (Business Owned Offsite Signal Container Business Objects)

Recupera os objetos de negócio de container de sinal externo (*Offsite Signal Container Business Objects*) que pertencem a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/owned_offsite_signal_container_business_objects`

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
| **368** | Ação considerada abusiva ou não permitida. |
