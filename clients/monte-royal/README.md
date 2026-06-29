# Monte Royal — Resumo Curado do Contexto Resgatado

> Resgate de 3 sessões antigas do Claude Code que ficaram inacessíveis pelo limite de imagens.
> **Para o histórico completo** (526 mensagens cronológicas): [`CONTEXTO_COMPLETO.md`](./CONTEXTO_COMPLETO.md).
> **Para os blocos de código brutos** (25 arquivos): [`code-blocks/`](./code-blocks/).

---

## TL;DR — A Loja em uma Tela

| Item | Valor |
|---|---|
| **Domínio Shopify** | `shop-mont-royal.myshopify.com` |
| **Tema base** | Clone do **Nord** (loja de relógios) |
| **Source de produtos** | Lucky Fours (custom collections + collects) |
| **Cor da marca** | **British Racing Green `#004225`** (escolhido entre 4 verdes) |
| **Off-white sutil** | `#f5f7f3` (substitui `#fbf4f1` bege da Nord) |
| **Persona** | "Homem em escalada" — homepage masculina exclusiva |
| **Tagline** | "BUILT FOR THE CLIMB" / "Watches for the man on his way up" |
| **Capítulo curado** | "THE GOLD CHAPTER" — 4 relógios (Oceanus, Tourbillon, Atlas, Etienne) |
| **Draft theme ID** | `154272530620` |

---

## A Decisão da Cor

Substituídas **19 ocorrências** de `#321e1e` (marrom Nord) por `#004225` em `config/settings_data.json`:
- `text_color`, `subheading_text_color`, `heading_highlight_accent_color`
- `primary_button_background`, `input_text_color`
- `background` (scheme-4 e scheme-7)
- `success_color`, `warning_color`, `product_rating_color`

Bege `#fbf4f1` → off-white esverdeado `#f5f7f3` no scheme-2.

**Presets `Sand` e `Snow` ficaram intocados** — rollback fácil se quiser voltar.

**Alternativas se ficar muito apagado:**
- `#005530` — verde mais saturado
- `#0F5132` — verde esmeralda

---

## A Homepage Masculina (10 seções)

Sequência aplicada em [`themes/client-d9e577c9/templates/index.json`](../../themes/client-d9e577c9/templates/index.json) — ver também o gerador em [`code-blocks/020_70c1dcae_assistant_mjs.mjs`](./code-blocks/020_70c1dcae_assistant_mjs.mjs).

| # | Seção | Conteúdo | Por quê |
|---|---|---|---|
| 1 | Slideshow Hero | herdado Nord (3 slides) | Captura primeiro impacto |
| 2 | Collection List | 3 cards: Best-Sellers · Men's Watches · Automatic | Header "BUILT FOR THE CLIMB" |
| 3 | Featured Collection | `watches` (67 produtos) | "Where most men start" |
| 4 | Featured Collection | `mens-watches` (48 produtos) | Coração da loja |
| 5 | Featured Collection | `automatic-watches` (7 produtos) | "For the connoisseur" |
| 6 | **Capítulo Gold** | 4 produtos curados | Posicionado depois do "connoisseur" |
| 7 | Featured Collection | `quartz-watches` (60 produtos) | Volume |
| 8 | Featured Collection | `watch-accessories` (4 produtos) | Cross-sell final |
| 9 | Testimonials | herdado Nord | Prova social |
| 10 | Customer Reviews | herdado Nord | Prova social |

**Removidos** (eram fracos / placeholder):
- `bogo-watches` (duplicada de `watches`)
- `sport-watches` (só 4 produtos)
- `grealy-collection`, `poedagar-collection`, `poedagar-cart` (vendor names sem narrativa)
- `new-watches`, `frontpage` (vazias)
- `womens-watches` (arquivada)

---

## FAQ Padrão (English)

Definido em [`code-blocks/016_70c1dcae_assistant_json.json`](./code-blocks/016_70c1dcae_assistant_json.json) — categorias:
- **Free Shipping** — worldwide, 7–16 business days, tracking link
- (e mais — abre o JSON pra ver todas)

---

## Scripts Customizados Resgatados

Todos em [`code-blocks/`](./code-blocks/) — relevantes pra reaproveitar em outras lojas:

| Arquivo | Função |
|---|---|
| [`004` / `005`](./code-blocks/) | Importa custom collections + collects do Lucky Fours pra MontRoyal (REST + GraphQL fallback) |
| [`006`](./code-blocks/006_70c1dcae_assistant_mjs.mjs) | Importa pages, policies e menus do `extras.json` |
| [`008`](./code-blocks/008_70c1dcae_assistant_mjs.mjs) | **theme-clone-cross-shop** — clona tema MAIN entre lojas Shopify diferentes (workaround do duplicate nativo) |
| [`009`](./code-blocks/009_70c1dcae_assistant_txt.txt) | Gera `templates/index.json` adaptado da Nord pra MontRoyal |
| [`013`](./code-blocks/013_70c1dcae_assistant_mjs.mjs) | Script de helper |
| [`014`](./code-blocks/014_70c1dcae_assistant_sql.txt) | **Migration SQL** — adiciona Microsoft Clarity em `agency_clients` |
| [`018`](./code-blocks/018_70c1dcae_assistant_txt.txt) | **curate-variants** — matriz de 8 combinações vencedoras (preto+verde, prata+azul, etc.) |
| [`019`](./code-blocks/019_70c1dcae_assistant_html.html) | **HTML mockup** "Mont Royal — Escolha o verde" — apresentação das 4 opções de verde |
| [`020`](./code-blocks/020_70c1dcae_assistant_mjs.mjs) | **build-index.mjs final** — gera homepage masculina sem placeholders, com Capítulo Gold |
| [`023`](./code-blocks/023_70c1dcae_assistant_md.md) | **Plano completo** "Verde British Racing + Homepage masculina" — leia primeiro |

---

## Verificação Manual (passos pós-deploy)

1. Abrir preview: `https://shop-mont-royal.myshopify.com/?preview_theme_id=154272530620`
2. Hard reload (Cmd+Shift+R) pra furar cache
3. Conferir:
   - [ ] Botões "Add to cart" e links em **verde British Racing**
   - [ ] Hero (3 slides) ainda aparece
   - [ ] Section "BUILT FOR THE CLIMB" com 3 cards
   - [ ] 5 sessões de coleção populadas com produtos reais
   - [ ] Section "THE GOLD CHAPTER" com 4 relógios curados
   - [ ] Sem cards vazios / sem placeholders "product $49.99"
   - [ ] Footer e header em tom verde

---

## Como Reaproveitar em Outro Projeto

1. **Pra clonar o conceito visual numa loja parecida:**
   - Pegar `#004225` + `#f5f7f3` como paleta
   - Replicar a sequência de homepage do plano (seção 023)
   - Adaptar copy "BUILT FOR THE CLIMB" pra persona do novo cliente

2. **Pra reusar os scripts:**
   - `theme-clone-cross-shop.mjs` (008) — clonar tema entre Shopifys
   - `build-index.mjs` (020) — gerar `templates/index.json` programaticamente
   - `curate-variants` (018) — matriz de variantes vencedoras

3. **Pra retomar a sessão Monte Royal numa nova janela:**
   - Cole o link deste README na conversa
   - Ou cole o conteúdo do [`CONTEXTO_COMPLETO.md`](./CONTEXTO_COMPLETO.md) inteiro (284 KB cabe num prompt)
