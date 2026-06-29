# Aplicativos da Conta de Anúncios (Ad Account Applications)

Gerenciamento de aplicativos (`Application`) associados à conta de anúncios.

## Leitura
Recupera uma lista de aplicativos associados à conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/applications`

### Parâmetros
Este endpoint não possui parâmetros específicos de filtro.

### Resposta
Retorna uma lista de nós `Application`.
```json
{
    "data": [
        {
            "id": "123456789",
            "name": "My App",
            "link": "https://www.facebook.com/games/?app_id=123456789"
        }
    ],
    "paging": {}
}
```

## Operações Não Suportadas
*   **Criação:** Não é possível associar aplicativos diretamente neste endpoint.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
