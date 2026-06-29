# BK Reviews Stars Desktop — Auto-inject via `small--hide`

**Data:** 2026-04-14
**Origem:** Retro Football Shop (validado em produção)
**Templates afetados:** Lever-BR + Lever-EN (mesmo fix nos dois)
**Categoria:** Reviews / Avaliações
**Skill relacionada:** [code-blocks](../../.claude/skills/code-blocks/SKILL.md)

---

## Problema

Stars de avaliação só apareciam no **mobile** da página de produto. No **desktop** sumiam.

A loja Mantos do PH (referência) tinha o app block `bk-reviews-star-section` adicionado via customizer no template product.json — mas tentar replicar isso via API direta no `templates/product.json` era silenciosamente ignorado pela Shopify.

Sync de metafield nativo (`product.metafields.reviews.rating.value`) também não estava disponível pra Retro.

---

## Investigação chave

Inspecionei a JS do BK Reviews (`bk-index-*.js` no extension CDN) e descobri o algoritmo de hydratação:

```javascript
// 1. Procura div com ID conhecido — se achar, hidrata e PARA
let R = document.getElementById('bk-star-section')
     ?? document.getElementById('auto-bk-star-section');
if (R) { hydrate(R); return; }

// 2. Caso contrário, encontra o primeiro <h1> da página
let Q = document.querySelector('[data-store*="product-name-"]');
if (!Q) {
  const H = document.querySelector('main') ?? document.querySelector('#main');
  Q = H?.querySelector('h1') ?? document.querySelector('h1');
}
const targets = [Q];

// 3. ITERA também elementos com `.small--hide h1` ou `.small--hide h2`
for (const M of document.querySelectorAll('.small--hide h1, .small--hide h2')) {
  targets.push(M);
}

// Para cada target, injeta <div id="auto-bk-star-section" class="bk-reviews"> após o h1
targets.forEach(s => {
  const div = document.createElement('div');
  div.classList.add('bk-reviews', themeName);
  div.id = 'auto-bk-star-section';
  s.parentElement.insertBefore(div, s.nextSibling);
  hydrate(div);
});
```

**Por que mobile funcionava e desktop não:**
- O tema Lever tem 2 `<h1>` na página: um no mobile (dentro de `.product-mobile-header`) e um no desktop (dentro de `.product__title.mobile-hidden-original`)
- A JS encontra o **primeiro h1** (mobile) e injeta — mobile renderiza
- A iteração `.small--hide h1, .small--hide h2` NÃO casa o h1 desktop porque o tema usa `.mobile-hidden-original` (custom) em vez de `.small--hide` (Shopify Dawn standard)

---

## Solução

Adicionar a classe `small--hide` no wrapper do h1 desktop, dentro do `{%- when 'title' -%}` do desktop loop:

```liquid
{%- when 'title' -%}
  <div class="product__title mobile-hidden-original small--hide" {{ block.shopify_attributes }}>
    <h1>{{ product.title | escape }}</h1>
    <a href="{{ product.url }}" class="product__title">
      <h2 class="h1">{{ product.title | escape }}</h2>
    </a>
  </div>
```

Apenas isso. **Não precisa de div estático**, **não precisa de app block**, **não precisa de metafield nativo**.

---

## Por que funciona

1. JS do BK encontra o 1º h1 (mobile) → injeta após → **mobile mostra stars**
2. JS itera `.small--hide h1` → encontra o h1 desktop (agora com `small--hide`) → injeta após → **desktop mostra stars**
3. CSS do tema (`.mobile-hidden-original` em media queries) já garante visibilidade correta por viewport

---

## Anti-patterns (NÃO fazer)

- ❌ Adicionar `<div id="bk-star-section">` estático em qualquer lugar — **bloqueia o auto-inject** (passo 1 do algoritmo retorna early)
- ❌ Adicionar `bk-reviews-star-section` block no `templates/product.json` via API direta — Shopify silenciosamente ignora
- ❌ Depender de `{% if product.metafields.reviews.rating.value != blank %}` — nem todos os clientes sincronizam
- ❌ Renderizar duas vezes o mesmo `id="bk-star-section"` — `getElementById` retorna só o primeiro

---

## Riscos / Limites

- **Requer BK Reviews instalado e ativo** (block `bk-reviews-embed` no footer-group)
- **Não compatível com Judge.me, Loox, Yotpo** — selectors diferentes
- **Posição é fixa "logo após o h1"** — se quiser controle preciso, precisa do app block via customizer

---

## Validação

| Check | Como |
|---|---|
| Stars no desktop | Aba anônima → produto → estrelas visíveis abaixo do título |
| Stars no mobile | Mesma URL em DevTools mobile → estrelas abaixo do título mobile |
| HTML rendered | `<div id="auto-bk-star-section" class="bk-reviews">` aparece após cada h1 do produto |
| Sem regressão | Card da homepage continua mostrando stars |

---

## Onde aplicar

- ✅ [themes/lever-br/sections/main-product.liquid](../../themes/lever-br/sections/main-product.liquid#L191) — `<div class="product__title mobile-hidden-original small--hide">`
- ✅ [themes/lever-en/sections/main-product.liquid](../../themes/lever-en/sections/main-product.liquid#L333) — idem
- ✅ [themes/client-8bf15616/sections/main-product.liquid](../../themes/client-8bf15616/sections/main-product.liquid) — Retro Football (já aplicado)

**Lojas deployadas antes de 2026-04-14**: precisam receber o patch retroativamente. Pull do tema → editar local → `theme-draft-sync` → preview → publish.

---

## Referência KB

[KNOWLEDGE_BASE.md § 26](../../themes/KNOWLEDGE_BASE.md) — "Reviews / Avaliações (BK Reviews App)"
