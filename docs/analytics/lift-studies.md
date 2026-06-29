# Estudos de Incrementalidade (Lift Studies)

Permite mensurar o impacto causal dos anúncios comparando um grupo de teste (exposto) com um grupo de controle (não exposto).

## Estrutura do Estudo
1.  **Estudo (`ad_study`):** O contêiner principal. Define duração e tipo (`LIFT`).
2.  **Células (`cells`):** Grupos de teste e controle.
    *   `treatment_percentage`: % que vê o anúncio.
    *   `control_percentage`: % que não vê (holdout).
3.  **Objetivos (`objectives`):** O que mensurar (Conversões, Pixels, App Events).

## Criando um Estudo
```bash
POST /<BUSINESS_ID>/ad_studies
```
**Parâmetros Principais:**
*   `type`: `LIFT`
*   `cells`: Lista de objetos definindo grupos e campanhas/contas associadas.
*   `objectives`: Lista de objetivos (ex: `CONVERSIONS`).
*   `observation_end_time`: Janela de conversão pós-teste.

**Exemplo de Payload:**
```json
{
  "name": "Lift Study 2025",
  "type": "LIFT",
  "start_time": 1735689600,
  "end_time": 1738368000,
  "cells": [
    {
      "name": "Test Group A",
      "treatment_percentage": 90,
      "control_percentage": 10,
      "adaccounts": ["<ACCOUNT_ID>"]
    }
  ],
  "objectives": [
    {
      "name": "Purchases",
      "type": "CONVERSIONS",
      "adspixels": [{"id": "<PIXEL_ID>", "event_names": ["fb_pixel_purchase"]}]
    }
  ]
}
```

## Obtendo Resultados
Os resultados são atrelados aos **Objetivos** do estudo.

```bash
GET /<STUDY_OBJECTIVE_ID>?fields=results&breakdowns=["cell_id"]
```

**Métricas Retornadas:**
*   `conversions_incremental`: Conversões adicionais causadas pelos anúncios.
*   `conversions_lift`: % de aumento.
*   `conversions_confidence`: Probabilidade de o lift ser real (>90% ideal).
*   `buyers_*`: Métricas focadas em usuários únicos (disponibilidade limitada pós-2021).

## Restrições Importantes
*   **Pós-Julho 2021:** Métricas de "Buyers" e detalhamentos demográficos (Idade, Gênero, País) foram limitados ou removidos para novos estudos.
*   **Imutabilidade:** Após início, não pode mudar `start_time` ou `treatment_percentage`.
