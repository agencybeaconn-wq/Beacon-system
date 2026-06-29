# Anúncios de Catálogo Advantage+ no Instagram

Use catálogos de produtos para criar anúncios dinâmicos no Feed, Stories e Explorar do Instagram.

## Criação do Criativo
Use `template_data` dentro de `object_story_spec`.

```json
{
  "object_story_spec": {
    "page_id": "<PAGE_ID>",
    "instagram_user_id": "<IG_USER_ID>",
    "template_data": {
      "message": "{{product.name}}",
      "name": "{{product.price}}", 
      "link": "<LINK>",
      "call_to_action": {
        "type": "SHOP_NOW"
      }
    }
  },
  "product_set_id": "<PRODUCT_SET_ID>"
}
```

## Requisitos de Imagem
- **Fonte:** `image_url` do produto ou `additional_image_urls`.
- **Resolução:** Mínimo 600x600px.
- **Corte:** Imagens não quadradas serão cortadas automaticamente.

## Limitações no Instagram
- **Campos Ignorados:** `description` (aparece só no Facebook).
- **Recursos Não Suportados:** Sobreposições, Cartões Fixos, Cartões de Mapa, Vídeos do Catálogo (nos Stories).
- **Sem Permalinks:** Como são dinâmicos, não geram `instagram_permalink_url` nem permitem recuperar curtidas/comentários via API.
