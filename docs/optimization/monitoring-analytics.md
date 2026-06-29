# Monitoramento e Análises

Monitorar o desempenho da campanha usando a API de Insights permite avaliar o que funciona e o que precisa de melhorias.

## Consulta de Dados de Análises (`insights`)

Para extrair dados de desempenho, faça solicitações `GET` ao ponto de extremidade `/act_<AD_ACCOUNT_ID>/insights`.

**Parâmetros comuns:**
- `fields`: Métricas desejadas (ex: `impressions`, `clicks`, `spend`).
- `time_range`: Intervalo de datas (`since`, `until`).
- `filtering`: Filtros específicos.

**Exemplo de solicitação da API:**
```bash
curl -X GET \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/insights \
  -F 'fields=impressions,clicks,spend' \
  -F 'time_range={"since":"2023-01-01","until":"2023-12-31"}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Interpretação dos Resultados (KPIs)

- **CTR (Taxa de Cliques):** Indica se o criativo é atraente. CTR baixa pode exigir ajustes no design ou copy.
- **CPC (Custo por Clique):** Custo médio para levar um usuário ao destino.
- **ROAS (Retorno do Investimento em Publicidade):** Eficácia da campanha em gerar receita.

## Otimização Contínua

Use os dados para identificar tendências:
- **Engajamento alto, conversão baixa:** Teste novas CTAs ou refine o targeting.
- **Alocação de orçamento:** Realoque verba para segmentos demográficos com melhor desempenho.
