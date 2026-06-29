# Criar um Anúncio

O conjunto de anúncios e o criativo formam o anúncio.

Para criar o anúncio, envie uma solicitação `POST` ao ponto de extremidade `/act_<AD_ACCOUNT_ID>/ads` junto com parâmetros como a `adset_id` e os detalhes do `creative`.

## Exemplo de solicitação da API

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads \
  -F 'name=My Ad' \
  -F 'adset_id=AD_SET_ID' \
  -F 'creative={"creative_id": "<CREATIVE_ID>"}' \
  -F 'status=ACTIVE' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Parâmetros necessários

| Nome | Descrição |
| :--- | :--- |
| **adset_id** | A identificação do conjunto de anúncios sob a qual o anúncio será veiculado. |
| **creative** | Contém a identificação do criativo do anúncio (`creative_id`). |
| **status** | Defina como `ACTIVE` para exibir o anúncio imediatamente. |
