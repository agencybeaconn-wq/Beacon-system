# Páginas Próprias Pendentes (Business Pending Owned Pages)

Recupera as páginas para as quais o negócio solicitou propriedade e ainda estão aguardando aprovação.

## Leitura
**Endpoint:** `GET /{business_id}/pending_owned_pages`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `BusinessPageRequest`.
Também suporta o campo `summary` para totais (ex: `summary=total_count`).

### Resposta
```json
{
    "data": [],
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
| **200** | Erro de permissão. |
