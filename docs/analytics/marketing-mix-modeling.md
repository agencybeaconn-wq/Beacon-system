# Marketing Mix Modeling (MMM) na API de Insights

Opção de autoatendimento para exportar dados granulares de anúncios para modelagem de mix de marketing.

## Como Funciona
Use o parâmetro `breakdowns=mmm` na API de Insights.
*   **Nível:** Apenas `adset` (equivalente a `level=adset`).
*   **Métricas:** `impressions`, `spend` (estimado).
*   **Restrição:** Não pode ser combinado com outros `breakdowns` ou `action_breakdowns`.

## Requisição Padrão (GET)
```bash
curl -G \
  -d "breakdowns=mmm" \
  -d "date_preset=last_7d" \
  -d "time_increment=1" \
  -d "access_token=<TOKEN>" \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/insights
```

## Exportação CSV (Recomendado)
Para obter um arquivo CSV formatado como no Gerenciador de Anúncios:
```bash
curl -G \
  -d "breakdowns=mmm" \
  -d "export_format=csv" \
  -d "time_increment=1" \
  -d "access_token=<TOKEN>" \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/insights
```

## Estrutura dos Dados (Colunas)
A resposta inclui as seguintes colunas padrão (índices 0-13):
`account_id`, `campaign_id`, `adset_id`, `date_start`, `date_stop`, `impressions`, `spend`, `country`, `region`, `dma`, `device_platform`, `platform_position`, `publisher_platform`, `creative_media_type`.

## Filtragem Permitida
Apenas filtros específicos são suportados com `breakdowns=mmm`:
*   `campaign.id`, `adset.id` (IN, NOT_IN)
*   `campaign.name`, `adset.name` (CONTAIN, NOT_CONTAIN)
*   `country`, `region`, `dma`, `device_platform`, `publisher_platform`, `platform_position` (IN)

## Business Manager
Para extrair dados de todo um BM, itere sobre as contas retornadas por `/owned_ad_accounts` e `/client_ad_accounts`.
