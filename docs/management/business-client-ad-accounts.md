# Contas de Anúncios de Clientes do Negócio (Business Client Ad Accounts)

Lista as contas de anúncios de propriedade de clientes às quais este negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/client_ad_accounts`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `search_query` | string | Termo de busca para filtrar contas. |

### Campos Retornados
A resposta contém uma lista de nós `AdAccount`.

Campos adicionais incluídos em cada nó:
*   `permitted_tasks`: Lista de tarefas atribuíveis a esta conta de anúncios.

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

## Notas Importantes
*   **Compartilhamento de Pixel:** A partir do final de setembro de 2024, a API `POST /{pixel-id}/shared_accounts` não suportará o compartilhamento de pixels com uma conta de anúncios se a conta empresarial não tiver acesso a ambos. A solução recomendada é usar `POST /{pixel-id}/agencies` ou `POST {ad_account}/agencies` para compartilhar com a conta empresarial primeiro.

## Operações Não Suportadas
*   **Criação:** Temporariamente limitado. Apenas apps que chamaram este endpoint com sucesso nos últimos 30 dias continuam com acesso.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva. |
| **80004** | Muitas chamadas para esta conta. |
