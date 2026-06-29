# Gerar um Criativo do Anúncio

Gerar um criativo envolve definir os elementos visuais e textuais que serão exibidos no seu anúncio (imagem, vídeo, carrossel, etc).

Para isso, envie uma solicitação `POST` ao ponto de extremidade `/act_<AD_ACCOUNT_ID>/adcreatives`.

## Exemplo de solicitação da API

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives \
  -F 'name=Sample Creative' \
  -F 'object_story_spec={
      "page_id": "YOUR_PAGE_ID",
      "link_data": {
        "message": "Check out our new product!",
        "link": "https://www.example.com/product",
        "caption": "Our New Product",
        "picture": "https://www.example.com/image.jpg",
        "call_to_action": {
          "type": "SHOP_NOW"
        }
      }
    }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

Nessa carga, `object_story_spec` especifica o formato usado para o story de anúncio e inclui detalhes para um anúncio com link, além dos metadados associados.

## Parâmetros necessários

| Nome | Descrição |
| :--- | :--- |
| **name** | O nome do criativo do anúncio. |
| **object_story_spec** | As especificações do criativo do anúncio (Page ID, Link Data, CTA, etc). |
