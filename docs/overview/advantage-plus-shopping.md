# Campanhas de Compras Advantage+ (ASC)

Automação para e-commerce e varejo. Substitui campanhas manuais complexas por uma estrutura simplificada.

## ⚠️ Aviso de Depreciação (v25.0)
O método usando `smart_promotion_type=AUTOMATED_SHOPPING_ADS` será descontinuado. Use a nova estrutura "Advantage+ Campaign Experience" (veja `advantage-plus-campaigns.md`).

## Estrutura (Legado/Atual até v24.0)

### 1. Campanha
- **Objetivo:** `OUTCOME_SALES`.
- **Tipo:** `AUTOMATED_SHOPPING_ADS`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Advantage+ Shopping Campaign' \
  -F 'objective=OUTCOME_SALES' \
  -F 'smart_promotion_type=AUTOMATED_SHOPPING_ADS' \
  ...
```

### 2. Clientes Existentes (Opcional)
Defina quem são seus clientes atuais para controlar o orçamento gasto com eles.
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>" \
  -F 'existing_customers=[<CUSTOM_AUDIENCE_ID>]'
```

### 3. Conjunto de Anúncios (Apenas 1 por Campanha)
- **Optimization Goal:** `OFFSITE_CONVERSIONS` ou `VALUE`.
- **Billing Event:** `IMPRESSIONS`.
- **Targeting:** Apenas `geo_locations` (País).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'promoted_object={ "pixel_id": "<PIXEL_ID>", "custom_event_type": "PURCHASE" }' \
  -F 'existing_customer_budget_percentage=20' \
  ...
```

### 4. Controles de Conta (Account Controls)
Defina restrições globais (idade mínima, exclusão geográfica) que se aplicam a todas as campanhas ASC.
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/account_controls" \
  -F 'audience_controls={ "age_min": 20, "excluded_geo_locations": {...} }'
```
