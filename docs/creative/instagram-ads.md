# Anúncios no Instagram

Guia para criar anúncios no Feed, Stories, Explorar e Reels do Instagram.

## 1. Obter ID da Conta do Instagram
Necessário para associar ao anúncio.
- Via Gerenciador de Negócios (Recomendado).
- Via Página conectada.

## 2. Campanha
Objetivos compatíveis variam por posicionamento.
- **Gerais:** `BRAND_AWARENESS`, `REACH`, `LINK_CLICKS`, `APP_INSTALLS`, `VIDEO_VIEWS`, `CONVERSIONS`.
- **Específicos:** `LEAD_GENERATION` (Explorar/Stories/Stream), `STORE_TRAFFIC` (Stories/Stream).

## 3. Conjunto de Anúncios (Targeting)
Defina `publisher_platforms` como `["instagram"]` e escolha os `instagram_positions`.

### Posicionamentos (`instagram_positions`)
- `stream` (Feed)
- `story` (Stories)
- `explore` (Aba Explorar)
- `explore_home` (Página Inicial do Explorar)
- `reels` (Reels)
- `ig_search` (Resultados de Pesquisa)

**Exemplo (Feed + Explorar):**
```bash
curl \
  -F 'name=Instagram Adset' \
  -F 'targeting={ 
    "geo_locations": {"countries":["US"]}, 
    "publisher_platforms": ["instagram"],
    "instagram_positions": ["stream", "explore"],  
    "user_os": ["iOS"] 
  }' \
  ...
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets
```

## 4. Criativo
Requer `instagram_user_id` (ID da conta do Instagram) e `page_id` (Página do Facebook associada).

> **Atualização v24.0:** O campo `instagram_actor_id` foi depreciado. Use `instagram_user_id` em todos os payloads.

- **Formatos:** Imagem única, Vídeo, Carrossel, Stories (com elementos interativos).
- **Nota:** As informações da Página do Facebook não aparecem no anúncio do Instagram, mas são necessárias para a criação.
