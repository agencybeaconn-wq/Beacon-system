# Anúncios de Catálogo com Destino no Facebook (On-Facebook Destination)

Direcione compradores para uma página de detalhes do produto (PDP) nativa no Facebook (formato de Loja), ideal para gerar leads qualificados.

> **Nota:** Atualmente disponível apenas para **Catálogos de Automóveis (Auto Catalogs)**.

## Pré-requisitos
- Catálogo de Automóveis válido (Automotive Inventory Ads).
- Pelo menos um item no catálogo.

## Configuração

### 1. Campanha
- **Objetivo:** `PRODUCT_CATALOG_SALES`.
- **Promoted Object:** ID do Catálogo.

### 2. Conjunto de Anúncios (`destination_type`)
Defina o destino como `FACEBOOK` para manter o usuário na plataforma.

- **`destination_type`**: `FACEBOOK` (Obrigatório).
- **Posicionamentos Suportados:**
  - **Facebook:** Feed, Marketplace, Search, Story, Right Hand Column.
  - **Instagram:** Stream, Explore, Story.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=On-Facebook Auto Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'destination_type=FACEBOOK' \
  -F 'promoted_object={"product_set_id": "<PRODUCT_SET_ID>"}' \
  -F 'targeting={ ... }' \
  ...
```

### 3. Criativo
Use tags de modelo específicas para veículos (ex: `{{vehicle.model}}`, `{{vehicle.price}}`).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives" \
  -F 'object_story_spec={
       "template_data": {
         "name": "{{vehicle.make}} {{vehicle.model}}",
         "description": "Apenas {{vehicle.price}}",
         "call_to_action": {"type": "GET_QUOTE"}
       }
     }' \
  ...
```

### 4. Anúncio
Crie o anúncio vinculando o Ad Set e o Criativo.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Auto Ad' \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={"creative_id": "<CREATIVE_ID>"}' \
  ...
```
