# Sugestões de Direcionamento (Targeting Suggestions)

Recupera sugestões de direcionamento com base em especificações fornecidas (ex: interesses ou comportamentos existentes).

## Leitura
Retorna uma lista de sugestões de direcionamento relacionadas aos itens fornecidos.

**Endpoint:** `GET /act_{ad_account_id}/targetingsuggestions`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `targeting_list` | list<Object> | Lista de especificações de direcionamento para basear as sugestões. Ex: `[{"type":"interests", "id":1}]`. | Não |
| `limit_type` | enum | Limita o tipo de sugestão a recuperar (ex: `interests`, `behaviors`, `life_events`). | Não |
| `app_store` | enum | Loja de aplicativos (para campanhas de instalação de app). | Não |
| `regulated_categories` | list<enum> | Categorias regulamentadas da campanha. | Não |

### Tipos de Limite (`limit_type`)
*   `interests`
*   `behaviors`
*   `life_events`
*   `industries`
*   `income`, `net_worth`
*   `home_value`
*   `family_statuses`, `relationship_statuses`
*   `education_schools`, `education_majors`, `education_statuses`
*   `work_positions`, `work_employers`
*   `location_categories`
*   `user_adclusters`

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
