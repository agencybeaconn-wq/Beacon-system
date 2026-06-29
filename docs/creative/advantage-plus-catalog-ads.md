# Anúncios de Catálogo Advantage+ (Antigos Anúncios Dinâmicos)

Crie anúncios personalizados automaticamente com base em um conjunto de produtos, direcionados ao público certo.

## Pré-requisitos
- Página do Facebook (e opcionalmente Instagram).
- Conta de Anúncios.
- Catálogo de Produtos.

## 1. Campanha
**Objetivos Compatíveis:**
- `PRODUCT_CATALOG_SALES` (Vendas do Catálogo)
- `CONVERSIONS` (Conversões)
- `LINK_CLICKS` (Tráfego)
- `APP_INSTALLS` (Instalação do App)

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Advantage+ Catalog Campaign' \
  -F 'objective=PRODUCT_CATALOG_SALES' \
  -F 'promoted_object={"product_catalog_id":"<CATALOG_ID>"}' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## 2. Conjunto de Anúncios
Defina o `product_set_id` e a estratégia de otimização.

### Configuração Padrão (Vendas)
- **Optimization Goal:** `OFFSITE_CONVERSIONS`
- **Billing Event:** `IMPRESSIONS`
- **Promoted Object:** `{"product_set_id": "<ID>", "custom_event_type": "PURCHASE"}`

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Catalog Ad Set' \
  -F 'optimization_goal=OFFSITE_CONVERSIONS' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'promoted_object={"product_set_id":"<PRODUCT_SET_ID>", "custom_event_type": "PURCHASE"}' \
  -F 'targeting={ "geo_locations": {"countries":["US"]} }' \
  ...
```

### Direcionamento (Targeting)
O direcionamento pode ser feito de duas formas principais:
1.  **Público Dinâmico (Retargeting/Upsell):** Usa `product_audience_specs`. Veja `docs/optimization/dynamic-product-audiences.md`.
2.  **Público Amplo (Broad Audience):** Usa demografia (Idade, Gênero) e o algoritmo encontra os melhores produtos.

## 3. Anúncio
O anúncio vincula um Criativo de Modelo (Template Creative) ao Conjunto de Anúncios.
Veja `docs/creative/catalog-creative-templates.md` para detalhes sobre como criar o criativo com macros (`{{product.name}}`).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Catalog Ad' \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={"creative_id": "<CREATIVE_ID>"}' \
  ...
```
