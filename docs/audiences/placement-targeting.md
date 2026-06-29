# Direcionamento de Posicionamento (Placement Targeting)

Controle onde seus anúncios são exibidos (Facebook, Instagram, Audience Network, Messenger, Threads).

## Estrutura de Posicionamento
O posicionamento é definido no objeto `targeting` do Ad Set.

### Plataformas (`publisher_platforms`)
- `facebook`, `instagram`, `audience_network`, `messenger`, `threads`.
- Padrão: Todas (se omitido).
- *Nota:* Para Threads, deve incluir `instagram` e `threads`.

### Posições Específicas
Se você selecionar uma plataforma, pode refinar as posições. Se omitir, todas as posições da plataforma serão usadas.

- **Facebook (`facebook_positions`):**
    - `feed`, `right_hand_column`, `marketplace`, `video_feeds`, `story`, `search`, `instream_video`, `facebook_reels`, `facebook_reels_overlay`.
- **Instagram (`instagram_positions`):**
    - `stream` (Feed), `story`, `explore`, `explore_home`, `reels`, `ig_search`.
- **Audience Network (`audience_network_positions`):**
    - `classic`, `rewarded_video`.
- **Messenger (`messenger_positions`):**
    - `story`, `sponsored_messages`.
- **Threads (`threads_positions`):**
    - `threads_stream` (Requer `instagram.stream`).

### Dispositivos (`device_platforms`)
- `mobile`, `desktop`.

## Exemplo de Configuração Manual
```json
"targeting": {
  "geo_locations": {"countries": ["US"]},
  "publisher_platforms": ["facebook", "instagram"],
  "facebook_positions": ["feed", "story"],
  "instagram_positions": ["stream", "story"],
  "device_platforms": ["mobile"]
}
```

## Brand Safety e Exclusões
Controle onde seus anúncios **não** devem aparecer.

### Filtro de Inventário (`brand_safety_content_filter_levels`)
Níveis de filtro para conteúdo sensível.
- **Facebook (In-Stream/Reels):** `FACEBOOK_RELAXED`, `FACEBOOK_STANDARD`, `FACEBOOK_STRICT`.
- **Audience Network:** `AN_RELAXED`, `AN_STANDARD`, `AN_STRICT`.
- **Feed:** `FEED_RELAXED`, `FEED_STANDARD`, `FEED_STRICT`.

```json
"targeting": {
  "brand_safety_content_filter_levels": ["FACEBOOK_STRICT", "AN_STANDARD"]
}
```

### Listas de Bloqueio
- **`excluded_publisher_categories`**: Excluir categorias (ex: `gambling`, `dating`, `tragedy_and_conflict`).
- **`excluded_publisher_list_ids`**: IDs de listas de bloqueio personalizadas.

## Posicionamentos Efetivos
Como algumas combinações de objetivo/posicionamento são inválidas, a API pode filtrar suas escolhas.
Para verificar onde o anúncio realmente rodará:

```bash
GET /<AD_SET_ID>?fields=targeting{effective_publisher_platforms,effective_facebook_positions}
```

## Soft Opt-Out (Gastos Limitados)
Permite alocar no máximo 5% do orçamento para posicionamentos excluídos se houver chance de alta performance.

```json
"placement_soft_opt_out": {
  "facebook_positions": ["marketplace"]
}
```
