# Especificações de Rastreamento e Conversão

Definem como o sistema monitora ações do usuário (`tracking_specs`) e o que conta como conversão para otimização (`conversion_specs`).

## Diferença Principal
*   **Tracking Specs:** Usado para **relatórios**. Define quais ações rastrear (ex: cliques, instalações, conversões offsite). Não afeta a entrega.
*   **Conversion Specs:** Usado para **otimização**. Define qual ação o algoritmo deve buscar maximizar. Desde a v2.4, é somente leitura e derivado do `optimization_goal`.

## Tracking Specs (`tracking_specs`)
Campo JSON no objeto `Ad`. Define o que rastrear.

**Exemplo: Rastrear múltiplos Pixels**
```json
tracking_specs="[
  {'action.type':'offsite_conversion','fb_pixel':1},
  {'action.type':'offsite_conversion','fb_pixel':2},
  {'action.type':'offsite_conversion','fb_pixel':3}
]"
```

**Padrões:**
O sistema aplica especificações padrão baseadas no objetivo e criativo. Adicionar specs manuais não remove as padrão (exceto para `APP_INSTALLS` e `OUTCOME_ENGAGEMENT`).

## Conversion Specs (`conversion_specs`)
Campo JSON no objeto `Ad` (somente leitura).

**Exemplos Comuns:**

| Tipo de Anúncio | Spec Típica |
| :--- | :--- |
| **Link Click** | `{'action.type':'link_click', 'object':'PAGE_ID'}` |
| **Page Like** | `{'action.type':'like', 'page':'PAGE_ID'}` |
| **App Install** | `{'action.type':'app_install', 'application':'APP_ID'}` |
| **Event Response** | `{'action.type':'rsvp', 'response':'yes', 'event':'EVENT_ID'}` |

## Metaespecificações
Agrupam múltiplas ações sob um único tipo para simplificar.

*   **`post_engagement`**: Inclui comment, like, share, link_click, photo_view, video_play.
*   **`page_engagement`**: Inclui checkin, follow, mention, tab_view + todas as ações de post_engagement no contexto da página.
*   **`app_engagement`**: Inclui app_install, app_use, credit_spent.

## Ações de Rastreamento Personalizadas
Você pode montar specs específicas combinando `action.type` com IDs de objetos.

*   `offsite_conversion` + `fb_pixel`
*   `leadgen_quality_conversion` + `fb_pixel` / `dataset`
*   `video_play` + `post`
*   `mobile_app_install` + `application`
