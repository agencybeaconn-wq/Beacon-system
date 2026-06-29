# Públicos Personalizados do Site (Website Custom Audiences)

Criação de públicos baseados em visitantes do site e ações específicas (Pixel da Meta e API de Conversões).

## Criação de Público

### Endpoint
```bash
POST https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences
```

### Parâmetros Principais
- **`name`**: Nome do público.
- **`rule`**: Objeto JSON com regras de inclusão/exclusão.
- **`retention_days`**: Dias para manter o usuário no público (1 a 180). Se omitido, usa o valor de `retention_seconds` da regra.
- **`prefill`**: `true` (padrão) para incluir tráfego passado; `false` para começar do zero.

### Exemplo de Criação (Visitou URL contendo "shoes")
```bash
curl -X POST \
  -F 'name="My Test Website Custom Audience"' \
  -F 'rule={
       "inclusions": {
         "operator": "or",
         "rules": [
           {
             "event_sources": [
               {
                 "id": "<PIXEL_ID>",
                 "type": "pixel"
               }
             ],
             "retention_seconds": 8400,
             "filter": {
               "operator": "and",
               "filters": [
                 {
                   "field": "url",
                   "operator": "i_contains",
                   "value": "shoes"
                 }
               ]
             }
           }
         ]
       }
     }' \
  -F 'prefill=1' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences
```

## Gerenciamento de Pixel

### Criar Pixel
```bash
POST https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adspixels
```

### Obter Código do Pixel
```bash
GET https://graph.facebook.com/v24.0/<PIXEL_ID>?fields=code
```

## Gerenciamento de Públicos

### Ler Públicos
```bash
GET https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences?fields=id,name,rule
```

### Atualizar
```bash
POST https://graph.facebook.com/v24.0/<CUSTOM_AUDIENCE_ID>
# Body: name="New Name"
```

### Excluir
```bash
DELETE https://graph.facebook.com/v25.0/<CUSTOM_AUDIENCE_ID>
```

## Recursos Avançados

### Data Dinâmica (Viagens)
Permite criar públicos baseados em datas futuras (ex: data de check-in).
- **Requisito:** Enviar `checkin_date` no evento do pixel.
- **Formato:** ISO-8601 (YYYY-MM-DD, YYYYMMDD, etc).

**Exemplo de Regra (Check-in futuro):**
```json
"rule_aggregation": {
  "type": "last_event_time_field",
  "config": {
    "field": "checkin_date",
    "time_format": "YYYY-MM-DD"
  },
  "operator": ">", // Data posterior a hoje (usando sintaxe específica, ex: "@<" para passado, etc. Verificar doc específica para operadores de tempo relativo)
  "value": "0"
}
```

### API de Conversões (CAPI)
Eventos enviados via CAPI também alimentam os Públicos Personalizados do Site. Recomenda-se enviar `external_id` para melhorar a correspondência.
