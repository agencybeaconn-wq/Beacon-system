# Criação Básica de Anúncios

Criar anúncios usando a API de Marketing envolve uma abordagem sistemática que inclui configurar campanhas, conjuntos de anúncios e criativos do anúncio.

## Pontos de Extremidade (Endpoints)

Os principais pontos de extremidade para criação são `campaigns`, `adsets` e `ads`.

### 1. Campanhas (`campaigns`)
Usado para criar e gerenciar as campanhas publicitárias e definir objetivos gerais (ex: reconhecimento da marca, conversões).

**Endpoint:** `POST https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns`

**Exemplo de solicitação:**
```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns \
  -F 'name=My Campaign' \
  -F 'objective=LINK_CLICKS' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### 2. Conjuntos de Anúncios (`adsets`)
Organiza anúncios dentro de campanhas. Define critérios de direcionamento (targeting), orçamento (budget), lances (bidding) e cronograma.

**Endpoint:** `POST https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets`

**Exemplo de solicitação:**
```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets \
  -F 'name=My Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'daily_budget=1000' \
  -F 'targeting={"geo_locations":{"countries":["US"]}}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### 3. Anúncios (`ads`)
Onde os anúncios reais são criados. Vincula o criativo (creative) ao conjunto de anúncios.

**Endpoint:** `POST https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads`

**Exemplo de solicitação:**
```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads \
  -F 'name=My Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'creative={"creative_id": "<CREATIVE_ID>"}' \
  -F 'status=ACTIVE' \
  -F 'access_token=<ACCESS_TOKEN>'
```
