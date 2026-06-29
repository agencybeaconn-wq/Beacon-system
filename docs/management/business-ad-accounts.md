# Contas de Anúncios do Negócio (Business Ad Accounts)

Gerencia a associação entre um Business Manager e Contas de Anúncios.

## Operações Suportadas

### Dissociação (Remover Conta)
Remove a associação entre um Business Manager e uma Conta de Anúncios.

**Endpoint:** `DELETE /{business_id}/ad_accounts`

#### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `adaccount_id` | string | ID da conta de anúncios a ser removida. | **Sim** |

#### Resposta
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Leitura:** Não suportado neste endpoint específico (use a borda `owned_ad_accounts` ou `client_ad_accounts` do Business Manager).
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **368** | Ação considerada abusiva. |
