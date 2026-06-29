# Limites e Boas Práticas da API de Insights

Gerencie o volume de dados e evite erros de limitação ao usar a API de Insights.

## Limites de Volume (Rate Limiting)
A API usa um sistema de "peso" de requisição, não apenas contagem de chamadas.
*   **Cabeçalho de Resposta:** `X-FB-Ads-Insights-Throttle`
*   **Formato:** `{ "app_id_util_pct": 100, "acc_id_util_pct": 10 }`
*   **Erro:** `error_code = 4` (Too many API requests).
*   **Recomendação:** Monitore o cabeçalho e pause/reduza requisições se `util_pct` estiver próximo de 100%.

## Limites de Dados por Chamada
Para evitar timeouts e sobrecarga:
*   **Erro:** `error_code = 100` (subcode: 1487534).
*   **Solução:** Reduza o intervalo de datas, remova detalhamentos complexos ou use paginação.

## Trabalhos Assíncronos (Async Jobs)
Recomendado para grandes volumes de dados ou consultas complexas.

### Fluxo de Trabalho
1.  **Iniciar Job (POST):**
    ```bash
    POST /<AD_OBJECT>/insights
    # Retorna: { "report_run_id": 123456 }
    ```
2.  **Verificar Status (Polling):**
    ```bash
    GET /<REPORT_RUN_ID>
    # Aguarde: "async_status": "Job Completed" e "async_percent_completion": 100
    ```
3.  **Pegar Resultados (GET):**
    ```bash
    GET /<REPORT_RUN_ID>/insights
    ```

## Exportação de Relatórios
Endpoint de conveniência para baixar relatórios em CSV/XLS.
```bash
https://www.facebook.com/ads/ads_insights/export_report/?report_run_id=<ID>&format=csv&access_token=<TOKEN>
```

## Restrições de Alcance (Reach)
*   **Limite de 13 Meses:** Consultas com `breakdowns` e `start_date` > 13 meses atrás **não retornarão** `reach` (e métricas derivadas como `frequency`, `cpp`) em chamadas síncronas.
*   **Solução:** Use Jobs Assíncronos (limite de 10/dia por conta).
*   **Throttle Específico:** `x-Fb-Ads-Insights-Reach-Throttle`.

## Boas Práticas Gerais
1.  **Filtragem:** Use `filtering` para buscar apenas objetos com dados (ex: `impressions > 0`).
2.  **Nível de Objeto:** Consulte primeiro o nível superior (ex: conta) para pegar IDs, depois consulte detalhes em lote.
3.  **Batch Requests:** Agrupe múltiplas chamadas em uma única requisição HTTP.
4.  **Date Presets:** Prefira `date_preset` a `time_range` customizado para melhor performance de cache.
