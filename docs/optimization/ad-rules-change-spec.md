# Especificação de Alteração de Regras de Anúncios (`change_spec`)

A `change_spec` define **como** alterar orçamentos ou lances quando a ação da regra é `CHANGE_BUDGET`, `CHANGE_CAMPAIGN_BUDGET` ou `CHANGE_BID`.

## Parâmetros do `change_spec`

| Campo | Obrigatório | Descrição | Valores Aceitos |
| :--- | :--- | :--- | :--- |
| **`amount`** | Sim | Valor da alteração ou valor alvo (se `target_field` for usado). | Numérico (ex: `3000`, `-50`, `5.0`). |
| **`unit`** | Sim* | Unidade do `amount`. *Obrigatório exceto se `target_field` estiver presente. | `ACCOUNT_CURRENCY` (valor monetário absoluto) ou `PERCENTAGE` (porcentagem). |
| **`limit`** | Opcional | Limite máximo/mínimo ou intervalo de tolerância. | Valor monetário (ex: `5000`) ou intervalo (ex: `[4000, 6000]`). |
| **`target_field`** | Opcional | Campo de referência para escalonamento proporcional (ex: manter ROAS). | `cost_per_mobile_app_install`, `mobile_app_purchase_roas`, etc. |

## Exemplos de Uso

### 1. Diminuir Orçamento em 30% (Regra de Desempenho)
Diminui o orçamento se as impressões forem > 8000 e a frequência > 5.

```json
"execution_spec": {
  "execution_type": "CHANGE_BUDGET",
  "execution_options": [
    {
      "field": "change_spec",
      "value": {
        "amount": -30,
        "unit": "PERCENTAGE"
      },
      "operator": "EQUAL"
    }
  ]
}
```

### 2. Escalonar Lance Baseado em CPA (Target Field)
Ajusta o lance para tentar manter o `cost_per_mobile_app_install` em 5.0.
- Se o CPA atual for 4.0 (melhor que a meta), o lance aumenta proporcionalmente (25%).
- O `limit` define que o lance não pode passar de 10.0 nem ser menor que 2.0.
- O filtro `NOT_IN_RANGE` na avaliação cria uma janela de tolerância (4.5 a 5.5) para evitar mudanças pequenas constantes.

```json
"execution_spec": {
  "execution_type": "CHANGE_BID",
  "execution_options": [
    {
      "field": "change_spec",
      "value": {
        "amount": 5.0,
        "limit": [2.0, 10.0],
        "target_field": "cost_per_mobile_app_install"
      },
      "operator": "EQUAL"
    }
  ]
}
```
