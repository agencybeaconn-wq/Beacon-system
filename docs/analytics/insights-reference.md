# Referência da API de Insights (Insights Reference)

Documentação detalhada da borda `insights` para recuperação de métricas de desempenho de anúncios.

## Visão Geral
A API de Insights fornece dados sobre o desempenho de publicidade, permitindo métricas desduplicadas, ordenação e relatórios assíncronos.

> **Nota sobre Métricas:**
> *   **Estimadas:** Fornecem insights direcionais para resultados difíceis de quantificar com precisão (ex: Reach).
> *   **Em Desenvolvimento:** Ainda em teste, podem mudar. Use com cautela.
> *   **iOS 14.5+:** Métricas de conversão não-inline (instalações de app, compras) não são agregadas entre campanhas iOS 14.5 e não-iOS 14.5.

## Leitura (Síncrona)
Recupera insights para um objeto de anúncio (Conta, Campanha, Conjunto de Anúncios ou Anúncio).

**Endpoint:** `GET /{object_id}/insights`

### Parâmetros de Consulta
| Parâmetro | Tipo | Descrição | Padrão |
| :--- | :--- | :--- | :--- |
| `level` | enum | Nível do relatório: `ad`, `adset`, `campaign`, `account`. | - |
| `fields` | list<string> | Campos a serem retornados (ex: `impressions`, `spend`, `actions`). | `impressions`, `spend` |
| `date_preset` | enum | Intervalo de tempo predefinido (ex: `last_30d`, `this_month`, `maximum`). | `last_30d` |
| `time_range` | object | Intervalo de tempo personalizado: `{'since':'YYYY-MM-DD','until':'YYYY-MM-DD'}`. | - |
| `time_increment` | enum/int | Agrupamento temporal: `all_days` (período total), `monthly` ou número de dias (1-90). | `all_days` |
| `breakdowns` | list<enum> | Quebras de dados (ex: `age`, `gender`, `country`, `placement`). | - |
| `action_breakdowns` | list<enum> | Quebras para ações (ex: `action_type`, `action_device`). Requer campo `actions`. | `['action_type']` |
| `filtering` | list<Filter> | Filtros para os dados (ex: `field: 'impressions', operator: 'GREATER_THAN', value: 1000`). | - |
| `sort` | list<string> | Ordenação (ex: `reach_descending`). | Ascendente |
| `limit` | int | Limite de registros retornados. | - |
| `use_unified_attribution_setting` | boolean | Se `true`, usa a configuração de atribuição unificada (nível de ad set). Recomendado. | `false` |

### Campos Disponíveis (Fields)
Uma lista extensa de métricas está disponível. Algumas das principais incluem:

*   **Desempenho:** `impressions`, `spend`, `reach`, `frequency`, `cpm`, `cpc`, `ctr`.
*   **Ações:** `actions`, `action_values`, `conversions`, `cost_per_action_type`, `cost_per_conversion`.
*   **Vídeo:** `video_p25_watched_actions`, `video_p50_watched_actions`, `video_p75_watched_actions`, `video_p100_watched_actions`, `video_avg_time_watched_actions`.
*   **Engajamento:** `inline_link_clicks`, `inline_post_engagement`, `outbound_clicks`.
*   **App/Mobile:** `mobile_app_purchase_roas`, `cost_per_mobile_app_install` (via actions).
*   **Compras:** `purchase_roas`, `website_purchase_roas`.

### Exemplo de Requisição
```javascript
FB.api(
    "/<AD_SET_ID>/insights",
    {
        "fields": "impressions,spend,actions",
        "breakdown": "publisher_platform",
        "date_preset": "last_7d"
    },
    function (response) {
        // handle response
    }
);
```

## Relatórios Assíncronos (POST)
Para grandes volumes de dados, recomenda-se criar um relatório assíncrono.

**Endpoint:** `POST /act_{ad_account_id}/insights`

Este endpoint aceita os mesmos parâmetros da leitura síncrona, mas retorna um `report_run_id`.
O status do relatório deve ser verificado periodicamente, e os dados baixados quando estiverem prontos.

### Parâmetros de Exportação
| Parâmetro | Descrição |
| :--- | :--- |
| `export_format` | Formato do arquivo: `csv` ou `xls`. |
| `export_name` | Nome do arquivo gerado. |
| `export_columns` | Colunas específicas para o arquivo exportado. |

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **613** | Limite de taxa excedido (Rate Limit). |
| **2635** | Versão depreciada da API. |
| **3018** | Data de início além de 37 meses do atual (limite de retenção). |
