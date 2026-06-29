# Insights de Nível de Ativo (Asset-Level Insights)

Analise o desempenho de ativos individuais (imagens, vídeos, textos) em campanhas de Criativo Dinâmico e Personalização de Ativos.

## Detalhamentos Disponíveis (Breakdowns)
Você pode segmentar os resultados pelos seguintes ativos:
- `body_asset` (Texto Principal)
- `description_asset` (Descrição)
- `image_asset` (Imagem)
- `title_asset` (Título)
- `call_to_action_asset` (Botão CTA)
- `link_url_asset` (URL de Destino)
- `video_asset` (Vídeo)
- `ad_format_asset` (Formato do Anúncio)

### Combinações
É possível combinar detalhamentos de ativos com demografia:
- `age`
- `gender`
- `age, gender`

## Métricas Principais
- `impressions`
- `clicks`
- `actions` (conversões, etc.)
- Derivados: `ctr`, `actions_per_impression`.

## Exemplos de Consulta

### Insights por Texto do Corpo (`body_asset`)
```bash
curl -G \
  -d "breakdowns=body_asset" \
  -d "fields=impressions,clicks,ctr" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/<AD_ID>/insights"
```
**Resposta Exemplo:**
```json
{
  "data": [
    {
      "impressions": "8801",
      "body_asset": { "text": "Texto A", "id": "..." }
    },
    {
      "impressions": "7558",
      "body_asset": { "text": "Texto B", "id": "..." }
    }
  ]
}
```

### Insights por Imagem e Idade (`image_asset`, `age`)
```bash
curl -G \
  -d "breakdowns=image_asset,age" \
  -d "fields=impressions" \
  -d "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/<ADSET_ID>/insights"
```
**Resposta Exemplo:**
```json
{
  "data": [
    {
      "impressions": "5497",
      "age": "18-24",
      "image_asset": { "hash": "...", "url": "...", "id": "..." }
    }
  ]
}
```
