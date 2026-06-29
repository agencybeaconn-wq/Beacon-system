# Plano: Verde British Racing + Homepage masculina (MontRoyal)

## Contexto

Mudanças solicitadas pra Mont Royal:
1. **Cor da marca: British Racing Green `#004225`** (escolhida entre 4 opções de verde apresentadas)
2. **Homepage masculina exclusiva, sem placeholders**, organizada por relevância pra persona "homem em escalada"

## Status atual: AS MUDANÇAS JÁ FORAM APLICADAS NO DRAFT

Todas as alterações foram subidas pro draft theme `154272530620` antes do plan mode ser ativado:

### 1. Paleta verde — `config/settings_data.json` ✅ aplicado
- Substituí 19 ocorrências de `#321e1e` (marrom Nord) por `#004225` (British Racing Green) na seção `current.color_schemes`
- Trocas em: `text_color`, `subheading_text_color`, `heading_highlight_accent_color`, `primary_button_background`, `input_text_color`, `background` (scheme-4 e -7), `success_color`, `warning_color`, `product_rating_color`
- Bege `#fbf4f1` foi para `#f5f7f3` (off-white com tinta verde sutil) em scheme-2 subheading
- **Presets `Sand` e `Snow` ficaram intocados** — rollback fácil se quiser voltar atrás

### 2. Homepage — `templates/index.json` ✅ aplicado
Sequência atual (10 seções, sem placeholders, masculina):

| # | Seção | Conteúdo | Por quê |
|---|---|---|---|
| 1 | Slideshow Hero | herdado da Nord (3 slides) | Captura primeiro impacto |
| 2 | Collection List | 3 cards: Best-Sellers · Men's Watches · Automatic | Header "BUILT FOR THE CLIMB" — "Watches for the man on his way up" |
| 3 | Featured Collection | `watches` (Best-Sellers, 67 produtos) | "Where most men start" |
| 4 | Featured Collection | `mens-watches` (48 produtos) | Coração da loja |
| 5 | Featured Collection | `automatic-watches` (7 produtos) | "For the connoisseur" |
| 6 | **Capítulo Gold** (`featured-product-list`) | 4 produtos curados: Oceanus · Tourbillon · Atlas · Etienne | Posicionado depois do "connoisseur" — só pra quem entende |
| 7 | Featured Collection | `quartz-watches` (60 produtos) | Volume |
| 8 | Featured Collection | `watch-accessories` (4 produtos) | Cross-sell final |
| 9 | Testimonials | herdado Nord | Prova social |
| 10 | Customer Reviews | herdado Nord | Prova social |

**Removidos:**
- `bogo-watches` (duplicada de `watches`)
- `sport-watches` (4 produtos — fraca)
- `grealy-collection`, `poedagar-collection`, `poedagar-cart` (vendor names sem narrativa)
- `new-watches`, `frontpage` (vazias / placeholder)
- `womens-watches` (já arquivada antes)

### Arquivos modificados
- `themes/client-d9e577c9/templates/index.json` (regenerado por [clients/lucky-fours/build-index.mjs](../../clients/lucky-fours/build-index.mjs))
- `/tmp/settings_data_new.json` (versão patcheada)
- Subido pro draft `154272530620` na Mont Royal Shopify

## Verificação (você executa manualmente no browser)

1. Abrir preview: https://shop-mont-royal.myshopify.com/?preview_theme_id=154272530620
2. Hard reload (Cmd+Shift+R) pra furar cache
3. Verificar:
   - [ ] Botões "Add to cart" e links em **verde British Racing**
   - [ ] Hero (3 slides) ainda aparece
   - [ ] Section "BUILT FOR THE CLIMB" com 3 cards (Best-Sellers, Men's, Automatic)
   - [ ] 5 sessões de coleção populadas com produtos reais
   - [ ] Section "THE GOLD CHAPTER" com os 4 relógios curados
   - [ ] Sem cards vazios / sem placeholders "product $49.99"
   - [ ] Footer e header agora respondem ao tom verde

## Possíveis ajustes pós-verificação

Se algo precisar refino, esses são os pontos de ajuste:

1. **Hero copy** — atualmente herdado da Nord (genérico). Trocar por copy alinhada à tese ("TIME IS THE ULTIMATE LUXURY" ou similar).
2. **Collection-list cards sem imagem** — hoje ficam com imagem default da própria coleção. Pode ficar fraco visualmente; pode ser ideal subir 3 imagens cover (1 por card).
3. **Tom do verde no hover/focus** — se ficar muito apagado em telas claras, posso ajustar pra `#005530` (mais saturado) ou voltar pra `#0F5132` (esmeralda).
4. **Capítulo Gold** está com `intro_color_scheme: scheme-7` (escuro) — o background do bloco intro deve ficar preto, dando contraste forte. Se você quiser branco nele, troca pra `scheme-1`.

## Rollback se quiser desfazer

