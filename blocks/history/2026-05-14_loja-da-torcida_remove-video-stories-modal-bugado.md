# Bloco: Remoção do VideoStoriesModal hardcoded (bug X+volume na PDP)

## Operação
- **Data:** 2026-05-14
- **Loja:** Loja da Torcida (`xdppna-zt.myshopify.com`)
- **Tema:** `Tema Lever Rolagem` (id `128963772488`, **publicado**)
- **Arquivo tocado:** `sections/main-product.liquid` (-1264 chars)
- **Modo:** CÓPIA (fix recorrente, conhecido em outras lojas)
- **Status:** Aplicado ✅

## Contexto

Cliente da Loja da Torcida reclamou de bug visual recorrente na PDP: **botão X (fechar) + botão volume (mute/unmute) aparecem soltos na tela**, no canto superior esquerdo. Pedro confirmou — "isso é o vídeo flutuante que ele quebrou dentro da página do produto", e já foi resolvido várias vezes em outras lojas (Goal Nations, Template, etc).

## Diagnóstico

Investigação descartou várias causas antes de achar a real:

| Causa investigada | Resultado |
|---|---|
| `sections/floating-video.liquid` (section órfã com bug de precedência liquid linha 4) | ❌ Não é invocada em template nenhum. Não causa o bug. |
| Block `stories_row_ipmRRC` no template product.json | ❌ Já estava `disabled: true` |
| Section `video_stories_E4DLye` no template product.json | ❌ Já estava `disabled: true` |
| App externo (Tolstoy/Videowise/etc) | ❌ Texto "Explore este produto" não existe em 421 arquivos do tema. Mas Pedro confirmou que **NÃO é app** |
| **Modal `#VideoStoriesModal` HARDCODED em `main-product.liquid` linhas 1128-1151** | ✅ **ESSA é a causa** |

## Causa raiz

O `main-product.liquid` tem o modal global `#VideoStoriesModal` **renderizado SEMPRE**, fora do `{% case block.type %}` que controla os blocks de stories. Ele tem:
- `<button class="video-stories-modal__close">` (botão X)
- `<button class="video-stories-modal__mute">` (botão volume)
- Backdrop e container vazio

Default fica escondido via CSS (`aria-hidden="true"`). Mas quando o CSS quebra ou algum JS abre o modal sem fechar, **aparecem só os controles** — exatamente o X+volume reclamado.

Esse modal só faz sentido se `stories_row` ou `video_stories_*` estiverem habilitados. Como AMBOS estão disabled na Loja da Torcida, o modal era **dead code que gerava bug**.

## Fix aplicado

Removidas as linhas 1128-1151 do `sections/main-product.liquid`:

```liquid
{%- comment -%} Stories Modal (Global for this section) - Moved outside product-info logic to prevent clipping/transform issues {%- endcomment -%}
<div id="VideoStoriesModal" class="video-stories-modal" aria-hidden="true">
    <button type="button" class="video-stories-modal__close" aria-label="Close">
      <svg ...></svg>
    </button>
    <button type="button" class="video-stories-modal__mute" aria-label="Mute/Unmute">
      ...
    </button>
  <div class="video-stories-modal__content">
    <div class="video-stories-modal__video-container"></div>
  </div>
  <div class="video-stories-modal__backdrop"></div>
</div>
```

Substituídas por comentário de rastreio:
```liquid
{%- comment -%} VideoStoriesModal removido 2026-05-14 — modal hardcoded gerava widget bugado X+volume mesmo com stories_row e video_stories disabled. Cliente Loja da Torcida reclamou. Ver memory feedback_no_floating_video. {%- endcomment -%}
```

## Backup

`blocks/backups/2026-05-14_loja-da-torcida_sections__main-product.liquid.bak`

Pra reverter: `restoreAsset(shop, 128963772488, 'sections/main-product.liquid', 'loja-da-torcida')` via lib `code-blocks-backup.mjs`.

## Verificação pós-PUT

| Check | Resultado |
|---|---|
| Tamanho final | 130.045 chars (era 131.309) ✅ |
| `<div id="VideoStoriesModal">` | ✅ removido |
| `class="video-stories-modal__mute"` | ✅ removido |
| `class="video-stories-modal__close"` | ✅ removido |
| Comentário rastreio | ✅ presente |

## Pitfall encontrado (vou lembrar)

**Falso positivo de validação:** ao validar `.PATCHED` com regex `/VideoStoriesModal/`, o teste pegou meu próprio comentário substituto ("VideoStoriesModal removido 2026-05-14") e disparou erro "ainda no .PATCHED". Lição: validar com pattern específico do HTML que tá removendo (`<div id="VideoStoriesModal"`), não só palavra-chave.

## Pra reativar features de vídeo no futuro

Se reativar `stories_row` (block) OU `video_stories_*` (section) no template product.json, **precisa colocar o modal de volta** no main-product.liquid pra os vídeos abrirem em fullscreen. Restaurar do backup `.bak`.

## Lições / candidato a propagar

**Sim — candidato a propagação em outras lojas Lever** com mesmo bug. Mesmo padrão pode existir em:
- Mantos do PH (se tiver stories_row/video_stories disabled mas modal hardcoded)
- Goal Nations, Coringão, etc.

Verificar com `validateLeverPitfalls()` se aplicável.

---

## Adendo 2026-05-14 (2) — Logos de pagamento + bloquinho coeso/cores nas bandeiras

Mesma sessão, demanda original do briefing. **Modo INSPIRAÇÃO** (referência Mantos PH, adaptado pra Loja da Torcida).

### Item 2: Logos de pagamento abaixo do CTA

Adicionado inline depois do `{%- when 'buy_buttons' -%}` no `sections/main-product.liquid`:

```liquid
<ul class="list list-payment" role="list" style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center; padding: 12px 0 4px; margin: 0; list-style: none;">
  {%- for type in shop.enabled_payment_types -%}
    <li class="list-payment__item" style="display: inline-flex;">
      {{ type | payment_type_svg_tag: class: 'payment-icon' }}
    </li>
  {%- endfor -%}
</ul>
```

**Por que `shop.enabled_payment_types`:** filter nativo Shopify, renderiza automaticamente os métodos habilitados em Settings → Payments. Não hardcoda imagens externas (Mantos usa CDN R2 da Lever mas dependência externa). CSS `assets/component-list-payment.css` já estava no tema, só faltava o HTML.

### Item 3: Bloquinho coeso + cores intercaladas + título negrito

**Liquid:** contador `benefit_idx` adicionado dentro do `{%- when 'benefit' -%}`:
```liquid
{%- assign benefit_idx = benefit_idx | default: 0 | plus: 1 -%}
<div class="guarantees-accordion-wrapper guarantees-color-{{ benefit_idx }}" {{ block.shopify_attributes }}>
```

**Style block** inserido antes do `{% schema %}`:
- `.guarantees-accordion-wrapper` agrupados visualmente: `border-radius` só nos cantos (first/last-of-type), `border-bottom: 0` no meio → vira bloco único conectado
- `.guarantee-title` em `font-weight: 700` (era peso normal)
- `.guarantee-subtitle` em cinza `#6b7280` pra hierarquia
- Container do ícone: 36x36px, border-radius 8px, background colorido suave
- 4 cores intercaladas (Loja da Torcida BR):
  - **1 (Garantia):** verde `#16a34a` em bg `#dcfce7`
  - **2 (Entrega):** azul `#2563eb` em bg `#dbeafe`
  - **3 (Troca):** laranja `#ea580c` em bg `#ffedd5`
  - **4 (Suporte):** rosa `#db2777` em bg `#fce7f3`

### Backup adicional

`blocks/backups/2026-05-14_loja-da-torcida_sections__main-product.liquid.fixes-2-3.bak`

### Verificação pós-PUT

| Check | Resultado |
|---|---|
| Tamanho final | 132.843 chars (era 130.045) ✅ |
| `<ul class="list list-payment">` | ✅ presente |
| `shop.enabled_payment_types` | ✅ presente |
| `assign benefit_idx` | ✅ presente |
| Classes `guarantees-color-N` | ✅ presente |
| `<style>` bloquinho | ✅ presente |

### Pitfall recorrente confirmado: falha silenciosa de cache do PUT

PUT retorna 200 mas re-fetch imediato traz versão antiga. Re-fetch após alguns segundos traz versão nova. **Não é PUT que falhou — é cache do Admin API.** Solução: validar verify com pequeno delay, OU retry verify ao invés de retry PUT.

### Lições

- **Modo INSPIRAÇÃO funcionou bem aqui:** Mantos serviu de referência conceitual (estrutura visual com bloquinho + logos + ícones coloridos), mas execução foi própria da Lever da Torcida — usou `shop.enabled_payment_types` nativo (não cópia da Mantos), cores brasileiras + variadas (não as da Mantos), bloquinho construído do zero com CSS.
- **Padrão candidato a propagação:** o `<style>` block + contador `benefit_idx` é reutilizável. Próxima loja com mesmas 4 bandeiras pode receber esse fix em 5min.
