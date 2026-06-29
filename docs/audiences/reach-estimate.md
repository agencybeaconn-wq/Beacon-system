# Reach Estimate API

Obtenha estimativas de alcance (tamanho do público) e lances sugeridos para um conjunto de especificações de segmentação.

## Endpoint
```bash
GET https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/reachestimate
```

## Parâmetros
- **`targeting_spec`**: Objeto JSON definindo a segmentação (geo, plataformas, OS, interesses, etc.).
- **`optimize_for`**: O objetivo de otimização para o qual você deseja a estimativa (ex: `IMPRESSIONS`, `LINK_CLICKS`).

## Exemplo de Uso
Estimar alcance para usuários iOS nos EUA e Reino Unido, no Instagram.

```bash
curl -G \
  --data-urlencode 'targeting_spec={ 
    "geo_locations": {"countries":["US","GB"]}, 
    "publisher_platforms": ["instagram"], 
    "user_os": ["iOS"] 
  }' \
  -d 'optimize_for=IMPRESSIONS' \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/reachestimate
```

## Resposta Típica
A resposta incluirá dados como:
- `users`: Estimativa do número de pessoas que podem ser alcançadas.
- `bid_estimations`: Sugestões de lance mínimo, médio e máximo.
- `imp_estimates`: Estimativas de impressões.
