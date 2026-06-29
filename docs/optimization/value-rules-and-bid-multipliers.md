# Regras de Valor (Value Rules) e Multiplicadores de Lance (Bid Multipliers)

> **Atenção:** Os **Bid Multipliers** estão sendo descontinuados e serão removidos em 2027. A recomendação é migrar para **Value Rules**.

## Regras de Valor (Value Rules)
Permitem ajustar lances para audiências, posicionamentos e locais de conversão específicos. Ao contrário dos multiplicadores, as regras são criadas como objetos reutilizáveis (`value_rule_set`) e anexadas a conjuntos de anúncios.

### Estrutura
- **Value Rule Set:** Coleção de até 10 regras.
- **Rule:** Contém critérios (ex: Idade, Gênero) e um ajuste de lance (Aumento ou Diminuição).
- **Criteria:** Define o segmento (ex: `AGE` contém `18-24`).

### Criar um Conjunto de Regras (`value_rule_set`)
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/value_rule_set" \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "My Value Rule Set",
    "rules": [
      {
        "name": "Increase for Young Adults",
        "adjust_sign": "INCREASE",
        "adjust_value": 20,
        "criterias": [
          {
            "criteria_type": "AGE",
            "operator": "CONTAINS",
            "criteria_values": ["18-24"],
            "criteria_value_types": ["NONE"]
          }
        ]
      }
    ]
  }'
```

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

### Migração (Bid Multipliers -> Value Rules)
Para migrar, você deve anexar a regra de valor e limpar os ajustes de lance antigos simultaneamente:

```bash
curl -X POST "https://graph.facebook.com/v24.0/<AD_SET_ID>" \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "bid_adjustments": {}, 
    "value_rule_set_id": "<VALUE_RULE_SET_ID>",
    "value_rules_applied": true
  }'
```

## Multiplicadores de Lance (Bid Multipliers) - DEPRECATED
Permitiam ajustar lances dentro de um único conjunto de anúncios usando o campo `bid_adjustments`.

### Exemplo de Uso (Legado)
```bash
curl -X POST "https://graph.facebook.com/v24.0/<AD_SET_ID>" \
  -F 'bid_adjustments={"user_groups": {"age": {"18-24": 0.7, "default": 1.0}}}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Mapeamento de Categorias

| Categoria (Bid Multiplier) | Tipo de Critério (Value Rules) | Notas |
| :--- | :--- | :--- |
| `age` | `AGE` | |
| `gender` | `GENDER` | |
| `home_location` | `LOCATION` | Suporta Cidades, Regiões, Países. |
| `device_platform` | `DEVICE_PLATFORM` | `MOBILE`, `DESKTOP`. |
| `user_os` | `OS_TYPE` | `ANDROID`, `IOS`. |
| `publisher_platform` | `PLACEMENT` | Mapeia para `FB_FEED`, `IG_STORIES`, etc. |
| `position_type` | `PLACEMENT` | Mapeia para `FB_FEED`, `IG_STORIES`, etc. |
| `custom_audience` | *Em breve* | Será suportado via `Audience Labels`. |

### Limitações Atuais das Value Rules
- **CBO:** Suporte aprimorado previsto para 2026.
- **Estratégias de Lance:** Atualmente suporta `LOWEST_COST_WITHOUT_CAP` (Auto-bid). Suporte para `COST_CAP` previsto para 2026.
- **Objetivo de Valor:** Suporte em breve.
