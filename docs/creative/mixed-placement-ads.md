# Anúncios com Posicionamentos Mistos

Crie anúncios que funcionam no Facebook e Instagram simultaneamente, com personalizações específicas para cada plataforma.

## Personalização por Plataforma (`platform_customizations`)
Use este parâmetro para fornecer uma imagem ou vídeo diferente especificamente para o Instagram, mantendo o criativo original para o Facebook.

### Exemplo de Payload
```json
{
  "name": "Mixed Placement Creative",
  "object_story_spec": {
    "page_id": "<PAGE_ID>",
    "instagram_user_id": "<IG_USER_ID>",
    "link_data": {
      "message": "Anúncio padrão para Facebook",
      "link": "http://example.com",
      "image_hash": "<FB_IMAGE_HASH>",
      "call_to_action": {
        "type": "LEARN_MORE",
        "value": { "link": "http://example.com" }
      }
    }
  },
  "platform_customizations": {
    "instagram": {
      "image_url": "http://example.com/ig-optimized-image.jpg",
      "image_crops": {
        "100x100": [[200,90], [900,790]]
      }
    }
  }
}
```

### Regras
- **Chaves Permitidas:** Apenas `instagram`.
- **Campos Substituíveis:** `image_url`, `image_hash`, `video_id`, `image_crops`.
- **Não Suportado:** Substituição de texto ou uso em Anúncios de Catálogo Advantage+.
- **Chamada para Ação (CTA):** Opcional, padrão é `LEARN_MORE`.

### Dica
Evite criar anúncios de `WEBSITE_CLICKS` que linkam para sua própria Página do Facebook ou Perfil do Instagram, pois isso gera uma experiência ruim de login no navegador in-app.
