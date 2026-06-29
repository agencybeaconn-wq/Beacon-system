# Formato de Anúncio Flexível (Flexible Ad Format)

Automatize a criação de anúncios agrupando ativos (imagens, vídeos, textos) em um único anúncio, permitindo que o sistema determine a melhor combinação e formato.

## Limitações
- **Objetivos Suportados:** `OUTCOME_SALES` e `OUTCOME_APP_PROMOTION`.
- **Requisitos:** Pelo menos 1 imagem ou vídeo por grupo.
- **CTA:** Todos os CTAs devem ser do mesmo tipo.
- **Texto:** Máximo de 5 variações por tipo de texto (`primary_text`, `headline`, etc.).

## Configuração (`creative_asset_groups_spec`)
Em vez de definir um formato rígido, você fornece grupos de ativos.

### Estrutura do Grupo
```json
{
  "groups": [
    {
      "images": [{"hash": "..."}],
      "videos": [{"video_id": "..."}],
      "texts": [
        {"text": "Promoção de Verão", "text_type": "primary_text"},
        {"text": "50% OFF", "text_type": "headline"}
      ],
      "call_to_action": {
        "type": "LEARN_MORE",
        "value": {"link": "https://example.com"}
      }
    }
  ]
}
```

### Exemplo de Criação de Anúncio
```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'adset_id=<ADSET_ID>' \
  -F 'creative={
       "name": "Flexible Creative",
       "object_story_spec": { "page_id": "<PAGE_ID>" }
     }' \
  -F 'creative_asset_groups_spec={
       "groups": [
         {
           "images": [
             {"hash": "<IMAGE_HASH_1>"},
             {"hash": "<IMAGE_HASH_2>"}
           ],
           "videos": [
             {"video_id": "<VIDEO_ID_1>"}
           ],
           "texts": [
             {"text": "Texto Principal A", "text_type": "primary_text"},
             {"text": "Título B", "text_type": "headline"}
           ],
           "call_to_action": {
             "type": "LEARN_MORE",
             "value": {"link": "https://site.com"}
           }
         }
       ]
     }' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Leitura
Para verificar a configuração, leia o campo `creative_asset_groups_spec` no ID do anúncio.

```bash
curl -G "https://graph.facebook.com/v24.0/<AD_ID>/" \
  -d 'fields=creative_asset_groups_spec' \
  -d 'access_token=<ACCESS_TOKEN>'
```
