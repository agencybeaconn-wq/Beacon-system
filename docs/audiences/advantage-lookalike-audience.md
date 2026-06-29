# Público Semelhante Advantage (Advantage Lookalike Audience)

Permite que a Meta entregue anúncios para pessoas fora dos seus Públicos Semelhantes (Lookalikes) definidos, caso haja probabilidade de melhorar a performance.

## Configuração (`targeting_relaxation_types`)

Este parâmetro fica dentro do objeto `targeting`.

*   **Ativar (Aceitar):** `targeting_relaxation_types: { 'lookalike': 1 }`
*   **Desativar (Recusar):** `targeting_relaxation_types: { 'lookalike': 0 }`

## Comportamento
*   **Padrão:** Geralmente ativado por padrão para campanhas com objetivos compatíveis.
*   **Compatibilidade:** Se usado com um objetivo incompatível, a API retornará um erro.

## Exemplo de Requisição

```bash
curl \
  -F "name=Advantage Lookalike Test" \
  -F "targeting={
       'geo_locations': {'countries': ['US', 'GB']}, 
       'custom_audiences': [{<LOOKALIKE_DATA>}],
       'targeting_relaxation_types': {'lookalike': 1}
     }" \
  -F "access_token=<ACCESS_TOKEN>" \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets
```
