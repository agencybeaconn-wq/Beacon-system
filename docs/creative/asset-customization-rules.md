# Regras de Personalização de Ativo (Asset Customization Rules)

Personalize quais ativos são exibidos com base em regras específicas (Posicionamento, Idioma ou Segmento), sem usar o algoritmo de Criativo Dinâmico "automático".

## Tipos de Personalização
1.  **Posicionamento:** Ativos diferentes para Feed, Stories, Reels, etc.
2.  **Idioma:** Ativos diferentes para falantes de inglês, espanhol, etc.
3.  **Segmento:** Ativos diferentes baseados em critérios de direcionamento.

## Requisitos
- **Mínimo de Regras:** Se usar `asset_feed_spec` com regras, deve haver pelo menos **duas** regras de personalização.
- **Ad Set:** `is_dynamic_creative=false`.

## 1. Campanha e Conjunto de Anúncios
Crie uma campanha padrão e um Ad Set com `is_dynamic_creative=false`.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Asset Customization Ad Set' \
  -F 'is_dynamic_creative=false' \
  -F 'optimization_goal=OFFSITE_CONVERSIONS' \
  ...
```

## 2. Criativo com Regras (`asset_customization_rules`)
Defina as regras dentro de `asset_feed_spec`.

### Estrutura Geral
```json
"asset_feed_spec": {
  "images": [...],
  "bodies": [...],
  "asset_customization_rules": [
    {
      "customization_spec": { "age_min": 18, "age_max": 25 },
      "image_label": { "name": "image_for_youth" },
      "body_label": { "name": "text_for_youth" }
    },
    {
      "customization_spec": { "age_min": 26 },
      "image_label": { "name": "image_for_adults" },
      "body_label": { "name": "text_for_adults" }
    }
  ]
}
```
*Nota: Os ativos (images, bodies) devem ter tags/labels correspondentes para serem selecionados pelas regras.*

## 3. Anúncio
Crie o anúncio vinculando o criativo.
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=Asset Custom Rule Ad' \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={"creative_id": <CREATIVE_ID>}' \
  ...
```
