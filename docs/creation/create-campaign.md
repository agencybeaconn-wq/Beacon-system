# Criar uma Campanha de Anúncios

O primeiro passo para lançar uma campanha de anúncios é criar a campanha usando a API.

Para criar uma campanha de anúncios, envie uma solicitação `POST` ao ponto de extremidade `/act_<AD_ACCOUNT_ID>/campaigns` com os parâmetros-chave, incluindo `name`, `objective` e `status`.

## Exemplo de solicitação da API

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns \
  -F 'name=My Campaign' \
  -F 'objective=LINK_CLICKS' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Parâmetros necessários

| Nome | Descrição |
| :--- | :--- |
| **name** | O nome da campanha. |
| **objective** | O objetivo da campanha, por exemplo, `LINK_CLICKS`. |
| **status** | O status inicial da campanha, geralmente definido como `PAUSED` ao ser criado pela primeira vez. |
