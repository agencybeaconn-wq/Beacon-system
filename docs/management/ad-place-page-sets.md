# Conjuntos de Páginas de Local (Ad Place Page Sets)

Gerenciamento de conjuntos de páginas de local (`AdPlacePageSet`) para contas de anúncios. Isso se aplica a Páginas publicadas e é usado para direcionamento geográfico ou agrupamento de locais.

## Leitura
Recupera uma lista de conjuntos de páginas de local associados à conta de anúncios.

**Endpoint:** `GET /{ad-account-id}/ad_place_page_sets`

### Resposta
Retorna um objeto JSON contendo uma lista de nós `AdPlacePageSet`.

```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 10
    }
}
```
*   `summary`: Inclua `summary=total_count` na requisição para obter o total.

## Criação
Cria um novo conjunto de páginas de local.

**Endpoint:** `POST /act_{ad_account_id}/ad_place_page_sets`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do conjunto de páginas. | Sim |
| `parent_page` | numeric string/int | ID da página pai para todas as páginas de localização. | Sim |
| `location_types` | list<enum> | Tipo de localização do usuário alvo (`recent`, `home`). | Não |
| `targeted_area_type` | enum | Critério para definir a área alvo (`CUSTOM_RADIUS`, `MARKETING_AREA`, `NONE`). | Não |

### Retorno
```json
{
  "id": "123456789"
}
```

## Operações Não Suportadas
*   **Atualização:** Não é possível atualizar conjuntos de páginas de local neste endpoint.
*   **Exclusão:** Não é possível excluir conjuntos de páginas de local neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
