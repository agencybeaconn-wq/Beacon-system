# Contas do Instagram Conectadas (Connected Instagram Accounts)

Recupera as contas do Instagram associadas a esta conta de anúncios.

## Leitura
Retorna as contas do Instagram conectadas.

**Endpoint:** `GET /act_{ad_account_id}/connected_instagram_accounts`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `IGUser`.

### Resposta
```json
{
    "data": [
        {
            "id": "123456789",
            "username": "my_instagram_account"
        }
    ],
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
| **200** | Erro de permissão. |
