# Campanhas de App Advantage+ com Anúncios de Catálogo

Integre anúncios de catálogo dinâmico em Campanhas de App Advantage+ (anteriormente Automated App Ads - AAA).

## Visão Geral
A estrutura de **Campanha** e **Conjunto de Anúncios** permanece idêntica à das Campanhas de App Advantage+ padrão. A mudança ocorre exclusivamente no nível do **Anúncio**, onde é necessário vincular um Conjunto de Produtos (`product_set_id`) diretamente na especificação do criativo.

## Criando o Anúncio
Ao criar o anúncio, o objeto `creative` deve conter o `product_set_id` além das especificações visuais padrão (`object_story_spec`).

### Endpoint
`POST /act_{ad_account_id}/ads`

### Parâmetros Principais
- **name:** Nome do anúncio.
- **adset_id:** ID do conjunto de anúncios da campanha de App.
- **creative:** Objeto JSON contendo:
  - `object_story_spec`: Especificação da história (imagem, título, mensagem).
  - `product_set_id`: ID do conjunto de produtos do catálogo.
  - `name`: Nome do criativo.

### Exemplo de Requisição
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Advantage+ App Catalog Ad' \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={
       "name": "Catalog Creative for App",
       "object_story_spec": {
         "page_id": "<PAGE_ID>",
         "template_data": {
           "message": "Instale agora e confira {{product.name}}",
           "link": "https://site.com/app"
         }
       },
       "product_set_id": "<PRODUCT_SET_ID>"
     }' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Atualizando o Anúncio
Você pode atualizar o conjunto de produtos ou a especificação visual enviando um novo objeto `creative` para o ID do anúncio.

### Endpoint
`POST /{ad_id}`

### Exemplo de Atualização
```bash
curl -X POST "https://graph.facebook.com/v24.0/<AD_ID>" \
  -F 'name=Updated Ad Name' \
  -F 'creative={
       "name": "Updated Creative",
       "object_story_spec": { ... },
       "product_set_id": "<NEW_PRODUCT_SET_ID>"
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Validação e Testes (`execution_options`)
Use `execution_options` para testar a criação sem efetivar a cobrança ou a publicação.

- **`validate_only`**: Simula a chamada e valida os campos.
- **`synchronous_ad_review`**: Verifica regras de política de anúncios (ex: texto em imagem, linguagem ofensiva). Deve ser usado com `validate_only`.
- **`include_recommendations`**: Retorna recomendações de otimização na resposta.

```bash
-F 'execution_options=["validate_only", "synchronous_ad_review"]'
```
