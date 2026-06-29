# Públicos Dinâmicos de Produto (Dynamic Product Audiences)

Configure estratégias de Retargeting, Cross-sell e Upsell para Anúncios de Catálogo Advantage+.

## Estrutura `product_audience_specs`
Define regras de inclusão e exclusão baseadas em eventos do pixel/app (`ViewContent`, `AddToCart`, `Purchase`).

### Parâmetros
- **product_set_id:** O conjunto de produtos relacionado à ação.
- **inclusions/exclusions:** Lista de regras.
- **retention_seconds:** Janela de tempo (ex: 864000s = 10 dias).
- **rule:** Evento (`eq: "ViewContent"`).

## Cenários Comuns

### 1. Retargeting (Visualizou ou Adicionou ao Carrinho, mas não Comprou)
Pessoas que interagiram com produtos do conjunto nos últimos dias.
```json
"product_audience_specs": [
  {
    "product_set_id": "<PRODUCT_SET_ID>",
    "inclusions": [
      {
        "retention_seconds": 432000, // 5 dias
        "rule": { "event": { "eq": "ViewContent" } }
      },
      {
        "retention_seconds": 432000,
        "rule": { "event": { "eq": "AddToCart" } }
      }
    ],
    "exclusions": [
      {
        "retention_seconds": 432000,
        "rule": { "event": { "eq": "Purchase" } }
      }
    ]
  }
]
```

### 2. Cross-Sell (Venda Cruzada)
Promover **Conjunto A** (ex: Bolsas) para quem comprou do **Conjunto B** (ex: Sapatos).
- No `promoted_object` do Ad Set: Use ID do Conjunto A.
- No `product_audience_specs`: Use ID do Conjunto B (Inclusão: Purchase).

```json
"promoted_object": { "product_set_id": "<PRODUCT_SET_A_ID>" },
"targeting": {
  "product_audience_specs": [
    {
      "product_set_id": "<PRODUCT_SET_B_ID>",
      "inclusions": [
        {
          "retention_seconds": 2592000, // 30 dias
          "rule": { "event": { "eq": "Purchase" } }
        }
      ]
    }
  ]
}
```

### 3. Upsell
Promover produtos mais caros ou versões premium para quem visualizou produtos de uma categoria.

### 4. Público Amplo (Broad Audience)
Alcançar novos clientes que não interagiram com seu site, mas têm perfil para comprar.
- **Não** use `product_audience_specs` de inclusão.
- Use apenas demografia (`age`, `gender`, `geo_locations`).
- Use `exclusions` para remover compradores recentes.

```json
"targeting": {
  "geo_locations": { "countries": ["US"] },
  "age_min": 18,
  "excluded_product_audience_specs": [
    {
      "product_set_id": "<PRODUCT_SET_ID>",
      "inclusions": [
        {
          "retention_seconds": 864000, // 10 dias
          "rule": { "event": { "eq": "Purchase" } }
        }
      ]
    }
  ]
}
```
