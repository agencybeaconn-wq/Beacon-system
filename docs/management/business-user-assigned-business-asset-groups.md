# Grupos de Ativos de Negócio Atribuídos ao Usuário (Business User Assigned Business Asset Groups)

Recupera a lista de grupos de ativos de negócio atribuídos a um usuário específico.

## Leitura
**Endpoint:** `GET /{business_user_id}/assigned_business_asset_groups`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `contained_asset_id` | numeric string ou integer | ID de um ativo contido para filtrar os grupos. |

### Campos Retornados
A resposta contém uma lista de nós `BusinessAssetGroup`.
Os seguintes campos são adicionados a cada nó retornado para detalhar as permissões:

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `adaccount_tasks` | list<string> | Tarefas de permissão para contas de anúncios contidas no grupo. |
| `offline_conversion_data_set_tasks` | list<string> | Tarefas de permissão para conjuntos de dados de conversão offline contidos no grupo. |
| `page_tasks` | list<string> | Tarefas de permissão para páginas contidas no grupo. |
| `pixel_tasks` | list<string> | Tarefas de permissão para pixels de anúncios contidos no grupo. |

Também suporta o campo `summary` para totais (ex: `summary=total_count`).

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 2
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
