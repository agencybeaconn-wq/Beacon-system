# Diário — Agente Tema

> Cérebro persistente. Cada sessão de tema registra entrada aqui. **Antes** de mexer em feature visual, ler entradas anteriores dessa loja + dessa feature.

## Como ler
- Ordem cronológica reversa
- Filtrar por loja (Ctrl+F nome) OU por feature (#cart-drawer, #kit-casal, #patches, #milestones, #pdp, #hero, #video-stories)

## Fontes que alimentaram este cérebro (Fase 0 — 2026-05-18)
- **24 sessões de `blocks/history/`** (2026-04-08 a 2026-05-14) — densidade máxima do sistema
- 4 reports completos em `blocks/reports/`
- Skills: `lever-theme`, `code-blocks`, `inline-customization`, `template-lint`, `template-parity`, `pagespeed`
- Memories: `feedback_no_emojis_use_icons`, `feedback_mutation_observer_loop_e_test_first`, `feedback_yampi_snippet_fantasma`, `feedback_pdp_mobile_order`, `feedback_quantity_selector_rule`, `feedback_scarcity_via_sold_out_sizes`, `feedback_preco_comparativo_layout`, `feedback_kit_casal_excluir_bxgy`, `feedback_no_floating_video`, `feedback_code_blocks_inspirar_nao_copiar`, `feedback_banner_message_over_image`, `feedback_edit_only_main_theme`, `feedback_theme_color_schemes`, `feedback_team_alias_normalize`, `feedback_pedro_zoom_67`, `feedback_pensamento_sistemico_visual`, `feedback_changelog_reutilizavel_obrigatorio`, `project_lever_cart_bonus_banners`

## Mapa das 24 sessões de blocks/history

### #cart-drawer (7 sessões)
- 2026-04-10 Furia (yampi-config)
- 2026-04-11 Golaço (from TG)
- 2026-04-11 Setor (yampi-fix from Trybuteha)
- 2026-04-13 Footmania (from Golaço)
- 2026-04-13 Template BR (from JGS)
- 2026-04-14 Template EN (from TG Jersey)
- 2026-04-14 TG Jersey (EN from JGS)
- 2026-04-16 Goal Nations (from Template BR)
- 2026-04-23 MatchWear (from Mantos CartPanda)

### #kit-casal (3 sessões)
- 2026-05-05 JGS Sports (variant picker from Mantos) — **base limpa, sem cursor bug**
- 2026-05-11 Mega Mantos (block from JGS) — **2 Kit Casal Brasil 2026/27 I+II completos, 196 variants cada**
- (Coringão 2026-05-08 — video stories, não kit-casal)

### #patches (2 sessões)
- 2026-04-08 Golaço (BR)
- 2026-04-08 TG Jerseys (EN)

### #cart-progress-bar / #milestones (2)
- 2026-04-16 Mega Mantos (from Template BR)
- 2026-05-11 Futnation (cart-single-milestone-fast-shipping)

### #hero / #video / #banners (3)
- 2026-04-15 Mega Mantos (animated-waves-divider)
- 2026-04-15 Mega Mantos (collection-templates 14 times)
- 2026-04-15 Mega Mantos (hero-video + video-banner-center)
- 2026-05-08 Coringão (video-stories from FootKids)

### #benefits / #reviews / #audit (4)
- 2026-04-14 Retro (BK-reviews-stars-desktop)
- 2026-04-17 Foot Mania (benefits-grid from FootKids)
- 2026-05-11 Futnation (audit-variants-pt-na-loja-en)
- 2026-05-14 Loja da Torcida (remove video-stories modal bugado)

### #pdp / #checkout (2)
- 2026-05-12 Loja da Torcida (cart-icon-direct-checkout)

## Padrões destilados

### Padrão Lever 2026 (atual)
- **Cart drawer verde Lever** (`#22c55e → #16a34a`), não azul/rosa Mantos original
- **Snippet isolado** `cart-item-kit-casal.liquid` (não inline na cart-drawer)
- **Cursor bug "PEDRO vira ORDEP"** fixado no JGS — usar JGS como fonte, não Mantos original
- **Preço PDP:** real grande+escuro · comparativo menor+cinza+riscado **antes** (row-reverse)
- **Escassez:** variants fake PP/3GG/4GG sold-out riscadas no picker (NÃO mais barra "X em estoque")

### Pitfalls registrados
- **Falha silenciosa de cache no Shopify** — primeiro PUT retorna 200 mas re-fetch traz versão antiga. Retry imediato resolve. Confirmado JGS 2026-05-05 + Mega Mantos 2026-05-11.
- **CRLF → LF antes de PUT** (pitfall #13)
- **MutationObserver sem disconnect = loop infinito.** Loja da Torcida bugou em produção 2026-05-14.
- **YampiSnippet fantasma** em lojas clonadas: pode existir sem app → redirect /cart.
- **839 linhas vs 436** (cart-drawer Mega Mantos vs JGS) — patch cirúrgico, não full-file.

---

## Entradas

<!-- Formato:
### YYYY-MM-DD — [Cliente] — [#feature]
**Loja:** ...
**Origem:** ... (se code-blocks)
**Modo:** cópia | inspiração
**Arquivos tocados:** [lista com diff]
**Validação:** validateAll [origem/.PATCHED/.APPLIED]
**Storefront markers:** ...
**Pitfalls:** ...
**Lições:** ...
-->

### 2026-05-19 — Supremo Esportes — #cart-drawer
**Loja:** 4pchyn-qs.myshopify.com (theme main 159042109699)
**Origem:** Template BR `themes/lever-br/snippets/cart-drawer.liquid` (padrão canônico)
**Modo:** inspiração — adaptado às cores Supremo (#ff5500 laranja no hover, em vez de verde Lever)
**Arquivos tocados:**
- `snippets/cart-drawer.liquid` (421 → 551 linhas, +130)
  - CSS escopado `.cart-drawer .cart-qty-btn` + `.cart-item__quantity-wrapper` + `.cart-qty-input`
  - Liquid `assign is_customized` + `assign is_promo` (loop discount_allocations) + `assign show_qty_selector`
  - Bloco `{%- if show_qty_selector -%}` botões -/+/input SVG | `{%- else -%}` texto estático antigo
  - Hidden `input[name=updates[]]` condicionado a `{%- unless show_qty_selector -%}` (evita duplo update)
  - `<script>` event listener delegado em `.cart-drawer .cart-qty-btn` → `cart-drawer-items.updateQuantity` (web component padrão Lever)
**Validação:**
- Grep MutationObserver: 0 ocorrências ativas (só comentário)
- `name="updates[]"`: 2 instâncias mutuamente exclusivas via Liquid
- Markers Admin API: show_qty_selector, cart-qty-btn--minus, cart-qty-btn--plus, is_customized — TODOS PRESENTES
- PDP renderiza JS + CSS embutidos (snippet ativo no header)
**Regra exclusão final:**
```liquid
assign show_qty_selector = true
if is_customized or is_promo or is_patch or item.final_price == 0
  assign show_qty_selector = false
endif
```
- `is_customized`: properties Nome/Número/Numero/Patches/_pairing_id
- `is_promo`: loop discount_allocations checa título (leve/bxgy/compre/pague) OU target_selection=entitled
- `is_patch`: já existia (properties['Posição'] OR title contém 'Patch')
- `item.final_price == 0`: brinde
**Storefront markers:** confirmados via PDP render (JS + CSS embedded). Verificação via /cart/add.js bloqueada por WAF (403) — Pedro precisa abrir browser e validar visualmente.
**Pitfalls evitados:**
- ZERO MutationObserver (memory `feedback_mutation_observer_loop_e_test_first`)
- CSS escopado `.cart-drawer .cart-qty-btn` (não global)
- Padrão Lever 1:1: usa `cart-drawer-items.updateQuantity` (já existe em `assets/cart.js`)
- Brand Supremo: laranja `#ff5500` no hover (não verde Lever default)
**Próximo passo Pedro:**
1. Abrir https://www.supremosports.com.br
2. Adicionar camisa SEM personalização → cart-drawer deve mostrar botões `- [1] +`
3. Adicionar camisa COM personalização → cart-drawer deve mostrar texto estático "Quantidade: 1"
4. Adicionar com cupom BxGy ativo → item de promo deve mostrar texto estático
**Backup:** `blocks/backups/supremo-2026-05-19-cart-drawer-qty/cart-drawer-AFTER.liquid`

---

## 2026-05-19 — Supremo Esportes #cart-drawer #milestones #emojis

**Pedido:** Pedro mandou print do cart drawer ainda ridículo após qty-selector. 5 itens pra arrumar: emoji 🎉 na mensagem de parabéns, label "p/ FRETE GRÁTIS" continuando após meta batida, "Personalizar: Não" poluindo linha do produto, milestone batido sem feedback visual, tamanho "P" formatação.

**Loja:** Supremo Esportes (`4pchyn-qs.myshopify.com`, theme main 159042109699)

**Arquivos tocados (PUT na API Admin):**
- `snippets/cart-progress-bar.liquid` (+39 linhas): strip emoji via cadeia `| replace` (15 emojis cobertos) + badge dinâmico "FRETE GRÁTIS" em verde `#15803d` com check SVG inline quando `m1_reached`
- `snippets/cart-drawer.liquid` (+20 linhas): novo bloco `property_skip` no loop de properties — esconde key `Personalizar`/`Personalização` e valores `Não/Nao/No/false/-/blank`
- `config/settings_data.json` (4 changes): strip emoji 🎁🤩🎉🏆 dos `settings.message_0/1/2/6_plus` direto na raiz (defesa em profundidade — Liquid replace + setting limpa)

**Lógica:**
- `cart-progress-bar.liquid` linha 84-114: bloco `liquid` único monta `_msg` por `shirt_count`, depois cadeia `| replace` em 15 code points emoji comuns; output `{{ _msg }}`.
- `cart-progress-bar.liquid` linha 191-201: `{%- if m1_reached -%}` renderiza `<span class="milestone__badge milestone__badge--reached" style="color:#15803d">` com SVG check 12px + texto "FRETE GRÁTIS"; `else` mantém badge original (`+1 p/ Frete Grátis`).
- `cart-drawer.liquid` linha 353-385: substituído `if property.last != blank and property_first_char != '_'` por bloco `assign property_skip` que normaliza key+value via downcase+strip e marca skip se: blank, prefix `_`, key in {personalizar,personalização,personalizacao}, value in {não,nao,no,false,-}.

**Validação:**
- Liquid balance: 13/13 if/endif, 2/2 for/endfor, 3/3 unless/endunless, 1/1 case/endcase, 3/3 comment/endcomment (progress-bar); 21/21, 5/5, 3/3 (drawer)
- Grep emoji em texto visível: ZERO (só em args de `replace` filter)
- Storefront fetch homepage pós-push: emoji 🎁 da `message_0` SUMIU; renderiza "Adicione 2 camisas para ganhar Frete Grátis! " limpo
- Live source pushed contém: `milestone__badge--reached`, `FRETE GRÁTIS`, `#15803d`, `property_skip`, `personalizar`, `'não'`

**Pitfalls evitados:**
- ZERO MutationObserver / ZERO CSS global (memory `feedback_mutation_observer_loop_e_test_first`)
- ZERO emoji em texto visível agora (memory `feedback_no_emojis_use_icons`)
- ZERO mexida em `cart-item--quantity-selector` (qty-selector recém-subido — Pedro pediu pra não tocar)
- ZERO mexida fora do escopo (cart-drawer.liquid + cart-progress-bar.liquid + settings_data.json messages_X only)
- Defesa em profundidade: setting limpa + Liquid replace — emoji futuro colado pelo lojista não aparece

**Por que mexer em settings_data.json (não overlap com qa):**
Pedro disse "qa só LÊ settings_data". Mas o emoji estava NA setting, não no Liquid. Cleanup é parte do escopo "arrumar emoji". qa é read-only audit; eu sou write-tema. Sem conflito destrutivo.

**Próximo passo Pedro:**
- Abrir cart com 2+ camisas (meta batida): badge milestone deve mostrar verde "✓ FRETE GRÁTIS" no lugar de "p/ FRETE GRÁTIS"
- Cart vazio: msg "Adicione 2 camisas para ganhar Frete Grátis!" sem emoji
- Item personalizado: aparece "Nome: X" e "Número: 10" mas NÃO "Personalizar: Sim/Não"
- Item NÃO personalizado: zero linha "Personalizar:"

**Backup:** `c:\tmp\supremo-cart-drawer\.live-snippets__cart-drawer.liquid`, `.live-snippets__cart-progress-bar.liquid`, `.backup-settings_data.json` (pré-strip de emoji)

---

## 2026-05-19 — Loja da Torcida #kit-casal #size-chart #video-ugc #pdp

**Loja:** `xdppna-zt.myshopify.com` (UUID `3a9a7bf6-e392-427c-ae73-0d2823dbe53f`, theme MAIN `128963772488`)

**Pedido (terceira guerra do dia):** 3 follow-ups após cart-drawer + variant-picker + kit-casal-picker já entregues hoje:
1. Wirar 4 botões "Tabela de medidas" do `kit-casal-variant-picker.liquid` (2 masc id dinâmico `abrirTabela-{{ section.id }}`, 2 fem class `js-kit-open-size-chart-fem`) pra disparar `sections/size-chart-drawer.liquid` global
2. Conferir conteúdo do drawer da Torcida vs Template BR canônico
3. Adicionar section UGC slot vazio na PDP, sem URL hardcoded

**Diagnóstico tarefa 1:**
- `sections/size-chart-drawer.liquid` da Torcida = IDÊNTICO ao Template BR (`diff` retorna zero)
- Mas o JS do drawer escutava SÓ `e.target.closest('#abrirTabela-global')` — não pegava os ID dinâmicos do kit-casal
- Kit-casal já tem fallback `window.openSizePanel()` pros botões fem, mas masc dependiam de match exato

**Diagnóstico tarefa 2:** `templates/product.json` da Torcida tem `sections.size-chart` com 5 blocks (`tab_1..tab_5`) já populados com conteúdo IDÊNTICO ao `themes/lever-br/templates/product.json` (Masc P-4GG, Fem P-2GG, Jogador, Infantil, Retrô) — zero ação necessária no conteúdo

**Diagnóstico tarefa 3:** Section `video_stories_E4DLye` já existe na PDP (`order: [..., "video_stories_E4DLye", ...]`) mas estava `"disabled": true` desde a sessão `2026-05-14 remove video-stories modal bugado`. Tinha 8 blocks com URL hardcoded YouTube `_9VUPq3SxOc` + título com encoding bug `"Qualidade e Confian��a"`

**Arquivos tocados:**
- `sections/size-chart-drawer.liquid` (17580 → 17277 bytes, -303): seletor delegado linha 390 estendido de `'#abrirTabela-global'` pra `'#abrirTabela-global, [id^="abrirTabela-"], .js-kit-open-size-chart-fem, .js-open-size-chart'` + comentários doc
- `templates/product.json` (46367 → 29125 bytes Shopify-normalized, 44283 local): section `video_stories_E4DLye` → `name: "Vídeos UGC"`, `settings.title: "Quem comprou, aprovou"`, `description: "<p>Veja depoimentos reais de quem já vestiu.</p>"`, `blocks: {}`, `block_order: []`, `disabled: true` MANTIDO (Pedro habilita quando configurar o 1º vídeo no editor)

**Validação push:**
- PUT 1 `size-chart-drawer.liquid`: 200, markers OK no primeiro re-fetch (sem cache stale)
- PUT 2 `product.json`: 200, markers OK no primeiro re-fetch
- CRLF→LF aplicado pré-PUT (pitfall #13)

**Storefront markers PDP normal** (`/products/camisa-selecao-brasileira-ii-2006-nike-retro-azul`):
- `sizePanelOverlay-global` PRESENTE
- `abrirTabela-global` PRESENTE
- `Tabela de medidas` PRESENTE
- `_9VUPq3SxOc` AUSENTE (URL hardcoded saiu)
- `Vídeos UGC` AUSENTE (disabled, OK)
- `main-product`, `related-products` PRESENTES (zero regressão)

**Storefront markers PDP Kit Casal** (`/products/kit-casal-2-camisas-brasil-home-26-27-torcedor`):
- `kit-casal-variant-picker` snippet renderiza
- Botões `id="abrirTabela-<sectionId>"` (masc) e `class="js-kit-open-size-chart-fem"` (fem) AMBOS PRESENTES
- Seletor estendido `[id^="abrirTabela-"]` confirmado no HTML embutido do drawer
- `_9VUPq3SxOc` AUSENTE, `Vídeos UGC` AUSENTE
- Drawer global compartilhado → todos 4 botões disparam mesmo overlay (1 trigger, 1 listener delegado, zero MutationObserver)

**Pitfalls evitados:**
- ZERO MutationObserver (regra inquebrável #2, memory `feedback_mutation_observer_loop_e_test_first` — esta loja BUGOU EM PRODUÇÃO em 2026-05-14 com isso)
- ZERO URL hardcoded (regra 3.1 do brief)
- ZERO CSS global novo (regra inquebrável #3)
- `disabled: true` mantido na video-stories até Pedro configurar 1º vídeo — evita section vazia/feia renderizada no storefront
- Seletor estendido `[id^="abrirTabela-"]` validado contra todo o repo: aparece SÓ no kit-casal-variant-picker (não tem outro `abrirTabela-X` órfão pra capturar por acidente)

**Lições:**
- Botão fem `.js-kit-open-size-chart-fem` já tinha fallback via `window.openSizePanel()` — mas botão masc com ID dinâmico estava silenciosamente quebrado (linha 119 do kit-casal-variant-picker). Lição: ao criar ID dinâmico via `section.id`, conferir se o listener global captura por prefixo.
- Section antiga com URL hardcoded + encoding bug = sinal de import legado. Vale auditar outras sections "disabled" pra ver se viraram lixo bagunçando o JSON.
- Drawer Lever Template BR vs Torcida: idênticos byte-a-byte = boa notícia (propagação anterior foi precisa).

**Backups:**
- `blocks/backups/2026-05-19_loja-da-torcida_terceira-guerra/sections__size-chart-drawer.liquid.bak` + `.AFTER`
- `blocks/backups/2026-05-19_loja-da-torcida_terceira-guerra/templates__product.json.bak` + `.AFTER`
- `blocks/backups/2026-05-19_loja-da-torcida_terceira-guerra/snippets__kit-casal-variant-picker.liquid.bak` (não modificado, snapshot defensivo)

**Próximo passo Pedro:**
1. Abrir uma PDP de Kit Casal no storefront, clicar nos 4 botões "Tabela de medidas" (2 do bloco masc, 2 do bloco fem) → todos devem abrir o mesmo drawer com as 5 abas (Camisas Masculinas, Femininas, Versão Jogador, Infantis, Retrô)
2. Abrir Customizer da PDP → section "Vídeos UGC" deve aparecer disabled. Adicionar 1+ blocks (cada um aceita `image_picker` cover, `video` upload Shopify, ou `video_url` YouTube, ou `custom_video_url` MP4), habilitar a section
3. Conferir PDP no zoom Pedro 67% (memory `feedback_pedro_zoom_67`) — visual pode parecer bugado se for só zoom

---

## 2026-05-19 — Loja da Torcida #cart-drawer #preco-comparativo #kit-casal #pdp-audit

**Loja:** `xdppna-zt.myshopify.com` (UUID `3a9a7bf6-e392-427c-ae73-0d2823dbe53f`, theme MAIN `128963772488`)

**Pedido (quinta guerra do dia):** Brief com 2 tarefas:
1. Cart-drawer Kit Casal mostrando preco `R$399,90 R$450,00` lado a lado mesmo tamanho — aplicar padrao Lever 2026 (memory `feedback_preco_comparativo_layout`): compare_at riscado menor+cinza ANTES, preco real grande+escuro DEPOIS (row-reverse)
2. Auditar PDP Kit Casal vs PDP normal — Pedro suspeitava que tinha perdido copys padrao (Garantia 30d / Entrega Segura / Troca Facil / Suporte / icones PIX/VISA/MASTERCARD / badge Economize R$X)

**Diagnostico tarefa 1:**
- `snippets/cart-drawer.liquid` linha 487-496 ja renderiza `<strong class=cart-item__price-final>` + `<s class=cart-item__price-compare>` (DOM ordem correta)
- CSS local (linhas 146-156): final 1.5rem, compare 1.2rem com `margin-left 0.4rem` — visualmente ficavam quase do mesmo tamanho lado a lado, SEM row-reverse
- Memory `feedback_preco_comparativo_layout` exige: compare ANTES no visual (row-reverse), preco real grande+escuro+800

**Diagnostico tarefa 2 (auditoria PDP kit-casal vs normal):**
- Fetch direto storefront ambas PDPs (`/products/kit-casal-2-camisas-brasil-home-26-27-torcedor` vs `/products/camisa-selecao-brasileira-ii-2006-nike-retro-azul`)
- Matriz de presenca 21 markers checados:
  - `Garantia de Ate 30 Dias` PRESENT em AMBAS
  - `Entrega Segura` PRESENT em AMBAS
  - `Troca Facil` PRESENT em AMBAS
  - `Suporte` PRESENT em AMBAS
  - `pix-badge-wrapper` PRESENT em AMBAS (badge "Pague 5% no PIX")
  - `bk-reviews-star-section` PRESENT em AMBAS
  - `Frete Gratis` PRESENT em AMBAS (frete-banner do tema)
  - `shop_the_look / Compre Junto` PRESENT em AMBAS
  - `related-products` PRESENT em AMBAS
  - `price-item--sale` + `price-item--regular` (compare_at riscado) PRESENT em AMBAS
- Diferenca real: PDP Kit usa `kit-casal-variant-picker` (snippet decide via `if product.tags contains 'kit-casal'` no `product-variant-picker.liquid` linha 11-13); PDP normal usa `<variant-selects>`
- Elementos AUSENTES em ambas (nao e regressao do kit, e estado global):
  - `Economize R$X nesse produto` — badge nao existe no tema (badge_XBEwXy disabled, com texto "Pague 2 Leve 3" / "Frete Gratis")
  - Icones VISA/MASTERCARD — Pedro removeu deliberadamente 2026-05-14 v3 (comentario em `main-product.liquid` linha 821: "Bloco payment-icons removido — Pedro decidiu que ficava melhor sem")
  - `rating-wrapper` — depende de `product.metafields.reviews.rating.value` ter dados (BK Reviews API)
  - `shipping_calculator` — block `disabled: true` no template

**Conclusao tarefa 2:** PDP Kit Casal NAO PERDEU nada vs PDP normal. Sao identicas em copys de garantia/entrega/troca/suporte/pix/reviews/frete. Os 3 elementos extras citados no brief (Economize R$X, VISA/MASTERCARD) NAO EXISTEM em nenhuma das duas — adicionar seria escopo novo (design decision pendente Pedro), nao "padronizar pra match". NAO mexi.

**Arquivos tocados (tarefa 1 apenas):**
- `snippets/cart-drawer.liquid` (30598 -> 30947 bytes, +349, +13 linhas)
  - Linha 146-156 substituido por bloco com novo container `.cart-item__price { display: inline-flex; flex-direction: row-reverse; align-items: baseline; gap: 0.6rem; }`
  - `.cart-item__price-final`: font-size 1.5rem -> 1.7rem, font-weight 700 -> 800, +`line-height: 1`
  - `.cart-item__price-compare`: font-size 1.2rem -> 1.1rem, removido `margin-left: 0.4rem` (gap cuida), +`line-height: 1`, +`font-weight: 500`
  - Comentario semantico com memory hint `feedback_preco_comparativo_layout`

**Validacao push:**
- Liquid balance: 27/27 if/endif, 1/1 unless/endunless, 5/5 for/endfor, 5/5 comment/endcomment OK
- PUT 1: status 200, SHA local nao bateu live (BOM/whitespace), bytes batem 30947=30947
- PUT 2 idempotente: mesmo SHA — diferenca e normalizacao Shopify, NAO conteudo
- Markers no LIVE Liquid (re-fetch): `flex-direction: row-reverse`, `feedback_preco_comparativo_layout`, `font-size: 1.7rem`, `font-weight: 800`, `font-size: 1.1rem`, `.cart-item__price {`, `gap: 0.6rem` — TODOS PRESENT
- Storefront `/cart` page render: TODOS markers PRESENT (cache CDN curto)
- Storefront PDP cache CDN ainda servindo CSS antigo (1-5min ate invalidar) — Pedro confere visualmente apos delay

**Por que mexer SO em CSS (nao em HTML/Liquid):**
- DOM ja estava correto: `<strong class=cart-item__price-final>` antes do `<s class=cart-item__price-compare>` (linha 490-491)
- Mudar ordem do DOM exigiria reescrever 6 linhas Liquid + 2 condicoes — risco de regressao
- `flex-direction: row-reverse` no container faz inversao puramente visual, mantem DOM intacto = ZERO risco de regressao em outros items (normal, personalized, patch, promo)
- CSS escopado `.cart-item__price` (nao global) — zero contaminacao fora do cart-drawer

**Pitfalls evitados:**
- ZERO MutationObserver (regra inquebravel #2)
- ZERO mudanca de HTML/Liquid (so CSS) — diff minimo, zero risco
- ZERO CSS global (escopado em `.cart-item__price`)
- ZERO mexida em cart-item-kit-casal.liquid (snippet so renderiza properties, nao preco)
- Patch unico aplica pra TODOS items do cart-drawer (kit-casal, normal, personalized, patch, promo) — mais consistencia visual em todo o cart, nao so kit

**Markers Admin API confirmados na versao LIVE:**
- `flex-direction: row-reverse` PRESENT
- `feedback_preco_comparativo_layout` PRESENT (rastro semantico)
- `font-size: 1.7rem` PRESENT (preco real)
- `font-weight: 800` PRESENT (preco real bold extra)
- `font-size: 1.1rem` PRESENT (compare_at menor)
- `.cart-item__price {` PRESENT (container novo)

**Proximo passo Pedro (validacao visual):**
1. Abrir `https://xdppna-zt.myshopify.com/cart` — itens com compare_at devem mostrar `R$450,00 (riscado, cinza, menor) R$399,90 (bold, escuro, maior)`
2. Cart-drawer: clicar carrinho na PDP — mesmo padrao
3. Cache CDN: aguardar 1-5min ou hard-refresh (Ctrl+F5) na PDP pra ver visualmente
4. Zoom 67% (memory `feedback_pedro_zoom_67`): com a diferenca de tamanho real 1.7rem vs 1.1rem, a hierarquia visual deve ficar evidente mesmo em zoom out

**Achado escopo 2 (relato sem acao — Pedro decide):**
- PDP Kit Casal nao perdeu nada vs PDP normal. Auditoria confirmou identidade de copys.
- Se quiser ADICIONAR globalmente: (a) badge "Economize R$X" dinamico no block badges_XBEwXy (hoje disabled), (b) icones VISA/MASTERCARD (Pedro removeu 2026-05-14 — ressuscitaria?), (c) habilitar shipping_calculator. Sao decisoes novas, nao corrigir regressao.

**Backups:**
- `blocks/backups/2026-05-19_loja-da-torcida_preco-copy/cart-drawer.liquid.bak` (30598 bytes — versao LIVE pre-patch)
- `blocks/backups/2026-05-19_loja-da-torcida_preco-copy/cart-drawer.liquid.AFTER` (30947 bytes — versao LIVE pos-patch)
- `blocks/backups/2026-05-19_loja-da-torcida_preco-copy/cart-item-kit-casal.liquid.bak` (snapshot defensivo, nao modificado)

**Licoes:**
- Padrao Lever de preco e UMA regra que vale em PDP E cart-drawer E cart-page. Aplicar so num lugar gera inconsistencia. Patch CSS escopado no cart-drawer cobre simultaneamente drawer (overlay) + page (`/cart` template).
- `flex-direction: row-reverse` e atalho zero-risco pra inverter visual mantendo DOM. Util pra padrao Lever onde Liquid ja renderiza ordem "logica" (preco final primeiro pra leitura screen reader).
- Antes de aceitar "PDP perdeu copy", FETCHAR storefront e comparar via matriz de markers. Pedro lembra elementos misturando memorias entre lojas — auditoria empirica resolve em 30s.
- Comentarios `{%- comment -%}` no liquid registram decisoes Pedro (linha 821: payment-icons removido v3) — evita reverter "por engano" feature que ele deletou de proposito.

---

## 2026-05-19 — Loja da Torcida #cart-drawer #kit-casal #qty-selector

**Loja:** `xdppna-zt.myshopify.com` (UUID `3a9a7bf6-e392-427c-ae73-0d2823dbe53f`, theme MAIN `128963772488`)

**Pedido (quarta guerra do dia):** Print mostrava seletor de quantidade (-/[1]/+) aparecendo no item Kit Casal Brasil 26/27 dentro do cart-drawer. Kit Casal nunca pode ter qty selector (regra inquebrável #18 + memory `feedback_kit_casal_excluir_bxgy` + `feedback_quantity_selector_rule`).

**Diagnóstico:**
- Cart-drawer.liquid linha 396-411 renderiza qty selector com condição `{%- if is_personalized or is_patch or is_promo -%}` (locked) `else` (botões -/+/qty)
- Kit Casal não casa em nenhuma das 3 flags: produto não é patch, não tem `Nome`/`Número`/`_pairing_id` (kit-casal usa `Nome Masculino`/`Nome Feminino`), e não tem cupom BxGy aplicado nele (já tem tag `excluded-from-promo`)
- Resultado: kit-casal caía no `else` = botões qty visíveis. Bug visual.
- Snippet `cart-item-kit-casal.liquid` (criado guerra 1 hoje) só renderiza properties, não tem qty.

**Arquivos tocados:**
- `snippets/cart-drawer.liquid` (29930 → 30570 bytes, +640, +10 linhas)
  - Linha 319-322: novo `assign is_kit_casal` (detecta via `product.tags contains 'kit-casal'` OR `properties['_pair_count'] != blank`)
  - Linha 402-403: comentário + `{%- unless is_kit_casal -%}` envolvendo todo o bloco `<div class="cart-item__qty-row">...</div>`
  - Linha 419-421: `{%- else -%}` com hidden `<input name="updates[]">` (essencial pra Shopify reconhecer o item no form submit) + `{%- endunless -%}`

**Validação:**
- Liquid balance: 27/27 if/endif, 1/1 unless/endunless, 5/5 for/endfor, 5/5 comment/endcomment, 3/3 liquid blocks
- Diff vs LIVE: APENAS +10 linhas, ZERO deleções (patch cirúrgico)
- PUT → cache stale 1ª vez (pitfall #13 confirmado de novo) → re-PUT idempotente → 2ª tentativa SHA-256 byte-a-byte MATCH
- Markers no LIVE Liquid: `is_kit_casal` PRESENT, `unless is_kit_casal` PRESENT, `_pair_count` PRESENT, `feedback_kit_casal_excluir_bxgy` PRESENT
- Storefront render (cart-drawer empty na PDP, sem itens): CSS markers `kit-casal-tag`, `cart-item__qty-btn`, `cart-item__qty-locked`, `data-cart-qty` todos PRESENT (snippet ativo, classes intactas)

**Por que `<input name="updates[]">` no else:**
Shopify form `/cart/update.js` espera 1 input `updates[]` por item, na ordem. Sem o input, o form submit pode reordenar/reset quantidades. Solução padrão Lever: kit-casal renderiza input hidden com `value="{{ item.quantity }}"` mantendo qty atual sem UI.

**Pitfalls evitados:**
- ZERO MutationObserver (regra inquebrável #2)
- ZERO CSS novo / ZERO CSS global (regra inquebrável #3)
- ZERO mudança em logic de `is_personalized`/`is_patch`/`is_promo` (zero regressão em items não-kit-casal)
- ZERO modificação no snippet `cart-item-kit-casal.liquid` (já estava limpo, sem qty)
- Detecção via TAG é primária (tag canônica `kit-casal` no produto, controlada pela Lever) + `_pair_count` é fallback property (legado Mantos)
- Property `_pair_count` lida apenas (memory: `_` properties aparecem em checkout custom — Pedro JÁ envia essa property pelo kit-casal-variant-picker, fora do meu escopo remover)

**Markers Admin API confirmados na versão LIVE:**
- `is_kit_casal` PRESENT (assign + 2 condições)
- `{%- unless is_kit_casal -%}` PRESENT (wrapper qty selector)
- `properties['_pair_count']` PRESENT (detecção fallback)
- `feedback_kit_casal_excluir_bxgy` PRESENT (rastro semântico da memory)

**Próximo passo Pedro (validação visual):**
1. Abrir `https://xdppna-zt.myshopify.com/products/kit-casal-2-camisas-brasil-home-26-27-torcedor` (ou o link público da Loja da Torcida)
2. Escolher tamanho masc + fem, clicar "Adicionar ao carrinho"
3. Cart-drawer abre → linha do Kit Casal deve mostrar APENAS título + tag KIT CASAL + grid `Camisa Masculina` / `Camisa Feminina`, SEM linha "Quantidade: - [1] +"
4. Validação cruzada: adicionar uma camisa NORMAL (não kit-casal, não personalizada, não promo) → essa deve mostrar o seletor -/[1]/+ (zero regressão)
5. Item personalizado normal continua locked "1 un" (zero regressão na lógica existente)

**Backups:**
- `blocks/backups/2026-05-19_loja-da-torcida_qty-fix/cart-drawer.liquid.bak` (29958 bytes — versão LIVE pré-patch)
- `blocks/backups/2026-05-19_loja-da-torcida_qty-fix/cart-drawer.liquid.AFTER` (30598 bytes — versão LIVE pós-patch)

**Lições:**
- Quando 3 flags (personalized/patch/promo) cobrem maioria dos casos especiais mas falham num 4º (kit-casal), preferir ADICIONAR 4ª flag + `unless` ao invés de modificar o if existente. Reduz risco de regressão drasticamente: o caminho do else (qty selector ativo) fica inalterado pra items normais.
- `_pairing_id` (gerado pelo carrinho pra parear personalizado com patch) ≠ `_pair_count` (gerado pelo kit-casal-variant-picker pra marcar produto como kit). Names próximos, conceitos distintos. Cuidado em buscas regex.
- Cache stale Shopify (pitfall #13): primeiro re-fetch após PUT pode trazer versão antiga; segundo PUT idempotente força reconciliação. Já 3ª vez hoje.

---

## 2026-05-19 — Mantos do PH — #kit-casal #variants

**Pedido:** Pedro pediu pra liberar 3GG e 4GG MASCULINO no Kit Casal Brasil Home 26/27 (continuando feminino bloqueado por escassez). Aprovou explicitamente via print do storefront + print do admin (25 variants atuais P/P até 2GG/2GG).

**Loja:** Mantos do PH (`a9dc24-2.myshopify.com`, theme main 142261027011 — Cartpanda forkado)

**Produto:** `Kit Casal 2 Camisas Brasil Home 26/27 - Torcedor` (gid 8248726585539, handle `kit-casal-camisa-brasil-home-26-27-nike-torcedor`)

**Arquivos tocados:**
- `snippets/kit-casal-variant-picker.liquid` — linha 65: `assign disabled_masc = '3GG,4GG' | split: ','` → `assign disabled_masc = '' | split: ','` (1 linha, -7 bytes). `disabled_fem` mantido `'3GG,4GG'`.

**Variants criadas via `productVariantsBulkCreate`:**
- 40 novas (100 → 140): 2 sizes masc novos (`3GG`, `4GG`) × 5 sizes fem (`P/M/G/GG/2GG`) × 4 personalização (`Nenhum/Só Masculina/Só Feminina/Ambos`)
- 2 lotes de 20 com delay 600ms (regra Lever serializa writes mesma loja)
- 0 userErrors em ambos lotes
- Tempo total criação: 2.5s

**Pricing (detectado por análise das 100 variants pré-existentes, 0 mismatches):**
- base = 319.90 (P/P + Nenhum)
- compareAtPrice = 450.00 (constante)
- inventoryPolicy = CONTINUE
- pers_extra: Nenhum=0, Só Masculina=30, Só Feminina=30, Ambos=60
- size_extra (somado por LADO): P/M/G/GG=0, 2GG=10, 3GG=20, 4GG=30
- Fórmula: `price = 319.90 + size_extra[masc] + size_extra[fem] + pers_extra[pers]`
- Range nova: `3GG/P + Nenhum = 339.90` até `4GG/2GG + Ambos = 419.90`

**Validação:**
- ✅ Backup snippet pré-patch (SHA-256 idêntico antes/depois): `blocks/backups/2026-05-19_mantos-ph_kit-casal-variant-picker__pre-unlock-3gg-4gg.liquid` (36816 bytes, sha=`baea0710...e76976f4a`)
- ✅ PUT snippet, re-fetch SHA bate com patched: `ace58893...be836318`
- ✅ Re-query produto via GraphQL: 140 variants confirmadas
- ✅ Spot-check 3/3:
  - `3GG/P + Nenhum` → price 339.90 compareAt 450.00
  - `4GG/2GG + Ambos` → price 419.90 compareAt 450.00
  - `3GG/GG + Só Masculina` → price 369.90 compareAt 450.00
- ✅ Storefront PDP — 6/6 markers do picker (`data-kit-section`, `data-kit-mode`, `Tamanho Masculino/Feminino`, `Personalizar camisa masculina/feminina`)
- ⏳ Storefront PDP convergência: 8/10 fetches já trazem masc 3GG/4GG UNLOCKED + fem 3GG/4GG LOCKED. Cache edge GRU ainda propagando os outros 2/10. Convergência prevista <5min.

**Pitfalls e descobertas:**
- ⚠️ **Pricing diferente do relatório anterior:** o relatório anterior dizia BASE=339.90 e nomes pers como `Só Camisa Masculina/Ambas as camisas`. Real: BASE=319.90, nomes `Só Masculina/Ambos`. Verificar SEMPRE a matriz real antes de extrapolar — não confiar em narrativa, ler dado.
- ⚠️ **Cache do storefront NÃO invalida só com PUT do snippet** quando a mudança não altera bytes "estruturais" (linha 65 alterou só 7 chars). PUT no-op de comentário no fim forçou invalidação parcial. Edge GRU serve mixed (alguns nodes velho, outros novo) por alguns minutos.
- ⚠️ **Cache stale na 1ª verificação SHA pós-PUT** (pitfall #13 confirmado de novo — 4ª vez hoje). Esperar 1.5s + retry resolveu.
- ✅ Regra inquebrável #5 respeitada: nenhuma `properties[_*]` introduzida.
- ✅ Regra inquebrável #11 respeitada: produto/loja é a MESMA, não há propagação. Caso isolado de unlock de SKUs sob aval explícito.
- ✅ Regra de severidade: a operação tocou snippet + criou variants no Admin. Como variants são fato de banco (criadas com 0 userErrors) e snippet bate SHA, severidade **ok** (com pendência de convergência cache em storefront).

**Backup:**
- `blocks/backups/2026-05-19_mantos-ph_kit-casal-variant-picker__pre-unlock-3gg-4gg.liquid`

**Rollback (se necessário):**
```js
// 1) Restaurar snippet
const original = fs.readFileSync(BACKUP_PATH, 'utf8');
await shReq(shop, token, 'PUT', '/admin/api/2026-04/themes/142261027011/assets.json', { asset: { key: 'snippets/kit-casal-variant-picker.liquid', value: original } });
// 2) Deletar 40 variants via productVariantsBulkDelete (IDs em unlock-3gg-4gg-create-log.json)
```

**Lições propagáveis:**
- Pricing matrix detection: `BASE + size_extra(masc) + size_extra(fem) + pers_extra` é a fórmula default Lever pra Kit Casal. Vale rodar `step3b` antes de criar variants em QUALQUER kit-casal pra confirmar (varia entre lojas).
- Quando Pedro fala "é só adicionar", verificar mesmo assim: snippet pode ter outros sizes bloqueados que ele esqueceu (no caso, fem ficou bloqueado intencionalmente).
- Cache busting Shopify: 2º PUT idempotente serve pra forçar invalidação quando 1º PUT não bate o cache do storefront.

