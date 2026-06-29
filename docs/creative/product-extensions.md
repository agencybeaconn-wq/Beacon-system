# Extensões de Produto (Product Extensions)

Exiba produtos do seu catálogo logo abaixo da mídia principal (imagem ou vídeo) do anúncio para aumentar o desempenho.

## Critérios de Qualificação
- **Objetivos:** `SALES` (Vendas) ou `TRAFFIC` (Tráfego).
- **Formato:** Imagem Única ou Vídeo Único.
- **Requisito:** Possuir um Catálogo.

## Configuração

### 1. Vincular o Conjunto de Produtos (`associated_product_set_id`)
Use `creative_sourcing_spec` para definir qual conjunto de produtos será exibido.

### 2. Habilitar o Recurso (`product_extensions`)
Use `degrees_of_freedom_spec` para ativar a otimização.
- `enroll_status`: `"OPT_IN"`
- `action_metadata`: `{"type": "MANUAL"}`

### Exemplo de Criação de Criativo
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Product Extension Creative' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "link_data": {
         "link": "https://site.com/promo",
         "message": "Confira estes produtos!"
       }
     }' \
  -F 'creative_sourcing_spec={
       "associated_product_set_id": "<PRODUCT_SET_ID>"
     }' \
  -F 'degrees_of_freedom_spec={
       "creative_features_spec": {
         "product_extensions": {
           "enroll_status": "OPT_IN",
           "action_metadata": { "type": "MANUAL" }
         }
       }
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Exemplo de Criação de Anúncio Direto
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Ad with Product Extensions' \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={
       "object_story_spec": { ... },
       "creative_sourcing_spec": {
         "associated_product_set_id": "<PRODUCT_SET_ID>"
       },
       "degrees_of_freedom_spec": {
         "creative_features_spec": {
           "product_extensions": {
             "enroll_status": "OPT_IN",
             "action_metadata": { "type": "MANUAL" }
           }
         }
       }
     }' \
  ...
```
