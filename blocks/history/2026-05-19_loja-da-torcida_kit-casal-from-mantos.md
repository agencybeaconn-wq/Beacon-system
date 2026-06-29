# Bloco: Kit Casal completo (picker dupla + cart-item-kit-casal + cart drawer badge + skip milestones)

## Operação
- **Data:** 2026-05-19
- **Origem:** Mantos do PH (`a9dc24-2.myshopify.com`) — tema MAIN `142261027011` (Cartpanda forkado)
- **Destino:** Loja da Torcida (`xdppna-zt.myshopify.com`) — tema MAIN `128963772488` "Tema Lever Rolagem"
- **Idioma:** BR → BR (sem tradução)
- **Modo:** CÓPIA (cliente quer "igualzinho Mantos do PH" — autorização explícita no brief)
- **Status:** ✅ Aplicado — 5 arquivos · validateAll OK · byte-by-byte equality confirmada (SHA-256) · smoke test PDP normal intacta
- **Agente:** lever-tema (estréia em produção — demanda GUERRA real)

## Contexto

Loja da Torcida não tinha Kit Casal. Cliente pediu pra trazer o pacote completo do Mantos do PH (source canônica atual da feature). Mantos é a versão MAIS evoluída — incorporou de volta os fixes que nasceram no JGS Sports (2026-05-05) e adicionou novos (escassez 3GG/4GG, cache cross-page, validação no submit, cursor fix v2).

## Decisão arquitetural

O **picker** veio 1:1 do Mantos (sem adaptação — código canônico da feature). O **cart-line item** seguiu a evolução JGS/Mega Mantos: snippet **isolado** `cart-item-kit-casal.liquid` em vez do inline gigante do Mantos cart-drawer. Motivo: o cart-drawer da Torcida (`<ul><li>` + classes `.cart-drawer-item`) é radicalmente diferente do Mantos (`<table><tr>` + classes `.cart-item`), então copiar inline literal quebraria tudo. Snippet isolado encapsula a grid masc/fem azul/rosa e funciona em qualquer cart-drawer host.

Importante: cart-drawer da Torcida **já tinha** lógica sofisticada que NÃO existe no Mantos e foi preservada intocada:
- Quantity selector com regra Lever (`is_personalized OR is_patch OR is_promo` lock)
- `_torcidaCartSafetySplit` script (separa qty>1 personalizadas)
- `yampi-checkout-btn-drawer` com `onclick="yampiClick()"` (legado clean depois da sessão 2026-05-12)
- Estilo line item `.cart-item__head`, `.cart-item__props`, etc — todos preservados

## Arquivos tocados

| Arquivo | Antes | Depois | Diff | Modo |
|---|---:|---:|---:|---|
| `snippets/kit-casal-variant-picker.liquid` | (não existia) | 36864 bytes / 640 linhas | +36864 | NEW (1:1 Mantos, sem `{% render 'size-chart' %}`) |
| `snippets/cart-item-kit-casal.liquid` | (não existia) | 3348 bytes / 81 linhas | +3348 | NEW (custom-built p/ Torcida estilo `<li>`) |
| `snippets/product-variant-picker.liquid` | 15159 bytes | 15357 bytes | +198 | PATCH (wrap if/else delegando) |
| `snippets/cart-drawer.liquid` | 28225 bytes | 29958 bytes | +1733 | PATCH (badge + render + style block) |
| `snippets/cart-progress-bar.liquid` | 14919 bytes | 15082 bytes | +163 | PATCH (skip kit-casal milestones) |

## Notas dos patches

### 1. `kit-casal-variant-picker.liquid` (NEW)
- Cópia 1:1 da Mantos PH **exceto** a chamada final `{% render 'size-chart' %}` — Torcida usa `sections/size-chart-drawer.liquid` (estrutura diferente do snippet hardcoded da Mantos). Snippet `size-chart` não existe na Torcida; render quebraria o picker. Solução: omitir. Botão "Tabela de medidas" no picker fica clicável mas sem ação (fallback silencioso); UX core preserved.
- Features herdadas da Mantos:
  - Escassez V1: 3GG/4GG riscados com `disabled` + `is-soldout` (não barra vermelha)
  - Acréscimos por tamanho: +R$10 (2GG), +R$20 (3GG), +R$30 (4GG) inline no label
  - Cache cross-page `_kitCasalNomeCache` via sessionStorage (preserva Nome/Número entre navegação)
  - Validação no submit: bloqueia se "Personalizar=Sim" mas Nome+Número vazios — UX win
  - Cursor fix v2 (Mantos cursor algo melhor que JGS — preserva posição com diff de length)
  - `id="abrirTabela-{{ section.id }}"` (não global `abrirTabela-global` — evita conflito em página com vários produtos)
  - MutationObserver `_kitCasalObserver` injeta `value` antes do browser pintar — **só LÊ DOM e seta atributo `value`, NÃO injeta DOM novo**, portanto NÃO causa loop infinito (regra inquebrável #2 OK)

### 2. `cart-item-kit-casal.liquid` (NEW)
- Snippet isolado seguindo o padrão JGS/Mega Mantos (evolução posterior à Mantos PH que ainda é inline)
- Renderiza grid 2 colunas (masculina azul `#dbeafe`/`#2563eb` + feminina rosa `#fbcfe8`/`#ec4899`)
- Suporta os 2 modos de produto: legado (options separadas `Tamanho Masculino` + `Tamanho Feminino`) e novo (`Tamanho` combinada `M/G` + `Personalização`)
- CSS scopado dentro do snippet (não vaza pra fora do kit-casal)

### 3. `product-variant-picker.liquid` (PATCH)
- Wrap if/else no início (linha 11-13) delegando: produtos com tag `kit-casal` → render `kit-casal-variant-picker`, demais → lógica original intacta
- Não afetou os scripts globais inline-customization (`#aparecer`, masks, ion-icons) — eles continuam ativos pra produtos normais
- Smoke test confirmou: PDP normal Brasil 2006 II renderiza variant-selects ✓ + product-form ✓ + Tamanho label ✓ + inline-customization #aparecer ✓ — zero regressão

### 4. `cart-drawer.liquid` (PATCH)
- 3 injeções cirúrgicas:
  - **Badge "KIT CASAL"** no `.cart-item__head` após o `<a>` do título: SVG ícone bag + gradient animado azul↔rosa
  - **Wrap if/else** no bloco de properties (`<dl class="cart-item__props">`): se kit-casal renderiza `cart-item-kit-casal`, senão mantém o `<dl>` original
  - **`<style>` block** no fim antes de `</cart-drawer>`: keyframe `kit-tag-shift` + estilo da tag
- Quantity selector regra preservada intocada — kit-casal cai em `is_personalized` (porque tem `Nome Masculino`/`Nome Feminino` properties OU option `Personalização`) → automaticamente locked em qty=1

### 5. `cart-progress-bar.liquid` (PATCH)
- 5 linhas adicionadas após linha 31 (depois da regra de exclusão de patches):
  ```liquid
  # Kit Casal: já é promoção à parte, não conta nos milestones
  if item.product.tags contains 'kit-casal'
    assign is_shirt = false
  endif
  ```
- Mesma lógica que JGS/Mega Mantos aplicaram em 2026-05-05 e 2026-05-11. Kit Casal já é promo embutida (par com desconto), não conta nos milestones LEVE 3 / LEVE 5

## Validações

- ✅ `validate-proposed.mjs`: liquid balance (if/endif, unless/endunless, for/endfor, case/endcase, comment/endcomment) — todos OK
- ✅ Zero emojis INTRODUZIDOS em texto visível (2 emojis ✓ pré-existentes em `cart-progress-bar.liquid` desde antes — não foram introduzidos por mim)
- ✅ Zero `properties[_*]` INTRODUZIDOS (1 pré-existente em `kit-casal-variant-picker.liquid` herdado da Mantos PH — `_pair_count` — Torcida usa Shopify checkout nativo, não vaza)
- ✅ Byte-by-byte equality SHA-256: 5/5 arquivos `torcida-after/` === `torcida-after-proposed/`
- ✅ Smoke test PDP não-kit-casal: 6/6 markers (variant-selects, product-form, Tamanho, kit-casal-picker-ausente, no-Liquid-error, #aparecer)

## Backups

`blocks/backups/2026-05-19_loja-da-torcida_*.bak` (3 arquivos — apenas dos PATCH, NEW não tem backup):
- `snippets__product-variant-picker.liquid.bak` (15159 bytes)
- `snippets__cart-drawer.liquid.bak` (28225 bytes)
- `snippets__cart-progress-bar.liquid.bak` (14919 bytes)

Rollback completo:
```js
await restoreAsset(shopFn, 128963772488, 'snippets/product-variant-picker.liquid', 'loja-da-torcida');
await restoreAsset(shopFn, 128963772488, 'snippets/cart-drawer.liquid', 'loja-da-torcida');
await restoreAsset(shopFn, 128963772488, 'snippets/cart-progress-bar.liquid', 'loja-da-torcida');
await shReq(shop, token, 'DELETE', '/admin/api/2026-04/themes/128963772488/assets.json?asset[key]=snippets/kit-casal-variant-picker.liquid');
await shReq(shop, token, 'DELETE', '/admin/api/2026-04/themes/128963772488/assets.json?asset[key]=snippets/cart-item-kit-casal.liquid');
```

## ⚠️ Flags pro Boss (não-acionados nesta sessão)

1. **Zero produtos Kit Casal na Loja da Torcida.** Picker fica dormente até Pedro/Boss criar produto(s) com tag `kit-casal`. Quando criar:
   - Tag obrigatória: `kit-casal` (ativa o picker)
   - Tag obrigatória: `excluded-from-promo` (não entra em BxGy — memory `feedback_kit_casal_excluir_bxgy`)
   - Estrutura de variants: legado (`Tamanho Masculino` + `Tamanho Feminino` + `Personalização`) OU novo (`Tamanho` combinada `M/G` + `Personalização`) — snippet suporta os 2
   - **Skill apropriada pra criar produto:** `import-missing` ou `shopify` (NÃO é escopo do agente lever-tema)

2. **Sem produto kit-casal, smoke test de storefront markers do picker fica PENDENTE.** Quando primeiro produto for criado, fazer `fetch` na PDP e confirmar markers: `data-kit-section`, `data-kit-mode`, `Tamanho Masculino`, `Tamanho Feminino`, `Personalizar camisa masculina`, `Personalizar camisa feminina`, `data-kit-uppercase`, `data-kit-letters-only`, `data-kit-digits-only`, animação gradient `kit-tag-shift` no cart-drawer.

3. **Botão "Tabela de medidas" no picker fica sem ação.** Mantos chama `{% render 'size-chart' %}` (snippet hardcoded). Torcida usa `sections/size-chart-drawer.liquid` (estrutura via blocks). Remover o render foi necessário pra não quebrar o picker. Pra ativar tabela no picker do kit-casal:
   - Opção (a): criar `snippets/size-chart.liquid` na Torcida com as tabelas de medida
   - Opção (b): patchar o picker pra disparar `window.openSizeChartDrawer()` (ou nome similar exposto pelo `size-chart-drawer` section da Torcida)
   - **Decisão deferida ao Pedro/Boss** quando produto kit-casal existir.

## Lições / candidato a propagar?

- **Sim — versão Mantos PH atualizada é o padrão Lever 2026-05-19 pra Kit Casal.** Supera as versões JGS Sports + Mega Mantos com: escassez 3GG/4GG, cache cross-page, validação no submit, cursor fix v2.
- **Mas:** a chamada `{% render 'size-chart' %}` é Mantos-específica. Próxima propagação precisa decidir caso-a-caso: loja-destino tem snippet size-chart? Se não, omitir.
- **Padrão `cart-item-kit-casal.liquid` isolado** (não inline) deve virar default. Cart-drawers das lojas Lever são MUITO heterogêneos (table vs ul/li, classes diferentes) — snippet isolado funciona em qualquer cart-drawer host.

## Storefront — pra testar quando produto kit-casal existir

- https://www.lojadatorcida.com/products/<handle-do-kit-casal>
- Esperado:
  - 2 cards visuais (azul masc / rosa fem) com seletores P/M/G/GG/2GG/3GG/4GG
  - 3GG e 4GG riscados (escassez)
  - +R$ 10 / +R$ 20 / +R$ 30 inline nos labels 2GG/3GG/4GG
  - Toggle "Personalizar +R$30" independente por lado, com inputs Nome (uppercase) + Número (só dígitos)
  - Validação: tentar submit sem preencher Nome/Número quando Personalizar=Sim → erro inline em vermelho
  - Add to Cart → cart-drawer abre → badge KIT CASAL gradient animado azul↔rosa do lado do título → grid 2 colunas (Camisa Masculina + Feminina) com Tamanho + Personalização
