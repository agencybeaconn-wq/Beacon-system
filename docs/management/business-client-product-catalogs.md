# Catálogos de Produtos de Clientes do Negócio (Business Client Product Catalogs)

Recupera os catálogos de produtos de propriedade de clientes aos quais este negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/client_product_catalogs`

### Campos Retornados
A resposta contém uma lista de nós `ProductCatalog`.

Campos adicionais incluídos em cada nó:
*   `permitted_roles`: Lista de funções atribuíveis a este catálogo de produtos.

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
