# Recursos do Advantage+ Creative (Advantage+ Creative Features)

Otimize automaticamente seus criativos com recursos de IA e aprimoramentos visuais.

## Visão Geral
A partir da v22.0, você deve optar individualmente por cada recurso usando `creative_features_spec` dentro de `degrees_of_freedom_spec`. O antigo pacote "Standard Enhancements" está sendo descontinuado.

## Como Habilitar (Opt-in)
Você pode habilitar recursos ao criar um Criativo (`/adcreatives`) ou um Anúncio (`/ads`).

### Exemplo de Payload
```json
"degrees_of_freedom_spec": {
  "creative_features_spec": {
    "image_touchups": { "enroll_status": "OPT_IN" },
    "inline_comment": { "enroll_status": "OPT_IN" },
    "image_template": { "enroll_status": "OPT_IN" }
  }
}
```

## Lista de Recursos Disponíveis

| Nome Técnico | Nome no Gerenciador | Descrição |
| :--- | :--- | :--- |
| `text_translation` | Traduzir texto | Traduz automaticamente para outros idiomas. |
| `inline_comment` | Comentários relevantes | Exibe o comentário mais relevante abaixo do anúncio. |
| `image_templates` | Adicionar sobreposições | Adiciona overlays de texto (IA) para melhorar performance. |
| `image_touchups` | Retoques visuais | Corta e expande imagens automaticamente. |
| `video_auto_crop` | Retoques visuais (Vídeo) | Corta e expande vídeos automaticamente. |
| `image_brightness_and_contrast` | Brilho e contraste | Ajusta brilho/contraste. |
| `enhance_cta` | Aprimorar CTA | Adiciona frases-chave ao botão CTA. |
| `text_optimizations` | Melhorias de texto | Troca texto principal/título/descrição se melhorar performance. |
| `image_background_gen` | Gerar fundos | Cria fundos via IA para produtos (Packshot). |
| `image_uncrop` | Expandir imagem | Expande a imagem via IA para preencher o formato. |
| `adapt_to_placement` | Adaptar ao posicionamento | Usa imagens 9:16 do catálogo em Stories/Reels. |
| `media_type_automation` | Mídia dinâmica | Usa vídeos do catálogo em vez de imagens estáticas. |
| `product_extensions` | Adicionar itens do catálogo | Mostra produtos do catálogo abaixo da mídia principal. |
| `description_automation` | Descrição dinâmica | Usa dados do catálogo na descrição automaticamente. |
| `creative_stickers` | Sticker CTA | Adiciona adesivos de CTA gerados por IA. |
| `reveal_details_over_time` | Revelar detalhes | Mostra detalhes do produto após alguns segundos de visualização. |
| `pac_relaxation` | Mídia flexível | Usa a mídia escolhida em todos os posicionamentos se performar melhor. |

### Recurso de Música
A música é habilitada via `asset_feed_spec`, não `creative_features_spec`.
```json
"asset_feed_spec": {
  "audios": [{ "type": "random" }]
}
```

## Fluxo de Criação com IA
Se você usar recursos de IA (`image_background_gen`, `image_uncrop`, etc.):
1.  Crie o anúncio com status `PAUSED`.
2.  Gere prévias para validar.
3.  Atualize o status para `ACTIVE`.

## Prévia (Preview)
Para visualizar o efeito de um recurso específico:

```bash
curl -G \
  -d 'ad_format="DESKTOP_FEED_STANDARD"' \
  -d 'creative_feature=image_templates' \
  -d 'access_token=<ACCESS_TOKEN>' \
  "https://graph.facebook.com/v24.0/<AD_ID>/previews"
```
