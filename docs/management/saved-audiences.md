# Públicos Salvos (Saved Audiences)

Recupera os públicos salvos associados à conta de anúncios.

## Leitura
Retorna uma lista de públicos salvos (`SavedAudience`).

**Endpoint:** `GET /act_{ad_account_id}/saved_audiences`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `business_id` | numeric string/int | ID do negócio para auxiliar em filtros (ex: usados recentemente). | Não |
| `fields` | list<string> | Campos a serem retornados. Padrão: apenas IDs. | Não |
| `filtering` | list<Filter> | Filtros para os dados retornados. | Não |

### Campos Retornados
A resposta contém uma lista de nós `SavedAudience`.

### Resposta
```json
{
    "data": [],
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
| **80004** | Muitas chamadas para esta conta de anúncios. |
