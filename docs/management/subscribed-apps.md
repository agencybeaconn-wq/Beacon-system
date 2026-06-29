# Apps Inscritos (Subscribed Apps)

Gerencia os aplicativos inscritos para receber atualizações em tempo real (webhooks) da conta de anúncios.

## Leitura
Retorna a lista de aplicativos inscritos na conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/subscribed_apps`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `AdAccountSubscribedApps`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Inscrição (Atualização)
Inscreve um aplicativo para receber atualizações da conta de anúncios.

**Endpoint:** `POST /act_{ad_account_id}/subscribed_apps`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `app_id` | string | ID do aplicativo a ser inscrito. | Não (Padrão: App do token) |

### Resposta
```json
{
    "success": true
}
```

## Cancelamento (Exclusão)
Remove a inscrição de um aplicativo da conta de anúncios.

**Endpoint:** `DELETE /act_{ad_account_id}/subscribed_apps`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `app_id` | string | ID do aplicativo a ser removido. | Não (Padrão: App do token) |

### Resposta
```json
{
    "success": true
}
```

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
