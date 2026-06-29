# Navegação de Direcionamento (Targeting Browse)

Recupera uma árvore unificada de opções de direcionamento como uma lista plana. Use a chave `parent` para recriar a estrutura da árvore.

## Leitura
Retorna opções de direcionamento disponíveis para navegação.

**Endpoint:** `GET /act_{ad_account_id}/targetingbrowse`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `limit_type` | enum | Limita o tipo de público a recuperar (ex: `interests`, `behaviors`, `demographics`). | Não |
| `include_nodes` | boolean | Inclui nós pesquisáveis (ex: entradas de trabalho/educação). Padrão: `false`. | Não |
| `regulated_categories` | list<enum> | Categorias regulamentadas da campanha (ex: `HOUSING`, `EMPLOYMENT`). | Não |

### Tipos de Limite (`limit_type`)
*   `interests`
*   `education_schools`, `education_majors`, `education_statuses`
*   `work_positions`, `work_employers`
*   `relationship_statuses`, `family_statuses`
*   `behaviors`
*   `income`, `net_worth`
*   `home_type`, `home_ownership`
*   `generation`
*   `politics`
*   `life_events`
*   `industries`

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
