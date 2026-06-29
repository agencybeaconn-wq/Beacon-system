# Anúncios de Catálogo Advantage+ para Apps Móveis

Direcione usuários para seu App (iOS/Android) usando o Catálogo de Produtos.

## 1. Configuração do SDK e Eventos
Para que o algoritmo funcione, o App deve enviar os mesmos eventos que o Pixel da Web.

### Mapeamento de Eventos Obrigatórios
| Evento Web | iOS SDK (`logEvent`) | Android SDK (`AppEventsConstants`) |
| :--- | :--- | :--- |
| `ViewContent` | `FBSDKAppEventNameViewedContent` | `EVENT_NAME_VIEWED_CONTENT` |
| `AddToCart` | `FBSDKAppEventNameAddedToCart` | `EVENT_NAME_ADDED_TO_CART` |
| `Purchase` | `logPurchase` | `EVENT_NAME_PURCHASED` |

### Exemplo de Código (Objective-C - ViewContent)
```objective-c
[[FBSDKAppEvents shared] logEvent:FBSDKAppEventNameViewedContent
  valueToSum:54.23
  parameters:@{
    FBSDKAppEventParameterNameCurrency    : @"USD",
    FBSDKAppEventParameterNameContentType : @"product",
    FBSDKAppEventParameterNameContentID   : @"123456789" // Deve bater com o ID no Catálogo
  }
];
```

## 2. Deep Linking e Fallback
Defina o comportamento do clique (`applink_treatment`) no nível do criativo.

### Opções de Tratamento (`applink_treatment`)
- **`web_only`**: Sempre envia para o site (padrão se não configurado).
- **`deeplink_with_web_fallback`**: Tenta abrir o App (Deep Link). Se não instalado, vai para o Site. **(Recomendado para Vendas)**.
- **`deeplink_with_appstore_fallback`**: Tenta abrir o App. Se não instalado, vai para a Loja de Apps (App Store/Play Store).

### Exemplo de Configuração
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Mobile Catalog Creative' \
  -F 'applink_treatment=deeplink_with_web_fallback' \
  -F 'object_story_spec={ ... }' \
  ...
```

## 3. Especificações de Rastreamento (`tracking_spec`)
Para medir conversões corretamente, inclua `app_custom_event` e `mobile_app_install` além de `offsite_conversion`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'tracking_spec=[
       {"action.type":["app_custom_event"], "application":["<APP_ID>"]},
       {"action.type":["mobile_app_install"], "application":["<APP_ID>"]},
       {"action.type":["offsite_conversion"], "fb_pixel":["<PIXEL_ID>"]}
     ]' \
  ...
```
