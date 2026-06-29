# Volume de Anúncios (Ads Volume)

API para monitorar o número de anúncios em veiculação ou análise, sujeitos aos limites de anúncios por página.

## Endpoint Principal
```bash
GET /v24.0/act_<AD_ACCOUNT_ID>/ads_volume
```

## O que conta como "Em Veiculação ou Análise"?
Um anúncio é contabilizado se:
1.  **Status Efetivo:** `1` (Active).
2.  **Status Configurado:** `Active` E Status Efetivo `9` (Pending Review) ou `17` (Pending Processing).
3.  **Status da Conta:** `1` (Active), `8` (Pending Settlement) ou `9` (In Grace Period).
4.  **Programação:**
    *   Hora de início no passado e hora de término no futuro (ou sem término).
    *   Programado para começar dentro de 3 meses.

## Parâmetros de Consulta
*   `show_breakdown_by_actor=true`: Detalha o volume por Página (`actor_id`).
*   `page_id=<PAGE_ID>`: Filtra para uma página específica.

## Exemplo de Resposta
```json
{
  "data": [
    {
      "ads_running_or_in_review_count": 2,
      "current_account_ads_running_or_in_review_count": 2,
      "actor_id": "<PAGE_ID>",
      "limit_on_ads_running_or_in_review": 250,
      "recommendations": []
    }
  ]
}
```

## Campos Importantes
*   `ads_running_or_in_review_count`: Total de anúncios contando para o limite.
*   `limit_on_ads_running_or_in_review`: O limite atual aplicado.
*   `recommendations`: Sugestões para reduzir volume (ex: `zero_impression`, `learning_limited`).
