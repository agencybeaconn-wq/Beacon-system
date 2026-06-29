# Números Pré-Verificados do Negócio (Business Preverified Numbers)

Representa uma coleção de Números de Telefone Pré-Verificados do WhatsApp Business em um negócio.

## Leitura
Recupera uma lista de Números de Telefone Pré-Verificados do WhatsApp Business em um negócio.

**Endpoint:** `GET /{business_id}/preverified_numbers`

### Requisitos
*   **Permissão:** `business_management`
*   **Token:** Token de Acesso de Usuário ou Usuário do Sistema.

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `fields` | string | Lista separada por vírgulas de campos a serem retornados (ex: `phone_number,code_verification_time`). |

### Campos do Objeto (WhatsAppBusinessPreVerifiedPhoneNumber)
Estes campos podem ser solicitados através do parâmetro `fields`.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `phone_number` | string | O número de telefone de exibição pré-verificado do negócio. |
| `code_verification_status` | enum | Indica o status de verificação. Valores: `VERIFIED` (últimos 14 dias), `NOT_VERIFIED` (nunca verificado), `EXPIRED` (mais de 14 dias). |
| `verification_expiry_time` | string | Data/hora de expiração da verificação. |
| `id` | string | ID do número pré-verificado. |

### Exemplo de Requisição
```bash
curl -X GET 'https://graph.facebook.com/v24.0/{business-id}/preverified_numbers' \
-H 'Authorization: Bearer {access-token}'
```

### Exemplo de Resposta
```json
{
  "data": [
    {
      "phone_number": "+1 211-555-5105",
      "code_verification_status": "VERIFIED",
      "verification_expiry_time": "2023-04-14T22:12:31+0000",
      "id": "5745365898905902"
    }
  ],
  "paging": {
    "cursors": {
      "before": "QVFIU...",
      "after": "QVFIU..."
    }
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
| **200** | Erro de permissão. |
