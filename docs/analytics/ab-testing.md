# Testes A/B (Split Testing)

Permite testar estratégias publicitárias com públicos mutuamente exclusivos para identificar a de melhor desempenho.

## Conceito
O sistema divide o público em grupos aleatórios e não sobrepostos (Split Test) para garantir a integridade científica do teste.
*   **Recomendação:** Testar apenas **uma variável** por vez (ex: Criativo A vs Criativo B, ou Otimização A vs Otimização B).

## Restrições
*   **Máximo de Estudos Simultâneos:** 100 por anunciante.
*   **Máximo de Células por Estudo:** 150.
*   **Máximo de Entidades por Célula:** 100.

## Configuração do Teste
Use o endpoint `/ad_studies` com `type=SPLIT_TEST`.

### Exemplo: Teste no Nível do Conjunto de Anúncios
Comparando dois Ad Sets existentes.

```bash
curl \
-F 'name="Teste de Criativo"' \
-F 'description="Comparando Ad Set A vs B"' \
-F 'start_time=1478387569' \
-F 'end_time=1479597169' \
-F 'type=SPLIT_TEST' \
-F 'cells=[
    {"name":"Grupo A", "treatment_percentage":50, "adsets":["<AD_SET_ID_A>"]},
    {"name":"Grupo B", "treatment_percentage":50, "adsets":["<AD_SET_ID_B>"]}
   ]' \
-F 'access_token=<TOKEN>' \
https://graph.facebook.com/v24.0/<BUSINESS_ID>/ad_studies
```

### Exemplo: Teste no Nível da Campanha
Comparando duas Campanhas inteiras (ex: Estratégia de Conversão vs Tráfego).

```bash
curl \
-F 'name="Teste de Estratégia"' \
-F 'type=SPLIT_TEST' \
-F 'cells=[
    {"name":"Grupo A", "treatment_percentage":50, "campaigns":["<CAMPAIGN_ID_A>"]},
    {"name":"Grupo B", "treatment_percentage":50, "campaigns":["<CAMPAIGN_ID_B>"]}
   ]' \
...
```

## Avaliação e Boas Práticas
1.  **KPIs:** Defina o sucesso antes (ex: menor CPA).
2.  **Tamanho da Amostra:** Garanta que os grupos tenham tamanhos comparáveis ou ajuste o orçamento para compensar diferenças de alcance.
3.  **Confiança:** Testes mais longos e com maior orçamento tendem a ter maior significância estatística.
4.  **Orçamento:** Pode-se usar orçamentos diferentes para testar a elasticidade, mas cuidado com o impacto no alcance.

![Diagrama de População do Facebook dividida em Splits](/Users/joaovithorbauer/.gemini/antigravity/brain/9c2b7915-9b24-459d-8627-f340ba521ae1/uploaded_image_1764622938388.png)
