# Conjuntos de Anúncios (Ad Sets)

Gerenciamento de conjuntos de anúncios (`AdSet`). O conjunto de anúncios define o orçamento, a programação, a segmentação (targeting), o posicionamento e a estratégia de lances para os anúncios contidos nele.

## Notas Importantes (iOS 14.5+)
*   **SKAdNetwork:** O direcionamento por inclusão de Públicos Personalizados de Aplicativos Móveis não é mais suportado para campanhas SKAdNetwork no iOS 14.5+.
*   **Instalação de App:** Novas campanhas de instalação de app no iOS 14.5+ não podem usar direcionamento por conexões de app.
*   **Faturamento CPA:** O faturamento por Instalação de App (CPA) não é mais suportado se o objetivo de otimização for Instalação de App.

## Leitura
Recupera uma lista de conjuntos de anúncios da conta.

**Endpoint:** `GET /act_{ad_account_id}/adsets`

### Parâmetros de Filtro e Insights
*   `effective_status`: Filtrar por status efetivo (ex: `ACTIVE`, `PAUSED`, `CAMPAIGN_PAUSED`).
*   `is_completed`: Filtrar por status de conclusão.
*   `date_preset`: Predefinição de data para métricas de insights.
*   `time_range`: Intervalo de datas personalizado.
*   `updated_since`: Timestamp Unix para buscar conjuntos atualizados recentemente.

### Resposta
Retorna uma lista de nós `AdSet`.
```json
{
    "data": [],
    "paging": {},
    "summary": { "total_count": 20 }
}
```

## Criação
Cria um novo conjunto de anúncios.

**Endpoint:** `POST /act_{ad_account_id}/adsets`

### Parâmetros Principais

#### Identificação e Estrutura
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do conjunto de anúncios. | Sim |
| `campaign_id` | string | ID da campanha pai. | Sim |
| `status` | enum | Status inicial (`ACTIVE`, `PAUSED`). | Sim |
| `source_adset_id` | string | ID de um conjunto de anúncios existente para copiar. | Não |

#### Orçamento e Programação
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `daily_budget` | int64 | Orçamento diário (centavos). Requer duração > 24h. |
| `lifetime_budget` | int64 | Orçamento vitalício (centavos). Requer `end_time`. |
| `start_time` | datetime | Data de início (Unix timestamp). |
| `end_time` | datetime | Data de término (Unix timestamp). |
| `adset_schedule` | list | Programação de entrega por dia/hora (Dayparting). |

#### Lances e Otimização
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `optimization_goal` | enum | Objetivo de otimização (ex: `LINK_CLICKS`, `OFFSITE_CONVERSIONS`, `REACH`). |
| `billing_event` | enum | Evento de cobrança (ex: `IMPRESSIONS`, `LINK_CLICKS`). |
| `bid_strategy` | enum | Estratégia de lances (ex: `LOWEST_COST_WITHOUT_CAP`, `COST_CAP`). |
| `bid_amount` | int | Valor do lance (cap ou target cost). |
| `attribution_spec` | list | Janela de atribuição. |
| `promoted_object` | object | Objeto promovido (ex: `pixel_id`, `custom_event_type`, `page_id`). |

#### Segmentação (Targeting)
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `targeting` | object | Estrutura completa de segmentação (Geo, Idade, Interesses, etc.). `countries` é obrigatório. |
| `destination_type` | enum | Destino (ex: `WEBSITE`, `APP`, `WHATSAPP`). |

### Exemplo de Requisição
```bash
curl -X POST \
  -F "name=My First Adset" \
  -F "lifetime_budget=20000" \
  -F "start_time=2025-12-01T13:42:19-0800" \
  -F "end_time=2025-12-11T13:42:19-0800" \
  -F "campaign_id=<CAMPAIGN_ID>" \
  -F "bid_amount=100" \
  -F "billing_event=LINK_CLICKS" \
  -F "optimization_goal=LINK_CLICKS" \
  -F "targeting={'geo_locations':{'countries':['US']},'facebook_positions':['feed']}" \
  -F "status=PAUSED" \
  -F "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets"
```

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **613** | Limite de taxa excedido. |
| **2641** | Localização restrita na segmentação. |
| **2695** | Limite de grupos de campanha (iOS 14) atingido. |
| **3018** | Data de início muito distante (> 37 meses). |
