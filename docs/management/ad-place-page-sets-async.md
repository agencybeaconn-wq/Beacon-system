# Conjuntos de Páginas de Local Assíncronos (Ad Place Page Sets Async)

Criação assíncrona de conjuntos de páginas de local (`AdPlacePageSet`) para contas de anúncios. Ideal para operações que podem levar mais tempo ou processamento em lote.

## Criação
Cria um novo conjunto de páginas de local de forma assíncrona.

**Endpoint:** `POST /act_{ad_account_id}/ad_place_page_sets_async`

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
*   **Leitura:** Não é possível ler neste endpoint (use `ad_place_page_sets` síncrono para leitura).
*   **Atualização:** Não é possível atualizar neste endpoint.
*   **Exclusão:** Não é possível excluir neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
