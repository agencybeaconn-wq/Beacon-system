# Anúncios de App (Instalação e Engajamento)

Anúncios para impulsionar instalações e engajamento com apps para celular e computador.

## Tipos de Anúncio
- **Instalação de App Móvel:** Leva à App Store/Google Play.
- **Engajamento de App Móvel:** Abre o app (Deep Link).
- **Instalação/Engajamento Desktop:** Para apps de computador e jogos.

## Requisitos
- **Objetivo da Campanha:** `APP_INSTALLS`, `LINK_CLICKS` ou `CONVERSIONS`.
- **Direcionamento:** `user_os` (iOS/Android) e `device_platforms` (mobile).

## Criação de Criativo

### 1. Com Foto (Instalação)
```bash
curl -X POST \
  -F 'name="App Install Creative"' \
  -F 'object_story_spec={ 
    "page_id": "<PAGE_ID>", 
    "link_data": { 
      "call_to_action": { 
        "type": "INSTALL_MOBILE_APP", 
        "value": { "link": "<APP_STORE_URL>" } 
      }, 
      "image_hash": "<IMAGE_HASH>", 
      "link": "<APP_STORE_URL>", 
      "message": "Baixe agora!" 
    } 
  }' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

### 2. Com Vídeo
```bash
curl -F 'name=App Video Creative' \
  -F 'object_story_spec={ 
    "page_id": "<PAGE_ID>", 
    "video_data": { 
      "call_to_action": {"type":"INSTALL_MOBILE_APP","value":{"link":"<APP_STORE_URL>"}}, 
      "image_url": "<THUMBNAIL_URL>", 
      "video_id": "<VIDEO_ID>" 
    } 
  }' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

### 3. Com Deep Link (Engajamento)
Use `app_link` para abrir uma tela específica no app.

```bash
"call_to_action": { 
  "type": "USE_MOBILE_APP", 
  "value": { 
    "link": "<APP_STORE_URL>", 
    "app_link": "myapp://product/123" 
  } 
}
```

## Anúncios de Catálogo Advantage+ para Apps
Use um modelo dinâmico para promover produtos específicos dentro do app.

```bash
curl -X POST \
  -F 'name="Advantage+ App Creative"' \
  -F 'object_story_spec={ 
    "page_id": "<PAGE_ID>", 
    "template_data": { 
      "call_to_action": { 
        "type": "INSTALL_MOBILE_APP", 
        "value": { "link": "http://example.com/app" } 
      }, 
      "message": "Test {{product.name}}", 
      "link": "http://example.com/app" 
    } 
  }' \
  -F 'product_set_id="<PRODUCT_SET_ID>"' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```
