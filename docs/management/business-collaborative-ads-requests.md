# Solicitações de Colaboração de Anúncios Colaborativos (Business Collaborative Ads Collaboration Requests)

Recupera todas as solicitações de colaboração de anúncios colaborativos iniciadas pelo negócio.

## Leitura
**Endpoint:** `GET /{business_id}/collaborative_ads_collaboration_requests`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `status` | string | Filtra as solicitações pelo status. |

### Campos Retornados
A resposta contém uma lista de nós `CPASCollaborationRequest`.

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
