# Eventos de Cobrança (Billing Events)

O `billing_event` define pelo que você paga (ex: impressões, cliques). Isso é diferente da meta de otimização (`optimization_goal`), que define o que o sistema busca entregar.

## Tipos de Compra (`buying_type`)

O tipo de compra (definido na campanha) restringe os eventos de cobrança disponíveis.

| Tipo de Compra | Eventos de Cobrança Válidos (`billing_event`) |
| :--- | :--- |
| `AUCTION` (Leilão - Padrão) | `IMPRESSIONS`, `LINK_CLICKS`, `PAGE_LIKES`, `POST_ENGAGEMENT`, `VIDEO_VIEWS`, `THRUPLAY` |
| `RESERVED` (Alcance e Frequência) | `IMPRESSIONS` |
| `FIXED_CPM` | `IMPRESSIONS` |

## Validação: Meta de Otimização vs. Evento de Cobrança

Para campanhas de Leilão (`AUCTION`), o `billing_event` disponível depende da `optimization_goal` escolhida.

| Meta de Otimização (`optimization_goal`) | Eventos de Cobrança Válidos |
| :--- | :--- |
| `APP_INSTALLS` | `IMPRESSIONS` |
| `AD_RECALL_LIFT` | `IMPRESSIONS` |
| `ENGAGED_USERS` | `IMPRESSIONS` |
| `EVENT_RESPONSES` | `IMPRESSIONS` |
| `IMPRESSIONS` | `IMPRESSIONS` |
| `LEAD_GENERATION` | `IMPRESSIONS` |
| `LINK_CLICKS` | `LINK_CLICKS`, `IMPRESSIONS` |
| `OFFSITE_CONVERSIONS` | `IMPRESSIONS` |
| `PAGE_LIKES` | `IMPRESSIONS` |
| `POST_ENGAGEMENT` | `IMPRESSIONS` (Nota: `POST_ENGAGEMENT` como evento de cobrança não está disponível a partir da v2.11) |
| `REACH` | `IMPRESSIONS` |
| `REPLIES` | `IMPRESSIONS` |
| `SOCIAL_IMPRESSIONS` | `IMPRESSIONS` |
| `THRUPLAY` | `IMPRESSIONS`, `THRUPLAY` |
| `TWO_SECOND_CONTINUOUS_VIDEO_VIEWS` | `IMPRESSIONS`, `TWO_SECOND_CONTINUOUS_VIDEO_VIEWS` |
| `VIDEO_VIEWS` | `IMPRESSIONS`, `VIDEO_VIEWS` |
| `VALUE` | `IMPRESSIONS` |
| `LANDING_PAGE_VIEWS` | `IMPRESSIONS` |

## Exemplo de Configuração
Otimizar para Engajamento (`POST_ENGAGEMENT`) mas pagar por Impressões (`IMPRESSIONS`).

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets" \
  -F 'name=Engagement AdSet - Pay per Impression' \
  -F 'optimization_goal=POST_ENGAGEMENT' \
  -F 'billing_event=IMPRESSIONS' \
  -F 'bid_amount=500' \
  -F 'daily_budget=1000' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'targeting={...}' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```
