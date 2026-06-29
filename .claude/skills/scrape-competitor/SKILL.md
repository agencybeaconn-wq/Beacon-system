---
name: scrape-competitor
description: Coleta produtos de loja concorrente (URL externa) e importa pra Shopify do cliente, aplicando tabela de preços do banco e nomenclatura padrão. Hoje suporta OpenCart (Futebol Religião). Estensível para outras plataformas via adapters.
argument-hint: <cliente> --url=<URL>
---

# Scrape Competitor

Pega produtos de uma URL pública de loja concorrente, normaliza títulos e preços conforme padrões Lever, e importa para a Shopify do cliente associando a uma coleção.

## Segue o [PROTOCOL.md](../../PROTOCOL.md)

VALIDATE → DRY-RUN → PREVIEW → CONFIRM → EXECUTE → LOG

## Plataformas suportadas

| Plataforma | Detector | Status |
|---|---|---|
| OpenCart (Futebol Religião) | `index.php?route=product/category` na URL ou `class="product-thumb"` no HTML | ✅ |
| Shopify externa | _futuro_ — usar `/products.json` direto | — |
| VTEX, Tray, Nuvemshop | _futuro_ | — |

Para adicionar suporte: criar novo bloco no detector + adapter dentro de `scrape-competitor.mjs`.

## Lib compartilhada

- [`../../lib/shopify-pricing.mjs`](../../lib/shopify-pricing.mjs) — `categorize()`, `calcExpectedPrice()` (preço por categoria + extras)
- [`../../lib/shopify-api.mjs`](../../lib/shopify-api.mjs) — `productSet`, `shopifyGraphQL`, `pollProductOperation`
- [`../../lib/supabase-rest.mjs`](../../lib/supabase-rest.mjs) — `fetchClient`, `fetchPricing`
- [`../../lib/validate.mjs`](../../lib/validate.mjs) — `assertClientExists`, `assertShopifyConnected`, `appendExecutionLog`

## Uso

```bash
# DRY-RUN (preview de produtos a importar + preço calculado)
node .claude/skills/scrape-competitor/scrape-competitor.mjs "Cliente" --url=https://www.futebolreligiao.com.br/chivas-guadalajara

# APPLY (cria coleção + importa via productSet async)
node .claude/skills/scrape-competitor/scrape-competitor.mjs "Cliente" --url=URL --apply

# Limita a N produtos (útil pra teste)
node .claude/skills/scrape-competitor/scrape-competitor.mjs "Cliente" --url=URL --limit=3 --apply

# Override do nome da coleção destino
node .claude/skills/scrape-competitor/scrape-competitor.mjs "Cliente" --url=URL --collection-name="Chivas - Guadalajara MX"

# Não pular dups (re-importa mesmo se título já existe no cliente)
node .claude/skills/scrape-competitor/scrape-competitor.mjs "Cliente" --url=URL --no-skip-existing --apply
```

## Pipeline

1. **Fetch HTML** da URL (User-Agent de browser real, sem deps externas)
2. **Detecta plataforma** pelo HTML
3. **Coleta páginas paginadas** seguindo `?page=N`
4. **Extrai links de produto** dos cards de listagem
5. **Para cada produto** (concorrência 3, delay 400ms):
   - Título completo (h1/og:title)
   - Tamanhos do `<select>` de opções
   - Imagens grandes em `-900x900.jpg`
   - Descrição do `tab-description`
6. **Normaliza títulos** — remove marcas (Nike, Adidas, etc) e a palavra "oficial"; corrige "Feminino" → "Feminina"
7. **Categoriza** via `categorize()` — camisa_torcedor, camisa_retro, conjunto_infantil, etc
8. **Calcula preço por variante** via `calcExpectedPrice()` — base por categoria + extras (manga longa, big size, personalização, patrocínio)
9. **Filtra duplicatas** com fuzzy match (handle/title normalizado) na loja do cliente
10. **Cria coleção** se não existir (auto-handle do título da página)
11. **Importa via productSet async** (3 dispatches paralelos, delay 700ms, polla até COMPLETE)
12. **Log** em `.claude/logs/execution.jsonl`

## Imagens

A skill **não baixa as imagens manualmente**. Usa `files: [{originalSource: <url-externa>}]` no productSet — a Shopify baixa e hospeda nelas mesma. Resultado: imagens ficam **no CDN da Shopify do cliente** (não dependem do site fonte continuar online).

## Tags aplicadas

Cada produto importado recebe:
- `scraped`
- `competitor:<dominio>` (ex: `competitor:futebolreligiao`)

Útil pra rastreabilidade e bulk operations futuras (ex: "remover todos os produtos scraped da Futebol Religião").

## Decisões de design

- **Handle omitido** — Shopify gera automático do título; evita colisão se já existe produto similar
- **Tamanhos brutos da fonte** — não traduz P/M/G/GG/EG. Use `/fix-options` depois se quiser padronizar
- **status=ACTIVE** — produtos ficam visíveis imediatamente. Mudar pra DRAFT manualmente se cliente preferir aprovação prévia
- **Nada de scrape em massa de domínio inteiro** — o input é sempre uma URL de coleção específica. Pra outra coleção, novo run

## Limites e cuidados

- **Rate limit destino**: 3 produtos paralelos com 700ms delay = ~4 req/s na Shopify do cliente, bem dentro do bucket REST de 6/s. Em loja Plus, dá pra subir; pra grátis, manter
- **Tempo estimado**: ~25 produtos = ~3-5 min (scrape + dispatch + poll)
- **Falhas parciais**: se um productSet falhar, os outros prosseguem. Erros vão pra stdout + log
- **Re-execução é segura**: pelo dedupe fuzzy match, rodar 2x não duplica produtos

## Quando NÃO usar

- Cliente quer copiar de loja Shopify nossa template → usar `/import-missing` (mais rápido, completo, com metafields)
- Cliente quer só os preços de um concorrente como referência → use `quality-gate` ou auditoria manual
- Site fonte exige login/JS pra mostrar produtos → adapter atual é HTML estático

Processe $ARGUMENTS conforme os passos acima.
