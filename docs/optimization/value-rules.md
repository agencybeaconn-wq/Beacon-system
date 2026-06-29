# Regras de Valor (Value Rules)

As Regras de Valor permitem ajustar lances com base no valor que diferentes públicos, posicionamentos ou locais têm para o seu negócio. O sistema otimiza os resultados priorizando os segmentos de maior valor.

## Funcionalidades
- **Ajuste de Lances:** Aumentar ou diminuir lances para segmentos específicos (ex: +20% para homens de 25-44 anos).
- **Consolidação:** Permite usar um único conjunto de anúncios para múltiplos públicos com valores diferentes, em vez de separar em vários conjuntos.
- **Prioridade:** As regras são aplicadas na ordem em que são definidas. A primeira regra correspondente vence.

## Critérios Disponíveis
- **`AGE`**: Faixas etárias (18-24, 25-34, etc.).
- **`GENDER`**: Gênero (MALE, FEMALE).
- **`LOCATION`**: País, Região, Cidade, DMA.
- **`OS_TYPE`**: Sistema Operacional (ANDROID, IOS).
- **`DEVICE_PLATFORM`**: Plataforma (MOBILE, DESKTOP).
- **`PLACEMENT`**: Posicionamento (FB_FEED, IG_STORIES, etc.).
- **`OMNI_CHANNEL`**: Canal (APP, WEBSITE, etc.).

## Gerenciamento de Regras (`value_rule_set`)

### Limites
- Máximo de **6 conjuntos de regras** por conta de anúncios.
- Máximo de **10 regras** por conjunto.
- Máximo de **2 critérios** por regra.

### Criar Conjunto de Regras
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/value_rule_set" \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "High Value Segments",
    "rules": [
      {
        "name": "High Value Age/Gender",
        "adjust_sign": "INCREASE",
        "adjust_value": 20,
        "criterias": [
          {
            "criteria_type": "AGE",
            "operator": "CONTAINS",
            "criteria_values": ["25-34"],
            "criteria_value_types": ["NONE"]
          },
          {
            "criteria_type": "GENDER",
            "operator": "CONTAINS",
            "criteria_values": ["MALE"],
            "criteria_value_types": ["NONE"]
          }
        ]
      }
    ]
  }'
```

### Atualizar Conjunto de Regras
Para atualizar, envie o objeto completo com as alterações desejadas para o ID do conjunto.

```bash
curl -X POST "https://graph.facebook.com/v24.0/<VALUE_RULE_SET_ID>" \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated Name",
    "rules": [...]
  }'
```

### Excluir Conjunto de Regras
```bash
curl -X POST "https://graph.facebook.com/v24.0/<VALUE_RULE_SET_ID>/delete_rule_set" \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Aplicação em Conjuntos de Anúncios

### Anexar a um Conjunto de Anúncios
```bash
curl -X POST "https://graph.facebook.com/v24.0/<AD_SET_ID>" \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "value_rule_set_id": "<VALUE_RULE_SET_ID>",
    "value_rules_applied": true
  }'
```

### Remover de um Conjunto de Anúncios
```bash
curl -X POST "https://graph.facebook.com/v24.0/<AD_SET_ID>" \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "value_rules_applied": false
  }'
```

## Elegibilidade
Compatível com a estratégia de lance `LOWEST_COST_WITHOUT_CAP` (Auto-bid).
Não compatível com objetivo `VALUE` (Value Optimization) em alguns casos específicos de conversão offline/leads.
