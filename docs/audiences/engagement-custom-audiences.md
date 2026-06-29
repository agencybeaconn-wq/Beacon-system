# Públicos Personalizados de Engajamento

Criação de públicos baseados em interações com conteúdo no Facebook e Instagram.

## Fontes de Evento Suportadas
- **Página do Facebook** (`page`)
- **Perfil Comercial do Instagram** (`ig_business`)
- **Anúncios de Cadastro** (`lead`)
- **Experiência Instantânea / Canvas** (`canvas`)
- **Compras / Shopping** (`shopping_page`, `shopping_ig`)
- **Realidade Aumentada** (`ar_experience`, `ar_effects`)

## Criação de Público
Requer aceitação dos Termos de Serviço de Públicos Personalizados.

```bash
curl -X POST \
  -F 'name="Page Engagement Audience"' \
  -F 'rule={ "inclusions": { ... } }' \
  -F 'prefill=1' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences
```
- **`prefill=1`**: Preenche automaticamente com usuários que engajaram no passado (respeitando a janela de retenção).

## Regras de Engajamento por Origem

### Página do Facebook (`page`)
- **Eventos:** `page_engaged` (todos), `page_visited`, `page_liked`, `page_messaged`, `page_cta_clicked`, `page_or_post_save`, `page_post_interaction`.
- **Retenção Máxima:** 730 dias (exceto `page_liked` que é 0/indefinido).

### Instagram Business (`ig_business`)
- **Eventos:** `ig_business_profile_all` (todos), `ig_business_profile_engaged`, `ig_business_profile_visit`, `ig_user_messaged_business`, `ig_business_profile_ad_saved`.
- **Interações com Anúncios:** `ig_ad_like`, `ig_ad_comment`, `ig_ad_share`, `ig_ad_save`, `ig_ad_cta_click`, `ig_ad_carousel_swipe`.
- **Interações Orgânicas:** `ig_organic_like`, `ig_organic_comment`, `ig_organic_share`, `ig_organic_save`, `ig_organic_swipe`.
- **Retenção Máxima:** 730 dias.

### Anúncios de Cadastro (`lead`)
- **Eventos:** `lead_generation_opened`, `lead_generation_submitted`, `lead_generation_dropoff`.
- **Retenção Máxima:** 90 dias.

### Compras (`shopping_ig` / `shopping_page`)
- **Eventos:** `VIEW_CONTENT`, `ADD_TO_CART`, `PURCHASE`.
- **Retenção Máxima:** 365 dias.

### Experiência Instantânea (`canvas`)
- **Eventos:** `instant_shopping_document_open`, `_close`, `_pause`, `_resume`, `_did_scroll`, `_element_click`, `_element_impression`.
- **Retenção Máxima:** 730 dias.

## Exclusões e Regras Múltiplas
É possível combinar inclusões e exclusões, ou múltiplas origens (ex: engajamento em qualquer uma de 3 páginas).

### Exemplo: Engajamento com Página (Incluir) E NÃO Clicou no CTA (Excluir)
```json
{
  "inclusions": {
    "operator": "or",
    "rules": [{
      "event_sources": [{ "id": "<PAGE_ID>", "type": "page" }],
      "retention_seconds": 31536000,
      "filter": { "operator": "and", "filters": [{ "field": "event", "operator": "eq", "value": "page_engaged" }] }
    }]
  },
  "exclusions": {
    "operator": "or",
    "rules": [{
      "event_sources": [{ "id": "<PAGE_ID>", "type": "page" }],
      "retention_seconds": 31536000,
      "filter": { "operator": "and", "filters": [{ "field": "event", "operator": "eq", "value": "page_cta_clicked" }] }
    }]
  }
}
```
