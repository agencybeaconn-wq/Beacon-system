# Solicitações de Compartilhamento de Público Recebidas (Business Received Audience Sharing Requests)

Recupera as solicitações de compartilhamento de público que foram recebidas por este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/received_audience_sharing_requests`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `initiator_id` | numeric string | O ID do negócio iniciador. |
| `request_status` | enum | O status da solicitação. Valores possíveis: `APPROVE`, `DECLINE`, `IN_PROGRESS`, `EXPIRED`, `PENDING`, `PENDING_INTEGRITY_REVIEW`, `PENDING_EMAIL_VERIFICATION`, `CANCELED`, `MMA_DIRECT_ASSETS_PENDING`, `MMA_DIRECT_ASSETS_APPROVED`, `MMA_DIRECT_ASSETS_DECLINED`, `MMA_DIRECT_ASSETS_EXPIRED`. |

### Campos Retornados
A resposta contém uma lista de nós `BusinessAssetSharingAgreement`.
Cada nó retornado inclui os campos:
*   `custom_audiences`: Lista de públicos personalizados pendentes para o acordo de compartilhamento (`BusinessAssetSharingAgreementSharedAudienceResponseShape`).

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
