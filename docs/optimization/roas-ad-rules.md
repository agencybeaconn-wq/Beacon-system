# Regras de Anúncios de ROAS (Return on Ad Spend)

Para criar regras eficazes baseadas em ROAS, é crucial usar a combinação correta de filtros para garantir a maturidade dos dados e a atribuição correta.

## Componentes Críticos

### 1. Janela de Atribuição (`attribution_window`)
Define quais conversões são contadas.
- **Exemplo:** `7D_CLICK` (cliques nos últimos 7 dias).
- **Nota:** Se a janela incluir visualização e clique (ex: `1D_VIEW_7D_CLICK`), o ROAS é a soma dos valores de ambas.

### 2. Predefinição de Tempo (`time_preset`) e Dados Maduros
Para evitar decisões baseadas em dados incompletos (conversões que ainda podem acontecer), use presets que excluem os dias mais recentes.

- **`LAST_ND_14_8`**: Últimos 14 dias, excluindo os 7 dias mais recentes (janela de 8 a 21 dias atrás). Ideal para janelas de atribuição de 7 dias.
- **`LAST_7D` / `LAST_14D`**: Excluem o dia de hoje (`TODAY`).

### 3. Tempo de Veiculação (`hours_since_creation`)
Garante que o anúncio rodou tempo suficiente antes de ser avaliado.
- **Recomendação:** `192` horas (8 dias) para regras que analisam janelas de 7 dias.

## Métricas de Valor de Compra
- **Mobile App:** `app_custom_event.fb_mobile_purchase`
- **Web (Pixel):** `offsite_conversion.fb_pixel_purchase`

## Exemplos de Regras

### 1. Aumentar Orçamento se ROAS Web > 0.50
Aumenta 20% se o ROAS for bom, usando dados maduros (excluindo última semana).

```json
"evaluation_spec": {
  "evaluation_type": "SCHEDULE",
  "filters": [
    { "field": "time_preset", "value": "LAST_ND_14_8", "operator": "EQUAL" },
    { "field": "attribution_window", "value": "7D_CLICK", "operator": "EQUAL" },
    { "field": "hours_since_creation", "value": 192, "operator": "GREATER_THAN" },
    { "field": "website_purchase_roas", "value": 0.50, "operator": "GREATER_THAN" }
  ]
},
"execution_spec": {
  "execution_type": "CHANGE_BUDGET",
  "execution_options": [
    {
      "field": "change_spec",
      "value": { "amount": 20, "unit": "PERCENTAGE" },
      "operator": "EQUAL"
    }
  ]
}
```

### 2. Ajustar Lance para Meta de ROAS App (Targeting 0.80)
Ajusta o lance diariamente para manter o ROAS próximo de 0.80, com tolerância de 5% (0.76 - 0.84).

```json
"evaluation_spec": {
  "evaluation_type": "SCHEDULE",
  "filters": [
    { "field": "time_preset", "value": "LAST_7D", "operator": "EQUAL" },
    { "field": "attribution_window", "value": "1D_VIEW_1D_CLICK", "operator": "EQUAL" },
    { "field": "mobile_app_purchase_roas", "value": [0.76, 0.84], "operator": "NOT_IN_RANGE" }
  ]
},
"execution_spec": {
  "execution_type": "CHANGE_BID",
  "execution_options": [
    {
      "field": "change_spec",
      "value": { "amount": 0.80, "target_field": "mobile_app_purchase_roas" },
      "operator": "EQUAL"
    }
  ]
}
```
