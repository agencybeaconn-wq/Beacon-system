# Agências da Conta de Anúncios (Ad Account Agencies)

Gerenciamento de agências (`Business`) associadas à conta de anúncios.

## Leitura
Recupera uma lista de agências associadas à conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/agencies`

### Campos Adicionais
Além dos campos padrão do nó `Business`, a resposta inclui:
*   `access_requested_time`: Data/hora da solicitação de acesso.
*   `access_status`: Status da solicitação de acesso.
*   `access_updated_time`: Data/hora da última atualização do acesso.
*   `permitted_tasks`: Lista de tarefas/permissões concedidas.

### Resposta
```json
{
    "data": [
        {
            "id": "123456",
            "name": "My Agency",
            "access_status": "ACCEPTED",
            "permitted_tasks": ["ADVERTISE", "ANALYZE"]
        }
    ],
    "paging": {}
}
```

## Associação (Criação)
Não é possível criar associações diretamente neste endpoint. O acesso deve ser solicitado via Business Manager.

## Dissociação (Exclusão)
Remove a associação de uma agência com a conta de anúncios.

**Endpoint:** `DELETE /act_{ad_account_id}/agencies`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `business` | string | ID do Business (Agência) a ser removido. | Sim |

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
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
