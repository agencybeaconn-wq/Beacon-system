# Categorias de Direcionamento Amplo (Broad Targeting Categories)

Recupera as categorias de direcionamento amplo disponíveis para esta conta de anúncios.

## Leitura
Retorna as categorias de direcionamento amplo da conta.

**Endpoint:** `GET /act_{ad_account_id}/broadtargetingcategories`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `custom_categories_only` | boolean | Se `true`, retorna apenas categorias personalizadas. |

### Campos Retornados
A resposta contém uma lista de nós `BroadTargetingCategories`.

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
| **80004** | Muitas chamadas para esta conta de anúncios. |
