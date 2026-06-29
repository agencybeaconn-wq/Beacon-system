# Noções Básicas sobre Otimização de Anúncios

A API de Marketing oferece pontos de extremidade para gerenciar públicos e analisar insights sobre campanhas publicitárias.

## Pontos de Extremidade (Endpoints)

### 1. Públicos Personalizados (`customaudiences`)
Permite criar e gerenciar públicos personalizados e semelhantes (Lookalike), adaptando anúncios a segmentos específicos.

**Endpoint:** `POST https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences`

**Exemplo de solicitação:**
```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences \
  -F 'name=My Custom Audience' \
  -F 'subtype=CUSTOM' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### 2. Insights (`insights`)
Fornece análises valiosas sobre o desempenho de campanhas, conjuntos de anúncios e anúncios (impressões, cliques, conversões, gastos).

**Endpoint:** `GET https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/insights`

**Exemplo de solicitação:**
```bash
curl -X GET \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/insights \
  -F 'fields=impressions,clicks,spend' \
  -F 'time_range={"since":"2023-01-01","until":"2023-12-31"}' \
  -F 'access_token=<ACCESS_TOKEN>'
```
