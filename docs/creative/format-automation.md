# Automação de Formatos (Format Automation)

Permite que um único anúncio de catálogo (Carrossel) seja transformado automaticamente em outros formatos otimizados (como Coleção) dependendo do usuário.

## Limitações
- **Tipo:** Apenas Advantage+ Catalog Ads em formato Carrossel.
- **Permissões:** `page_manage_ads`.

## Configuração (`format_transformation_spec`)
Use este campo para definir quais transformações são permitidas.

### Parâmetros
- **`format`**: Tipo de transformação (ex: `da_collection`).
- **`data_source`**: Fonte dos dados.
  - `["catalog"]`: Usa dados do catálogo.
  - `["none"]`: Desativa fontes de dados.
  - `[]` (Vazio): Ativa todas as fontes disponíveis.

### Exemplo: Transformação em Coleção (`da_collection`)
Este exemplo permite que um anúncio de carrossel seja exibido como um anúncio de coleção (Dynamic Ads Collection) quando apropriado.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'name=Ad Creative with Format Transformation' \
  -F 'object_story_spec={ "page_id": "<PAGE_ID>" }' \
  -F 'product_set_id=<PRODUCT_SET_ID>' \
  -F 'asset_feed_spec={
       "ad_formats": ["CAROUSEL", "COLLECTION"],
       "optimization_type": "FORMAT_AUTOMATION"
     }' \
  -F 'format_transformation_spec=[{
       "format": "da_collection",
       "data_source": ["catalog"]
     }]' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Leitura
Verifique as transformações ativas no criativo.

```bash
curl -G "https://graph.facebook.com/v24.0/<CREATIVE_ID>" \
  -d 'fields=format_transformation_spec' \
  -d 'access_token=<ACCESS_TOKEN>'
```
