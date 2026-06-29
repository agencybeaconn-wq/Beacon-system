# Anúncios de Catálogo Advantage+ para Geração de Leads

Use o catálogo de produtos para gerar leads. O Facebook mostra os itens mais relevantes e abre um formulário de lead ao clicar.

## Configuração da Campanha
- **Objetivo:** `OUTCOME_LEADS`.
- **Conjunto de Anúncios:**
  - `optimization_goal="LEAD_GENERATION"`
  - `promoted_object={"product_set_id":"<ID>", "page_id":"<ID>"}`

## Criação do Criativo
Use um template dinâmico com `lead_gen_form_id` no Call to Action.

```bash
curl -X POST \
  -F 'name="Advantage+ Lead Gen Creative"' \
  -F 'object_story_spec={ 
    "page_id": "<PAGE_ID>", 
    "template_data": { 
      "call_to_action": {
        "type": "SIGN_UP",
        "value": { "lead_gen_form_id": "<FORM_ID>" }
      }, 
      "description": "{{product.description}}", 
      "link": "<LINK>", 
      "message": "{{product.name}}", 
      "name": "{{product.price}}" 
    } 
  }' \
  -F 'product_set_id=<PRODUCT_SET_ID>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

## Recuperação de Leads com Item ID
Ao buscar o lead, inclua `retailer_item_id` para saber qual produto gerou o interesse.

```bash
curl -G \
  -d 'fields=field_data,retailer_item_id' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/<LEAD_ID>
```
