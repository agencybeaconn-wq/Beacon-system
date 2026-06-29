# Solicitação de Função no Negócio (Business Role Request)

Representa uma solicitação para um usuário ingressar em um negócio. Permite visualizar, atualizar e excluir convites pendentes.

## Leitura
Recupera detalhes de uma solicitação de função no negócio.

**Endpoint:** `GET /{business_role_request_id}`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos do Objeto (BusinessRoleRequest)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | numeric string | ID da solicitação de convite. |
| `created_by` | User \| SystemUser | Usuário que enviou o convite. |
| `created_time` | datetime | Data/hora em que o convite foi enviado. |
| `email` | string | Email do usuário convidado. |
| `expiration_time` | datetime | Data/hora de expiração do convite. |
| `finance_role` | enum | Função financeira pré-atribuída ao convidar. |
| `invited_user_type` | list<enum> | Tipo de usuário convidado para esta solicitação. |
| `owner` | Business | Negócio para o qual o usuário foi convidado. |
| `role` | enum | Função no negócio para o usuário convidado. |
| `status` | enum | Status do convite (ex: aceito, recusado, expirado). |
| `updated_by` | User \| SystemUser | Usuário que atualizou o convite. |
| `updated_time` | datetime | Data/hora da atualização do convite. |

## Atualização
Atualiza uma solicitação de função existente (ex: alterar a função).

**Endpoint:** `POST /{business_role_request_id}`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `role` | enum | Nova função a ser atribuída (ex: `ADMIN`, `EMPLOYEE`, `FINANCE_EDITOR`, etc.). |

### Retorno
```json
{
    "id": "numeric string"
}
```

## Exclusão
Exclui (cancela) uma solicitação de função no negócio.

**Endpoint:** `DELETE /{business_role_request_id}`

### Parâmetros
Este endpoint não possui parâmetros.

### Retorno
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva ou não permitida. |
