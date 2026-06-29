# Experiências Instantâneas (Canvas)

Experiências Instantâneas (antigo Canvas) são destinos de tela cheia pós-clique que carregam quase instantaneamente.

## Criação (`/canvases`)

Para criar, você precisa do ID da Página e dos elementos (fotos, botões, texto).

**Exemplo de Criação:**
```bash
curl \
  -F 'background_color=FFFFFF' \
  -F 'body_element_ids=["<CANVAS_PHOTO_ID>"]' \
  -F 'is_hidden=' \
  -F 'is_published=' \
  -F 'name=Canvas Name' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/<PAGE_ID>/canvases
```

### Elementos
- **Botão:** `button_style` obrigatório.
- **Carrossel:** Múltiplas imagens/vídeos.
- **Foto/Vídeo:** IDs de mídia carregados na Página.
- **Texto:** Estilo e conteúdo.
- **Conjunto de Produtos:** Catálogo Advantage+.

## Publicar e Usar em Anúncios

1. **Publicar:** Defina `is_published=1` via `POST /<CANVAS_ID>`.
2. **Gerar Criativo:** Use o `CANVAS_LINK` retornado.

```bash
curl -X POST \
  -F 'object_story_spec={
       "page_id": "<PAGE_ID>",
       "link_data": {
         "link": "<CANVAS_LINK>",
         "call_to_action": { "type": "LEARN_MORE" }
       }
     }' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adcreatives
```

## Públicos de Engajamento

Crie públicos de pessoas que interagiram com a Experiência Instantânea.

- **Abriram:** `event_name: "instant_shopping_document_open"`
- **Clicaram:** `event_name: "instant_shopping_element_click"`

**Exemplo (Abriram):**
```bash
curl \
  -F 'name=Instant Experience Engagement Audience' \
  -F 'rule=[{"object_id":"<CANVAS_ID>","event_name":"instant_shopping_document_open"}]' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences
```
