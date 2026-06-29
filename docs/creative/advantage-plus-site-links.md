# Adicionar Links de Site (Advantage+ Site Links)

Exiba URLs adicionais abaixo da mídia principal do anúncio no Feed do Facebook para melhorar o desempenho.

## Critérios de Qualificação
- **Objetivos:** Tráfego, Engajamento, Leads ou Vendas.
- **Conversão:** Site.
- **Formato:** Imagem Única ou Vídeo Único.
- **Posicionamento:** Apenas Feed do Facebook.

## Configuração

### 1. Definir os Links (`site_links_spec`)
Use `creative_sourcing_spec` para listar os links adicionais.
Cada link deve ter:
- `site_link_title`: Texto do link.
- `site_link_url`: URL de destino.
- `site_link_image_hash` ou `site_link_image_url` (Opcional): Imagem do link.

### 2. Habilitar o Recurso (`site_extensions`)
Use `degrees_of_freedom_spec` para ativar a otimização.
- `site_extensions`: `enroll_status: "OPT_IN"`.

### Exemplo de Criação de Criativo
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Creative With Site Links' \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "link_data": {
         "link": "https://site.com/main-offer",
         "message": "Confira nossa oferta principal!"
       }
     }' \
  -F 'creative_sourcing_spec={
       "site_links_spec": [
         {
           "site_link_title": "Coleção de Verão",
           "site_link_url": "https://site.com/summer"
         },
         {
           "site_link_title": "Mais Vendidos",
           "site_link_url": "https://site.com/bestsellers"
         },
         {
           "site_link_title": "Contato",
           "site_link_url": "https://site.com/contact"
         },
         {
           "site_link_title": "Sobre Nós",
           "site_link_url": "https://site.com/about"
         }
       ]
     }' \
  -F 'degrees_of_freedom_spec={
       "creative_features_spec": {
         "site_extensions": { "enroll_status": "OPT_IN" }
       }
     }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Exemplo de Criação de Anúncio Direto
Você também pode passar essa estrutura diretamente ao criar o anúncio (`/ads`), dentro do objeto `creative`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Ad with Site Links' \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={
       "object_story_spec": { ... },
       "creative_sourcing_spec": {
         "site_links_spec": [ ... ]
       },
       "degrees_of_freedom_spec": {
         "creative_features_spec": {
           "site_extensions": { "enroll_status": "OPT_IN" }
         }
       }
     }' \
  ...
```
