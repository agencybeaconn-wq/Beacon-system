# Posicionamentos do Audience Network do Negócio (Business AN Placements)

Recupera os posicionamentos do Audience Network associados a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/an_placements`

### Campos Retornados
A resposta contém uma lista de nós `AdPlacement`.

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
| **200** | Erro de permissão. |
