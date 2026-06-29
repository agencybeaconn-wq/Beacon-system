# Solicitações de Compartilhamento de Público Iniciadas pelo Negócio (Business Initiated Audience Sharing Requests)

Recupera as solicitações de compartilhamento de público que foram iniciadas por este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/initiated_audience_sharing_requests`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `recipient_id` | string | O ID do negócio destinatário. |
| `request_status` | enum | O status da solicitação de compartilhamento. <br>Valores possíveis: `APPROVE`, `DECLINE`, `IN_PROGRESS`, `EXPIRED`, `PENDING`, `PENDING_INTEGRITY_REVIEW`, `PENDING_EMAIL_VERIFICATION`, `CANCELED`, `MMA_DIRECT_ASSETS_PENDING`, `MMA_DIRECT_ASSETS_APPROVED`, `MMA_DIRECT_ASSETS_DECLINED`, `MMA_DIRECT_ASSETS_EXPIRED`. |

### Campos Retornados
A resposta contém uma lista de nós `BusinessAssetSharingAgreement`.

Campos adicionais incluídos em cada nó:
*   `custom_audiences`: Públicos personalizados pendentes para o acordo de compartilhamento.

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
| **104** | Assinatura incorreta. |
| **200** | Erro de permissão. |
