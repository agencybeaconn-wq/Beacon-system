# Anúncios com Vários Anunciantes (Multi-Advertiser Ads)

Exiba seus anúncios junto com os de outras empresas para alcançar pessoas com alta intenção de compra.

> **Importante:** A partir de **19 de agosto de 2024**, este recurso é **OPT-IN (ativado) por padrão**. Se você não especificar o campo, ele será ativado automaticamente.

## Configuração (`contextual_multi_ads`)
Para controlar explicitamente essa funcionalidade, use o campo `contextual_multi_ads` na criação do criativo.

### Opções
- **`OPT_IN`**: Ativa o recurso (Padrão após 19/08/2024).
- **`OPT_OUT`**: Desativa o recurso.

### Exemplo de Criação de Criativo
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Creative with Multi-Ads' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "link_data": {
         "link": "https://www.google.com",
         "image_hash": "<IMAGE_HASH>",
         "attachment_style": "link"
       }
     }' \
  -F 'contextual_multi_ads={
       "enroll_status": "OPT_IN"
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Compatibilidade
- **Objetivos:** Todos.
- **Formatos:** Todos.
- **Posicionamentos:** Selecionados no Facebook e Instagram.
