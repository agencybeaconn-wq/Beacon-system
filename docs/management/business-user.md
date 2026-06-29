# Usuário do Negócio (Business User)

Representa um usuário do negócio. Um usuário do negócio pode ser um funcionário ou um administrador. Administradores têm controle total, enquanto funcionários têm acesso limitado conforme definido pelos administradores.

## Leitura
Recupera informações de um usuário do negócio.

**Endpoint:** `GET /{business_user_id}`

### Parâmetros
Este endpoint não possui parâmetros obrigatórios.

### Campos do Objeto (BusinessUser)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | numeric string | ID do usuário do negócio. |
| `business` | Business | Negócio associado a este usuário. |
| `email` | string | Email do usuário conforme fornecido no Gerenciador de Negócios. |
| `finance_permission` | string | Permissão financeira (ex: `EDITOR`, `ANALYST`). |
| `first_name` | string | Primeiro nome do usuário. |
| `ip_permission` | string | Permissão de direitos de anúncios (ex: `Reviewer`). |
| `last_name` | string | Sobrenome do usuário. |
| `name` | string | Nome completo do usuário. |
| `pending_email` | string | Email pendente de verificação. |
| `role` | string | Função do usuário (ex: `ADMIN`, `EMPLOYEE`). |
| `title` | string | Título do usuário no negócio. |
| `two_fac_status` | string | Status da autenticação de dois fatores. |

### Bordas (Edges)
*   `assigned_ad_accounts`: Contas de anúncios atribuídas.
*   `assigned_business_asset_groups`: Grupos de ativos atribuídos.
*   `assigned_pages`: Páginas atribuídas.
*   `assigned_product_catalogs`: Catálogos de produtos atribuídos.
*   `assigned_whatsapp_business_accounts`: Contas do WhatsApp Business atribuídas.

## Criação
Adiciona um usuário ao negócio (envia convite).

**Endpoint:** `POST /{business_id}/business_users`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `email` | string | **Obrigatório.** Email do usuário a ser adicionado. |
| `role` | enum | Função do usuário (ex: `ADMIN`, `EMPLOYEE`, `FINANCE_EDITOR`, etc.). |
| `invited_user_type` | array<enum> | Tipo de usuário (`FB` ou `MWA`). Padrão: `FB`. |

### Retorno
```json
{
    "id": "numeric string"
}
```

## Atualização
Atualiza as informações de um usuário do negócio.

**Endpoint:** `POST /{business_user_id}`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `email` | string | Novo email do usuário. |
| `first_name` | string | Novo primeiro nome. |
| `last_name` | string | Novo sobrenome. |
| `role` | enum | Nova função (ex: `ADMIN`, `EMPLOYEE`). |
| `skip_verification_email` | boolean | Se verdadeiro, não envia email de verificação (o email ainda requer verificação). |

### Retorno
```json
{
    "success": true
}
```

## Exclusão
Remove um usuário do negócio.

**Endpoint:** `DELETE /{business_user_id}`

### Parâmetros
Este endpoint não possui parâmetros.

### Retorno
```json
{
    "success": true
}
```

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **104** | Assinatura incorreta. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva ou não permitida. |
| **415** | Autenticação de dois fatores necessária. |
| **457** | Origem da sessão inválida. |
| **613** | Limite de taxa excedido. |
| **3914** | Tentativa de remover o último administrador do Gerenciador de Negócios. |
