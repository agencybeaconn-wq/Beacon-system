# Lever Scraper

Toolbox de scrapers em Node.js da **Lever** — extrai catálogos, docs e páginas de qualquer fonte e faz upload pro Supabase consolidado do Lever System (ou pra qualquer outro Supabase configurado).

> Vive em `lever/tools/scraper/`. Execução manual sob demanda — não é serviço/cron. Pra agendamento, ver `tools/scraper/src/upload/_env.js` e plugar num worker externo.

## Stack

- **Node.js CommonJS** — sem TypeScript
- **Playwright** — sites JS-rendered ou com bot protection (Cloudflare, captcha)
- **Cheerio** — HTML estático
- **Turndown** — HTML → Markdown (scrapers de docs)
- **@supabase/supabase-js** — uploaders

## Setup

```bash
cd lever/tools/scraper
npm install
cp .env.example .env   # preencher SCRAPER_SUPABASE_URL + SCRAPER_SUPABASE_SERVICE_KEY
npx playwright install chromium   # só pra scrapers que usam Playwright
```

Pra apontar pro Lever System consolidado, copia as credenciais de `lever/.env` (`LEVERSYSTEM_SUPABASE_URL` / `LEVERSYSTEM_SUPABASE_SERVICE_ROLE_KEY`) pro `.env` local com nomes `SCRAPER_SUPABASE_URL` / `SCRAPER_SUPABASE_SERVICE_KEY`.

## Estrutura

```
src/
├── shopify/          Shopify (stores públicas + docs)
│   ├── store-products.js   Loja → CSV pronto pra Shopify Admin Import
│   ├── docs.js             shopify.dev → markdown
│   └── fetch-missing.js    Completa páginas do llms.txt fora do sitemap
├── meta/             Meta / Facebook docs
│   ├── docs.js             developers.facebook.com → markdown
│   ├── docs-fallback.js    Páginas JS-rendered (Playwright)
│   └── docs-reprocess.js   Re-extrai do HTML salvo sem rescrapear
├── generic/          Genéricos
│   ├── pages.js            Lista de URLs → JSON estruturado
│   ├── images.js           Baixa imagens listadas num produtos.json
│   └── images-playwright.js  Mesma coisa via browser (Cloudflare/hotlink)
├── sites/            Scrapers de sites específicos (refactoráveis)
│   ├── timpson.js          timpson.co.uk/autokeysonline
│   ├── cke.js              store.carkeysexpress.com (Next.js buildId)
│   ├── mk3.js              mk3.com/car-remotes (CDP)
│   ├── mk3-deep.js         mk3.com detalhe (CDP)
│   ├── fssport.js          fssport.com.br (Nuvemshop HTML)
│   └── pedidoatacado.js    pedidoatacado.com (Woo Store API)
└── upload/           Uploaders pro Supabase
    ├── _env.js             Helper que lê .env (SCRAPER_SUPABASE_*)
    ├── supabase.js         Catálogo chaves
    ├── cke.js              Produtos CKE
    ├── mk3.js              Listagem MK3
    ├── mk3-deep.js         Detalhe MK3
    └── timpson-servicos.js Serviços Timpson
```

## Scrapers disponíveis

| Script                                | Fonte                            | Técnica                         | Saída                                    |
| ------------------------------------- | -------------------------------- | ------------------------------- | ---------------------------------------- |
| `src/shopify/store-products.js`       | Qualquer loja Shopify pública    | `/products.json` (API pública)  | CSV import + JSON backup                 |
| `src/shopify/docs.js`                 | shopify.dev                      | Endpoint `.md` nativo + sitemap | Markdown + index                         |
| `src/meta/docs.js`                    | developers.facebook.com          | BFS + Cheerio + Turndown        | Markdown + assets                        |
| `src/meta/docs-fallback.js`           | Páginas JS-rendered da Meta      | Playwright                      | Markdown                                 |
| `src/sites/pedidoatacado.js`          | pedidoatacado.com (WooCommerce)  | Store API REST                  | JSON (schema Medusa)                     |
| `src/sites/fssport.js`                | fssport.com.br (Nuvemshop)       | HTML + Cheerio                  | JSON (schema Medusa)                     |
| `src/sites/cke.js`                    | store.carkeysexpress.com         | `buildId` Next.js + JSON        | JSON                                     |
| `src/sites/mk3.js`                    | mk3.com/car-remotes (listagem)   | Chrome CDP                      | JSON                                     |
| `src/sites/mk3-deep.js`               | mk3.com (detalhe)                | Chrome CDP                      | JSON                                     |
| `src/sites/timpson.js`                | timpson.co.uk/autokeysonline     | Playwright                      | JSON                                     |
| `src/generic/pages.js`                | URLs genéricas                   | Playwright                      | JSON estruturado                         |

### Helpers

- `src/generic/images.js` / `images-playwright.js` — baixa imagens listadas num `produtos.json` (Playwright contorna Cloudflare)
- `src/shopify/fetch-missing.js` — completa páginas Shopify docs do `llms.txt` fora do sitemap
- `src/meta/docs-reprocess.js` — reprocessa HTML salvo pelo `meta/docs.js` sem rescrapear

### Uploads (Supabase)

| Script                            | Tabela              | Input                  |
| --------------------------------- | ------------------- | ---------------------- |
| `src/upload/supabase.js`          | `chaves_automotivas`| `catalogo_raw.json`    |
| `src/upload/cke.js`               | `cke_produtos`      | `cke_produtos.json`    |
| `src/upload/mk3.js`               | `mk3_car_remotes`   | `mk3_car_remotes.json` |
| `src/upload/mk3-deep.js`          | `mk3_produtos`      | `mk3_deep.json`        |
| `src/upload/timpson-servicos.js`  | `servicos_timpson`  | `servicos_raw.json`    |

URL e service key são lidos de `.env` via `src/upload/_env.js`. Não tem URL hardcoded.

---

## Scraper Shopify Store (loja → CSV de import)

O mais usado. Extrai **todos os produtos, variantes e imagens** de qualquer loja Shopify pública e gera um CSV no formato oficial do **Shopify Admin > Products > Import**.

### Como funciona

Toda loja Shopify expõe `/products.json` publicamente (a menos que tenha sido explicitamente bloqueado). O script pagina até esgotar.

### Uso

1. Edita `src/shopify/store-products.js` e troca a constante:

   ```js
   const STORE_URL = 'https://spacesportsfut.com.br';
   ```

2. Roda:

   ```bash
   node src/shopify/store-products.js
   ```

3. Saída em `./shopify-store-<host>/`: `produtos.csv` (upload direto), `produtos.json` (backup), `README.md` (stats).

### Importando o CSV no Shopify

Admin > **Products** > **Import** → upload do `produtos.csv` → marca "Overwrite any current products that have the same handle" se for o caso → **Upload and continue**.

A Shopify puxa as **imagens diretamente das URLs do CDN original**, sem precisar subir imagem manualmente.

### O que o CSV contém

- Todas as variantes (uma linha cada) — `Option1/2/3`, SKU, preço, `compare_at_price`, peso, barcode
- Todas as imagens (linha extra por imagem além da primeira variante)
- Tags, vendor, type, descrição HTML, status `active`
- Estoque: 100 unid. se `available: true`, 0 se `false` — ajustar manualmente depois
- Schema completo (40+ colunas) seguindo o template oficial Shopify

### Limitações

- Não pega produtos **não publicados** (a API pública não os expõe)
- Não pega metafields nem SEO custom
- Algumas lojas bloqueiam `/products.json` — sem cookie de admin não tem jeito

---

## Scrapers de docs

### `src/shopify/docs.js`

Usa o **endpoint `.md` nativo do Shopify** (sufixa qualquer URL de doc com `.md`) e o sitemap oficial. Saída em `./shopify-docs/`: markdown + `index.json` + `search-index.json`. Roda em ~10 min.

Depois rodar `src/shopify/fetch-missing.js` pra completar páginas que estão no `llms.txt` mas não no sitemap.

### `src/meta/docs.js`

Crawler BFS dos docs da Meta Marketing API. Salva HTML, markdown, code samples, tabelas e imagens.

Pra páginas JS-rendered (ex: WhatsApp Cloud API):

```bash
node src/meta/docs-fallback.js
```

Pra ajustar lógica de extração sem rescrapear:

```bash
node src/meta/docs-reprocess.js
```

---

## Scrapers de catálogo (Woo / Nuvemshop)

### `src/sites/pedidoatacado.js`

Usa a **WooCommerce Store API** (`/wp-json/wc/store/v1/products`). Sem auth. Inclui categorias, variações, mídias.

### `src/sites/fssport.js`

Nuvemshop não tem API pública — scrapeia HTML via Cheerio. CDN bloqueia hotlink, então pra baixar imagens use:

```bash
node src/generic/images-playwright.js fssport-com-br/produtos.json
```

---

## Scrapers MK3 (Chrome + CDP)

Site agressivo com captcha. Conecta num Chrome real já aberto via debug remoto — você abre o navegador, resolve o captcha manualmente, e só então o script anexa.

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="C:\Users\<você>\chrome-debug" ^
  https://www.mk3.com/en/car-remotes
```

Resolve o captcha, depois:

```bash
node src/sites/mk3.js        # listagem
node src/sites/mk3-deep.js   # detalhe de cada produto
```

---

## Convenções

- Todos os scrapers gravam saída na raiz ou em `<host>/` (no `.gitignore`)
- Idempotência: imagem pula se já baixada; catálogo regrava tudo
- Sleeps + retries com backoff
- User-Agent realista hardcoded onde necessário

## Decidindo qual técnica usar

1. **Endpoint JSON público?** (Shopify `/products.json`, Woo Store API, Next.js `buildId`) → fetch direto. Mais rápido, mais estável.
2. **HTML completo no servidor?** → Cheerio.
3. **JS-rendered ou bot protection (Cloudflare, captcha)?** → Playwright. Captcha persistente → Chrome `--remote-debugging-port` + CDP.
4. **Bloqueio de hotlink em imagens?** → Playwright (cookies + TLS fingerprint do browser).

## Histórico

Os scrapers de sites específicos (CKE, MK3, FSSport, pedidoatacado, Timpson) foram criados originalmente pra um cliente. Foram migrados pra esse repo dentro do Lever como **ferramentas reusáveis** — qualquer cliente futuro com necessidade similar (concorrente, catálogo de mercado, etc.) pode reaproveitar via parametrização.
