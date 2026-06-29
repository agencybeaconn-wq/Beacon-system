# Modelos de Criativo de Catálogo (Catalog Creative Templates)

Configure como os produtos do catálogo são exibidos nos anúncios usando templates dinâmicos e macros.

## Template Data (`template_data`)
Define o conteúdo dinâmico.

### Macros Disponíveis
O Facebook substitui `{{campo}}` pelo valor do feed de produtos.
- `{{product.name}}`: Título do produto.
- `{{product.description}}`: Descrição.
- `{{product.price}}`: Preço formatado.
- `{{product.current_price}}`: Preço promocional (ou normal se não houver promoção).
- `{{product.brand}}`: Marca.
- `{{product.retailer_id}}`: ID do produto.

### Opções e Transformações
- `{{product.price | raw}}`: Remove símbolo da moeda.
- `{{product.price | strip_zeros}}`: Remove .00.
- `{{product.name | titleize}}`: Capitaliza Primeira Letra.
- `{{product.url | urlencode}}`: Codifica para URL.

## Formatos

### Carrossel (Padrão)
Mostra múltiplos produtos.
- **Cartão Estático (Intro/Fim):** Use `child_attachments` com `static_card: true`.
- **Slideshow por Cartão:** `format_option: "carousel_slideshows"` (se o produto tiver várias imagens).

### Imagem Única / Link
Força um único produto.
- `force_single_link: true`
- `multi_share_end_card: false`

### Exemplo de Carrossel com Cartão Estático
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Catalog Carousel with Intro' \
  -F 'product_set_id=<PRODUCT_SET_ID>' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "template_data": {
         "message": "Confira nossas ofertas!",
         "child_attachments": [
           {
             "static_card": true,
             "name": "Super Promoção",
             "description": "Até 50% OFF",
             "image_hash": "<IMAGE_HASH>",
             "call_to_action": {"type": "SHOP_NOW"},
             "link": "https://site.com/promo"
           },
           {
             "name": "{{product.name}}",
             "description": "{{product.price}}",
             "call_to_action": {"type": "SHOP_NOW"}
           }
         ]
       }
     }'
```

## Categorias de Anúncio (`categorization_criteria`)
Promova categorias (ex: "Tênis", "Camisetas") em vez de produtos individuais. O Facebook gera colagens ou usa imagens de categoria.

```bash
curl -X POST ... \
  -F 'categorization_criteria=product_type' \
  -F 'category_media_source=MIXED' \
  -F 'object_story_spec={
       "template_data": {
         "name": "{{category.name}}",
         "description": "{{category.description}}",
         "message": "Explore nossas categorias"
       }
     }'
```

## Deep Links e Rastreamento
Use `template_url_spec` para construir URLs complexas com parâmetros de rastreamento ou Deep Links.

```json
"template_url_spec": {
  "ios": {
    "url": "myapp://product/{{product.retailer_id}}",
    "app_store_id": "123"
  },
  "web": {
    "url": "https://site.com/p/{{product.retailer_id}}?utm_source=fb"
  }
}
```

### App Link Treatment
- `deeplink_with_web_fallback`: Tenta abrir App, senão vai para Web.
- `deeplink_with_appstore_fallback`: Tenta abrir App, senão vai para Store.

## Etiquetas Automáticas (`automated_product_tags`)
Adiciona tags (ex: preço, nome) automaticamente na imagem.
- Defina `automated_product_tags: true` em `template_data`.
