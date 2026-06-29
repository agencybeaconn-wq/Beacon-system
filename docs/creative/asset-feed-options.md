# Opções de Especificação do Feed de Ativos

Detalhes dos campos disponíveis em `asset_feed_spec` e suas restrições.

## Campos Principais

### Mídia
- **`images`**: Lista de objetos `{"hash": "HASH"}`. Max 10.
- **`videos`**: Lista de objetos `{"video_id": "ID", "thumbnail_url": "URL"}`. Max 10.
- **`carousels`**: Lista de `child_attachments`.

### Texto
- **`bodies`**: Texto principal do anúncio. Max 5.
- **`titles`**: Título (headline). Max 5.
- **`descriptions`**: Descrição do link (feed news). Max 5.

### Ação e Destino
- **`call_to_action_types`**: Ex: `["LEARN_MORE", "SHOP_NOW"]`. Max 5.
- **`link_urls`**: Lista de `{"website_url": "URL"}`. Max 5.
- **`ad_formats`**: `["SINGLE_IMAGE"]`, `["SINGLE_VIDEO"]`, `["CAROUSEL"]` ou `["AUTOMATIC_FORMAT"]`.

### Otimização e Extensões
- **`optimization_type`**: `ASSET_CUSTOMIZATION`, `LANGUAGE`, `PLACEMENT`, `REGULAR`.
- **`message_extensions`**: `[{"type": "whatsapp"}]` (Botão de WhatsApp no site).

### Lojas (Shops)
- **`onsite_destinations`**: Destino na loja (`storefront_shop_id`, `shop_collection_product_set_id`, `details_page_product_id`).
- **`shops_bundle`**: `true` para otimizações de loja.
- **`reasons_to_shop`**: `true` para destacar "Frete Grátis", "Em Alta", etc.

## Restrições
- **Total de Ativos:** Máximo de 30 ativos combinados.
- **Imagens/Vídeos:** Máximo 10 cada.
- **Textos (Corpo, Título, Descrição, Link, CTA):** Máximo 5 cada.
- **Formatos:** Apenas 1 `ad_format` permitido por feed.

## Recursos Avançados

### Deep Links
Para objetivos `APP_INSTALLS`, `CONVERSIONS`, `LINK_CLICKS`.
```json
"link_urls": [{
  "website_url": "<APP_STORE_URL>",
  "deeplink_url": "<DEEPLINK_SCHEME>"
}]
```

### Extensão de WhatsApp (Botão no Site)
Adiciona um botão flutuante do WhatsApp na landing page (requer suporte do navegador in-app).
```json
"message_extensions": [{
  "type": "whatsapp"
}]
```
