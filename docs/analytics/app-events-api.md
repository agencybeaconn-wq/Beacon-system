# API de Eventos do App (Legado)

> [!WARNING]
> **Não Recomendado:** A API de Eventos do App não é recomendada para novas integrações.
> **Ação Recomendada:** Use a **API de Conversões (CAPI)**, que agora suporta eventos de App, Web e Offline.

## Visão Geral
Permite rastrear ações em aplicativos móveis (instalações, compras, etc.) para mensuração e criação de públicos.

## Tipos de Eventos
1.  **Registrados Automaticamente:** Instalações, sessões, compras (via SDK).
2.  **Padrão:** Eventos pré-definidos (ex: `fb_mobile_purchase`).
3.  **Personalizados:** Eventos específicos do app.

## Endpoints Principais

### Registrar Instalação
```bash
POST /{app-id}/activities
```
**Parâmetros:**
*   `event`: `MOBILE_APP_INSTALL`
*   `advertiser_tracking_enabled`: `1` (permitido) ou `0` (negado - iOS 14.5+).
*   `advertiser_id`: IDFA ou Android ID.

### Registrar Eventos de Conversão
```bash
POST /{app-id}/activities
```
**Parâmetros:**
*   `event`: `CUSTOM_APP_EVENTS`
*   `custom_events`: Array JSON com os eventos.
*   `ud`: User Data (hash SHA256) para Correspondência Avançada.

**Exemplo de Payload (Conversão):**
```bash
curl -i -X POST "https://graph.facebook.com/{app-id}/activities \
   ?event=CUSTOM_APP_EVENTS \
   &advertiser_id={advertiser-tracking-id} \
   &advertiser_tracking_enabled=1 \
   &application_tracking_enabled=1 \
   &custom_events=[ \
      {\"_eventName\":\"fb_mobile_purchase\", \
       \"event_id\":\"123456\", \
       \"_valueToSum\":21.97, \
       \"fb_currency\":\"GBP\" \
      } \
    ] \
   &ud[em]={sha256-hashed-email}"
```

## Parâmetros Importantes
*   `_eventName`: Nome do evento (ex: `fb_mobile_purchase`).
*   `_valueToSum`: Valor monetário ou numérico para agregação.
*   `event_id`: Identificador único para **desduplicação**.
*   `fb_content`: Detalhes dos itens (JSON).

## Eventos Padrão Comuns
*   `fb_mobile_activate_app` (Sessão/Ativação)
*   `fb_mobile_purchase` (Compra)
*   `fb_mobile_add_to_cart` (Adicionar ao Carrinho)
*   `fb_mobile_complete_registration` (Cadastro)
