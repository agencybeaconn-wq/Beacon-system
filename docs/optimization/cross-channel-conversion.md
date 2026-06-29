# Otimização para Conversão entre Canais (Cross-Channel Conversion Optimization)

Permite otimizar conversões tanto para o site quanto para o app dentro de uma única campanha, capturando mais dados e potencialmente reduzindo o CPA.

## Principais Benefícios
- **Simplicidade:** Uma única campanha para Site e App.
- **Eficiência:** Otimiza para onde a conversão é mais provável.

## Requisitos e Restrições
- **Objetivo:** Apenas `CONVERSIONS`.
- **Eventos Suportados:** `PURCHASE`, `COMPLETE_REGISTRATION`, `ADD_PAYMENT_INFO`, `ADD_TO_CART`, `INITIATED_CHECKOUT`, `SEARCH`, `CONTENT_VIEW`, `LEAD`, `ADD_TO_WISHLIST`, `SUBSCRIBE`, `START_TRIAL`.
- **Estratégia de Lance:** `LOWEST_COST_WITHOUT_CAP` ou `LOWEST_COST_WITH_BID_CAP`.
- **Posicionamentos:** Disponível para Facebook e Instagram (exceto Audience Network, Messenger, Instant Articles).

## Configuração do Conjunto de Anúncios

### Campos Obrigatórios
1.  **`optimization_goal`**: Defina como `OFFSITE_CONVERSIONS` (ou `CONVERSIONS` dependendo da versão, mas a doc menciona `OFFSITE_CONVERSIONS` para conversões fora do site). *Nota: O exemplo JSON usa `CONVERSIONS`.*
2.  **`billing_event`**: `IMPRESSIONS`.
3.  **`promoted_object`**: Deve conter o objeto `omnichannel_object`.

### Estrutura do `omnichannel_object`
Define os destinos de App e Pixel. O `custom_event_type` deve ser o mesmo em ambos.

```json
{
  "daily_budget": 20000,
  "optimization_goal": "CONVERSIONS",
  "promoted_object": {
    "omnichannel_object": {
      "app": [
        {
          "application_id": "<APP_ID>",
          "custom_event_type": "PURCHASE",
          "object_store_urls": [
            "https://play.google.com/store/apps/details?id=com.example",
            "https://apps.apple.com/us/app/example/id123456"
          ]
        }
      ],
      "pixel": [
        {
          "pixel_id": "<PIXEL_ID>",
          "custom_event_type": "PURCHASE"
        }
      ]
    }
  }
}
```

## Configuração do Anúncio (`tracking_specs`)
O `tracking_specs` deve rastrear tanto o Pixel quanto o App.

```json
{
  "tracking_specs": [
    {
      "action.type": ["offsite_conversion"],
      "fb_pixel": ["<PIXEL_ID>"]
    },
    {
      "action.type": ["mobile_app_install"],
      "application": ["<APP_ID>"]
    },
    {
      "action.type": ["app_custom_event"],
      "application": ["<APP_ID>"]
    }
  ]
}
```

## Configuração do Criativo

### Opção A: Advantage+ Catalog Ads (Dinâmico)
Use `template_url_spec` para deep links dinâmicos.

```json
{
  "creative": {
    "applink_treatment": "deeplink_with_web_fallback",
    "template_url_spec": {
      "android": { "url": "example://product/{{product.retailer_id}}" },
      "ios": { "url": "example://product/{{product.name}}" },
      "web": { "url": "https://www.example.com/product/{{product.name}}" }
    }
  }
}
```

### Opção B: Anúncios Manuais
Use `omnichannel_link_spec`.

```json
{
  "applink_treatment": "deeplink_with_web_fallback",
  "omnichannel_link_spec": {
    "web": {
      "url": "https://www.example.com/page"
    },
    "app": {
      "application_id": "<APP_ID>",
      "platform_specs": {
        "android": { "url": "example://page" },
        "ios": { "url": "example://page" }
      }
    }
  }
}
```
