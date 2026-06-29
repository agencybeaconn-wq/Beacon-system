# Tokens de Acesso de Usuário do Sistema (Business System User Access Tokens)

Gerencia a criação de tokens de acesso para usuários do sistema associados ao negócio.

## Criação
Gera um novo token de acesso para um usuário do sistema.

**Endpoint:** `POST /{business_id}/system_user_access_tokens`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `system_user_id` | int64 | O ID do usuário do sistema para o qual o token será gerado. |
| `scope` | List<Permission> | Lista de permissões (escopos) a serem concedidas ao token. |
| `asset` | array<int64> | Lista de IDs de ativos associados. |
| `fetch_only` | boolean | Se verdadeiro, busca apenas o token existente sem criar um novo (se aplicável). |
| `set_token_expires_in_60_days` | boolean | Se verdadeiro, define a expiração do token para 60 dias. |

### Retorno
```json
{
    "access_token": "string"
}
```

## Operações Não Suportadas
*   **Leitura:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **200** | Erro de permissão. |
| **452** | Chave de sessão inválida (formato incorreto ou revogada). |
| **3962** | Permissão fornecida não é válida. Verifique a ortografia e sintaxe. |
