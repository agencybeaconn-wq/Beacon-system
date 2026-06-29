# Gerenciamento de Imagens com Várias Proporções (Multi-Aspect Ratio)

Otimize a exibição de produtos em diferentes posicionamentos (Feed 1:1, Stories 9:16) usando tags de imagem no Catálogo.

## Seleção por Tags Automáticas
O sistema seleciona automaticamente a imagem correta se ela tiver uma das seguintes tags no feed de produtos:

- **`INSTAGRAM_PREFERRED`**: Para Instagram (geral).
- **`STORY_PREFERRED`**: Para Facebook/Instagram Stories (9:16).
- **`REELS_PREFERRED`**: Para Facebook/Instagram Reels (9:16).
- **`ASPECT_RATIO_4_5_PREFERRED`**: Para posicionamentos verticais 4:5.
- **`ASPECT_RATIO_9_16_PREFERRED`**: Para posicionamentos verticais 9:16.

## Adaptar ao Posicionamento (`adapt_to_placement`)
Habilite para permitir que o sistema use automaticamente a melhor imagem disponível (ex: usar a imagem 9:16 em Stories em vez de cortar a 1:1).

- **Configuração:** Defina `adapt_to_placement: true` no `creative_spec`.
- **Fallback:** Se não houver imagem 9:16, o sistema preenche o fundo com a cor predominante.

## Tags Personalizadas (`preferred_image_tags`)
Para controle manual avançado, use `preferred_image_tags` no criativo.

### JSON para Múltiplas Proporções
Você pode fornecer um JSON serializado para definir tags específicas por proporção.

```json
{
  "DEFAULT": "minha-tag-padrao",
  "4_5": "minha-tag-4-5",
  "9_16": "minha-tag-9-16"
}
```

### Exemplo no Criativo
```bash
curl -X POST ... \
  -F 'object_story_spec={
       "template_data": {
         "preferred_image_tags": [
           "{\"DEFAULT\":\"tag_padrao_1\",\"9_16\":\"tag_stories_1\"}",
           "{\"DEFAULT\":\"tag_padrao_2\",\"9_16\":\"tag_stories_2\"}"
         ]
       }
     }'
```
Neste exemplo, se o anúncio for exibido em um Story (9:16), o sistema buscará imagens com a tag `tag_stories_1`. Se não for Story, buscará `tag_padrao_1`.
