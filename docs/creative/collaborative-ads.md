# Anúncios Colaborativos (Collaborative Ads / CPAS)

Permite que marcas veiculem anúncios de vendas de catálogo usando segmentos de produtos compartilhados por varejistas.

## Visão Geral
- **Varejista:** Cria um segmento do catálogo e o compartilha com a marca.
- **Marca:** Aceita o segmento e cria campanhas de Advantage+ Catalog Ads direcionando para o site/app do varejista.

## Fluxo para Varejistas e Parceiros

### 1. Criar Segmento do Catálogo
Use a borda `owned_product_catalogs` no catálogo principal.
- **Permissões:** `business_management`, `catalog_management`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/<CATALOG_ID>/owned_product_catalogs" \
  -F 'name=Segmento para Marca X' \
  -F 'catalog_segment_filter={"product_brand": {"i_contains": "Marca X"}}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### 2. Compartilhar Segmento
Compartilhe o segmento com a Business Manager da marca.

```bash
curl -X POST "https://graph.facebook.com/v24.0/<CATALOG_SEGMENT_ID>/agencies" \
  -F 'business=<BRAND_BUSINESS_ID>' \
  -F 'permitted_tasks=["ADVERTISE"]' \
  -F 'utm_settings={"campaign_source": "fb_cpas"}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Fluxo para Marcas

### 1. Aceitar Segmento
A marca deve aceitar os termos na **Central de Colaboração** (Collaboration Center) e atribuir usuários.

### 2. Criar Campanha
Crie uma campanha de Vendas de Catálogo usando o ID do Segmento (`catalog_segment_id`) como `product_catalog_id`.

> **Nota:** Use uma conta de anúncios dedicada para cada varejista.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=CPAS Campaign - Retailer X' \
  -F 'objective=PRODUCT_CATALOG_SALES' \
  -F 'promoted_object={"product_catalog_id": "<CATALOG_SEGMENT_ID>"}' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Limitações de Criativo
- `multi_share_end_card`: Fixo em `false`.
- `template_url_spec`: Deve direcionar para o site do varejista.
- Rastreamento personalizado desabilitado.

## Relatórios e Insights

### Métricas Específicas
- **`catalog_segment_value`**: Valor total das conversões (compras, add-to-cart) para o segmento.
- **`catalog_segment_value_omni_purchase_roas`**: ROAS total (Omnichannel).
- **`catalog_segment_value_website_purchase_roas`**: ROAS de compras no site.
- **`converted_product_value`**: Valor de conversão por ID de produto.
- **`converted_product_quantity`**: Quantidade vendida por ID de produto.

### Detalhamentos (Breakdowns)
- **`action_converted_product_id`**: Para ver performance por produto específico.

```bash
curl -G "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/insights" \
  -d 'fields=converted_product_value,converted_product_quantity' \
  -d 'action_breakdowns=action_converted_product_id' \
  -d 'access_token=<ACCESS_TOKEN>'
```
