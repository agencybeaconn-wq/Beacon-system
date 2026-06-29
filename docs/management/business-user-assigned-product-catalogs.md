# Catálogos de Produtos Atribuídos ao Usuário do Negócio (Business User Assigned Product Catalogs)

Recupera os catálogos de produtos que foram atribuídos a este usuário no escopo do negócio.

## Leitura
**Endpoint:** `GET /{business_user_id}/assigned_product_catalogs`

### Parâmetros
Este endpoint não possui parâmetros específicos além dos padrões de paginação e resumo.

### Campos Retornados
A resposta contém uma lista de nós `ProductCatalog`.
Os seguintes campos são adicionados a cada nó retornado:

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `access_type` | string | Verifica se o negócio tem acesso de proprietário ou agência no ativo. |

Também suporta o campo `summary` para totais (ex: `summary=total_count`).

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
