# Webhooks para Anúncios de Cadastro (Leads)

Receba notificações em tempo real quando um novo lead for gerado para integrar com seu CRM.

## Configuração

### 1. Pré-requisitos
- App Meta configurado.
- Endpoint HTTPS válido.
- Permissões: `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`, `ads_management`.

### 2. Assinar Campo `leadgen`
No Painel de Apps, configure o produto Webhooks, selecione o objeto **Page** e assine o campo **leadgen**.

### 3. Instalar App na Página
Para receber os webhooks, a Página deve "instalar" o app (inscrever-se).

```bash
curl -i -X POST "https://graph.facebook.com/v24.0/{page-id}/subscribed_apps \
  ?subscribed_fields=leadgen \
  &access_token={page-access-token}"
```

**Verificar Instalação:**
```bash
curl -i -X GET "https://graph.facebook.com/v24.0/{page-id}/subscribed_apps \
  ?access_token={page-access-token}"
```

## Payload de Notificação
O Facebook enviará um POST para seu endpoint com os dados do evento.

```json
{
   "object": "page",
   "entry": [
       {
           "id": 153125381133,
           "time": 1438292065,
           "changes": [
               {
                   "field": "leadgen",
                   "value": {
                       "leadgen_id": 123123123123,
                       "page_id": 123123123,
                       "form_id": 12312312312,
                       "adgroup_id": 12312312312,
                       "ad_id": 12312312312,
                       "created_time": 1440120384
                   }
               }
           ]
       }
   ]
}
```

Use o `leadgen_id` para buscar os detalhes completos do lead via API (`GET /<LEAD_ID>`).
