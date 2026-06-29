# Clientes do Negócio (Business Clients)

Lista todos os negócios que concederam a este negócio acesso a um ou mais de seus ativos.

## Leitura
**Endpoint:** `GET /{business_id}/clients`

### Campos Retornados
A resposta contém uma lista de nós `Business`.

Campos adicionais incluídos em cada nó:
*   `adaccount_permissions`: Lista de permissões de conta de anúncios.
*   `application_permissions`: Lista de permissões de aplicativo.
*   `page_permissions`: Lista de permissões de página.
*   `productcatalog_permissions`: Lista de permissões de catálogo de produtos.
*   `shared_ca_count`: Contagem de audiências personalizadas compartilhadas.

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 1
    }
}
```

## Exclusão (Dissociar Negócio)
Você pode dissociar um Negócio de outro Negócio.

**Endpoint:** `DELETE /{business_id}/clients`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `business` | string | O ID do negócio do cliente a ser dissociado. | **Sim** |

### Resposta
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso OAuth 2.0 inválido. |
