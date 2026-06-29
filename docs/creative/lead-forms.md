# Formulários de Lead (Lead Forms)

Guia para criar e gerenciar formulários de lead e anúncios associados.

## Estrutura da Campanha
1. **Campanha:** `objective="OUTCOME_LEADS"`, `buying_type="AUCTION"`.
2. **Conjunto de Anúncios:** `optimization_goal="LEAD_GENERATION"`, `destination_type="ON_AD"`, `promoted_object="<PAGE_ID>"`.

## Criação do Formulário (`/leadgen_forms`)

### Exemplo Básico
```bash
curl -X POST "https://graph.facebook.com/v24.0/<PAGE_ID>/leadgen_forms" \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "<PAGE_ACCESS_TOKEN>",
    "name": "Formulário de Contato",
    "questions": [
      {"type":"FULL_NAME", "key": "q1"},
      {"type":"EMAIL", "key": "q2"},
      {"type":"CUSTOM", "key": "q3", "label": "Qual seu interesse?", 
       "options": [
         {"value": "Comprar", "key": "opt1"},
         {"value": "Alugar", "key": "opt2"}
       ]}
    ]
  }'
```

### Configurações Avançadas
- **Maior Intenção:** `is_optimized_for_quality: true` (adiciona tela de revisão).
- **Filtrar Orgânicos:** `block_display_for_non_targeted_viewer: true`.
- **Rastreamento:** `tracking_parameters: {"origem": "fb_ads"}`.
- **Conteúdo Restrito (Gated Content):** Use `upload_gated_file` e configure `thank_you_page` com botão de download.

### Tipos de Perguntas Especiais
- **Agendamento:** `type: "DATE_TIME"`.
- **CPF (Brasil):** `type: "ID_CPF"`.
- **Localizador de Lojas:** `type: "STORE_LOOKUP"`.

## Criativo do Anúncio
Associe o formulário ao criativo usando `lead_gen_form_id` no `call_to_action`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -d '{
    "object_story_spec": {
      "link_data": {
        "call_to_action": {
          "type": "SIGN_UP",
          "value": { "lead_gen_form_id": "<FORM_ID>" }
        },
        "image_hash": "<IMAGE_HASH>",
        "link": "http://fb.me/",
        "message": "Cadastre-se agora!"
      },
      "page_id": "<PAGE_ID>"
    }
  }'
```

## Gerenciamento
- **Listar Formulários:** `GET /<PAGE_ID>/leadgen_forms`
- **Arquivar:** `POST /<FORM_ID>?status=ARCHIVED` (não é possível excluir).
