# Insights de Anúncios (Instagram)

Obtenha estatísticas de desempenho para anúncios no Instagram e Facebook.

## Detalhamento por Plataforma e Posição
Use `breakdowns=publisher_platform,platform_position` para separar os dados entre Facebook e Instagram, e entre os posicionamentos específicos (Feed, Stories, Reels, Explorar).

### Exemplo de Requisição
```bash
curl -G \
  -d 'access_token=<ACCESS_TOKEN>' \
  -d 'fields=impressions,clicks,spend' \
  -d 'breakdown=publisher_platform,platform_position' \
  "https://graph.facebook.com/v24.0/<AD_SET_ID>/insights"
```

### Exemplo de Resposta
```json
{
  "data": [
    {
      "impressions": "322",
      "publisher_platform": "instagram",
      "platform_position": "feed"
    },
    {
      "impressions": "617",
      "publisher_platform": "instagram",
      "platform_position": "instagram_stories"
    },
    {
      "impressions": "168",
      "publisher_platform": "instagram",
      "platform_position": "instagram_reels"
    }
  ]
}
```

## Tags de Rastreamento
Use o campo `url_tags` no criativo do anúncio para rastreamento externo (ex: Google Analytics).
- **Recomendação:** Use `utm_source=instagram` para identificar tráfego vindo do Instagram.
- **Macro:** `url_tags=SITE_SOURCE_NAME` pode ajudar a diferenciar dinamicamente.
