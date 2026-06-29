# Catálogos de Produtos Próprios do Negócio (Business Owned Product Catalogs)

Recupera os catálogos de produtos que pertencem a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/owned_product_catalogs`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `ProductCatalog`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Criação
Permite criar um novo Catálogo de Produtos.

**Endpoint:** `POST /{business_id}/owned_product_catalogs`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do catálogo. | **Sim** |
| `vertical` | enum | Indústria ou vertical do catálogo (ex: `commerce`, `hotels`, `vehicles`). Padrão: `commerce`. | Não |
| `additional_vertical_option` | enum | Configurações adicionais de catálogo que não introduzem novas verticais. | Não |
| `business_metadata` | JSON object | Metadados do negócio. | Não |
| `catalog_segment_filter` | JSON rule | Filtro para criar um segmento de catálogo. | Não |
| `da_display_settings` | Object | Configurações de exibição de Anúncios Dinâmicos. | Não |
| `destination_catalog_settings` | JSON object | Configurações de catálogo de destino. | Não |
| `flight_catalog_settings` | JSON object | Configurações de catálogo de voos. | Não |
| `parent_catalog_id` | numeric string | ID do catálogo pai. | Não |
| `partner_integration` | JSON object | Configurações de integração de parceiros. | Não |
| `store_catalog_settings` | JSON object | Configurações de catálogo de loja. | Não |

### Retorno
Este endpoint suporta *read-after-write*.
```json
{
    "id": "123456789"
}
```

## Operações Não Suportadas
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **102** | Chave de sessão inválida ou expirada. |
| **104** | Assinatura incorreta. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **804** | Objeto especificado já existe. |
| **80009** | Muitas chamadas para esta conta de Catálogo (limite de taxa). |
| **2310019** | O negócio deste catálogo não está integrado aos Anúncios Colaborativos. |
