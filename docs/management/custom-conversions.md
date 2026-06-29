# Conversões Personalizadas (Custom Conversions)

Gerenciamento de Conversões Personalizadas na conta de anúncios. Permite medir a eficácia dos anúncios e otimizar a entrega para pessoas que converteram conforme regras específicas.

## Leitura
Recupera as conversões personalizadas associadas à conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/customconversions`

### Parâmetros
Este endpoint não possui parâmetros de filtro específicos documentados aqui.

### Campos Retornados
A resposta contém uma lista de nós `CustomConversion`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Criação
Cria uma nova conversão personalizada.

**Endpoint:** `POST /act_{ad_account_id}/customconversions`

### Parâmetros Principais
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome da conversão personalizada. | Sim |
| `event_source_id` | numeric string | ID da fonte de eventos (Pixel, Offline Event Set, etc.). | Não |
| `rule` | string | Regra para contar o evento como conversão (JSON string). | Não |
| `advanced_rule` | string | Conjunto de regras avançadas permitindo múltiplas fontes. | Não |
| `custom_event_type` | enum | Tipo de evento personalizado (ex: `PURCHASE`, `LEAD`, `ADD_TO_CART`). | Não |
| `action_source_type` | enum | Origem da ação (ex: `website`, `app`, `physical_store`). | Não |
| `default_conversion_value` | float | Valor padrão da conversão. Padrão: 0. | Não |
| `description` | string | Descrição da conversão. | Não |

### Retorno
```json
{
    "id": "123456789",
    "is_custom_event_type_predicted": "true"
}
```

## Operações Não Suportadas
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva ou não permitida. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
