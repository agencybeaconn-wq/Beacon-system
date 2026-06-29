# Direcionamento Detalhado Advantage (Advantage Detailed Targeting)

Permite que a Meta expanda o direcionamento detalhado (interesses, comportamentos) para alcançar pessoas além das que você definiu, se isso melhorar a performance.

## Configuração (`targeting_optimization`)

Este parâmetro fica dentro do objeto `targeting`.

*   **Ativar (Aceitar):** `targeting_optimization: 'expansion_all'`
*   **Desativar (Recusar):** `targeting_optimization: 'none'`

## Comportamento
*   **Compatibilidade:** Nem todos os objetivos de campanha suportam essa otimização. Se usado com um objetivo incompatível, a API retornará um erro.
*   **Padrão:** Geralmente desativado por padrão, a menos que especificado o contrário em atualizações recentes ou objetivos específicos (como Instalações de App que podem forçar automação).

## Exemplo de Requisição

```bash
curl \
  -F "name=Advantage Detailed Targeting Test" \
  -F "targeting={
       'geo_locations': {'countries': ['US', 'GB']}, 
       'user_os': ['iOS'], 
       'targeting_optimization': 'expansion_all'
     }" \
  -F "access_token=<ACCESS_TOKEN>" \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets
```
