# Anúncios de Lojas (Shops Ads)

Direcione clientes para sua Loja no Facebook/Instagram ou para seu site, dependendo da probabilidade de compra.

## Pré-requisitos
- Loja com checkout habilitado (Facebook/Instagram).
- Catálogo conectado à loja.
- Permissão `catalog_management`.

## 1. Campanha
Objetivos suportados: `PRODUCT_CATALOG_SALES`, `CONVERSIONS`, ou `OUTCOME_SALES` (ODAX).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Shops Ads Campaign' \
  -F 'objective=OUTCOME_SALES' \
  -F 'promoted_object={"product_catalog_id":"<CATALOG_ID>"}' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Conjunto de Anúncios
- **Destination Type:** `SHOP_AUTOMATIC`.
- **Billing Event:** `IMPRESSIONS`.
- **Bid Strategy:** Sem limite de custo (ex: `LOWEST_COST_WITHOUT_CAP`).
- **Promoted Object:** Deve incluir `omnichannel_object` com `onsite` (ID da conta comercial) e `pixel`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Shops Ad Set' \
  -F 'destination_type=SHOP_AUTOMATIC' \
  -F 'promoted_object={
       "omnichannel_object": {
         "onsite": [{"commerce_merchant_settings_id": "<COMMERCE_ID>"}],
         "pixel": [{"pixel_id": "<PIXEL_ID>", "custom_event_type": "PURCHASE"}]
       }
     }' \
  -F 'targeting={"geo_locations": {"countries":["US"]}}' \
  ...
```

## 3. Criativo
Defina o destino local (`onsite_destinations`) e otimizações de loja (`shops_bundle`).

### Destinos Locais (`onsite_destinations`)
- **Vitrine:** `storefront_shop_id`
- **Conjunto de Produtos:** `shop_collection_product_set_id`
- **Produto Específico:** `details_page_product_id`

### Otimizações (`shops_bundle`)
- **Automated Product Tags:** `automated_product_tags: true` (em `template_data`).
- **Reasons to Shop:** `reasons_to_shop: true` (em `asset_feed_spec`).

### Exemplo de Criativo (Imagem com Destino Vitrine)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Shops Creative' \
  -F 'asset_feed_spec={ "onsite_destinations": [{ "storefront_shop_id": "<SHOP_ID>" }] }' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "link_data": {
         "image_hash": "<HASH>",
         "link": "<WEBSITE_URL>",
         "message": "Visite nossa loja!"
       }
     }' \
  ...
```

### Exemplo com Otimizações (Reasons to Shop)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Shops Optimized Creative' \
  -F 'product_set_id="<PRODUCT_SET_ID>"' \
  -F 'asset_feed_spec={ "reasons_to_shop": true }' \
  -F 'object_story_spec={ ... }' \
  ...
```

## Integração com Advantage+ Shopping
Siga o mesmo processo de `destination_type=SHOP_AUTOMATIC` dentro de uma campanha Advantage+ Shopping (ASC).
