# Descrição de Direcionamento (Targeting Description)

Obtenha descrições legíveis por humanos (frases) para especificações de direcionamento. Útil para mostrar ao usuário final quem está sendo impactado pelo anúncio.

## 1. Para Anúncios Existentes
Recupera a descrição do direcionamento configurado em um anúncio específico.

```bash
GET https://graph.facebook.com/v24.0/<AD_ID>/targetingsentencelines
```

**Resposta Exemplo:**
```json
{
  "id": "<AD_ID>/targetingsentencelines",
  "targetingsentencelines": [
    {
      "content": "Location - Living In:",
      "children": ["Japan", "United States"]
    },
    {
      "content": "Age:",
      "children": ["20 - 24"]
    }
  ]
}
```

## 2. Para Contas de Anúncios (Simulação)
Gera a descrição para um objeto `targeting_spec` arbitrário, sem precisar criar o anúncio.

```bash
GET https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/targetingsentencelines
```

**Parâmetros:**
- **`targeting_spec`**: Objeto JSON com as regras de direcionamento.
- **`hide_targeting_spec_from_return`**: (Opcional) `true` para não repetir o spec na resposta.

**Exemplo de Requisição:**
```bash
curl -G \
  --data-urlencode 'targeting_spec={ 
    "age_max": 24, 
    "age_min": 20, 
    "genders": [1], 
    "geo_locations": {"countries":["US","JP"]} 
  }' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/targetingsentencelines
```

**Resposta Exemplo:**
```json
{
  "targetingsentencelines": [
    {
      "content": "Location - Living In:",
      "children": ["Japan", "United States"]
    },
    {
      "content": "Age:",
      "children": ["20 - 24"]
    },
    {
      "content": "Gender:",
      "children": ["Male"]
    }
  ]
}
```
