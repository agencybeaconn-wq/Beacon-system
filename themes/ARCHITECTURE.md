# Tema Lever — Arquitetura e Guia de Navegação

Documentação estrutural completa do tema proprietário da **Lever Digital**, usado na maioria das lojas dos clientes. Este documento é a **fonte de verdade** pra navegação, edição e manutenção do tema.

> **Base:** Dawn v15.4.1 (Shopify oficial)
> **Customizações Lever:** licença, proteção anti-plágio, selos personalizados, milestones no carrinho, parcelamento PIX, Yampi/CartPanda checkout, configuradores custom (patch/player/shop-the-look).

---

## 📂 Estrutura de diretórios

```
themes/lever-br/          (e themes/lever-en/)
├── assets/              (~200 arquivos)
│   ├── base.css                   ← estilos base do Dawn
│   ├── *.css                      ← CSS por seção/componente
│   ├── *.js                       ← JS por funcionalidade
│   ├── cart-progress-bar.{css,js} ← milestones customizadas
│   ├── scarcity-badge.{css,js}    ← badge de escassez
│   └── shop-the-look-global.css   ← configurador shop-the-look
│
├── sections/            (~63 arquivos .liquid + 2 .json group)
│   ├── header.liquid               ← cabeçalho principal
│   ├── header-group.json           ← configuração do header-group
│   ├── footer.liquid
│   ├── footer-group.json
│   ├── announcement-bar.liquid     ← barra de anúncio topo
│   ├── main-product.liquid         ← página de produto
│   ├── main-cart-items.liquid      ← carrinho itens
│   ├── main-cart-footer.liquid     ← footer carrinho (totais + frete + checkout)
│   ├── main-collection-product-grid.liquid  ← listagem de coleção
│   ├── collection-list-tabs.liquid        ← ⭐ TABS de times (home) com logos
│   ├── collection-player-tabs.liquid      ← tabs de jogadores
│   ├── featured-collection-tabs.liquid    ← tabs Masculino/Feminino/Infantil
│   ├── custom-patch-rules.liquid          ← ⭐ regras de PATCHES por produto
│   ├── custom-player-rules.liquid         ← ⭐ regras de personalização nome/número
│   └── custom-shop-the-look-rules.liquid  ← sugestão combinada
│
├── snippets/            (~55 arquivos)
│   ├── YampiSnippet.liquid                ← ⭐ integração checkout Yampi (BR)
│   ├── cartxCheckoutSnippet.liquid        ← ⭐ integração CartPanda (BR)
│   ├── buy-buttons.liquid                 ← botões comprar/adicionar
│   ├── price.liquid                       ← renderização de preço (+parcelamento, PIX)
│   ├── patch-selector-block.liquid        ← seletor de patch na página
│   ├── patch-styles.liquid                ← estilos dos patches
│   ├── scarcity-badge.liquid              ← badge escassez
│   ├── progress-bar.liquid                ← barra milestones carrinho
│   ├── header-mega-menu.liquid            ← mega-menu do header
│   ├── card-product.liquid                ← card de produto (grid)
│   ├── customization-inputs.liquid        ← inputs de personalização
│   └── shipping-calculator.liquid         ← calculadora de frete
│
├── templates/           (~25 arquivos)
│   ├── index.json                         ← home page
│   ├── cart.json                          ← carrinho (com milestones + frete)
│   ├── product.json                       ← página de produto default
│   ├── collection.json                    ← página de coleção default
│   ├── collection.atletico-mg.json        ← ⭐ customização per-team (Atlético MG)
│   ├── collection.corinthians-2.json      ← ⭐ Corinthians (alt)
│   ├── collection.feminino.json           ← coleção Feminino
│   ├── collection.retro.json              ← coleção Retrô
│   ├── page.contact.json
│   ├── page.json
│   ├── list-collections.json
│   ├── search.json
│   ├── gift_card.liquid
│   ├── password.json
│   └── customers/*.json
│
├── locales/             (~51 arquivos)
│   ├── pt-BR.json                         ← tradução principal (BR)
│   ├── pt-BR.schema.json                  ← chaves do customizer (BR)
│   ├── en.default.json                    ← tradução (EN)
│   ├── en.default.schema.json
│   └── ...outros idiomas (de, es, fr, etc) — não usamos na prática
│
├── config/              (2 arquivos)
│   ├── settings_schema.json               ← ⭐ DEFINIÇÃO dos campos editáveis no customizer
│   └── settings_data.json                 ← ⭐ VALORES atuais (cores, licença, milestones)
│
└── layout/              (2 arquivos)
    ├── theme.liquid                       ← layout base (html, head, body, body scripts)
    └── password.liquid                    ← layout página de senha
```

---

## 🎨 Sistema de Cores (`color_schemes`)

O tema usa o sistema **color_scheme_group** do Dawn (Shopify 2024+). Permite criar múltiplos schemes que seções/blocks referenciam por ID (`scheme-1`, `scheme-2`, etc).

**Onde fica definido:** [config/settings_schema.json:93-158](lever-br/config/settings_schema.json) (seção `colors`)

**Campos por scheme:**
- `background` — cor de fundo sólida
- `background_gradient` — gradient (opcional)
- `text` — cor do texto
- `button` — cor de fundo do botão primário
- `button_label` — cor do texto do botão primário
- `secondary_button_label` — cor do botão secundário e links
- `shadow` — cor das sombras

**Roles (mapping automático Dawn):**
```json
"role": {
  "text": "text",
  "background": { "solid": "background", "gradient": "background_gradient" },
  "links": "secondary_button_label",
  "icons": "text",
  "primary_button": "button",
  "on_primary_button": "button_label",
  "secondary_button": "background",
  "on_secondary_button": "secondary_button_label"
}
```

**Como seções herdam o scheme:**
Cada section/block tem um campo `color_scheme` que recebe um `scheme-X`. No Liquid, o componente aplica:
```liquid
<div class="color-{{ section.settings.color_scheme }}">
```
O CSS em `assets/base.css` mapeia `.color-scheme-1 { --color-background: var(--scheme-1-background); }` etc.

**Pra editar cores globalmente:**
1. Customizer → Theme settings → Colors → editar scheme 1/2/3...
2. Ou via API: `settings_data.json.current.sections.color_schemes.settings.scheme-1.settings.background`

**Pra editar cor de seção específica:**
Mudar o `color_scheme` da seção pra apontar pra outro scheme (ex: `scheme-3`).

---

## ⭐ Customizações Lever (não são do Dawn)

Essas são features **específicas do tema Lever** — não existem no Dawn original.

### 1. Licença e Proteção Anti-Plágio

**Schema:** [config/settings_schema.json:11-65](lever-br/config/settings_schema.json)

Campos:
- `lever_license_key` (text) — chave única da licença Lever Digital
- `lever_protection_enabled` (bool) — ativa travas de segurança
- `lever_block_right_click` — bloqueia botão direito
- `lever_block_text_selection` — bloqueia seleção de texto
- `lever_block_inspect` — bloqueia F12 / Ctrl+U

A licença é registrada no Supabase externo **Lever Site** (`ykctllrqygchllhxnkjh.supabase.co`, tabela `licenses`). A skill `shopify` tem o flow de criação da licença.

### 2. Milestones no Carrinho (Progress Bar)

**Schema:** [config/settings_schema.json:1585-1835](lever-br/config/settings_schema.json) (seção `cart`)
**Render:** [snippets/progress-bar.liquid](lever-br/snippets/progress-bar.liquid)
**CSS/JS:** [assets/cart-progress-bar.css](lever-br/assets/cart-progress-bar.css), `cart-progress-bar.js`

**Campos configuráveis:**
- `milestone_1_quantity` (int, default 3) — meta 1 (ex: Compre 2 Leve 3)
- `milestone_1_badge` (text, "Leve 3") — texto do badge
- `milestone_1_icon` (select: shirt/gift/trophy/star/ball/custom)
- `milestone_1_custom_svg` (html) — SVG custom
- `milestone_2_quantity` (int, default 6) — meta 2
- `milestone_2_*` (mesma estrutura)
- `milestone_0_icon` — ícone inicial (home/cart/shop)
- `message_0` a `message_6_plus` (richtext) — mensagens dinâmicas por quantidade

**Como customizar pro cliente:**
Via `configure-theme` skill, ou editando `settings_data.json` direto.

### 3. Parcelamento e Pix

**Schema:** [config/settings_schema.json:1840-1950](lever-br/config/settings_schema.json) (seção `Parcelamento e Pix`)
**Render:** [snippets/price.liquid](lever-br/snippets/price.liquid), `product-installments.liquid`

- `installment_enabled` (bool, default true)
- `installment_max` (range 1-12, default 12)
- `pix_discount_enabled` (bool)
- `pix_discount` (range 0-50%, default 3)
- `rate_1` a `rate_12` (text) — taxa de juros por parcela

**Uso:** calcula automaticamente "em até 12x R$XX/mês" e "ou R$XX no Pix (3% off)" na página de produto.

### 4. Selos Personalizados (até 5)

**Schema:** [config/settings_schema.json:1952+](lever-br/config/settings_schema.json)

Cada selo (1-5) tem:
- `custom_badge_N_enabled` (bool)
- `custom_badge_N_condition` (select: tag | title)
- `custom_badge_N_value` (text) — o valor (ex: "lancamento", "flamengo")
- `custom_badge_N_text` (text) — label do selo (ex: "NOVIDADE")
- `custom_badge_N_bg_color` + `custom_badge_N_text_color`

**Lógica:** se produto tem a tag ou título contém o value, o selo aparece. Implementado em `snippets/card-product.liquid` e `snippets/scarcity-badge.liquid`.

### 5. Configuradores Custom (Patch / Player / Shop-the-Look)

**Seções de regras** (editáveis no customizer):
- [sections/custom-patch-rules.liquid](lever-br/sections/custom-patch-rules.liquid) — define quais patches estão disponíveis (Champions, Libertadores, etc) e preços
- [sections/custom-player-rules.liquid](lever-br/sections/custom-player-rules.liquid) — regras de personalização nome+número
- [sections/custom-shop-the-look-rules.liquid](lever-br/sections/custom-shop-the-look-rules.liquid) — configurador combinar produtos

**Snippets de renderização:**
- [snippets/patch-selector-block.liquid](lever-br/snippets/patch-selector-block.liquid) — UI de seleção
- [snippets/patch-styles.liquid](lever-br/snippets/patch-styles.liquid) — estilos
- [snippets/customization-inputs.liquid](lever-br/snippets/customization-inputs.liquid) — inputs nome/número

**Integração:** Os valores selecionados viram `properties[_patch]`, `properties[_player_name]`, `properties[_player_number]` no carrinho, e somam preço no `buy-buttons.liquid`.

### 6. Coleção Tabs na Home (logos de times)

**Section:** [sections/collection-list-tabs.liquid](lever-br/sections/collection-list-tabs.liquid)

**Funcionamento:** case statement gigante que mapeia `handle da coleção → URL do logo`. Usado na home pra mostrar tabs de times.

**Quando precisa editar:** Quando adicionar um time novo cujo handle ainda não tá mapeado (mostra foto do produto em vez do logo).

Exemplo de adição:
```liquid
{% case block.settings.collection.handle %}
  {% when 'brasileirao' %}
    {% assign custom_team_image = 'https://cdn.../logos/brasileirao.png' %}
  {% when 'flamengo' or 'cr-flamengo' %}
    {% assign custom_team_image = 'https://cdn.../logos/flamengo.png' %}
  {% ... %}
{% endcase %}
```

**CDN dos logos:** `https://pub-741e79c7a4b84c228594bbc296d1fbdd.r2.dev/Site%20Lever/Logos%20Clubes/`

### 7. Tabs de Jogadores

**Section:** [sections/collection-player-tabs.liquid](lever-br/sections/collection-player-tabs.liquid)

Mesmo padrão, mas com fotos de jogadores (Neymar, CR7, Messi, Vini Jr, etc).

### 8. Tabs Masculino/Feminino/Infantil (home)

**Section:** [sections/featured-collection-tabs.liquid](lever-br/sections/featured-collection-tabs.liquid)

Home tem 3 tabs que apontam pra coleções específicas:
- **Masculino** → `MASCULINO BRASIL` (ou equivalente)
- **Feminino** → `FEMININA BRASIL`
- **Infantil** → `INFANTIL BRASIL`

**Nota importante:** essas coleções são smart collections com regras que precisam usar **partial matches** (`femin` em vez de `feminina`) pra resistir a typos — ver [.claude/lib/shopify-pricing.mjs](../.claude/lib/shopify-pricing.mjs) e memória `feedback_smart_collection_rules.md`.

---

## 🛒 Carrinho (Cart) — Diferenças BR vs EN

Esta é a **diferença estrutural mais importante** entre os 2 temas.

### BR (testeloja-9899)

- **Checkout nativo Shopify DESATIVADO** quando `YampiSnippet` ou `cartxCheckoutSnippet` estão ativos
- **Yampi Checkout** ([snippets/YampiSnippet.liquid](lever-br/snippets/YampiSnippet.liquid)):
  - Injetado no `cart` template via include
  - Intercepta o botão "Finalizar Compra"
  - Posta cart payload pra `api.dooki.com.br/v2/public/shopify/cart`
  - Redireciona pro checkout do Yampi
- **CartPanda Checkout** ([snippets/cartxCheckoutSnippet.liquid](lever-br/snippets/cartxCheckoutSnippet.liquid)):
  - Fluxo similar, endpoint diferente
  - Usado em clientes que preferem CartPanda
- **Progress Bar** no carrinho (milestones) — posição: **dentro do cart-drawer**
- **Shipping Calculator** no `main-cart-footer.liquid` — opções em português

### EN (loja-de-estruturacao-...-en)

- **Checkout nativo Shopify** (loja EN vende internacional, Shopify Payments)
- **Sem Yampi/CartPanda**
- **Progress Bar** — posição pode estar em outro lugar (verificar após EN pull completar)
- **Shipping Calculator** — opções em inglês, sem frete nacional

### Como integrar Yampi/CartPanda num cliente

1. Copiar `snippets/YampiSnippet.liquid` ou `cartxCheckoutSnippet.liquid` do BR
2. Incluir no cart template: `{% render 'YampiSnippet' %}` no `main-cart-footer.liquid` ou `cart.json`
3. Validar endpoint + credenciais da Yampi/CartPanda da loja
4. Testar: adicionar produto → clicar checkout → deve redirecionar

Skill dedicada: [`/yampi-checkout`](../.claude/skills/yampi-checkout/SKILL.md) (checar se existe e está atualizada).

---

## 🌍 i18n — Diferenças BR vs EN

- **BR** usa `pt-BR.json` como idioma principal (arquivo `pt-BR.default.json` seria o formato oficial, mas algumas lojas usam `pt-BR.json` sem `.default`)
- **EN** usa `en.default.json`
- Os 50+ outros locales (`de.json`, `fr.json`, `ja.json`, etc) vêm do Dawn base — **não usamos na prática**. Poderíamos deletar pra reduzir tamanho do tema, mas não é prioridade.
- `schema.json` locales (ex: `pt-BR.schema.json`) são usados pelo customizer pra traduzir labels dos campos

**Como customizar tradução:**
Editar direto o arquivo `locales/pt-BR.json` (BR) ou `locales/en.default.json` (EN). A estrutura segue Dawn: nested object por seção.

---

## 📄 Templates per-team

Templates JSON customizados pra coleções específicas. Exemplo:

- `templates/collection.flamengo.json`
- `templates/collection.corinthians.json`
- `templates/collection.atletico-mg.json`
- `templates/collection.feminino.json`

**Como funciona:** Shopify permite criar templates alternativos pra um resource. O handle do template (ex: `flamengo`) é escolhido no admin Shopify: `Collections → Flamengo → Theme templates → Collection > Flamengo`.

**Quando criar um novo:** Se um cliente quer layout diferenciado pra uma coleção específica (ex: Flamengo com banner exclusivo + hero, diferente do default).

**⚠️ Nunca sobrescrever no propagate:** Templates per-team são **customizações do cliente**. A allowlist de `/lever-theme propagate` exclui `templates/*.json`.

---

## 🔑 Arquivos-chave por tipo de edição

| O que você quer mudar | Arquivo(s) |
|---|---|
| Cores globais | `config/settings_data.json` (current.color_schemes) |
| Logo | `config/settings_data.json` (settings.logo) |
| Telefone/email suporte | `sections/header-group.json` (header.settings.support_phone, support_email) |
| Announcement bar (texto rotatório) | `sections/header-group.json` (announcement-bar.blocks) |
| Milestones (quantidade + mensagens) | `config/settings_data.json` (current.milestone_1_quantity, etc) ou via Customizer |
| Frete grátis (valor e mensagens) | `templates/cart.json` (cart-footer.blocks.shipping_calculator.settings) |
| Parcelamento (max + juros) | `config/settings_data.json` (current.installment_max, rate_X) |
| Pix (desconto) | `config/settings_data.json` (current.pix_discount) |
| Selos personalizados | `config/settings_data.json` (current.custom_badge_1_*, etc) |
| Adicionar logo de time (home tabs) | `sections/collection-list-tabs.liquid` (case statement) |
| Adicionar jogador (player tabs) | `sections/collection-player-tabs.liquid` |
| Customizar coleção específica | Criar `templates/collection.<handle>.json` |
| Regras de patches (configurador) | `sections/custom-patch-rules.liquid` |
| Regras de personalização (nome/num) | `sections/custom-player-rules.liquid` |
| Ativar Yampi/CartPanda | `snippets/YampiSnippet.liquid` + include no cart template |
| Traduções BR | `locales/pt-BR.json` |
| Traduções EN | `locales/en.default.json` |
| CSS de componentes | `assets/component-*.css` |
| CSS da página de produto | `assets/section-main-product.css` |
| JS do carrinho | `assets/cart-drawer.js`, `cart.js`, `cart-progress-bar.js` |

---

## 🔄 BR vs EN — Principais divergências conhecidas

(Esta seção deve ser mantida atualizada a cada edição. Use `/lever-theme diff-br-en` pra detectar drift automaticamente.)

| Aspecto | BR | EN |
|---|---|---|
| Checkout | Yampi ou CartPanda (via snippet) | Nativo Shopify |
| Idioma padrão | pt-BR | en.default |
| Frete no carrinho | Opções em pt-BR ("Frete Grátis 7-15 dias") | Opções em en-US ("Standard Shipping") |
| Progress bar (milestones) | Dentro do cart-drawer | (verificar posição após pull EN) |
| Parcelamento Pix | Ativo por padrão | Desativado (não faz sentido fora do BR) |
| Custom badges | Podem referenciar produtos BR (Flamengo, Corinthians) | Referenciam times internacionais |
| Collection templates | collection.flamengo, atletico-mg, corinthians | (provavelmente outros ou nenhum) |

**⚠️ Drift conhecido:** User mencionou melhorias feitas no BR que não foram portadas pro EN. A skill `/lever-theme diff-br-en` vai detectar isso automaticamente e gerar relatório.

---

## 🛠️ Guia rápido de edição

### Adicionar logo de time novo
1. Identificar handle da coleção (ex: `santos`)
2. Editar `themes/lever-br/sections/collection-list-tabs.liquid`
3. Adicionar `when 'santos'` com URL do logo no CDN
4. `/lever-theme push-dev br`
5. Testar na testeloja
6. `/lever-theme propagate <cliente>` (ou vários)

### Corrigir bug em snippet compartilhado
1. `/lever-theme pull br` (sincroniza cópia local)
2. Editar snippet
3. `/lever-theme dev br` (preview local)
4. `/lever-theme push-dev br`
5. `/lever-theme diff <cliente>` pra validar
6. `/lever-theme propagate <cliente>`

### Adicionar seção nova (ex: slideshow com vídeo)
1. Copiar snippet+CSS+JS do Dawn ou criar do zero
2. Adicionar em `sections/`
3. Registrar no customizer via settings_schema
4. Testar no dev
5. Propagar

### Traduzir um texto
1. Achar a chave em `locales/pt-BR.json` (ex: `products.product.add_to_cart`)
2. Editar valor
3. Push dev
4. Se for pra EN também, editar `locales/en.default.json` separadamente

---

## 📊 Metadados

| | |
|---|---|
| Base | Dawn 15.4.1 (Shopify) |
| Customizações Lever | Licença, milestones, patches, player config, Yampi/CartPanda, selos |
| Total de arquivos | ~408 (BR) / ~408 (EN, pendente pull) |
| Schema size | 2203 linhas |
| Main product template size | 1309 linhas |
| Customizer sections | 25+ seções |
| Locales suportados | 50+ (só usamos pt-BR + en.default) |

---

## 🔗 Ver também

- [.claude/skills/lever-theme/SKILL.md](../.claude/skills/lever-theme/SKILL.md) — comandos da skill
- [.claude/skills/configure-theme/SKILL.md](../.claude/skills/configure-theme/SKILL.md) — automação de settings via briefing
- [themes/README.md](README.md) — workflow + allowlist
- [supabase/functions/store-deployment/index.ts](../supabase/functions/store-deployment/index.ts) — pipeline de deploy (theme_assets step)

---

_Última atualização: 2026-04-10 — gerada automaticamente a partir do pull `themes/lever-br`._
