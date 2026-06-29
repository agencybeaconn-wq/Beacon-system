# Contas do WhatsApp Business de Clientes do Negócio (Business Client WhatsApp Business Accounts)

Recupera uma lista de Contas do WhatsApp Business associadas a um negócio.

## Leitura
**Endpoint:** `GET /{business_id}/client_whatsapp_business_accounts`

### Requisitos
*   **Permissões:** `whatsapp_business_management`, `whatsapp_business_messaging`, `public_profile`.
*   **Token:** Token de acesso de Usuário do Sistema Admin para o negócio.

### Parâmetros
Este endpoint não possui parâmetros diretos, mas suporta filtragem avançada.

### Filtragem
É possível filtrar os resultados usando o parâmetro `filtering`.

**Exemplo de Filtro:**
```
filtering=[{'field':'ownership_type', 'operator': 'IN', 'value': ['SELF', 'CLIENT_OWNED']}]
```

### Campos Retornados
A resposta contém uma lista de nós `WhatsAppBusinessAccount`.

Campos adicionais incluídos em cada nó:
*   `permitted_tasks`: Lista de tarefas atribuíveis a usuários neste ativo.

### Exemplo de Requisição (cURL)
```bash
curl -i -X GET \
'https://graph.facebook.com/LATEST-VERSION/{business-id}/client_whatsapp_business_accounts' \
-H 'Authorization: Bearer USER-ACCESS-TOKEN'
```

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
| **100** | Parâmetro inválido. |
| **104** | Assinatura incorreta. |
| **200** | Erro de permissão. |
| **80008** | Muitas chamadas para esta conta do WhatsApp Business (Rate Limit). |
