# Créditos Estendidos do Negócio (Business Extended Credits)

Representa linhas de crédito que pertencem a um negócio.

## Leitura
**Endpoint:** `GET /{business_id}/extendedcredits`

### Requisitos
*   **Permissões:** `whatsapp_business_management`, `business_management`, `whatsapp_business_messaging`, `public_profile`.
*   **Token:** Token de acesso de usuário.

### Exemplo de Requisição (cURL)
```bash
curl -i -X GET \
 "https://graph.facebook.com/LATEST-VERSION/{business-id}/extendedcredits?access_token=USER-ACCESS-TOKEN"
```

### Campos Retornados
A resposta contém uma lista de nós `ExtendedCredit`.

### Resposta
```json
{
  "data": [ 
   {
  	"id": "EXTENDED-CREDIT-ID"
   }
  ],
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
