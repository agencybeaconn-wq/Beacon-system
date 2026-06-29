# API de Conversões Offline (Depreciada)

> [!WARNING]
> **Depreciação:** A API de Conversões Offline será descontinuada em **14 de maio de 2025**.
> **Ação Necessária:** Migre para a **API de Conversões (CAPI)**, que agora suporta eventos offline.

## Visão Geral
Permite enviar dados de vendas físicas/offline para a Meta e atribuí-los a campanhas de anúncios.

## Fluxo de Configuração
1.  **Criar Conjunto de Eventos Offline:**
    ```bash
    POST /<BUSINESS_ID>/offline_conversion_data_sets
    name="Loja Física", description="Vendas offline"
    ```
2.  **Atribuir à Conta de Anúncios:**
    ```bash
    POST /<OFFLINE_EVENT_SET_ID>/adaccounts
    business=<BUSINESS_ID>, account_id=<AD_ACCOUNT_ID>
    ```
3.  **Habilitar Rastreamento no Anúncio:**
    Atualize o `tracking_specs` do anúncio para incluir o dataset.
    ```bash
    POST /<AD_ID>
    tracking_specs=[{"action.type":"offline_conversion","dataset": ["<DATASET_ID>"]}]
    ```

## Upload de Eventos
Envie transações (até 62 dias após a conversão).
```bash
POST /<OFFLINE_EVENT_SET_ID>/events
```
**Parâmetros:**
*   `upload_tag`: Identificador do lote (ex: "store_data_jan").
*   `data`: Array JSON de eventos (máx 2000 por chamada).
    *   `match_keys`: Dados de cliente hash (email, phone, etc - SHA256).
    *   `event_name`: Purchase, Lead, etc.
    *   `event_time`: Timestamp Unix.
    *   `value` & `currency`: Obrigatório para Purchase.
    *   `contents`: Itens comprados (id, quantity, price).

**Exemplo de Payload:**
```json
{
  "match_keys": {"email": ["<HASHED_EMAIL>"]},
  "event_name": "Purchase",
  "event_time": 1456870902,
  "value": 100.00,
  "currency": "BRL"
}
```

## Visualização de Dados
*   **Estatísticas de Upload:** `GET /<OFFLINE_EVENT_SET_ID>/stats`
*   **Insights de Atribuição:** Use a API de Insights com `action_breakdowns=["action_type"]`.

## Opções de Processamento de Dados (LDU)
Para conformidade com leis dos EUA (CCPA), use `data_processing_options`.
```json
"data_processing_options": ["LDU"],
"data_processing_options_country": 1,
"data_processing_options_state": 1000
```
