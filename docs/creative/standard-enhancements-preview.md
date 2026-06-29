# Prévia dos Aprimoramentos Padrão (Standard Enhancements Preview)

> **Aviso:** A partir da v22.0, as prévias de aprimoramentos padrão estão sendo descontinuadas em favor de prévias de recursos individuais (Advantage+ Creative).

## Sub-recursos Incluídos
- **Imagem Única:** `image_template`, `image_touchups`, `text_optimizations`, `inline_comment`.
- **Vídeo Único:** `video_auto_crop`, `text_optimizations`, `inline_comment`.

## Como Gerar Prévias

### Funcionalidade Atualizada (v22.0+)
Use o parâmetro `creative_feature=standard_enhancements`.

```bash
curl -G \
  -d 'ad_format="DESKTOP_FEED_STANDARD"' \
  -d 'creative_feature=standard_enhancements' \
  -d 'access_token=<ACCESS_TOKEN>' \
  "https://graph.facebook.com/v24.0/<CREATIVE_ID>/previews"
```

### Resposta Exemplo
```json
{
  "data": [
    {
      "body": "<preview_link>",
      "transformation_spec": {
        "standard_enhancements": [
          {
            "body": "<preview_link>",
            "optimization_type_description": "Vary image aspect ratio",
            "status": "eligible"
          }
        ]
      }
    }
  ]
}
```

## Limitações
- **Posicionamentos Suportados:** `MOBILE_FEED_STANDARD`, `INSTAGRAM_STANDARD`, `INSTAGRAM_REELS`, `INSTAGRAM_STORY`.
- **Recortes:** Imagens podem parecer cortadas no Mobile Feed se a proporção não for compatível.
- **Não Suportado na Prévia:** `inline_comment`, `text_optimizations` (Liquidez de texto).
