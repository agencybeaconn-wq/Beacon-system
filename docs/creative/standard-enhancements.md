# Standard Enhancements for Advantage+ Creative (Depreciado)

> **Aviso:** A partir da API v22.0, o pacote "Standard Enhancements" está sendo descontinuado em favor do opt-in individual de recursos (veja `advantage-plus-creative-features.md`).

## Visão Geral
O "Standard Enhancements" era um pacote que ativava automaticamente várias otimizações de criativo, como:
- Ajuste de proporção de imagem/vídeo.
- Aplicação de modelos (templates).
- Exibição de comentários relevantes.

## Mapeamento de Recursos
Ao optar por `standard_enhancements`, você estava efetivamente ativando:

**Para Imagens:**
- `image_template`
- `image_touchups`
- `text_optimizations`
- `inline_comment`

**Para Vídeos:**
- `video_auto_crop`
- `text_optimizations`
- `inline_comment`

## Configuração (Legado)
Para versões anteriores ou compatibilidade, o uso era via `creative_features_spec`.

### Exemplo de Opt-in
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Creative with Standard Enhancements' \
  -F 'object_story_spec={ ... }' \
  -F 'degrees_of_freedom_spec={
       "creative_features_spec": {
         "standard_enhancements": {
           "enroll_status": "OPT_IN"
         }
       }
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Exemplo na Criação do Anúncio
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'creative={
       "object_story_spec": { ... },
       "degrees_of_freedom_spec": {
         "creative_features_spec": {
           "standard_enhancements": {
             "enroll_status": "OPT_IN"
           }
         }
       }
     }' \
  ...
```
