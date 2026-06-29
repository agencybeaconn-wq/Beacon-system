# Compartilhamento de Orçamento do Conjunto de Anúncios (Ad Set Budget Sharing)

Permite que conjuntos de anúncios compartilhem até **20%** de seu orçamento diário com outros conjuntos da mesma campanha para maximizar resultados.

## Diferença vs. Orçamento de Campanha Advantage+
- **Budget Sharing:** Controle no nível do conjunto de anúncios com 20% de flexibilidade. Automação parcial.
- **Advantage+ Campaign Budget:** Controle no nível da campanha com 100% de flexibilidade. Automação total.

## Requisitos e Limitações
- Apenas campanhas com **Orçamento Diário**.
- Todos os conjuntos de anúncios devem ter a **mesma estratégia de lance**.
- Afeta apenas campanhas novas ou duplicadas.
- Não pode ser ativado durante a veiculação (apenas na criação). Pode ser desativado durante a veiculação.

## Configuração (`is_adset_budget_sharing_enabled`)

### Criação de Campanha
Defina `is_adset_budget_sharing_enabled="True"` ao criar a campanha.

> **Nota:** A partir da v24.0, este campo é obrigatório (True/False) se você não estiver usando orçamento no nível da campanha.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns" \
  -F 'name=Campaign with Budget Sharing' \
  -F 'objective=OUTCOME_TRAFFIC' \
  -F 'is_adset_budget_sharing_enabled="True"' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### Leitura
```bash
curl -G "https://graph.facebook.com/v24.0/<CAMPAIGN_ID>/" \
  -d 'fields=is_adset_budget_sharing_enabled' \
  -d 'access_token=<ACCESS_TOKEN>'
```

### Desativação (Atualização)
Você pode desativar o recurso em uma campanha existente.

```bash
curl -X POST "https://graph.facebook.com/v24.0/<CAMPAIGN_ID>/" \
  -F 'is_adset_budget_sharing_enabled="False"' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Como Funciona o Gasto
- **Orçamento Diário:** Valor base definido no conjunto.
- **Flexibilidade:** Até 75% acima do orçamento diário em dias bons.
- **Orçamento Compartilhado:** Até 20% do orçamento pode ser movido para outros conjuntos.
- **Gasto Máximo Diário:** (Orçamento Diário + Orçamento Compartilhado) * 1.75
