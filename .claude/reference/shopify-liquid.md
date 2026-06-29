# Shopify Liquid — Cheatsheet para o tema Lever

Referência rápida dos filters/tags/objects mais úteis pro tema Lever-br e Lever-en.
Consulta completa: [`shopify-docs/pages/api/liquid/`](../../shopify-docs/pages/api/liquid/) ou `node .claude/lib/shopify-docs.mjs "<termo>"`.

API version atual do projeto: **2026-04** (`.claude/lib/shopify-api.mjs`).

---

## Filters de imagem (⭐ modernos)

### `image_tag` — geração automática de `<img>` com srcset responsivo

Preferido sobre `img_tag` legacy. Gera `<img srcset>` com todas as resoluções automaticamente — ~40KB/página de economia em telas retina.

```liquid
{{ image | image_tag:
    loading: 'lazy',
    widths: '350, 750, 1100, 1500',
    sizes: '(min-width: 990px) 33vw, 100vw',
    alt: product.title
}}
```

Alternativas úteis:
- `image_url: width: 800` — retorna só a URL (pra `style="background-image: url(...)"`)
- `image_tag: widths: '...'` — srcset automático
- `image_tag: preload: true` — adiciona `rel=preload` pro above-the-fold

### Legacy (não usar em código novo)
- `{{ image | img_url: '800x' }}` — 2 gerações atrás, sem srcset
- `{{ image | img_tag }}` — gera `<img>` mas sem srcset responsivo

---

## Filters de dinheiro

```liquid
{{ product.price | money }}                       → R$ 239,00
{{ product.price | money_with_currency }}         → R$ 239,00 BRL
{{ product.price | money_without_currency }}      → 239,00
{{ product.price | money_without_trailing_zeros }}→ R$ 239
```

---

## Filters de string úteis

| Filter | Uso | Output |
|---|---|---|
| `escape` | HTML escape | `<` → `&lt;` |
| `handleize` | converte pra handle URL-safe | `"Camisa Flamengo"` → `camisa-flamengo` |
| `truncate: N` | corta em N caracteres | `"abcdefgh" \| truncate: 5` → `ab...` |
| `truncatewords: N` | corta em N palavras | |
| `strip_html` | remove tags HTML | |
| `md5` / `sha256` | hash | |
| `t:` | tradução via locales/ | `{{ 'cart.subtotal' \| t }}` |

---

## Metaobjects (⭐ moderno)

Metaobjects permitem estruturas custom reusáveis (ex: FAQ, authors, testimonials, spec tables).

Acesso em Liquid:
```liquid
{% assign faqs = shop.metaobjects.faq.values %}
{% for faq in faqs %}
  <h3>{{ faq.question }}</h3>
  <p>{{ faq.answer }}</p>
{% endfor %}
```

Binding num `section.setting`:
```json
{
  "type": "metaobject",
  "id": "faq_item",
  "metaobject_type": "faq",
  "label": "FAQ item"
}
```

Depois no Liquid da section:
```liquid
{% assign faq = section.settings.faq_item %}
<h3>{{ faq.question }}</h3>
```

---

## App Blocks (integração sem fork)

Sections que permitem apps (Yampi, CartPanda, etc) injetarem blocos sem modificar o tema:

```json
{
  "name": "Product page",
  "blocks": [
    { "type": "@app" }
  ]
}
```

Quando um app instala, ele aparece automaticamente como opção no customizer. Recomendado pra qualquer section de product/cart/checkout.

---

## Section Groups

Agrupam sections reusáveis em header/footer/aside:

```json
{
  "type": "header",
  "name": "t:sections.header.name",
  "sections": {
    "announcement": { "type": "announcement-bar" },
    "header": { "type": "header" }
  },
  "order": ["announcement", "header"]
}
```

---

## Objetos de context úteis

| Objeto | Escopo | Exemplos |
|---|---|---|
| `shop` | global | `shop.name`, `shop.email`, `shop.metaobjects.*`, `shop.currency` |
| `product` | product template | `product.title`, `product.variants`, `product.selected_variant`, `product.images` |
| `collection` | collection template | `collection.products`, `collection.title` |
| `cart` | global | `cart.items`, `cart.total_price`, `cart.item_count` |
| `customer` | se logado | `customer.email`, `customer.first_name` |
| `section` | dentro de section | `section.settings.*`, `section.blocks` |
| `template` | qualquer | `template.name` (`product`, `index`, `cart`) |

---

## Performance tips

### Preload do primeiro hero
```liquid
{%- if request.page_type == 'index' and section.index == 0 -%}
  {{- hero | image_url: width: 1500 | preload_tag: as: 'image' -}}
{%- endif -%}
```

### Lazy loading (default, mas explicit)
```liquid
{{ image | image_tag: loading: 'lazy' }}
```

### Prefetch
```liquid
<link rel="dns-prefetch" href="//cdn.shopify.com">
```

---

## `theme check` (configurable em `.theme-check.yml`)

Regras do Lever:
- `fail-level: error` (warnings não bloqueiam)
- Rode: `node .claude/skills/lever-theme/theme-check.mjs br`
- Auto-fix: `node .claude/skills/lever-theme/theme-check.mjs br --fix`

Checks principais:
- `ImgLazyLoading` — deve ter `loading="lazy"`
- `LiquidTag` — usa `{%- -%}` em vez de `{% %}` pra trim whitespace
- `ParserBlockingScript` — `<script defer>` não-bloqueante
- `UnusedAssign` — variáveis declaradas e não usadas

---

## ⚠️ checkout.liquid DEPRECATED (2025-26)

Shopify descontinua `checkout.liquid` em **agosto de 2026**. Lojas que usam Yampi/CartPanda com `layout/checkout.liquid` custom precisam migrar pra **Checkout UI Extensions**.

- Detecção: `themes/.../layout/checkout.liquid` existe → é legado.
- Migration path: [shopify-docs/pages/api/checkout-ui-extensions/](../../shopify-docs/pages/api/checkout-ui-extensions/)
- Lever: este é um projeto próprio (Fase 7+). Por ora, `quality-gate` apenas alerta.

---

## Consultar a doc

```bash
# Busca filter Liquid
node .claude/lib/shopify-docs.mjs "image_tag filter"

# Busca tag Liquid
node .claude/lib/shopify-docs.mjs "section_groups"

# Busca objeto Liquid
node .claude/lib/shopify-docs.mjs "product object"
```
