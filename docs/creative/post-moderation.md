# Moderação de Posts de Anúncios (Instagram)

Gerencie comentários e interações nos posts gerados pelos seus anúncios.

## Identificadores de Mídia
- **`effective_instagram_media_id`:** ID do post do anúncio (Dark Post). Use para ver comentários **não orgânicos** (feitos no anúncio).
- **`source_instagram_media_id`:** ID do post orgânico original (se você impulsionou um post existente). Use para ver comentários **orgânicos**.

## Como Obter os IDs
Consulte o criativo do anúncio:
```bash
curl -G \
  -d "fields=instagram_permalink_url,effective_instagram_media_id" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/<AD_CREATIVE_ID>"
```

## Ler Comentários (Não Orgânicos)
```bash
curl -G \
  -d "fields=id,message,instagram_user" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/<EFFECTIVE_INSTAGRAM_MEDIA_ID>/comments"
```

## Gerenciamento de Comentários (Graph API do Instagram)
Para responder, ocultar ou excluir, use a Graph API do Instagram com o ID da mídia obtido.
- Requer permissões adicionais (`instagram_manage_comments`, etc).

## Limitações
- **Stories:** Não suportam comentários/moderação.
- **Catálogo Advantage+:** Não geram `effective_instagram_media_id` acessível para moderação via API de Marketing.
