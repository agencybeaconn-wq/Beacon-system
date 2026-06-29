# Custo por Ação (CPA) e Custo por Visualização (CPV)

O CPA permite pagar por conversões específicas, enquanto o CPV (para vídeos) cobra por visualizações.

## Conceitos
- **CPA:** Cobra pela quantidade de conversões (ex: cliques, curtidas).
- **CPV:** Cobra por visualizações de vídeo (10 segundos ou mais).

## Configuração
Para usar CPA/CPV, configure os campos no conjunto de anúncios:

- **`billing_event`**: O evento pelo qual você paga (ex: `LINK_CLICKS`, `PAGE_LIKES`, `THRUPLAY`, `VIDEO_VIEWS`).
- **`optimization_goal`**: A meta de otimização (geralmente igual ao `billing_event`).
- **`bid_amount`**: Valor máximo que você deseja pagar pela ação (em centavos).

## Limitações Importantes
- **App Installs:** A cobrança de CPA para instalações de app (`billing_event=APP_INSTALLS`) está **obsoleta** desde a v9.0. Use `IMPRESSIONS` como evento de cobrança.
- **Cliques Externos:** Apenas para domínios externos e apps hospedados.
- **Conexões Excluídas:** Para otimizar para conexões (ex: `PAGE_LIKES`), use `excluded_connections` no targeting para não pagar por quem já curtiu.

## Exemplos

### CPA (Exemplo Genérico)
> **Nota:** O exemplo abaixo usa `IMPRESSIONS` como evento de cobrança, conforme recomendação para certos objetivos onde o CPA direto pode não estar disponível ou ser a melhor opção.

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=CPA Ad Set' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'optimization_goal=REACH' \
  -F 'bid_amount=1000' \
  -F 'promoted_object={ "page_id": "<PAGE_ID>" }' \
  -F 'targeting={...}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### CPV (Visualizações de Vídeo)
Para pagar por visualização (`VIDEO_VIEWS`):

1. **Campanha:** Objetivo `OUTCOME_ENGAGEMENT` (ou `VIDEO_VIEWS` em versões antigas).
2. **Conjunto de Anúncios:**
   - `billing_event=VIDEO_VIEWS`
   - `optimization_goal=VIDEO_VIEWS`

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=CPV Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'daily_budget=500' \
  -F 'billing_event=VIDEO_VIEWS' \
  -F 'optimization_goal=VIDEO_VIEWS' \
  -F 'bid_amount=100' \
  -F 'targeting={...}' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```
