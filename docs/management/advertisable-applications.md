# Aplicativos Anunciáveis (Advertisable Applications)

Recupera a lista de aplicativos que podem ser anunciados pela conta de anúncios.

## Leitura
Retorna os aplicativos anunciáveis da conta.

**Endpoint:** `GET /act_{ad_account_id}/advertisable_applications`

### Restrições
*   Aplicativos em **modo de desenvolvedor** só são retornados se o token de acesso pertencer a um administrador do aplicativo.
*   Aplicativos **live** (em produção) não possuem essa restrição.

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `app_id` | numeric string/int | ID específico do aplicativo para filtrar. |
| `business_id` | numeric string/int | ID do Business Manager para filtrar aplicativos. |

### Campos Retornados
Além dos campos padrão do nó `Application`, a resposta inclui:
*   `advertisable_app_events`: Lista de eventos do app disponíveis para anúncio.
*   `cpa_access`: Informações sobre acesso a CPA (Custo por Ação).

### Resposta
```json
{
    "data": [
        {
            "id": "123456",
            "name": "My App",
            "advertisable_app_events": ["PURCHASE", "ADD_TO_CART"],
            "cpa_access": "..."
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
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **3000** | Tentativa de ler insights de um objeto não pertencente ao usuário. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
