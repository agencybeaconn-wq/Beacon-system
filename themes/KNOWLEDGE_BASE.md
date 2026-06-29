# Theme Knowledge Base — Mapa Natural Language → Arquivos

Este arquivo mapeia **termos em linguagem natural** que colaboradores usam → **arquivos específicos** do tema Lever. O objetivo é que quando alguém disser "o preço tá estranho na página do produto", Claude saiba imediatamente quais arquivos olhar.

> **Quando usar:** Claude DEVE consultar este arquivo **antes** de investigar qualquer problema de tema. Procure a seção mais relevante, liste os arquivos-chave, **confirme com o user** antes de abrir arquivos aleatórios.

> **Tema base:** Dawn 15.4.1 com customizações Lever. Os paths são relativos a `themes/lever-br/` (mesma estrutura em `themes/lever-en/`).

---

## 1. Preço na página de produto

**Termos naturais:**
- "o preço tá estranho"
- "preço não aparece"
- "valor não carrega"
- "parcelamento errado"
- "pix não aparece"
- "em até X vezes não tá certo"
- "preço riscado sumiu" (compare_at_price)

**Arquivos-chave:**
- `snippets/price.liquid` — renderização base do preço + compare_at
- `snippets/product-installments.liquid` — cálculo e display de parcelamento + Pix
- `snippets/unit-price.liquid` — preço por unidade (opcional)
- `sections/main-product.liquid` — wrapper da página de produto
- `assets/component-price.css` — estilos do preço
- `assets/product-info.js` — JS de atualização de preço ao trocar variante

**Settings relacionados:** `config/settings_schema.json` → seção "Parcelamento e Pix"
- `installment_enabled` — ativa parcelamento
- `installment_max` — máx parcelas (1-12)
- `pix_discount_enabled` + `pix_discount` — Pix
- `rate_1` a `rate_12` — taxa de juros por parcela

**Bugs comuns:**
- Parcelamento não aparece → checar `installment_enabled=true` em `settings_data.json`
- Pix sumiu → `pix_discount_enabled=true` + `pix_discount > 0`
- Preço $0.00 → variante importada com `price: "0"` (bug)

---

## 2. Botão Adicionar ao Carrinho

**Termos naturais:**
- "botão não funciona"
- "add to cart sumiu"
- "não consigo comprar"
- "clico e não acontece nada"
- "compre agora não aparece"

**Arquivos-chave:**
- `snippets/buy-buttons.liquid` — botões principais de compra
- `assets/product-form.js` — form de produto + submit
- `assets/cart.js` — adição ao carrinho (quando tipo=page)
- `assets/cart-drawer.js` — adição via drawer (quando tipo=drawer)
- `assets/cart-notification.js` — adição via notification (quando tipo=notification)
- `snippets/product-variant-picker.liquid` — seletor que habilita/desabilita botão

**Bugs comuns:**
- Botão cinza (disabled) → variante esgotada ou sem variante selecionada
- Clica e nada → JS quebrado, checar console do browser
- "Sold out" permanente → `inventory_policy=deny` + `inventory_quantity=0`

---

## 3. Carrinho Drawer (gaveta lateral)

**Termos naturais:**
- "carrinho travou"
- "drawer do carrinho não abre"
- "items não aparecem no carrinho"
- "quantidade não atualiza"
- "remover item não funciona"

**Arquivos-chave:**
- `sections/cart-drawer.liquid` — section do drawer
- `snippets/cart-drawer.liquid` — markup interno
- `assets/cart-drawer.js` — JS de abrir/fechar/update
- `assets/component-cart-drawer.css` — estilos
- `assets/component-cart-items.css` — items dentro do drawer

**Settings:** `config/settings_schema.json` → `cart_type` (drawer/page/notification)

---

## 4. Progress Bar / Milestones do Carrinho

**Termos naturais:**
- "barra de progresso sumiu"
- "milestone não aparece"
- "compre 2 leve 3 não funciona"
- "brinde não aparece"
- "mensagem do carrinho errada"
- "progress bar não atualiza"

**Arquivos-chave:**
- `snippets/cart-progress-bar.liquid` — markup da barra
- `assets/cart-progress-bar.css` — estilos
- `assets/cart-progress-bar.js` — lógica de atualização baseada em qty
- `snippets/progress-bar.liquid` — variante do snippet

**Settings:** `config/settings_schema.json` → seção "cart" (linhas 1585+)
- `milestone_1_quantity`, `milestone_1_badge`, `milestone_1_icon`
- `milestone_2_quantity`, `milestone_2_badge`, `milestone_2_icon`
- `milestone_0_icon` (ícone inicial)
- `message_0` a `message_6_plus` (mensagens por quantidade)

**Bugs comuns:**
- Não aparece → checar se `milestone_1_quantity > 0` e não vazio
- Mensagem errada → revisar `message_N` no customizer
- Ícone quebrado → se `milestone_N_icon = custom`, conferir `milestone_N_custom_svg`

---

## 5. Frete Grátis / Calculadora de Frete

**Termos naturais:**
- "frete não aparece"
- "calcular frete não funciona"
- "frete grátis errado"
- "opção de frete faltando"
- "PAC/SEDEX sumiu"

**Arquivos-chave:**
- `snippets/shipping-calculator.liquid` — form do calculador
- `sections/main-cart-footer.liquid` — onde é incluído
- `assets/component-shipping-calculator.css` — estilos

**Settings:** `templates/cart.json` → `cart-footer.blocks.shipping_calculator.settings`
- `title`, `subtitle`
- `option_1_title`, `option_2_title`, `option_3_title`, `option_4_title` — textos das opções de frete

**Bugs comuns:**
- Opções em inglês em loja BR → editar `option_N_title` no `cart.json`
- Sem opções → block `shipping_calculator` desabilitado no customizer

---

## 6. Imagens do Produto (galeria, zoom)

**Termos naturais:**
- "foto não aparece"
- "galeria quebrada"
- "zoom não funciona"
- "imagem cortada"
- "thumbnails sumiram"

**Arquivos-chave:**
- `snippets/product-media.liquid` — media individual
- `snippets/product-media-gallery.liquid` — galeria completa
- `snippets/product-media-modal.liquid` — modal de zoom
- `snippets/product-thumbnail.liquid` — thumb
- `assets/product-modal.js` — JS de modal/zoom
- `assets/media-gallery.js` — JS da galeria
- `assets/component-media-gallery.css`

**Bugs comuns:**
- Sem imagem → produto sem `images[]` (ver check `checkNoImages` no quality-gate)
- Zoom não abre → JS quebrado ou classe CSS faltando

---

## 7. Variantes / Tamanho / Cor

**Termos naturais:**
- "tamanho não funciona"
- "seletor de cor quebrado"
- "opção não aparece"
- "PP não aparece"
- "não consigo escolher tamanho"
- "swatch sumiu"

**Arquivos-chave:**
- `snippets/product-variant-picker.liquid` — picker principal (tabs/pills)
- `snippets/product-variant-options.liquid` — options
- `assets/component-product-variant-picker.css`
- `assets/component-swatch.css` — swatches de cor
- `assets/product-form.js` — JS de troca de variante

**Bugs comuns:**
- Ordem errada (GGG antes de PP) → `fix-options` skill
- Variante sumiu → cliente deletou no admin
- Swatches não aparecem → produto sem metafield de cor

---

## 8. Header / Menu Principal

**Termos naturais:**
- "logo mal posicionado"
- "menu desapareceu"
- "menu mobile quebrado"
- "sticky header não funciona"
- "header muito grande/pequeno"
- "telefone/email no header errado"

**Arquivos-chave:**
- `sections/header.liquid` — section principal
- `sections/header-group.json` — config do header group
- `snippets/header-mega-menu.liquid` — mega-menu desktop
- `snippets/header-dropdown-menu.liquid` — dropdown menu
- `snippets/header-drawer.liquid` — drawer mobile
- `snippets/header-search.liquid` — busca
- `assets/component-mega-menu.css`
- `assets/component-menu-drawer.css`

**Settings:** `sections/header-group.json` → `header.settings`
- `logo_position`, `mobile_logo_position`
- `menu`, `menu_type_desktop`
- `sticky_header_type`
- `support_phone`, `support_email`
- `color_scheme`, `icon_color`

---

## 9. Announcement Bar (barra de anúncio topo)

**Termos naturais:**
- "aviso do topo"
- "promoção no topo"
- "barra de anúncio"
- "mensagem rolando no topo"
- "frete grátis no topo errado"

**Arquivos-chave:**
- `sections/announcement-bar.liquid`
- `assets/component-announcement.css`

**Settings:** `sections/header-group.json` → `announcement-bar.blocks`
- Cada block `announcement-*` tem `text` e `link`
- `auto_rotate` + `change_slides_speed`

---

## 10. Footer

**Termos naturais:**
- "rodapé errado"
- "links do footer"
- "horário de atendimento errado"
- "contato faltando"
- "redes sociais no footer"
- "copyright"

**Arquivos-chave:**
- `sections/footer.liquid` — layout do footer
- `sections/footer-group.json` — config + blocks
- `snippets/social-icons.liquid` — redes sociais
- `assets/section-footer.css`

**Settings:** `sections/footer-group.json` → blocks do tipo `text`, `link_list`, `social`

**Tip:** campo `subtext` dos blocks `text` suporta HTML — é onde fica horário de atendimento, email, whatsapp.

---

## 11. Cores do Tema (color schemes)

**Termos naturais:**
- "cor errada"
- "botão em outra cor"
- "fundo da página"
- "cor do texto"
- "esquema de cores"
- "tema escuro/claro"

**Arquivos-chave:**
- `config/settings_schema.json` → seção "colors" (linhas 93-158) — **definição dos schemes**
- `config/settings_data.json` → `current.sections.color_schemes.settings` — **valores atuais**
- `assets/base.css` — CSS vars que usam os schemes

**Como funciona:**
- O tema tem `color_scheme_group` com múltiplos schemes (`scheme-1`, `scheme-2`, etc)
- Cada scheme tem: `background`, `background_gradient`, `text`, `button`, `button_label`, `secondary_button_label`, `shadow`
- Sections/blocks recebem `color_scheme: scheme-N` e o CSS aplica automaticamente

**Pra trocar cor global:**
- Editar `scheme-1.settings.background` (por exemplo) no `settings_data.json`
- Ou via customizer: Theme settings → Colors → scheme-1

---

## 12. Tipografia (fontes)

**Termos naturais:**
- "fonte muito grande"
- "fonte errada"
- "título não aparece em negrito"
- "corpo do texto"
- "heading tamanho"

**Arquivos-chave:**
- `config/settings_schema.json` → seção "typography"
- `config/settings_data.json` → `current.type_header_font`, `type_body_font`
- `assets/base.css` — CSS variables `--font-heading-*`, `--font-body-*`

**Settings:** `type_header_font_family`, `type_body_font_family`, `heading_scale`, `body_scale`

---

## 13. Grid de Produtos (página de coleção)

**Termos naturais:**
- "produtos não aparecem em grid"
- "layout da coleção ruim"
- "quantos produtos por linha"
- "coleção mobile quebrada"
- "produto sem foto na listagem"

**Arquivos-chave:**
- `sections/main-collection-product-grid.liquid` — grid principal
- `snippets/card-product.liquid` — card individual de produto
- `sections/main-collection-banner.liquid` — banner topo
- `assets/component-card.css` — estilos do card
- `assets/section-main-collection-product-grid.css`

**Settings:** via customizer em `Collection template` → products_per_row, columns_mobile, etc.

---

## 14. Filtros de Coleção (facets)

**Termos naturais:**
- "filtro não funciona"
- "não consigo filtrar por tamanho"
- "preço range quebrado"
- "ordenar produtos"

**Arquivos-chave:**
- `snippets/facets.liquid` — UI dos filtros
- `snippets/price-facet.liquid` — filtro de preço (range)
- `assets/facets.js` — JS de aplicar filtros
- `assets/component-facets.css` — estilos

**Configuração no admin:** Settings → Search and discovery → Filters

---

## 15. Configurador de Patches (camisas)

**Termos naturais:**
- "patch não aparece"
- "configurador de patch quebrado"
- "não consigo adicionar patch"
- "libertadores patch"
- "champions patch"

**Arquivos-chave:**
- `sections/custom-patch-rules.liquid` — regras editáveis no customizer
- `snippets/patch-selector-block.liquid` — UI de seleção na página produto
- `snippets/patch-styles.liquid` — estilos dos patches
- `snippets/patch-script.liquid` — JS do seletor

**Como funciona:**
- Customizer → section "Custom Patch Rules" → define patches disponíveis + preços
- Cada produto exibe os patches aplicáveis baseado em condições (time, liga)
- Seleção vira `properties[_patch]` no line item do carrinho
- Preço do patch é somado ao preço do produto via JS

---

## 16. Configurador de Nome/Número (personalização)

**Termos naturais:**
- "personalização não funciona"
- "nome na camisa"
- "número do jogador"
- "configurador do jogador"
- "nome custom"

**Arquivos-chave:**
- `sections/custom-player-rules.liquid` — regras no customizer
- `snippets/customization-inputs.liquid` — inputs de nome+número
- `assets/cart.js` — lógica de cart properties

**Como funciona:**
- User seleciona "Personalizar" em uma variante (option com valor "Personalizar")
- Inputs de nome+número aparecem
- Vira `properties[_player_name]` + `properties[_player_number]` no carrinho
- Preço +R$30 (nome_numero extra) somado pelo JS

---

## 17. Selos Custom (custom badges)

**Termos naturais:**
- "selo de novidade"
- "badge não aparece"
- "tag de lançamento"
- "etiqueta do produto"

**Arquivos-chave:**
- `snippets/custom-badges.liquid` — renderização dos selos
- `snippets/scarcity-badge.liquid` — badge de escassez
- `assets/component-scarcity.css`

**Settings:** `config/settings_schema.json` → seção "Selos Personalizados" (até 5 selos)
- `custom_badge_N_enabled`
- `custom_badge_N_condition` (tag | title)
- `custom_badge_N_value` (ex: "lancamento")
- `custom_badge_N_text` (ex: "NOVIDADE")
- `custom_badge_N_bg_color` + `custom_badge_N_text_color`

---

## 18. Parcelamento e Pix (destaque na página de produto)

**Termos naturais:**
- "parcelamento errado"
- "pix desconto"
- "6x sem juros"
- "12x com juros"
- "à vista no pix"

**Arquivos-chave:**
- `snippets/product-installments.liquid` — display principal
- `snippets/price.liquid` — integração com preço base

**Settings:** `config/settings_schema.json` → seção "Parcelamento e Pix"
- `installment_enabled`, `installment_max`
- `pix_discount_enabled`, `pix_discount`
- `rate_1` a `rate_12`

---

## 19. Home — Hero / Slideshow

**Termos naturais:**
- "banner da home"
- "slideshow não funciona"
- "hero image"
- "imagem principal da home"

**Arquivos-chave:**
- `sections/image-banner.liquid` — hero fixo
- `sections/slideshow.liquid` — carousel
- `assets/component-slideshow.css`
- `assets/slideshow.js`

**Configuração:** via customizer → index.json → blocks `image-banner` ou `slideshow`

---

## 20. Tabs de Times na Home (logos)

**Termos naturais:**
- "logo do time não aparece"
- "tabs de time"
- "flamengo com foto errada"
- "case statement de time"

**Arquivos-chave:**
- `sections/collection-list-tabs.liquid` — ⭐ **case statement que mapeia handle → URL de logo**

**CDN de logos:** `https://pub-741e79c7a4b84c228594bbc296d1fbdd.r2.dev/Site%20Lever/Logos%20Clubes/...`

**Como adicionar time novo:**
```liquid
{% case block.settings.collection.handle %}
  {% when 'novo-time' or 'new-team' %}
    {% assign custom_team_image = 'https://cdn.../logos/novo-time.png' %}
  ...
{% endcase %}
```

---

## 21. Tabs Masculino/Feminino/Infantil (home)

**Termos naturais:**
- "tabs da home"
- "masculino feminino infantil"
- "categoria de gênero"
- "aba sumiu da home"

**Arquivos-chave:**
- `sections/featured-collection-tabs.liquid` — tabs configuráveis

**Configuração:** cada tab aponta pra uma smart collection (ex: `MASCULINO BRASIL`, `FEMININA BRASIL`, `INFANTIL BRASIL`).

**⚠️ Cuidado:** smart collections devem usar partial matches (`femin`, `masculin`) pra resistir a typos. Ver `feedback_smart_collection_rules` na memória.

---

## 22. Yampi / CartPanda Checkout (BR apenas)

**Termos naturais:**
- "yampi não funciona"
- "checkout não abre"
- "pagamento não vai"
- "finalizar compra quebrado"
- "cartpanda erro"

**Arquivos-chave:**
- `snippets/YampiSnippet.liquid` — integração Yampi completa
- `snippets/cartxCheckoutSnippet.liquid` — integração CartPanda
- `sections/main-cart-footer.liquid` — onde são incluídos via `{% render %}`

**Como integrar em um cliente novo:**
1. Copiar `YampiSnippet.liquid` ou `cartxCheckoutSnippet.liquid` do `themes/lever-br`
2. Incluir no `main-cart-footer.liquid` do cliente
3. Validar endpoint + token Yampi/CartPanda

**Skill dedicada:** [`/yampi-checkout`](../.claude/skills/yampi-checkout/SKILL.md)

---

## 23. Licença Lever / Proteção Anti-Plágio

**Termos naturais:**
- "licença do tema"
- "chave lever"
- "bloquear botão direito"
- "anti-plágio"
- "proteção de código"
- "tema pirateado"

**Arquivos-chave:**
- `config/settings_schema.json` → seção "Lever Digital - Licença & Proteção" (linhas 11-65)
- `layout/theme.liquid` — onde o JS de proteção é injetado
- `assets/global.js` — lógica de bloqueio

**Settings:**
- `lever_license_key` — chave única do cliente (gerada via skill `shopify`)
- `lever_protection_enabled` — ativa proteções
- `lever_block_right_click`, `lever_block_text_selection`, `lever_block_inspect`

**Registro da licença:** Supabase externo `ykctllrqygchllhxnkjh.supabase.co` → tabela `licenses`

---

## 24. SEO (meta title, meta description, metafields)

**Termos naturais:**
- "google não indexa"
- "meta tag errada"
- "description do produto"
- "title do produto no Google"
- "seo ruim"

**Arquivos-chave:**
- `layout/theme.liquid` — tags `<title>`, `<meta description>`
- Shopify admin: `product.metafields_global_title_tag`, `product.metafields_global_description_tag`
- `snippets/meta-tags.liquid` (se existir) — helper de meta tags

**Como editar SEO de um produto:**
- Admin Shopify → Product → Search engine listing preview → edit
- Ou via API: `PUT /products/{id}.json { product: { metafields_global_title_tag: "..." } }` (ver skill `/shopify`)

**Check automatizado:** quality-gate tem check 5 (SEO metafields faltando)

---

## 25. Carrinho Footer (totais, botões, frete)

**Termos naturais:**
- "subtotal errado"
- "total não aparece"
- "botão finalizar"
- "carrinho footer"

**Arquivos-chave:**
- `sections/main-cart-footer.liquid` — layout
- `assets/component-cart.css`
- `assets/cart.js`

**Blocks configuráveis em `templates/cart.json`:**
- `subtotal` — totais
- `buttons` — checkout/continue shopping
- `shipping_calculator` — calculadora de frete

---

## 26. Reviews / Avaliações (BK Reviews App)

**Termos naturais:**
- "estrelas de avaliação não aparecem no desktop"
- "rating sumiu na página de produto"
- "review só aparece no mobile"
- "BK Reviews"
- "estrelas posicionadas errado"
- "alinhamento das estrelas no topo"
- "avaliações desktop"

**Solução validada (2026-04-14, Retro Football):**

A JS do BK Reviews (`bk-index-*.js`) faz auto-inject de um div `auto-bk-star-section` **após o `<h1>` do produto**. O algoritmo é:

```
1. Procura getElementById('bk-star-section') ou 'auto-bk-star-section' → se achar, hidrata e PARA
2. Senão, encontra primeiro <h1> e injeta stars após ele
3. Itera querySelectorAll('.small--hide h1, .small--hide h2') e injeta após cada um
```

O tema Lever tem 2 `<h1>` na página de produto (mobile dentro de `.product-mobile-header`, desktop dentro de `.product__title.mobile-hidden-original`). Para a JS auto-injetar em AMBOS, basta adicionar a classe `small--hide` no wrapper do h1 desktop:

```liquid
{%- when 'title' -%}
  <div class="product__title mobile-hidden-original small--hide" {{ block.shopify_attributes }}>
    <h1>{{ product.title | escape }}</h1>
    ...
```

**Arquivos-chave:**
- `sections/main-product.liquid` — adicionar `small--hide` na classe do `<div class="product__title mobile-hidden-original">` no desktop loop (case `when 'title'`)
- `assets/component-rating.css` — renderização nativa das stars (não usado pelo BK, mas existe pra fallback metafield)
- `templates/product.json` — bloco `bk-reviews-embed` no footer-group renderiza widget completo (form + lista de reviews)

**Settings relacionados:**
- App **BK Reviews** instalado e enabled na loja
- O bloco `bk-reviews-embed` no footer-group é o que carrega a JS — sem ele nada hidrata
- Hidratação é 100% client-side; não depende de metafield nativo

**Bugs comuns / anti-patterns:**
- **NÃO adicionar `<div id="bk-star-section">` estático** — bloqueia o auto-inject (a JS para no passo 1 e ignora o passo 2/3). Resultado: só um lado funciona
- **NÃO adicionar `bk-reviews-star-section` app block via API/JSON** — Shopify silenciosamente ignora; só funciona via customizer
- **Não confiar em `{% if product.metafields.reviews.rating.value != blank %}`** — nem todas as lojas sincronizam o BK pro metafield nativo
- **Sem `small--hide` no título desktop**: mobile funciona (1º h1 detectado), desktop não (h1 com `mobile-hidden-original` não casa o selector da iteração)
- **Lojas deployadas antes 2026-04-14**: precisam receber retroativamente. Editar `sections/main-product.liquid`, sync e republicar

---

## 27. Variant Picker — Tamanhos PP/P/M/G/GG/2GG/3GG/4GG

**Termos naturais:**
- "adicionar tamanho 3GG"
- "big size"
- "variante 4GG"
- "tamanho não aparece"
- "esgotado no tamanho"
- "escassez no variante"

**Arquivos-chave:**
- `sections/main-product.liquid` — caso `when 'variant_picker'` no desktop e mobile loops
- `snippets/product-variant-picker.liquid` — markup das pílulas de tamanho
- `assets/component-variant-picker.css` — styling
- `.claude/skills/fix-options/` — skill pra padronizar opções
- [lib/shopify-pricing.mjs:BIG_SIZES](.claude/lib/shopify-pricing.mjs) — set `{2GG, 3GG, 4GG, GGG, GGGG}` que recebem acréscimo

**Pricing:**
- `extras.tamanho_2gg` / `tamanho_3gg` / `tamanho_4gg` no `client_pricing` — acréscimo por tamanho
- Default R$10 se não configurado
- Aliases: GGG = 3GG, GGGG = 4GG

**Bugs comuns:**
- Variante renomeada manualmente (ex: "PP" → "pp") quebra o match pro `BIG_SIZES` — a skill `fix-options` normaliza
- 4GG criado sem o extra configurado → fica com preço de M/G

---

## 28. Personalização (Nome + Número na variante)

**Termos naturais:**
- "personalizar camisa"
- "nome atrás"
- "número na camisa"
- "camisa já personalizada"
- "personalização custa X"

**Arquivos-chave:**
- `sections/main-product.liquid` — case `when 'variant_picker'` (opção 2)
- `snippets/product-form.liquid` — input do nome e número
- `assets/section-main-product.css` — estilo dos campos

**Pricing:**
- `extras.personalizacao` / `nome_numero` (aliases) no `client_pricing` — acréscimo quando option2 === "Personalizar"
- Default R$30
- Sub-key `camisa_torcedor_personalizada` (v7) pra produtos **pré-personalizados** (com nome+número no título tipo "Garro 8") — preço base embute o +R$30

**Bugs comuns:**
- Produto com nome de jogador no título SEM aplicar o extra — ver caso Coringão Shop (2026-04-14): criamos sub-key `camisa_torcedor_personalizada` e detector em [pickV7SubKey](.claude/lib/shopify-pricing.mjs)
- Variante "Personalizar" sem o +R$30 aplicado — rodar `/bulk-fix-prices` pra corrigir

---

## 29. Progress Bar / Milestones (Buy X Get Y)

**Termos naturais:**
- "barra de progresso quebrada"
- "leve 3 pague 2"
- "milestone do carrinho"
- "progresso do carrinho não atualiza"
- "dual promo"

**Arquivos-chave:**
- `snippets/cart-milestones.liquid` — render da barra
- `assets/component-cart-drawer.css` — styling
- `assets/cart-milestones.js` — lógica de cálculo client-side
- `config/settings_schema.json` seção "Milestones / Progress" — settings editáveis (thresholds, mensagens)

**Settings:**
- `milestone_1_qty`, `milestone_1_message`, `milestone_1_reward_type` (discount/gift)
- Suporta até 3 milestones empilhados

**Bugs comuns:**
- Filtro por tag não aplicado (conta camisas + patches errado) — adicionar filtro `item.properties._exclude_from_milestone` nos patches
- Dual promo (Buy 2 Get 3 + Buy 3 Get 5) requer lógica especial em `cart-milestones.js` — ver block [JGS + TG Jerseys](../blocks/candidates/RANKING.md)

---

## 30. Escassez (Scarcity Badge)

**Termos naturais:**
- "restam 3 unidades"
- "últimas peças"
- "badge de escassez"
- "mostrar estoque baixo"

**Arquivos-chave:**
- `sections/main-product.liquid` — case `when 'scarcity_badge'`
- `snippets/product-scarcity.liquid` — render
- `assets/component-scarcity.css`

**Settings (por block):**
- `max_stock` — threshold pra mostrar o badge (default 10)
- `message` — "Restam apenas {count} unidades"
- `color` — default vermelho

**Bugs comuns:**
- Produto com `inventory_management: null` (sem tracking) nunca mostra badge — por design
- Variante com `inventoryPolicy: CONTINUE` (permite vender sem estoque) mostra contador incorreto — revisar `/bulk-fix-stock` (futura skill)

---

## 31. Provador Virtual (Mantos do PH / Retro Football)

**Termos naturais:**
- "provador virtual"
- "ver no modelo"
- "try on"

**Arquivos-chave:**
- `snippets/virtual-tryon.liquid` — button + modal
- `assets/virtual-tryon.js` — lógica (upload foto → API externa → imagem com a camisa)

**Integrações:**
- Usa API externa (configurável via settings)
- Precisa de metafield por produto com imagem "flat" da camisa (usada como overlay)

**Bugs comuns:**
- Sem metafield da camisa flat → provador não abre
- API externa lenta → loading infinito (timeout de 30s no JS)

---

## 32. Shop the Look / Compre Junto

**Termos naturais:**
- "compre junto"
- "produtos relacionados"
- "cross-sell"
- "shop the look"

**Arquivos-chave:**
- `sections/main-product.liquid` — case `when 'shop_the_look'`
- `snippets/shop-the-look.liquid` — render dos cards
- Usa metafield `shopify--discovery--product_recommendation.related_products`

**Config:**
- Quantidade de produtos: setting `limit` (default 4)
- Heading: `Compre Junto`

---

## 33. Filtros de coleção (Facetas)

**Termos naturais:**
- "filtro por tamanho"
- "filtro em inglês"
- "faceted search"
- "filtro de coleção"

**Arquivos-chave:**
- `sections/main-collection-product-grid.liquid`
- `snippets/facets.liquid`
- `locales/*.json` — textos dos filtros (se loja EN, usa en.json)

**Bugs comuns:**
- Loja EN mostrando filtros em PT → verificar se o theme locale está certo no admin
- Filtros de opção não aparecem → precisa ativar "search and discovery" no Shopify + tags com prefixo certo

---

## 34. Banner Homepage + Anúncio Topo

**Termos naturais:**
- "banner principal"
- "anúncio do topo"
- "announcement bar"
- "barra de avisos"

**Arquivos-chave:**
- `sections/image-banner.liquid` — banner principal
- `sections/announcement-bar.liquid` — tarja superior (rotativa)
- `sections/header-group.json` — agrupa announcement + header
- [.claude/skills/configure-theme](.claude/skills/configure-theme/SKILL.md) — configura anúncios via briefing

---

## 35. Checkout externo (Yampi / CartPanda)

**Termos naturais:**
- "yampi"
- "cartpanda"
- "checkout externo"
- "redirecionar checkout"

**Arquivos-chave:**
- `snippets/checkout-redirect.liquid`
- `assets/checkout-redirect.js`
- `config/settings_schema.json` seção "Checkout" — toggle `yampi` / `cartpanda` / `nativo`
- [.claude/skills/yampi-checkout](.claude/skills/yampi-checkout/SKILL.md) — skill dedicada
- Bloco validado em [blocks/history/2026-04-10_furia_yampi-config.md](../blocks/history/2026-04-10_furia_yampi-config.md)

---

## 36. Reviews / Avaliações — VER § 26

Consulte a seção 26 já existente. Adendo:

**Erro típico reproduzido (2026-04-14):**
- Stars não aparecem em desktop porque o h1 do título não tem classe `.small--hide` que o BK Reviews usa pra auto-inject. **Fix**: adicionar `small--hide` em `<div class="product__title mobile-hidden-original">` do desktop loop.
- Ver [blocks/history/2026-04-14_retro_bk-reviews-stars-desktop.md](../blocks/history/2026-04-14_retro_bk-reviews-stars-desktop.md) pro patch exato.

---

## Como Claude deve usar este arquivo

1. **Quando o user descrever um problema**, primeiro identifique a seção mais próxima (busca fuzzy nos "Termos naturais")
2. **Confirme antes de abrir arquivos**: "Você está falando sobre [nome da seção]? Vou olhar os arquivos X, Y, Z antes de começar — tudo bem?"
3. **Leia os arquivos-chave em paralelo** (usando grep cross-file se necessário)
4. **Proponha a mudança** ao user antes de editar
5. **Siga o [PROTOCOL.md](../.claude/PROTOCOL.md)** (preview → confirm → execute)

## Manutenção deste arquivo

- Atualizar sempre que novo snippet/section importante for adicionado ao tema
- Rodar `/lever-theme diff-br-en` mensalmente pra detectar arquivos novos
- Incluir bugs comuns conforme forem sendo resolvidos (virando FAQ)

**Última atualização:** 2026-04-14 — adicionadas seções 26-36 (Reviews, Variant Picker, Personalização, Progress Bar, Escassez, Provador Virtual, Shop the Look, Filtros, Banners, Checkout Externo).
