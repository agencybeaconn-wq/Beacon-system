# Contas do WhatsApp Business Próprias do Negócio (Business Owned WhatsApp Business Accounts)

Representa uma coleção de Contas do WhatsApp Business que pertencem a um negócio.

## Leitura
Recupera uma lista de Contas do WhatsApp Business próprias deste negócio. Suporta filtragem e ordenação.

**Endpoint:** `GET /{business_id}/owned_whatsapp_business_accounts`

### Requisitos
*   Permissão `whatsapp_business_management`
*   Permissão `business_management`
*   Permissão `whatsapp_business_messaging`
*   Permissão `public_profile`
*   Token de acesso de Usuário do Sistema Admin para o negócio.

### Parâmetros
Embora a documentação base indique que não há parâmetros, o endpoint suporta filtragem via parâmetro `filtering`.

| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `filtering` | list<Object> | Filtros para a consulta (ex: filtrar por `creation_time`). |
| `fields` | list<string> | Campos a serem retornados (ex: `id,name,creation_time`). |

### Campos Retornados
A resposta contém uma lista de nós `WhatsAppBusinessAccount`.

### Exemplo de Resposta
```json
{
  "data": [
    {
      "id": "WHATSAPP-BUSINESS-ACCOUNT-ID",
      "name": "Test WhatsApp Business Account",
      "timezone_id": "1",
      "message_template_namespace": "MESSAGE-TEMPLATE-NAMESPACE"
    }
  ],
  "paging": {
    "cursors": {
      "before": "BEFORE-CURSOR",
      "after": "AFTER-CURSOR"
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
| **100** | Parâmetro inválido. |
| **104** | Assinatura incorreta. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **80008** | Muitas chamadas para esta conta do WhatsApp Business (limite de taxa). |
