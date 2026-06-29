# Contas do Instagram do Negócio (Business Instagram Accounts)

Recupera as contas do Instagram às quais este negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/instagram_accounts`

### Campos Retornados
A resposta contém uma lista de nós `IGUser`.

### Resposta
```json
{
    "data": []
}
```

## Exclusão (Dissociar Conta)
Você pode dissociar uma conta do Instagram de um Negócio.

**Endpoint:** `DELETE /{business_id}/instagram_accounts`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `instagram_account` | string | O ID da conta do Instagram a ser dissociada. | **Sim** |

### Resposta
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
