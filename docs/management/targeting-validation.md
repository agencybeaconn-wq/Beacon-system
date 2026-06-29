# Validação de Direcionamento (Targeting Validation)

Consulta a estrutura de anúncios para validar opções de direcionamento (interesses, categorias, etc.).

## Leitura
Retorna a validação dos itens de direcionamento fornecidos.

**Endpoint:** `GET /act_{ad_account_id}/targetingvalidation`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `id_list` | list<int64> | Lista de IDs para validar (interesses, categorias). | Não |
| `name_list` | list<string> | Lista de nomes para validar. | Não |
| `targeting_list` | list<Object> | Lista de pares tipo/ID de direcionamento. | Não |
| `is_exclusion` | boolean | Indica se os IDs podem ser usados em exclusão. Padrão: `false`. | Não |

### Campos Retornados
A resposta contém uma lista de nós `AdAccountTargetingUnified`.

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
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
