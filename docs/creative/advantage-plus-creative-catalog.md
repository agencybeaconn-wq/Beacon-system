# Criativo Advantage+ para Catálogo (Advantage+ Creative for Catalog)

Automatize a escolha do formato (Carrossel ou Coleção) e variações de criativo para cada usuário.

## Configuração Principal
Use `optimization_type: "FORMAT_AUTOMATION"` no `asset_feed_spec`.

### Parâmetros Obrigatórios
- **`product_set_id`**: Conjunto de produtos.
- **`ad_formats`**: `["CAROUSEL", "COLLECTION"]`.
- **`template_data`**: Configuração do modelo (link, mensagem, CTA).

## Formatos e Variações

### 1. Anúncios de Coleção (Collection Ads)
Exibe uma mídia de capa (Hero) e 3 produtos abaixo.
- **Padrão:** Vídeo gerado automaticamente do catálogo.
- **Imagem Personalizada:** Use o campo `images` no `asset_feed_spec`.
- **Vídeo Personalizado:** Use o campo `videos` no `asset_feed_spec`.

### 2. Anúncios em Carrossel (Carousel Ads)
Exibe múltiplos produtos deslizáveis.
- **Variações de Descrição:** Forneça múltiplas opções em `descriptions`. O sistema testará qual performa melhor.
  - Ex: `{{product.price}}`, `{{product.brand}}`, ou texto livre "Frete Grátis".

## Otimizações Avançadas (`creative_features_spec`)
Controle recursos automáticos no `degrees_of_freedom_spec`.

- **`adapt_to_placement`**: Usa imagens 9:16 em Stories/Reels (tela cheia).
- **`media_type_automation`**: Permite exibir vídeos do catálogo em vez de apenas imagens.
- **`dynamic_partner_content`**: Inclui anúncios de parceria.
- **`add_text_overlay`**: Adiciona informações (preço, frete) sobre a imagem.

### Exemplo Completo (Automação de Formato + Adaptação 9:16)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Advantage+ Creative Catalog Ad' \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={
       "name": "Advantage+ Creative",
       "product_set_id": "<PRODUCT_SET_ID>",
       "object_story_spec": {
         "page_id": "<PAGE_ID>",
         "template_data": {
           "multi_share_end_card": true,
           "link": "https://site.com",
           "message": "Confira as novidades!",
           "call_to_action": {"type": "SHOP_NOW"}
         }
       },
       "asset_feed_spec": {
         "optimization_type": "FORMAT_AUTOMATION",
         "ad_formats": ["CAROUSEL", "COLLECTION"],
         "descriptions": [
           {"text": "{{product.description}}"},
           {"text": "A partir de {{product.current_price}}"}
         ]
       },
       "degrees_of_freedom_spec": {
         "creative_features_spec": {
           "adapt_to_placement": { "enroll_status": "OPT_IN" },
           "media_type_automation": { "enroll_status": "OPT_IN" }
         }
       }
     }' \
  ...
```
