# Parâmetros de URL por Tipo de Público (Audience Type URL Parameters)

Diferencie tráfego de novos clientes (prospecting) vs. existentes (retargeting) em Campanhas Advantage+ Shopping (ASC) usando parâmetros de URL dinâmicos.

## Configuração (Nível da Conta de Anúncios)
Configure `custom_audience_info` para definir as tags que serão injetadas nas URLs dos anúncios.

### Parâmetros
- **audience_type_param_name:** Nome do parâmetro na URL (ex: `audience_type`).
- **new_customer_tag:** Valor para novos clientes (ex: `prospecting`).
- **existing_customer_tag:** Valor para clientes existentes (ex: `retargeting`).

*Nota: Requer que a definição de "Clientes Existentes" já esteja configurada na conta.*

## Exemplo de Configuração
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>" \
  -H 'Content-Type: application/json' \
  -d '{
    "custom_audience_info": {
      "audience_type_param_name": "audience_type",
      "new_customer_tag": "prospecting",
      "existing_customer_tag": "retargeting"
    },
    "access_token": "<ACCESS_TOKEN>"
  }'
```

## Resultado na URL
Se um usuário clicar no anúncio:
- **Novo Cliente:** `https://site.com/?audience_type=prospecting`
- **Cliente Existente:** `https://site.com/?audience_type=retargeting`
