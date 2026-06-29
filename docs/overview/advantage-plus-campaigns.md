# Experiência de Campanha Advantage+ (Sales, App, Leads)

Nova estrutura unificada para criar campanhas Advantage+ (substituindo fluxos separados de ASC/AAC).

## Mudança Principal (v25.0+)
- **Antigo:** Usava `smart_promotion_type` (`AUTOMATED_SHOPPING_ADS`, `SMART_APP_PROMOTION`).
- **Novo:** Configure a campanha com **Advantage+ Budget**, **Advantage+ Audience** e **Advantage+ Placement**. O sistema define automaticamente o `advantage_state`.

## Critérios para Habilitar Advantage+
Para que `advantage_state` seja ativado (`ADVANTAGE_PLUS_SALES`, `ADVANTAGE_PLUS_APP`, `ADVANTAGE_PLUS_LEADS`), a campanha deve ter:

1.  **Advantage+ Placement:**
    - Não defina direcionamento ou exclusões de posicionamento. Deixe todos elegíveis.
2.  **Advantage+ Budget:**
    - Orçamento definido no nível da campanha (`advantage_campaign_budget_optimization`).
3.  **Advantage+ Audience:**
    - Use `targeting_automation: { advantage_audience: 1 }`.
    - Não defina parâmetros de direcionamento restritivos (exceto `geo_locations`).

## Verificando o Estado
```bash
GET /v24.0/<CAMPAIGN_ID>?fields=name,objective,advantage_state_info
```
Resposta esperada:
```json
"advantage_state_info": {
  "advantage_state": "ADVANTAGE_PLUS_SALES",
  "advantage_budget_state": "ENABLED",
  "advantage_audience_state": "ENABLED",
  "advantage_placement_state": "ENABLED"
}
```

## Migração e Cópia
- **Migrar (Manter ID):** `POST <CAMPAIGN_ID>?migrate_to_advantage_plus=true`
- **Copiar (Novo ID):** `POST <CAMPAIGN_ID>/copies?migrate_to_advantage_plus=true`

## Orçamento para Clientes Existentes
O campo `existing_customer_budget_percentage` será descontinuado.
**Nova Abordagem:** Crie dois conjuntos de anúncios na campanha:
1.  **Novos Clientes:** Exclua o público personalizado de clientes existentes.
2.  **Clientes Existentes:** Direcione apenas para o público personalizado de clientes existentes e defina um limite de gastos (`daily_spend_cap`).
