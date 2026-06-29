# Catálogo de Produtos (Product Catalog)

Representa um catálogo para o seu negócio, que pode ser usado para entregar anúncios dinâmicos. Catálogos de produtos contêm uma lista de itens como produtos, hotéis ou voos, e as informações necessárias para exibi-los.

## Leitura
Recupera informações sobre um catálogo de produtos.

**Endpoint:** `GET /{product_catalog_id}`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `segment_use_cases` | array<enum> | Casos de uso do segmento (ex: `COLLAB_ADS`, `IG_SHOPPING`). |

### Campos do Objeto (ProductCatalog)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | numeric string | ID do catálogo. |
| `business` | Business | Negócio proprietário do catálogo. |
| `catalog_store` | StoreCatalogSettings | Página principal da loja associada. |
| `commerce_merchant_settings` | CommerceMerchantSettings | Configurações do comerciante para itens vendidos. |
| `da_display_settings` | ProductCatalogImageSettings | Configurações de exibição de imagem (corte, preenchimento) para anúncios dinâmicos. |
| `default_image_url` | string | URL da imagem padrão para produtos sem imagem. |
| `fallback_image_url` | list<string> | URL da imagem de fallback para itens dinâmicos gerados automaticamente. |
| `feed_count` | int32 | Número total de feeds usados pelo catálogo. |
| `is_catalog_segment` | bool | Indica se é um segmento de catálogo. |
| `is_local_catalog` | bool | Indica se é um catálogo local. |
| `name` | string | Nome do catálogo. |
| `product_count` | int32 | Número total de produtos no catálogo. |
| `store_catalog_settings` | StoreCatalogSettings | Configurações para catálogo de loja física. |
| `vertical` | enum | Tipo de catálogo (ex: `hotels`, `commerce`). |

### Bordas (Edges)
*   `agencies`: Agências com acesso.
*   `assigned_users`: Usuários atribuídos.
*   `automotive_models`: Modelos automotivos.
*   `categories`: Categorias de produtos.
*   `check_batch_request_status`: Status de requisições em lote.
*   `collaborative_ads_share_settings`: Configurações de compartilhamento de anúncios colaborativos.
*   `data_sources`: Fontes de dados (feeds, etc.).
*   `destinations`: Destinos contidos.
*   `diagnostics`: Diagnósticos do catálogo.
*   `event_stats`: Estatísticas agregadas de eventos.
*   `external_event_sources`: Fontes de eventos externas (pixels, apps).
*   `flights`: Voos.
*   `home_listings`: Listagens de imóveis.
*   `hotel_rooms_batch`: Operações em lote com quartos de hotel.
*   `hotels`: Hotéis.
*   `pricing_variables_batch`: Operações em lote com preços de quartos.
*   `product_groups`: Grupos de produtos.
*   `product_sets`: Conjuntos de produtos.
*   `product_sets_batch`: Operações em lote com conjuntos de produtos.
*   `products`: Produtos.
*   `vehicle_offers`: Ofertas de veículos.
*   `vehicles`: Veículos.

## Criação
Cria um novo catálogo de produtos.

**Endpoint:** `POST /{business_id}/owned_product_catalogs`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `name` | string | **Obrigatório.** Nome do catálogo. |
| `vertical` | enum | Indústria ou vertical (ex: `commerce`, `hotels`, `vehicles`). Padrão: `commerce`. |
| `additional_vertical_option` | enum | Configurações adicionais de vertical. |
| `business_metadata` | JSON object | Metadados do negócio. |
| `catalog_segment_filter` | JSON rule | Filtro para criar segmento de catálogo. |
| `da_display_settings` | Object | Configurações de exibição de anúncios dinâmicos. |
| `destination_catalog_settings` | JSON object | Configurações para catálogos de destino. |
| `flight_catalog_settings` | JSON object | Configurações para catálogos de voo. |
| `parent_catalog_id` | numeric string | ID do catálogo pai. |
| `partner_integration` | JSON object | Configurações de integração de parceiros. |
| `store_catalog_settings` | JSON object | Configurações para catálogos de loja. |

### Retorno
```json
{
    "id": "numeric string"
}
```

## Atualização
Atualiza um catálogo existente.

**Endpoint:** `POST /{product_catalog_id}`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `name` | string | Novo nome do catálogo. |
| `fallback_image_url` | URI | URL da imagem de fallback. |
| `default_image_url` | URI | URL da imagem padrão. |
| `da_display_settings` | Object | Configurações de exibição de imagem. |
| `partner_integration` | JSON object | Configurações de integração. |
| `store_catalog_settings` | JSON object | Configurações de catálogo de loja. |

## Exclusão
Exclui um catálogo de produtos.

**Endpoint:** `DELETE /{product_catalog_id}`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `allow_delete_catalog_with_live_product_set` | boolean | Se `true`, força a exclusão mesmo com conjuntos de produtos ativos. Padrão: `false`. |

### Retorno
```json
{
    "success": true
}
```

## Associação de Usuários
Adiciona um usuário ao catálogo.

**Endpoint:** `POST /{product_catalog_id}/assigned_users`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `user` | UID | **Obrigatório.** ID do usuário. |
| `tasks` | array<enum> | **Obrigatório.** Permissões (ex: `MANAGE`, `ADVERTISE`). |

## Criação de Veículos
Adiciona um veículo ao catálogo.

**Endpoint:** `POST /{product_catalog_id}/vehicles`

### Parâmetros Principais
`make`, `model`, `year`, `price`, `title`, `description`, `images`, `url`, `vehicle_id`, `state_of_vehicle`, `currency`, `body_style`, `vin`.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **804** | Objeto especificado já existe. |
| **3970** | Necessário ser administrador para excluir. |
