# Recursos de IA Generativa (Generative AI Features)

Utilize a IA da Meta para gerar textos, expandir imagens e criar fundos automaticamente.

> **Aviso:** O uso desses recursos está sujeito aos Termos de IA Generativa de Criativo do Anúncio. Você é responsável por revisar as prévias antes de publicar.

## 1. Geração de Texto (`text_generation`)
Gera variações de texto principal (`message`) baseadas no texto original e histórico da conta.

### Configuração
- **Opt-in:** `text_generation: { enroll_status: "OPT_IN" }`
- **Requisito:** Fornecer um texto inicial em `message`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Text Gen Creative' \
  -F 'object_story_spec={
       "link_data": {
         "message": "<TEXTO_PRINCIPAL_ORIGINAL>",
         "link": "<URL>",
         "image_hash": "<HASH>"
       },
       "page_id": "<PAGE_ID>"
     }' \
  -F 'degrees_of_freedom_spec={
       "creative_features_spec": {
         "text_generation": { "enroll_status": "OPT_IN" }
       }
     }' \
  ...
```

### Prévia e Aprovação
1.  Crie o anúncio/criativo (o status será `PAUSED` por padrão se criado via `/ads`).
2.  Consulte o `asset_feed_spec` para ver as sugestões geradas.
3.  Se aprovado, atualize o status do anúncio para `ACTIVE`.

## 2. Expansão de Imagem (`image_uncrop`)
Expande automaticamente a imagem para preencher proporções de tela cheia (ex: Stories, Reels).

### Configuração
- **Opt-in:** `image_uncrop: { enroll_status: "OPT_IN" }`

```bash
curl -X POST ... \
  -F 'degrees_of_freedom_spec={
       "creative_features_spec": {
         "image_uncrop": { "enroll_status": "OPT_IN" }
       }
     }'
```

### Prévia
Use o endpoint de previews com `creative_feature=image_uncrop`.
- **Posicionamentos:** `INSTAGRAM_STANDARD`, `FACEBOOK_REELS_MOBILE`, `INSTAGRAM_REELS`, `MOBILE_FEED_STANDARD`, `INSTAGRAM_STORY`.

```bash
curl -G "https://graph.facebook.com/v24.0/<AD_ID>/previews" \
  -d 'ad_format=INSTAGRAM_STORY' \
  -d 'creative_feature=image_uncrop' \
  ...
```

## 3. Geração de Plano de Fundo (`image_background_gen`)
Cria fundos variados para imagens de produtos (Packshots) em Anúncios de Catálogo Advantage+.

### Configuração
- **Opt-in:** `image_background_gen: { enroll_status: "OPT_IN" }`
- **Requisito:** Anúncios de Catálogo (Product Set).

```bash
curl -X POST ... \
  -F 'product_set_id=<PRODUCT_SET_ID>' \
  -F 'degrees_of_freedom_spec={
       "creative_features_spec": {
         "image_background_gen": { "enroll_status": "OPT_IN" }
       }
     }'
```

### Prévia
Suportado apenas em `MOBILE_FEED_STANDARD`.

```bash
curl -G "https://graph.facebook.com/v24.0/<AD_ID>/previews" \
  -d 'ad_format=MOBILE_FEED_STANDARD' \
  -d 'creative_feature=image_background_gen' \
  ...
```
