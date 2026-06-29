# Audience Network Ads

O Audience Network permite veicular anúncios em aplicativos e sites móveis de terceiros, estendendo o alcance das campanhas do Facebook.

## Visão Geral
- **Plataformas:** Apps iOS/Android e sites móveis de parceiros.
- **Criativos Suportados:** Imagem/Vídeo (Mobile App), Links, Carrossel, Advantage+ Catalog.
- **Objetivos Suportados:** `MOBILE_APP_INSTALLS`, `MOBILE_APP_ENGAGEMENT`, `LINK_CLICKS`, `CONVERSIONS`, `PRODUCT_CATALOG_SALES`.
- **Restrição:** Não suporta tamanhos IAB padrão. Deve ser usado em conjunto com outra plataforma (ex: `facebook`), não isoladamente.

## Configuração de Ad Set
Para veicular no Audience Network, é necessário configurar o `targeting` corretamente.

```json
"targeting": {
  "device_platforms": ["mobile"],
  "geo_locations": {"countries":["US"]},
  "publisher_platforms": ["facebook", "audience_network"],
  "audience_network_positions": ["classic", "instream_video", "rewarded_video"] // Opcional: especificar posições
}
```

## Criação de Anúncios

### 1. Anúncio de Link (Tráfego/Conversão)
```bash
# 1. Campanha
curl -X POST -F 'objective="OUTCOME_TRAFFIC"' ...

# 2. Ad Set (com publisher_platforms=["audience_network"])
curl -X POST -F 'targeting={...}' ...

# 3. Criativo
curl -X POST \
  -F 'object_story_spec={
    "link_data": {
      "image_hash": "<HASH>",
      "link": "<URL>",
      "message": "Try it out"
    },
    "page_id": "<PAGE_ID>"
  }' ...

# 4. Anúncio
curl -X POST -F 'creative={"creative_id":"<ID>"}' ...
```

### 2. Mobile App Ads (Instalação/Engajamento)
- **Objetivo:** `OUTCOME_APP_PROMOTION` (antigo `APP_INSTALLS`).
- **Ad Set:** Deve incluir `promoted_object` com `application_id` e `object_store_url`.
- **Criativo:** `call_to_action` do tipo `INSTALL_MOBILE_APP`.

```bash
# Criativo de Imagem
curl -F 'object_story_spec={
  "link_data": {
    "call_to_action": {"type":"INSTALL_MOBILE_APP", "value":{"link":"<STORE_URL>"}},
    "image_hash": "<HASH>",
    "link": "<STORE_URL>",
    ...
  },
  "page_id": "<PAGE_ID>"
}' ...

# Criativo de Vídeo
curl -F 'object_story_spec={
  "video_data": {
    "call_to_action": {"type":"INSTALL_MOBILE_APP", "value":{"link":"<STORE_URL>"}},
    "image_url": "<THUMBNAIL>",
    "video_id": "<VIDEO_ID>"
  },
  "page_id": "<PAGE_ID>"
}' ...
```

### 3. Carrossel
- No Audience Network, **apenas os dois primeiros cards** (`child_attachments`) são exibidos.
- Objetivos: Instalação, Engajamento, Tráfego, Conversão.

### 4. Advantage+ Catalog Ads
- **Objetivo:** `PRODUCT_CATALOG_SALES`.
- **Requisito:** `publisher_platforms` deve incluir `audience_network`.

## Prévia (Ad Preview)
Gera um iframe (válido por 24h) para visualizar o anúncio.

**Formatos (`ad_format`):**
- `MOBILE_BANNER`, `MOBILE_INTERSTITIAL`, `MOBILE_NATIVE`
- `MOBILE_MEDIUM_RECTANGLE`, `MOBILE_FULLWIDTH`
- `AUDIENCE_NETWORK_INSTREAM_VIDEO`, `AUDIENCE_NETWORK_REWARDED_VIDEO`
- `AUDIENCE_NETWORK_NATIVE_BANNER`

```bash
GET https://graph.facebook.com/v24.0/<AD_ID>/previews?ad_format=MOBILE_INTERSTITIAL
```

## Métricas e Relatórios
Para analisar performance específica no Audience Network, use `breakdowns=['publisher_platform']`.

- **`placement` nos insights:**
    - `mobile_feed`: Feed do Facebook Mobile.
    - `mobile_video_channel`: Vídeos sugeridos no mobile (pode incluir Audience Network dependendo do contexto, mas geralmente Audience Network aparece separado no breakdown de plataforma).
    - *Nota: A documentação original menciona `mobile_video_channel` como feeds de vídeo sugeridos, verifique o breakdown de plataforma para confirmar a entrega no Audience Network.*
