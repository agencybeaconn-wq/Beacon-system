# Detalhamentos de Insights (Breakdowns)

Permite agrupar resultados da API de Insights em subconjuntos específicos (ex: por idade, gênero, dispositivo).

## Tipos de Detalhamento

### 1. Detalhamentos Genéricos (`breakdowns`)
Agrupam métricas gerais (impressões, alcance, gasto).
*   **Demográficos:** `age`, `gender`, `country`, `region`, `dma`.
*   **Plataforma/Dispositivo:** `publisher_platform`, `platform_position`, `impression_device`, `device_platform`.
*   **Tempo:** `hourly_stats_aggregated_by_advertiser_time_zone`, `hourly_stats_aggregated_by_audience_time_zone`.
*   **Criativo:** `image_asset`, `video_asset`, `body_asset`, `title_asset` (para criativos dinâmicos).

### 2. Detalhamentos de Ação (`action_breakdowns`)
Agrupam o campo `actions` (conversões, cliques).
*   `action_type` (padrão implícito se nenhum for especificado).
*   `action_device`, `action_destination`, `action_target_id`.
*   `action_video_type`, `action_video_sound`.
*   `action_reaction` (tipo de reação: like, love, haha, etc).

## Combinação de Detalhamentos
Nem todos os detalhamentos podem ser combinados.
*   **Permitido:** `age` + `gender`.
*   **Permitido:** `publisher_platform` + `platform_position`.
*   **Restrito:** Detalhamentos por hora não funcionam com métricas únicas (`reach`, `frequency`).

## Limitações Importantes
1.  **Métricas Únicas:** `reach` e `frequency` retornam 0 se usados com detalhamentos por hora.
2.  **Métricas Offsite:** Alguns detalhamentos (`region`, `dma`) não estão mais disponíveis para métricas de conversão offsite (Pixel/CAPI) devido a privacidade.
3.  **Campos Indisponíveis:** Não é possível solicitar `relevance_score`, `newsfeed_avg_position` em detalhamentos.

## Exemplo de Requisição

```bash
curl -G \
  -d "fields=impressions,actions" \
  -d "breakdowns=age,gender" \
  -d "access_token=<TOKEN>" \
  https://graph.facebook.com/v24.0/<CAMPAIGN_ID>/insights
```
