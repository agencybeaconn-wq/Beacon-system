# Anúncios em Vários Idiomas (Multi-language Ads)

Personalize criativos (texto, imagem, vídeo) para falantes de diferentes idiomas em um único anúncio.

## Visão Geral
- **Objetivos Suportados:** `APP_INSTALLS`, `BRAND_AWARENESS`, `CONVERSIONS`, `LINK_CLICKS`, `REACH`, `VIDEO_VIEWS`.
- **Ad Set:** `is_dynamic_creative=false`.

## Configuração (`asset_feed_spec`)
Use `asset_feed_spec` para fornecer ativos rotulados (`adlabels`) e `asset_customization_rules` para vincular esses rótulos a localidades (`locales`).

### 1. Rotule os Ativos
Adicione `adlabels` a cada ativo (título, corpo, imagem, etc.) para identificar o idioma.
```json
"bodies": [
  { "text": "Delicious recipe!", "adlabels": [{"name": "english"}] },
  { "text": "Délicieuse recette!", "adlabels": [{"name": "french"}] }
]
```

### 2. Defina as Regras (`asset_customization_rules`)
Crie regras vinculando `locales` aos rótulos.
- **Regra Padrão:** Obrigatória (`is_default: true`). Define o que mostrar se o usuário não corresponder a nenhuma outra regra.

```json
"asset_customization_rules": [
  {
    "customization_spec": { "locales": [9, 44] }, // IDs para Francês
    "body_label": { "name": "french" },
    "title_label": { "name": "french" },
    ...
  },
  {
    "is_default": true,
    "customization_spec": { "locales": [24] }, // ID para Inglês (US)
    "body_label": { "name": "english" },
    ...
  }
]
```

### Exemplo Completo
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'object_story_spec={ "page_id": "<PAGE_ID>" }' \
  -F 'asset_feed_spec={
       "ad_formats": ["SINGLE_IMAGE"],
       "bodies": [
         { "text": "Hello", "adlabels": [{"name": "en"}] },
         { "text": "Hola", "adlabels": [{"name": "es"}] }
       ],
       "images": [
         { "hash": "<HASH>", "adlabels": [{"name": "en"}] },
         { "hash": "<HASH>", "adlabels": [{"name": "es"}] }
       ],
       "asset_customization_rules": [
         {
           "customization_spec": { "locales": [8] }, // Espanhol
           "body_label": { "name": "es" },
           "image_label": { "name": "es" }
         },
         {
           "is_default": true,
           "customization_spec": { "locales": [6] }, // Inglês
           "body_label": { "name": "en" },
           "image_label": { "name": "en" }
         }
       ]
     }' \
  ...
```

## Tradução Automática (`autotranslate`)
O Facebook pode traduzir automaticamente seu texto padrão.
- Adicione `autotranslate: ["fr_XX", "es_XX"]` ao `asset_feed_spec`.
- Os textos traduzidos aparecerão como "Traduzida automaticamente".

```json
"asset_feed_spec": {
  "autotranslate": ["fr_XX"],
  "bodies": [{ "text": "Original Text", "adlabels": [{"name": "english"}] }],
  ...
}
```

## Localidades (Locales)
Use a API de Pesquisa para encontrar IDs de localidade:
```bash
curl -G "https://graph.facebook.com/v24.0/search?type=adlocale&q=en"
```
Exemplos comuns:
- `6`: English (US)
- `24`: English (UK)
- `8`: Spanish
- `9`: French (France)
- `12`: Portuguese (Brazil)
