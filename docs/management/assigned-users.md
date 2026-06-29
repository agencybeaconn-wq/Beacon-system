# Usuários Atribuídos (Assigned Users)

Gerenciamento de usuários (Business e System Users) atribuídos à conta de anúncios.

## Leitura
Recupera uma lista de usuários atribuídos à conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/assigned_users`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `business` | numeric string | ID do Business associado à conta. | Sim |

### Campos Retornados
Além dos campos padrão do nó `AssignedUser`, a resposta inclui:
*   `tasks`: Lista de tarefas/permissões atribuídas ao usuário.
*   `permitted_tasks`: Lista de tarefas que *podem* ser atribuídas.

### Resposta
```json
{
    "data": [
        {
            "id": "123456",
            "name": "John Doe",
            "tasks": ["ADVERTISE", "ANALYZE"]
        }
    ],
    "paging": {}
}
```

## Atualização (Atribuição de Tarefas)
Atualiza as permissões de um usuário na conta de anúncios.

**Endpoint:** `POST /act_{ad_account_id}/assigned_users`

### Tarefas vs. Funções (Roles)
A API migrou de permissões baseadas em funções (Roles) para permissões baseadas em tarefas (Tasks).

| Função Antiga (Role) | Tarefas Equivalentes (Tasks) |
| :--- | :--- |
| **ADMIN** | `MANAGE`, `ADVERTISE`, `ANALYZE` |
| **ADVERTISER** | `ADVERTISE`, `ANALYZE`, `DRAFT` |
| **ANALYST** | `ANALYZE`, `DRAFT` |

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `user` | UID | ID do usuário (Business ou System User). | Sim |
| `tasks` | list<enum> | Lista de tarefas (`MANAGE`, `ADVERTISE`, `ANALYZE`, `DRAFT`). | Sim |

### Exemplo de Requisição
```bash
curl -X POST \
  -F "user=<USER_ID>" \
  -F "tasks=['ADVERTISE', 'ANALYZE']" \
  -F "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/assigned_users"
```

## Dissociação (Exclusão)
Remove um usuário da conta de anúncios.

**Endpoint:** `DELETE /act_{ad_account_id}/assigned_users`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `user` | UID | ID do usuário a ser removido. | Sim |

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **2620** | Chamada inválida para atualizar permissões. |
| **3919** | Erro técnico inesperado. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
