---
name: clone-theme
description: Clona o tema visual de qualquer loja (Shopify, Woo, custom, qualquer plataforma) a partir de uma URL e sobe como tema novo (unpublished) numa loja Shopify que temos acesso. Fork do Dawn como base, conversão HTML→Liquid feita pelo Claude in-conversation (custo zero — não usa API externa). Skill colaborativa, segue os 4 Blocos e Pair Programming do JEB.
argument-hint: <url> --to "<cliente>" --name "<nome do tema>" [--scope minimal|full] [--preview offline|shop|none] [--apply]
---

# Clone Theme — Clonar Tema de Qualquer Loja

Pega design + layout de uma loja-alvo (qualquer plataforma — Shopify, WooCommerce, Wix, Squarespace, custom Next.js, etc.) e gera um tema Shopify novo (fork do Dawn) pra subir como **unpublished** numa loja Shopify que temos conexão via OAuth.

**Foco:** tema, design system e layout. NÃO migra produtos (use `import-missing` ou `deploy-store` pra isso depois).

---

## Princípios JEB aplicados

Esta skill é desenhada em cima das skills do `[[JEB]]` (vault Obsidian em `C:\Users\Cliente\Obsidian-juvito`). Quem rodar a skill (ou eu, quando entrar no passo 7) precisa estar familiarizado com:

- `[[Conceitos/4 Blocos da Comunicação]]` — o "convert plan" do passo 7 segue O QUÊ / O COMO / O QUE NÃO QUERO / COMO VALIDAR
- `[[Conceitos/Pair Programming com Agente]]` — humano navega, skill pilota. Tabela explícita abaixo
- `[[Conceitos/Pré-Execução - Perguntas Obrigatórias]]` — 3 perguntas com hipótese antes de gastar trabalho pesado
- `[[Conceitos/Idempotência por Padrão]]` — re-rodar mesma URL nunca duplica tema nem retrabalha sem necessidade
- `[[Conceitos/Confirmação Múltipla]]` — 3 evidências independentes antes de declarar "pronto pra subir"
- `[[Conceitos/Anti-padrões]]` — esta skill evita ativamente #3 (prescrever solução linha-por-linha), #4 (confiar na IA pra refatorar sozinha), #5 (IA nunca diz "não" — skill PARA quando detecta fonte paga/imagem copyright)

Se algum desses links não bate com nota existente, abrir o vault e conferir antes de prosseguir.

---

## Custo: $0

| Passo | Como roda | Custo |
|---|---|---|
| Scrape de HTML/CSS/assets | Playwright headless local | $0 (Chromium baixa 1x, ~200MB) |
| Extração de design system | `postcss` (já no projeto) | $0 |
| Base do tema | Fork do Dawn (git clone do repo público, cacheado em `~/.claude-cache/dawn`) | $0 |
| **Conversão HTML→Liquid** | **Claude in-conversation** (esta sessão, usando plano Claude Code que você já paga) | **$0** |
| Validation | `shopify theme check` (CLI já instalada) | $0 |
| Upload | Asset API REST + `getCreds` (já temos OAuth) | $0 |

A skill **pausa no passo 7 (conversão)** e me invoca aqui no chat pra eu ler o material raw e gerar os `.liquid` inline via Write. Sem chamada de API externa. Trade-off: skill não roda autônoma em background — precisa da minha presença na sessão (= `[[Pair Programming com Agente]]` real).

---

## Divisão de papéis (Pair)

Aplicação direta de `[[Conceitos/Pair Programming com Agente]]` — humano traz O QUÊ, agente traz O COMO.

| Etapa | Humano (navega) | Skill/Claude (pilota) |
|---|---|---|
| 1. Definir clone | URL-alvo, loja-destino, nome do tema, escopo | — |
| 2. Pré-execução | Responde 3 perguntas estruturadas | Faz as perguntas com hipótese embutida |
| 3. Discover | — | Lista URLs, classifica páginas |
| 4. Confirmar escopo | Aprova/ajusta sample de URLs | Mostra preview do escopo |
| 5. Scrape + tokens | — | Roda Playwright, extrai tokens, baixa assets |
| 6. Flags de licença | Decide se substitui ou usa fonte paga / imagem copyright | Detecta e PARA pra perguntar (anti-padrão #5) |
| 7. Conversão Liquid | — | Claude in-conversation gera sections/templates |
| 8. Validação | Verifica preview local visualmente (diff humano) | Roda theme check + sanity |
| 9. Confirmar upload | "Sobe pra cliente Z?" → y/n | Pergunta antes do PUT |
| 10. Upload | Aprova publicação no Theme Editor (depois) | Sobe como `unpublished`, retorna preview URL |

**Regra de ouro:** publicação final no Theme Editor é sempre humana. Skill jamais publica.

---

## Pré-Execução — perguntas obrigatórias

Aplicação de `[[Conceitos/Pré-Execução - Perguntas Obrigatórias]]`. Skill faz **3 perguntas com hipótese embutida + opções concretas**, não vagas. Bloqueia até resposta.

### Pergunta 1 — Escopo (cobre Bloco 1 dos 4 Blocos)

```
Vou clonar https://exemplo.com pra "Cliente Z" como tema "Tema Exemplo".
Escopo proposto: [a] full (~15 páginas, ~5min scrape)

Confirma?
 [a] full — home + 2 PDPs + 2 PLPs + cart + 5 pages + blog + 404
 [b] minimal — home + 1 PDP + 1 PLP + cart + 3 pages (~3min)
 [c] custom — você lista URLs específicas
```

### Pergunta 2 — Substituições preventivas (cobre Bloco 3)

```
Antes de scrape, declare upfront pra evitar rework:
 - Fontes pagas detectadas → substituir por Geist (recomendo)? [s/n]
 - Imagens com copyright óbvio (marca registrada, foto de produto sem autorização)
   → flagar e parar pra você revisar manualmente? [s/n]
 - Animações JS complexas (GSAP/Lottie) → converter pra CSS simples? [s/n]
```

### Pergunta 3 — Critério de pronto (cobre Bloco 4)

```
Como sei que terminei?
 [a] theme check 0 errors + preview local visual ok (default)
 [b] acima + diff visual automático (screenshot tema clonado vs alvo)
 [c] acima + você passa o link do preview pra 1 pessoa externa testar
```

**Se a skill não pode fazer as 3 perguntas** (ex: rodando em background, sem TTY), aborta com mensagem de erro pedindo flags explícitas: `--scope full --substitute-paid-fonts --flag-copyright --no-js-animations --gate=preview`.

---

## Comando

```
/clone-theme <url> --to "<cliente>" --name "<nome do tema>"
  [--scope minimal|full]           # default: full
  [--dawn-version main]            # default: main do repo Shopify/dawn
  [--no-fonts]                     # pula download de fontes (usa fallback)
  [--no-images]                    # pula download de imagens do alvo
  [--preview offline|shop|none]    # default: offline — Liquid renderizado local + side-by-side com alvo
  [--apply]                        # confirma upload — sem isso, para no preview
  [--force]                        # ignora workspace existente (re-scrapa, re-converte)
```

**Modos de preview (passo 9):**

- `offline` (default) — **não precisa de loja Shopify nem de Shopify CLI logado.** Renderiza cada `.liquid` localmente usando `liquidjs` + mock data (produtos/coleções/cart fake). Gera `_preview/*.html` estáticos, serve em `localhost:4173`, abre browser numa página `index.html` com **comparação lado-a-lado**: render do clone à esquerda, screenshot do alvo à direita, paleta + fontes + tokens visualizados.
- `shop` — usa `shopify theme dev` apontando pra loja-alvo. Mais fiel (dados reais), mas precisa da loja já estar conectada e CLI logado.
- `none` — pula preview, vai direto pro gate de upload (só faz sentido se você confia no scrape, ex: re-run de algo já validado).

---

## ⚠️ Responsabilidade de uso

Skill é ferramenta neutra. Casos legítimos: migrar próprio site pra Shopify, replicar tema antigo da marca, refazer landing institucional como Shopify, prototipar. Clone fiel de concorrente envolve risco de IP/copyright (trade dress, imagens autorais, fontes licenciadas).

A skill **avisa e PARA** (não bloqueia, mas força decisão consciente — combate ao anti-padrão #5 "IA nunca diz não") quando detecta:
- Fontes pagas (Adobe Fonts, Monotype, Typekit)
- Imagens com `copyright` em metadados EXIF
- Logos com marca registrada visível (heurística por OCR opcional)

Responsabilidade de uso final é de quem aciona.

---

## Pipeline (10 passos)

```
1. Validate
   - Cliente existe em agency_clients, shopify_status='connected'
   - URL acessível (HEAD request com User-Agent realista)
   - Nome do tema único na loja-alvo (GET /themes.json)
   - Workspace local themes/clones/<nome>/ inspecionado:
       * Não existe → cria
       * Existe + --force → confirma deleção, recria
       * Existe sem --force → reaproveita (idempotência)

2. Pré-execução
   - As 3 perguntas estruturadas acima. Bloqueia até resposta.

3. Discover
   - Playwright abre URL, espera networkidle
   - Coleta todos <a href> da home + 1 nível de profundidade
   - Classifica por padrões de URL:
       * /products/*, /produto/*, /shop/* → PDP
       * /collections/*, /categoria/*, /shop → PLP
       * /cart, /carrinho → cart
       * /about, /sobre, /faq, /contact → page
       * /blog/*, /news/* → blog
   - Mostra preview do escopo (lista de URLs picked) e ESPERA confirmação humana
   → discovery.json

4. Scrape (Playwright, paralelo)
   - Pra cada URL-alvo:
       * goto + waitForLoadState('networkidle')
       * page.content() → HTML pós-render
       * page.screenshot({fullPage: true}) → PNG
       * Coleta computed CSS via getComputedStyle no <html>, <body>, e elementos chave
       * Lista URLs externos: imagens, fontes (@font-face), ícones
   - Idempotente: se themes/clones/<nome>/_raw/<page-type>/ já existe e tem mtime < 24h, pula

5. Asset download
   - Imagens: fetch + sharp pra otimizar + salva em assets/ com hash no nome (dedupe natural)
   - Fontes:
       * fonts.googleapis.com / fonts.gstatic.com → free, baixa
       * use.typekit.net / use.fontawesome.com / fonts.adobe.com → PAGA, PARA e pergunta
       * Self-hosted → baixa, mas avisa que verifique licença
   - Ícones inline SVG → snippets/icon-*.liquid (mesmo padrão do tema Lever)
   - Imagens com EXIF Copyright → FLAGA e pede confirmação

6. Design system extraction
   - postcss parse de todos CSS coletados
   - Extrai cores únicas (filtra repetições, agrupa por luminosidade), font-stack, type scale, spacing scale, border-radius, breakpoints
   - Claude in-conversation refina e categoriza → tokens.json
   - tokens.json vira:
       * CSS variables em assets/base.css
       * Settings em config/settings_schema.json (editáveis no Theme Editor)

7. Liquid conversion ← PAUSA, Claude in-conversation entra
   Ver seção "Convert Plan estruturado" abaixo.

8. Validate (Confirmação Múltipla)
   Ver seção "Confirmação Múltipla" abaixo. Precisa 3 evidências independentes.

9. Preview (default: --preview offline, ver seção dedicada abaixo)
   - offline → renderiza Liquid local com liquidjs + mock data,
     gera _preview/*.html, serve em localhost:4173,
     abre índice com comparação side-by-side vs screenshots do alvo
   - shop → npx shopify theme dev --path=themes/clones/<nome>/ --store=<shop>
   - none → pula
   - Em offline e shop, skill espera enter do humano antes do passo 10

10. Upload (só com --apply)
    - Idempotente: GET /themes.json → se nome já existe, pergunta (sobrescrever / criar com sufixo / abortar)
    - POST /admin/api/2024-01/themes.json
        body: { theme: { name: "<nome>", role: "unpublished" } }
        → retorna theme_id
    - PUT cada arquivo via /themes/{id}/assets.json (delay 400ms, retry com backoff)
        Reusa lógica do theme-push.mjs (binário vs texto, retry)
    - Retorna preview URL: https://<shop>?preview_theme_id={theme_id}
    - Log em execution.jsonl: { skill: 'clone-theme', source_url, target_client, theme_id, files, duration, evidence: {...} }
```

---

## Convert Plan estruturado (passo 7) — segue os 4 Blocos

Quando a skill chega no passo 7, ela imprime o "convert plan" segundo `[[Conceitos/4 Blocos da Comunicação]]`. Eu (Claude in-conversation) entro como par e executo:

### Bloco 1 — O QUÊ

> Converter HTML pós-render do site-alvo em sections/templates Liquid funcionais sobre o fork do Dawn, mantendo fidelidade visual ao alvo e usando os design tokens extraídos.

**Output esperado:**
```
sections/clone-hero.liquid          (com schema editável)
sections/clone-features.liquid      (com schema editável)
sections/clone-product-main.liquid  (sobrescreve main-product.liquid do Dawn)
sections/clone-collection-grid.liquid
templates/index.json
templates/product.json
templates/collection.json
templates/cart.json
layout/theme.liquid                 (ajustes mínimos)
assets/clone-base.css               (CSS vars do tokens.json + estilos do alvo)
```

### Bloco 2 — O COMO (em traços largos, espaço pra eu propor melhor)

**Insumos disponíveis:**
- `themes/clones/<nome>/_raw/<page>/index.html` (HTML pós-render)
- `themes/clones/<nome>/_raw/<page>/screenshot.png` (full-page)
- `themes/clones/<nome>/_design/tokens.json` (cores, fontes, spacing, breakpoints)
- `~/.claude-cache/dawn/` (Dawn como referência de patterns Liquid corretos)

**Abordagem livre — eu escolho:**
- Reuse sections do Dawn quando layout/comportamento bate (header, footer, predictive-search)
- Crie sections `clone-*` quando layout do alvo é distintivo
- Mapeie texto estático → Liquid objects (`product.title`, `cart.item_count`, `section.settings.*`)
- Blocos repetidos → schema `blocks` com type variável

### Bloco 3 — O QUE NÃO QUERO ⚠️ (o bloco mais importante)

- **Nunca** copie HTML do alvo com `<script>` inline → Shopify CSP bloqueia, e checkout quebra
- **Nunca** use cor hex literal nas sections → sempre `var(--color-X)` puxando de settings
- **Nunca** referencie fonte por nome direto em CSS → usar `{{ settings.type_body_font | font_face }}`
- **Nunca** hardcode texto em pt-BR/en-US — sempre `{{ 'key' | t }}` apontando pra locales/
- **Nunca** crie section sem schema (vira "unconfigurable" no Theme Editor)
- **Nunca** sobrescreva `templates/customers/*.json` do Dawn — deixa Dawn padrão (login/register exigem comportamento Shopify específico)
- **Nunca** mexa em `layout/checkout.liquid` (legado, deprecated, Shopify gerencia checkout fora do tema)
- **Nunca** crie `assets/*.js` inline com lógica complexa — Dawn tem sistema de modules, reuse
- **Nunca** baixe ou referencie fonte de `use.typekit.net` no CSS final — substitua por fallback livre declarado em tokens.json
- **Nunca** invente Liquid objects que não existem (`{{ product.custom_field }}` não vai render — usa `{{ product.metafields.* }}` corretamente ou cai pra setting)
- **Nunca** assuma que a loja-alvo tem produto/coleção/cliente — sempre use guards `{% if product %}` ou Dawn snippets de fallback
- **Não tente clone pixel-perfect de animações JS** — converte pra CSS transition simples, marca TODO no comment

### Bloco 4 — COMO VALIDAR

Aplicação de `[[Conceitos/Confirmação Múltipla]]` — **3 evidências independentes**, não basta uma:

1. **Evidência 1 (estática):** `npx shopify theme check themes/clones/<nome>/` retorna **0 errors** (warnings ok)
2. **Evidência 2 (sintaxe):** Sanity custom — todos `{% render 'X' %}` referenciam snippet existente, todos section types em templates/*.json existem em sections/, settings_schema.json é JSON válido, sem `<script>` inline
3. **Evidência 3 (visual):** Preview local em localhost:9292 — humano confirma que home + PDP + PLP renderizam sem erro de runtime Liquid e bate visualmente com screenshot do alvo

Sem as 3 evidências, skill NÃO segue pro upload. Diferença de fontes evita o falso positivo do "shopify theme check passa mas tema visualmente quebrado" ou "renderiza mas template referencia section órfã".

---

## Idempotência (`[[Conceitos/Idempotência por Padrão]]`)

Re-rodar `/clone-theme` com mesmos args **nunca** duplica trabalho nem cria temas duplicados.

| Recurso | Mecanismo de idempotência |
|---|---|
| Workspace local `themes/clones/<nome>/` | Existe + sem --force → reaproveita raws e tokens. Re-executa só os passos posteriores. |
| `_raw/<page>/` | mtime < 24h → pula scrape. Re-scrape com --force ou se mtime > 24h. |
| Dawn fork | git pull no `~/.claude-cache/dawn` (idempotente por design git) |
| Asset download | Hash no nome (`hero-a3f9c.jpg`) → mesmo asset não baixa 2x |
| Theme upload | GET /themes.json antes do POST → se nome existe, pergunta (sobrescrever / sufixo / abortar). Asset API PUT é naturalmente idempotente |
| Log `execution.jsonl` | Sempre append, never overwrite |

Re-rodar é seguro. Skill é "resumable" — se cai no passo 7, retomar do raw já scraped não custa scrape de novo.

---

## Preview Offline (sem Shopify) — passo 9, default

**Objetivo:** ver o clone renderizado e apresentável **sem precisar de loja Shopify nem do CLI logado**. Roda 100% local.

### Como funciona

```
themes/clones/<nome>/_preview/
├── index.html                ← dashboard de comparação
├── home.html                 ← Liquid renderizado da home
├── product.html              ← PDP renderizada com mock product
├── collection.html           ← PLP com mock collection
├── cart.html                 ← cart com 2 items mock
├── pages/sobre.html          ← page renderizada
├── _mock/
│   ├── product.json          ← 3 produtos mock (com variantes, imgs, preços)
│   ├── collection.json       ← 1 coleção mock c/ 12 products
│   ├── cart.json             ← 2 line_items
│   ├── shop.json             ← shop object (name, domain, currency BRL)
│   └── customer.json         ← customer logged out mock
└── _assets/                  ← copy de themes/clones/<nome>/assets/
```

### Stack do renderizador (zero custo, tudo local)

- `liquidjs` (npm, MIT) — render engine Liquid compatível com Shopify
- `themes/clones/<nome>/_preview/_mock/*.json` — dados fake mas realistas (gerados uma vez, reusáveis)
- `npx serve _preview/` — servidor estático em `localhost:4173`

### `index.html` — dashboard de apresentação

Página de entrada do preview. Layout:

```
┌─────────────────────────────────────────────────────┐
│ Clone Theme — <nome>                                │
│ Source: <url-alvo> · Generated: <data>              │
├─────────────────────────────────────────────────────┤
│ DESIGN SYSTEM                                       │
│ Paleta: ● ● ● ● ● ● ● ●  (8 cores)                  │
│ Fontes: Heading: Geist  ·  Body: Inter              │
│ Type scale: 12 · 14 · 16 · 18 · 24 · 32 · 48        │
├─────────────────────────────────────────────────────┤
│ PÁGINAS                                             │
│ ┌────────────┬────────────┬────────────┐            │
│ │ Home       │ PDP        │ PLP        │ ...        │
│ │ [render]   │ [render]   │ [render]   │            │
│ │ [target]   │ [target]   │ [target]   │            │
│ │ ✓ ok       │ ⚠ 2 diffs  │ ✓ ok       │            │
│ └────────────┴────────────┴────────────┘            │
├─────────────────────────────────────────────────────┤
│ VALIDAÇÃO (3 evidências)                            │
│ ✓ theme check: 0 errors, 3 warnings                 │
│ ✓ sanity: schema válido, 0 refs órfãs               │
│ ⏳ visual: aguardando review humano                  │
└─────────────────────────────────────────────────────┘
```

Cada card de página abre um modal/route com **iframe split**: render do clone (esquerda) + screenshot full-page do alvo (direita). Scroll sincronizado.

### Compartilhar o preview

Como `_preview/` é HTML/CSS/JS estático (sem backend), você consegue:

- **Zipar** `_preview/` e mandar pra alguém revisar
- **Subir num bucket Supabase Storage** público temporário → link público (opcional, via flag `--share`)
- **Deploy em Vercel/Netlify drop** se quiser link permanente
- **Capturar PDF** via `npx puppeteer-pdf _preview/index.html` (opcional)

### Limitações do preview offline (vs preview shop)

| Item | Offline (mock) | Shop (`shopify theme dev`) |
|---|---|---|
| Custo | $0 | $0 mas precisa CLI auth |
| Dados | Mock fixo | Reais da loja-alvo |
| Variantes | 3 fakes | Catálogo real |
| Checkout | Stub (não funciona) | Stub (não funciona) |
| Cart drawer JS | Roda | Roda |
| `{{ shop.* }}` | Mock | Real |
| `{{ settings.* }}` | Default schema | Real do shop |
| Apresentar pra terceiros | ✓ HTML estático compartilhável | ✗ precisa CLI rodando |

Recomendação: **`offline` pra apresentação e iteração**, **`shop` pro QA final antes de upload**.

---

## Pré-requisitos

1. **Playwright** instalado (1x):
   ```bash
   npm install --save-dev playwright
   npx playwright install chromium
   ```

2. **liquidjs** (pra preview offline):
   ```bash
   npm install --save-dev liquidjs
   ```

3. **`serve`** (servidor estático pro preview, leve, já cacheado em npx):
   ```bash
   npx serve --version   # baixa 1x, depois é instantâneo
   ```

4. **Shopify CLI** já instalada (`@shopify/cli` ^3.93.2 no devDeps) ✓

5. **postcss** já instalado ✓

6. **Variáveis de ambiente** em .env:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (pra `getCreds` resolver token OAuth do cliente — usado só no upload, passo 10)

7. **Pastas:**
   - `themes/clones/` (adicionar em .gitignore)
   - `~/.claude-cache/dawn/` (criada automaticamente no 1º run)

---

## Estrutura de arquivos gerados

```
themes/clones/<nome>/
├── _raw/                    ← scrape bruto, gitignored, usado pela conversão
│   ├── home/{index.html, screenshot.png, page.css}
│   ├── product/...
│   └── ...
├── _design/
│   ├── tokens.json
│   ├── fonts-report.md      ← licenças detectadas, substituições aplicadas
│   ├── assets-report.md     ← imagens baixadas, flags de copyright
│   └── evidence.json        ← snapshot das 3 evidências de validação
├── _preview/                ← renderização offline (passo 9), apresentável sem Shopify
│   ├── index.html           ← dashboard de comparação side-by-side
│   ├── home.html, product.html, collection.html, cart.html, ...
│   ├── _mock/*.json         ← mock data (product, collection, cart, shop, customer)
│   └── _assets/             ← copy de ../assets/ pra servir como static
├── assets/                  ← Dawn + assets do alvo
├── config/
├── layout/theme.liquid
├── locales/
├── sections/
│   ├── clone-*.liquid       ← sections novas geradas pela conversão
│   └── ...                  ← Dawn default ou sobrescritas
├── snippets/
└── templates/
```

---

## Limitações conhecidas (honestidade > overselling — `[[Anti-padrões]]` #5)

| Limitação | Por quê | Workaround |
|---|---|---|
| Animações JS complexas (GSAP, Lottie, Three.js) | Scrape pega DOM final, não recria comportamento | Vira CSS transition simples ou stub estático (marca TODO em comment) |
| Checkout customizado | Shopify checkout é fixo (Checkout Extensibility é limitado) | Só blocks permitidos; layout principal não muda |
| Variantes/options exóticas (swatch custom, builder, configurador) | Dawn usa picker padrão | Pode requerer section custom depois — fora do escopo desta skill |
| Fontes pagas | Não pode redistribuir | Skill substitui por fallback livre + flagra no report |
| Imagens com copyright | Sem licença pra usar | Skill flagra, PARA, pede decisão humana |
| Forms com backend custom | Backend não é nosso | Vira form Shopify (Customer/contact) ou stub |
| Mega menus com lógica JS | Complexo demais pra converter 1:1 | Gera versão Dawn-style simplificada, refina manual |
| Qualidade vs complexidade | Site Tailwind clean: 80% pronto. Site legacy WordPress: 40-50% | Mais ajuste manual depois — esperado, não bug |

---

## Anti-genericidade — caso de uso real (Lucky Fours)

Aplicação da regra 3.6 do `[[CLAUDE]]` do JEB. Exemplo real, não hipotético.

**Caso:** o próprio Juvito tem o projeto `[[Lucky Fours]]` (`luckyfours.com`), que hoje roda fora de Shopify. Hipótese: migrar pra Shopify mantendo identidade visual já consolidada (paleta, tipografia, layout das pages-chave) sem refazer manualmente do zero.

```
/clone-theme https://luckyfours.com --to "Lucky Fours" --name "Tema Lucky Fours" --preview offline
```

Fluxo esperado (~12 min total + ~5 min eu in-conversation):

1. Pré-execução pergunta escopo, substituições preventivas, critério de pronto
2. Discover: lista URLs do luckyfours.com, classifica em home/PDP/PLP/cart/pages
3. Scrape: HTML pós-render + screenshots + CSS computed → `_raw/`
4. Tokens: paleta extraída do CSS, fontes detectadas, type/spacing scale → `_design/tokens.json`
5. Dawn fork → `themes/clones/tema-lucky-fours/`
6. Convert plan estruturado (4 Blocos) → eu gero sections `clone-*` e templates
7. Theme check + sanity (Confirmação Múltipla evidências 1 e 2)
8. **Preview offline:** `_preview/index.html` aberto em `localhost:4173` com side-by-side render-vs-alvo (evidência 3 = revisão humana)
9. Se ok: skill pergunta sobre upload. Sem `--apply`, para aqui — o `_preview/` já é a entrega apresentável

**O ganho real:** ao fim, você (ou quem revisar) abre o `_preview/index.html` e vê o tema clonado renderizado lado-a-lado com o `luckyfours.com` original, **sem Shopify envolvido**. Apresentação direta. Decide se vale subir, refinar, ou descartar.

Esse é o teste de fogo da skill — se rodar em Lucky Fours não chegar perto do original visualmente, o pipeline tá quebrado e a skill precisa retrabalho antes de ser usada em cliente real.

---

## Como Claude entra no fluxo (passo 7)

Quando a skill chega no passo 7, ela:

1. Imprime o convert plan estruturado (Bloco 1+2+3+4 acima)
2. Para a execução e retorna controle pro chat
3. **Eu (Claude in-conversation)** então:
   - Leio `themes/clones/<nome>/_raw/<page>/index.html` + `screenshot.png` + `_design/tokens.json`
   - Pra cada arquivo do convert plan, gero o Liquid via Write
   - Respeito **todos** os "nunca" do Bloco 3 — se a tentação aparecer, paro e pergunto
   - Anuncio progresso em texto curto ("home → 4 sections geradas, indo pra PDP")
4. Quando terminar todas as páginas, **a skill** roda `clone-validate.mjs` (passo 8) automaticamente. Se 3 evidências passam, pergunta pro humano sobre preview/upload.

Isso significa que `clone-theme` **NÃO é skill 100% autônoma em background** — é pair com Claude in-conversation. Trade-off: $0 de custo, visibilidade total de cada conversão, opção de interromper/ajustar mid-fluxo. Custo: precisa de mim ativo na sessão.

---

## Exemplo de uso (fluxo completo — Lucky Fours)

```
você: /clone-theme https://luckyfours.com --to "Lucky Fours" --name "Tema Lucky Fours"

skill (passo 1): valida cliente connected ✓, URL ok ✓, nome único ✓
                 workspace themes/clones/tema-lucky-fours/ não existe → cria
skill (passo 2): 3 perguntas estruturadas → você responde
                 [escopo: full] [fontes pagas → Geist] [copyright → flagar]
                 [animações JS → CSS simples] [critério: b — visual diff automático]
skill (passo 3): discovery → URLs achadas, picked N, mostra lista
você: confirma
skill (passos 4-6): scrape paralelo + tokens
                    → _raw/ e _design/tokens.json prontos
skill (passo 6.5): forka Dawn → themes/clones/tema-lucky-fours/
skill (passo 7): imprime convert plan (4 Blocos) e pausa

eu (Claude in-conversation):
  "Lendo _raw/home/index.html + screenshot.png + tokens.json.
   Vou gerar X sections novas + Y templates seguindo o Bloco 3.
   [Write sequencial pra cada arquivo]
   Home pronta. Indo pra PDP/PLP/cart/pages.
   [...]
   Conversão pronta: N sections, M templates, layout ajustado."

skill (passo 8 — Confirmação Múltipla 2 evidências automáticas):
   ✓ Evidência 1: theme check → 0 errors, K warnings
   ✓ Evidência 2: sanity → schema válido, 0 refs órfãs

skill (passo 9 — Preview offline):
   Renderizando _preview/ com liquidjs + mock data...
   ✓ _preview/index.html, home.html, product.html, collection.html, cart.html gerados
   ✓ Servindo em http://localhost:4173
   → abre browser automaticamente em localhost:4173

você: [vê dashboard side-by-side render-clone vs luckyfours.com,
       navega pelas pages, valida paleta/fontes/layout]

skill: ⏸ Evidência 3 (visual): aprovado? (y / n / refine)
você: y / n / refine

  se "y":
    skill: ✓ 3 evidências confirmadas. Subir como unpublished na Lucky Fours? (y/n)
    você: y → passo 10
    você: n → para, _preview/ permanece pra compartilhar/iterar

  se "n":
    skill: pra, log de erro, _preview/ permanece pra você revisar o que tá errado

  se "refine":
    skill: pergunta o que ajustar → eu (Claude) volto pro passo 7 com nota,
           re-gero arquivos específicos, re-renderiza _preview/

skill (passo 10, só com --apply): POST /themes.json + PUT N assets
                                  ✓ Preview Shopify: https://<shop>?preview_theme_id=...
                                  ✓ Log com 3 evidências
```

### Compartilhar o preview offline

Pra mostrar pro Pedro/cliente/colaborador **sem precisar deles instalarem nada**:

```bash
# Opção 1 — zip
cd themes/clones/tema-lucky-fours/_preview && zip -r ../preview-lucky.zip .
# manda preview-lucky.zip — pessoa extrai e abre index.html no browser

# Opção 2 — link público temporário (via Supabase Storage)
node .claude/skills/clone-theme/clone-preview.mjs --share tema-lucky-fours
# → retorna URL pública tipo https://<supabase>/storage/v1/.../preview-lucky/index.html

# Opção 3 — deploy permanente
npx vercel deploy themes/clones/tema-lucky-fours/_preview --prod
```

---

## Lições da implementação real (testado contra luckyfours.com)

Esta seção é viva — atualiza conforme a skill é usada e descobrimos quirks no terreno. Aprendizados após rodar o pipeline end-to-end contra `https://luckyfours.com`:

### O que evoluiu vs. o desenho original

| Desenho original | Realidade encontrada | Decisão |
|---|---|---|
| Pipeline em 4 fases com Liquid in-conversation pesado | Funcionou bem mais simples: **scrape → tokens → Dawn fork + tokens injetados via CSS vars + sections custom (6 arquivos) → ZIP**. Não precisei converter HTML do alvo direto pra Liquid — bastou aplicar tokens visuais sobre Dawn e criar sections genéricas com schema editável | Pipeline real são 7 scripts standalone, não 4 fases acopladas |
| `clone-preview.mjs` (HTML estático) como passo crítico do pipeline | Útil só pra **validação intermediária** dos tokens (paleta/fontes batem com o alvo). Depois que o tema vira ZIP Shopify, esse preview HTML é descartável — o preview real é Shopify CLI dev ou upload no admin | `clone-preview` virou **debug opcional**, não passo obrigatório |
| `clone-validate.mjs` checa Supabase + Shopify antes de scrape | Projeto tem inconsistência: `.env` usa `VITE_SUPABASE_PUBLISHABLE_KEY` mas as libs esperam `VITE_SUPABASE_ANON_KEY`. Bloqueia o validate | Workaround: criar `.clone-meta.json` manualmente OU consertar libs pra aceitar PUBLISHABLE_KEY como fallback. **TODO no projeto** |
| Conversão HTML→Liquid via Claude in-conversation seria longa (~5-15 min) | Não foi necessária — sections custom com **schema editável** + tokens via CSS vars já entrega tema funcional. Claude in-conversation **só pra refinar** seções específicas que o user quiser | Pair Programming continua, mas com escopo menor |

### Refinamento estrutural (paridade visual real)

Quando o user dizer "tudo gigante / sem padrão" depois do primeiro upload, o problema quase nunca é falta de section — é **proporção errada herdada do default** que coloquei. Roteiro de fix sistemático:

1. **Medir o alvo de verdade** via `_raw/<page>/page.css` — grep `max-width`, `gap`, `padding`, `font-size`, `min-height`. Sites premium minimalistas costumam usar:
   - Container `~990px` (não `1280px`)
   - Heading top `~22px` (não `48px+`)
   - Body `14px` (não `16px`)
   - Grid gap `8-12px` (não `16-32px`)
   - Banner height `240-320px` (não `400+`)
2. **Cards de relógio/joia: aspect `1/1`** (quadrado), não `4/5` ou `3/4` que esticam o produto verticalmente
3. **Header**: `logo_position` no `header-group.json` é o que centraliza logo Dawn-style (`top-center` vs `middle-left` default). É 1 linha de config, não precisa custom section
4. **Menu hierárquico**: Shopify aceita `items: [...]` aninhado em `menuUpdate` GraphQL — usar isso pra ter dropdown "Shop ▾ / Support ▾" em vez de menu flat de 13 itens em 2 linhas. **Pai precisa de `type` + `resourceId` ou `url`** mesmo sendo só wrapper de submenu — não dá pra ter item-pai sem destino
5. **Hero como slot vazio**: pra banner manual editável, defaults precisam ser `""` (strings vazias) — assim o user abre Theme Editor, sobe imagem própria + texto próprio. Defaults preenchidos com texto sample dão impressão de "tema genérico já preenchido"

### Quirks descobertos no terreno

1. **`config/settings_data.json` do Dawn é preset-based**: estrutura `{ "current": "Default", "presets": { "Default": {...} } }`. Tentar setar `data.current.foo` falha porque `current` é string. Solução: ler `data.current` (string), escrever em `data.presets[data.current]`.

2. **`@import url(...)` no início do CSS é OK pra Google Fonts**, mas o ideal é `<link rel="preconnect">` + `<link rel="stylesheet">` no `<head>` via snippet `clone-tokens.liquid` (já implementado).

3. **PowerShell `Compress-Archive` quebra o ZIP pro Shopify** — usa `\` (backslash) nos paths internos do arquivo. Shopify admin rejeita com `"missing template layout/theme.liquid"` mesmo o arquivo existindo. **Solução validada:** usar `npx shopify theme package` (Shopify CLI oficial, offline, zero auth) — gera ZIP com `/` forward slash. `clone-package.mjs` foi atualizado pra usar isso após o bug aparecer no upload da Mont Royal.

4. **Path com espaços** — `themes/clones/<slug>/` em "Sistema - Lever" tem espaços; `npx serve` falha com `shell: true` porque args não são escapados. Solução: rodar `npx serve` com path em aspas duplas no Bash, sem `shell: true`.

5. **Playwright primeiro run** baixa Chromium ~200MB. Rodar `npx playwright install chromium` 1x no setup (custo zero, mas só feito uma vez por máquina).

6. **Lucky Fours específico**: é loja Shopify (usa `/products/`, `/collections/`, `/cart`, `/pages/`). Pra alvos não-Shopify a heurística de classificação no `clone-discover.mjs` precisaria expandir (`/produto/`, `/categoria/` etc — já cobertos).

### Caso real validado (Lucky Fours, scope minimal)

```
URL alvo:    https://luckyfours.com
Cliente:     Lucky Fours (mock — Supabase desabilitado pra teste)
Tema gerado: Tema Lucky Fours

Discovery:   75 links → 73 classificados → 7 picked (home + PDP + PLP + cart + 3 pages)
Scrape:      7/7 ok, 13MB raw (HTML + screenshot + CSS)
Tokens:      50 cores, 20 font stacks → Primary=#637381, Body=Montserrat, Heading=Playfair Display
Dawn fork:   369 arquivos cacheados, 360 copiados pro workspace
Sections:    6 customizadas (clone-hero, clone-featured-grid, clone-product-grid,
             clone-product-main, clone-cart-main, clone-page-content)
Templates:   5 sobrescritos (index/product/collection/cart/page.json)
Tokens CSS:  assets/clone-base.css + clone-fonts.css + snippets/clone-tokens.liquid
ZIP:         361 arquivos, 0.97MB → themes/clones/tema-lucky-fours/tema-lucky-fours.zip
```

**Validação Confirmação Múltipla** (3 evidências):
- ✓ **Evidência 1 (tokens):** paleta + fontes extraídas batem visualmente com o alvo (`#637381` cinza Shopify-like, Montserrat + Playfair Display = combo padrão de e-commerce premium)
- ✓ **Evidência 2 (estrutura):** sections custom têm schema válido, templates JSON apontam pra sections existentes, theme.liquid tem render do snippet de tokens. ZIP empacota sem erro
- ⏳ **Evidência 3 (visual):** depende de você instalar o ZIP no admin Shopify OU rodar `shopify theme dev` — esse é o gate humano antes de qualquer publicação

## Como você testa o ZIP agora (sem subir nada no Supabase nem código)

### Opção 1 — Manual no admin Shopify (mais simples)

1. Vá no admin de qualquer loja Shopify (dev, playground, sandbox, ou a real)
2. `Online Store` → `Themes` → `Add theme` → `Upload zip file`
3. Seleciona `themes/clones/tema-lucky-fours/tema-lucky-fours.zip`
4. Tema sobe como **unpublished** — clica em "Customize" pra abrir o Theme Editor
5. Preview com produtos da loja real, ajusta settings se quiser, publica quando achar bom

### Opção 2 — Shopify CLI dev (preview com hot reload)

```bash
npx shopify theme dev --path="themes/clones/tema-lucky-fours" --store=<seu-shop>.myshopify.com
```

Abre `localhost:9292` com o tema rodando linkado à loja escolhida. Edita arquivos local, vê reload no browser. Sem upload definitivo até você rodar `shopify theme push` separadamente.

## Ciclo "clone, conferência, aplicação" — evolução chave da skill

Em uso real (Mont Royal recebendo o ZIP do Lucky Fours), ficou claro que a skill não termina com `assemble + package`. Ela tem 3 fases que **se repetem em loop** até o user aprovar:

```
   ┌──────────────────────────────────────────────────────┐
   │                                                      │
   ▼                                                      │
[CLONAR]   →   [CONFERIR]   →   [APLICAR/AJUSTAR]   →   [PACKAGE]   →   user revisa
                    ↑                    │
                    │                    │
                    └────────────────────┘
                       (loop até gaps = 0
                        OU gaps documentados como
                        skipped intencional)
```

**CLONAR** — scrape + tokens + Dawn fork + sections genéricas (passos 1-7 do pipeline original).

**CONFERIR** — dois scripts complementares:

- `clone-audit.mjs` — compara **categorias** de sections do alvo contra workspace. Reporta gaps em alto nível (hero, image_banner, collection_list, etc).
- `clone-layout-extract.mjs` — extrai **sequência exata** de sections do HTML scraped (ordem + tipo + contagem de blocos por section). Output `_design/layout-<page>.json` mostra "section 1 = collection-list com 212 cards, section 2 = featured-collection com 48 cards, section 3 = image-banner, ..." — permite replicar **posicionamento** no `templates/*.json`, não só presença de tipo. Crítico pra paridade visual: a home do alvo pode ter 6 featured-collection alternadas com 5 image-banner; sem o extract, faz tudo igual mas vira página plana com 1 grid só.

**APLICAR/AJUSTAR** — gera novas sections (`clone-X.liquid`) e atualiza `templates/*.json` cobrindo os gaps. Re-roda audit. Quando audit volta com 0 gaps acionáveis (ou só skipped intencional), parte pra package.

### Quando um gap é "skipped intencional"

Nem todo gap deve virar section nova. Casos legítimos pra skip:
- **Section ultra-específica do alvo** que não faz sentido no destino (ex: configurador "Try Your Luck" de loja de relógios não vai pra loja de roupas)
- **Funcionalidade que depende de app externo** que o destino não tem
- **Trade dress muito identitário** (logo grande customizado, hero com vídeo proprietário, etc.) — manter como Dawn padrão evita problemas legais

Skips ficam registrados em `_design/audit.json` com `reason: "skipped:..."` pra ficar rastreável.

## Camada PREMIUM — Lucky Fours-grade (target 95% fidelidade)

A skill agora aplica automaticamente uma **camada premium** depois da Fase 2 — features battle-tested no clone real do Lucky Fours (Mont Royal). Não substitui nada existente, só adiciona:

### Templates copiados (`templates/` na skill → workspace)
| Arquivo | Função |
|---|---|
| `snippets/clone-cart-drawer.liquid` | Cart drawer lateral Ajax c/ BOGO, Mix & Match upsell, Shipping Protection, compare-at price, bandeiras SVG |
| `assets/clone-cart.js` | Controller Ajax (cart.js, /add, /change), money format regex, productCache compare-at, categoryMaps auto-match |
| `assets/clone-storefront.js` | Variant picker delegation (custom dropdown com mini-imagem) |
| `assets/clone-header.js` | Sticky header + transparent-on-home toggle |
| `assets/clone-baseline.css` | CSS defensivo: overflow-x hidden, box-sizing, grid `minmax(0,1fr)`, card aspect-ratio canonical, responsivo 990/600/380 |
| `sections/clone-product-grid.liquid` | Grid com srcset/sizes/width/height/decoding async/fetchpriority eager (LCP) + custom dropdown variant picker |
| `sections/clone-product-main.liquid` | PDP refinada: bundle boxes BxGy, sticky bar, slide animation, color swatches com imagem real |
| `sections/clone-reviews.liquid` | Estrelas + count (Loox/Judge.me/Yotpo compatível via metafields) |

### Settings de cor modulares (patcher em sections Dawn)
- `header.liquid` recebe 5 settings: transparent_on_home (checkbox), header_bg_color, header_text_color, header_dropdown_bg, header_dropdown_text
- `announcement-bar.liquid` recebe 2 settings: announcement_bg_color, announcement_text_color
- `footer.liquid` recebe 4 settings: footer_bg_color, footer_text_color, footer_heading_color, footer_border_color
- Tudo via CSS custom properties (`--clone-header-bg`, etc) — defaults batem com look Lucky Fours

### Performance baseline (clone-tokens.liquid)
- `preconnect` ao `cdn.shopify.com` (imagens chegam 100-300ms antes)
- Google Fonts via `<link>` paralelo + `media="print" onload` lazy + `<noscript>` fallback (não bloqueia render como `@import` fazia)
- `clone-base.css` com `preload: true` (high priority)

### Audit visual (script novo: `clone-audit-visual.mjs`)
- Playwright tira screenshot full-page de 4 rotas (home/PDP/PLP/cart) no alvo e no clone
- Auto-detecta PDP/PLP do alvo via `/products.json` e `/collections.json`
- Gera `_design/visual-audit/index.html` com side-by-side review
- Uso: `node clone-audit-visual.mjs <slug> --target <url> --clone <preview-url>`

---

## Camada de ROBUSTEZ — multi-plataforma + self-healing (target 95%)

### 1. Detector de plataforma (`clone-detect-platform.mjs`)
Detecta a plataforma de origem em 4 camadas (do mais barato pro mais caro):

| Camada | Como mede |
|---|---|
| HTTP headers | `x-shopify-stage`, `x-magento-tags`, `x-bc-apigw-client-id`, set-cookie |
| `<meta name="generator">` | "WooCommerce 8.x", "Shopify", "Squarespace", etc |
| Endpoints conhecidos | `/products.json`, `/wp-json/wc/v3/products`, `/rest/V1/products` |
| HTML heurísticas | `window.Shopify`, `__NEXT_DATA__`, classes `.woocommerce`, `cdn11.bigcommerce.com` |

Plataformas suportadas: **shopify, woocommerce, magento, bigcommerce, wix, squarespace**.
Frameworks (Next.js, Nuxt) viram hint de hidratação (não plataforma).
Output: `_design/platform.json` com `{ platform, confidence, signals, hydration_framework }`.

Uso: `node clone-detect-platform.mjs <slug> [--url URL]`

### 2. Normalizador de produtos (`clone-normalize-products.mjs`)
Por plataforma detectada, extrai produtos e normaliza pra **formato Shopify-compatible** (title, handle, body_html, variants[], images[], options[], price/compare_at).

| Plataforma | Endpoint usado | Notas |
|---|---|---|
| shopify | `/products.json` paginado | nativo, sem mapping |
| woocommerce | `/wp-json/wc/v3/products` | mapeia attributes→options, variations→variants |
| magento | `/rest/V1/products` | exige token pra full data; best-effort sem |
| bigcommerce | `/api/storefront/v3/products` | mapeia option_values→variants |
| wix/squarespace/custom | scrape via Playwright | heurística DOM (data-product-id, .product-card, etc) com scroll forçado |

Output: `_design/products.normalized.json` (array Shopify-ready, pronto pra `import-missing`/`deploy-store`).
Uso: `node clone-normalize-products.mjs <slug> [--limit N] [--platform shopify] [--url URL]`

### 3. Self-Healing Validator (`clone-self-heal.mjs`)
Rodado depois do `clone-assemble`. Auto-corrige 7 categorias de erro **antes** do upload:

| Etapa | Problema | Correção |
|---|---|---|
| 1 | JSON inválido (trailing comma, aspas) | tenta auto-fix; fallback stub mínimo |
| 2 | Template referencia section órfã | substitui por `rich-text` placeholder + log |
| 3 | `{% render 'X' %}` snippet inexistente | comenta render, não quebra tema |
| 4 | `{{ 'X' \| asset_url }}` asset ausente | gera placeholder SVG/CSS/JS no nome certo |
| 5 | settings_schema.json: ids duplicados, blocks sem name | corrige id (sufixo aleatório), gera name fallback |
| 6 | templates/*.json com order órfão/duplicado | filtra refs inexistentes, dedup |
| 7 | `shopify theme check` (se CLI disponível) | parseia output JSON, lista erros pro relatório |

Idempotente. Output: `_design/self-heal.report.json` com lista de issues processadas.
Uso: `node clone-self-heal.mjs <slug> [--dry-run]`

---

## Pipeline recomendado pra atingir 95%

### Modo orquestrado — 1 comando (recomendado)

```bash
node .claude/skills/clone-theme/clone-theme.mjs <url> --slug <nome> [--limit 100] [--skip step] [--force]
```

O orquestrador (`clone-theme.mjs`) roda os 10 passos automatizáveis em sequência:
1. validate, 2. discover, 3. scrape, 4. **detect-platform**, 5. tokens, 6. **normalize-products**, 7. assemble, 8. **self-heal**, 9. audit, 10. package.

Cada passo é idempotente — se o output existe, pula. Re-rodar é safe.
Output: `_design/pipeline-run.json` com timing por passo.

Após o pipeline, o usuário faz upload manual do ZIP (ou via `clone-upload.mjs`) e roda:

```bash
node .claude/skills/clone-theme/clone-audit-visual.mjs <slug> --target <url> --clone <preview-url>
```

### Modo manual — passo a passo

```
1. clone-validate.mjs <slug>
2. clone-discover.mjs <slug>
3. clone-scrape.mjs <slug>
4. clone-detect-platform.mjs <slug>      ← multi-plataforma
5. clone-tokens.mjs <slug>
6. clone-normalize-products.mjs <slug>   ← catálogo
7. clone-assemble.mjs <slug>             ← com camada PREMIUM
8. clone-self-heal.mjs <slug>            ← auto-fix bloqueia uploads quebrados
9. clone-audit.mjs <slug>                (sections gap audit)
10. clone-package.mjs <slug>             (ZIP final)
11. [upload manual via Admin ou clone-upload.mjs]
12. clone-audit-visual.mjs <slug>        ← após preview URL ativa
```

### Score esperado por origem

| Origem | Standalone | + MCP Playwright interativo |
|---|---|---|
| Shopify-source | 92-95% | **98%** |
| WooCommerce | 80-88% | **92-96%** |
| BigCommerce | 75-85% | **90-95%** |
| Magento | 60-75% | **80-88%** |
| Wix/Squarespace | 55-70% | **75-85%** |
| Custom Next.js/Nuxt | 60-75% | **85-92%** |

---

## Modos de operação

### Modo STANDALONE (scripts em background, sem Claude)
```bash
node .claude/skills/clone-theme/clone-theme.mjs <url> --slug <nome>
```
- Roda os 10 passos automáticos em sequência
- Usa Node Playwright local (precisa `npm install playwright` + `npx playwright install chromium`)
- Paralelizável, sem Claude na sessão
- Ideal pra CI/cron, batch de lojas, ou re-run idempotente
- **Score esperado: 60-90%** dependendo da plataforma

### Modo INTERATIVO (Claude in-session + MCP Playwright)
Quando MCP `mcp__playwright__*` está disponível, Claude usa o playbook em **[MCP-PLAYBOOK.md](./MCP-PLAYBOOK.md)**:

| Fase | Tool calls | Tempo | Ganho |
|---|---|---|---|
| **A — Inspeção inicial** | navigate + network + console + evaluate (window globals) + screenshot | ~30s | Detector confidence ~95% mesmo em SPAs |
| **B — Discovery interativo** | hover + click em mega-menus, captura URLs ocultas | ~1-2 min | 2-3x mais URLs descobertas |
| **C — Scrape de SPA** | scroll forçado + "load more" click + accessibility tree | ~2-3 min/PLP | Captura ~80% de SPAs (vs 35-40% estático) |
| **D — Validação pós-upload** | navigate preview + console messages + 404 check | ~1 min | Self-heal reativo, pega erros runtime |
| **E — Audit visual semântico** | screenshots alvo+clone, EU comparo as imagens | ~5 min total | Feedback acionável priorizado (não pixel-diff) |

**Total: ~15-20 min interativo. Score esperado: 75-98% (depende da plataforma).**

### Quando usar qual?

| Cenário | Modo recomendado |
|---|---|
| Clone novo, plataforma desconhecida | **Interativo** (Fase A primeiro pra diagnosticar) |
| Re-clone idempotente (já feito 1x) | Standalone |
| Lote de 10+ lojas | Standalone paralelo |
| User pediu "clona pra mim" no chat | **Interativo** completo |
| Pós-upload, dúvida visual | **Interativo Fase E** (audit semântico) |
| CI/background sem chat | Standalone |

## Status atual

✓ **Fase 1 (scrape + tokens):** 5 scripts entregues e testados — `clone-validate.mjs`, `clone-prompts.mjs`, `clone-discover.mjs`, `clone-scrape.mjs`, `clone-tokens.mjs`
✓ **Fase 2 (Dawn fork + sections + ZIP):** 3 scripts entregues e testados — `clone-assemble.mjs`, `clone-package.mjs`, `clone-audit.mjs` + 8 sections (`clone-hero`, `clone-featured-grid`, `clone-product-grid`, `clone-product-main`, `clone-cart-main`, `clone-page-content`, `clone-collection-list`, `clone-image-banner`) + 5 templates
✓ **Camada PREMIUM:** clone-assemble.mjs agora copia 8 templates battle-tested + apenda baseline CSS + injeta 11 settings de cor modulares + scripts no theme.liquid. Fidelidade automática alvo: 95%
✓ **Audit visual:** clone-audit-visual.mjs com Playwright para review side-by-side
✓ **Ciclo audit→aplicar→repackage** validado contra Lucky Fours: 6 gaps detectados → 2 sections novas geradas + announcement-bar ativada + index.json reescrito com narrativa scroll → 1 gap restante (product_filter, skipped intencional)
○ **Fase 3 (preview HTML estático)** — `clone-preview.mjs` codado, opcional, útil só pra validar tokens antes da Fase 2
○ **Fase 4 (upload via API Shopify)** — `clone-upload.mjs` codado, mas upload manual via admin (ZIP) ou Shopify CLI cobrem o caso melhor

**Próximas evoluções possíveis** (conforme uso real revelar):
- Audit também avaliar **densidade de scroll** (Lucky Fours tem ~17 sections na home, meu index.json tem 7) e sugerir multiplicação de blocos pra paridade
- Audit avaliar **PDP/PLP/cart** separadamente (hoje só conta categorias globais)
- Diff visual automatizado (Playwright tira screenshot do tema instalado e compara com screenshot do alvo, retorna pontos de divergência)
- Fix de `clone-validate.mjs` pra aceitar `VITE_SUPABASE_PUBLISHABLE_KEY` como fallback
- Orchestrator `clone-theme.mjs` que roda os 8 scripts em sequência com um comando só

Processe $ARGUMENTS conforme os passos acima.
