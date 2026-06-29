# Recuperação de Leads

Métodos para extrair leads gerados por anúncios: Webhooks (Tempo Real) e Leitura em Lote (Batch).

## Permissões Necessárias
- `leads_retrieval`
- `ads_management`
- `pages_manage_ads`

## 1. Webhooks (Tempo Real)
Receba notificações instantâneas. Configure no App Dashboard.

**Payload de Exemplo:**
```json
{
  "object": "page",
  "entry": [{
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "123456",
        "form_id": "789012",
        "created_time": 1440120384
      }
    }]
  }]
}
```
Use o `leadgen_id` para buscar detalhes: `GET /<LEAD_ID>`.

## 2. Leitura em Lote (Batch)

### Por Anúncio
```bash
curl -G \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/<AD_ID>/leads
```

### Por Formulário
```bash
curl -G \
  -d 'access_token=<ACCESS_TOKEN>' \
  -d 'fields=created_time,id,ad_id,field_data' \
  https://graph.facebook.com/v24.0/<FORM_ID>/leads
```

### Filtragem (Por Data)
Filtre leads criados após um timestamp específico.

```bash
curl -G \
  -d 'filtering=[{"field":"time_created","operator":"GREATER_THAN","value":1672531200}]' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/<FORM_ID>/leads
```

## Resposta de Dados (`field_data`)
Os dados do lead vêm em um array de pares nome/valor.

```json
"field_data": [
  { "name": "full_name", "values": ["João Silva"] },
  { "name": "email", "values": ["joao@exemplo.com"] }
]
```

## Avisos Legais Personalizados
Para ver respostas a checkboxes de disclaimer:
`GET /<LEAD_ID>?fields=custom_disclaimer_responses`
