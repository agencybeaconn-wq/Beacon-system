# bulk-deploy-products — Deploy massivo de produtos via Bulk Operations

Deploy de 1000+ produtos em ~5 minutos usando `bulkOperationRunMutation` + `productSet` da Shopify GraphQL Admin API (2026-04).

**Antes:** REST sequencial = ~2.7 horas pra 1400 produtos.
**Agora:** Bulk operation server-side = ~4 minutos pra 1400 produtos.

## Como funciona

```
1. stagedUploadsCreate    → URL pré-assinada no Google Cloud Storage
2. Upload JSONL           → 1 linha por produto (productSet input)
3. bulkOperationRunMutation → Shopify processa TUDO server-side
4. Poll até COMPLETED     → resultado JSONL com IDs criados
```

O Shopify processa internamente sem rate limit, baixa imagens do CDN server-side, e deduplicação é nativa via `productSet` (handle match).

## Uso

```bash
# DRY-RUN: mostra quantos produtos seriam criados
node .claude/skills/bulk-deploy-products/bulk-deploy-products.mjs "Nome do Cliente"

# EXECUTAR: deploy real (default publica no Online Store em paralelo após create)
node .claude/skills/bulk-deploy-products/bulk-deploy-products.mjs "Nome do Cliente" --apply

# Template EN em vez de BR
node .claude/skills/bulk-deploy-products/bulk-deploy-products.mjs "Nome do Cliente" --apply --source=EN

# Source customizado (UUID)
node .claude/skills/bulk-deploy-products/bulk-deploy-products.mjs "Nome do Cliente" --apply --source-id=UUID

# Não publicar (deixa produtos invisíveis no Online Store)
node .claude/skills/bulk-deploy-products/bulk-deploy-products.mjs "Cliente" --apply --no-publish

# Paralelismo customizado (default 10 concurrent)
node .claude/skills/bulk-deploy-products/bulk-deploy-products.mjs "Cliente" --apply --concurrency=20
```

## Publish no Online Store

Após o bulk create, a skill dispara automaticamente um **publish paralelo** (10 concurrent) via REST PUT `published: true`. Workaround pro `productSet` não aceitar `publications` input quando o app não tem scope `write_publications` (caso comum em apps custom existentes).

**Benchmark publish paralelo:**
- 1500 produtos, 10 concurrent = ~3 min (vs 29 min sequencial)
- Rate limit aware via `shReq` retry automático em 429

**Desativar publish:** `--no-publish` (use se quer publicar depois via UI ou outro flow).

## Triggers (linguagem natural)

- "subir produtos do template"
- "deploy produtos rápido"
- "importar todos os produtos"
- "copiar catálogo do template"
- "bulk deploy"

## O que o productSet inclui

Cada produto é criado com:
- `title`, `handle`, `descriptionHtml`, `vendor`, `productType`, `tags`
- `productOptions` (Tamanho, Personalizar, etc.)
- `variants` com `optionValues`, `price`, `inventoryPolicy: CONTINUE`, `tracked: false`
- `files` (imagens via URL — Shopify baixa do CDN server-side)
- `compare_at_price` (quando válido: compare_at > price)

## Deduplicação

- Busca handles existentes na loja destino ANTES de gerar o JSONL
- Filtra duplicatas de handle no template fonte (Set)
- `productSet` com handle existente = update (não duplica)
- **Idempotente:** rodar 2x não cria duplicatas

## API Shopify usada

| Mutation | Documentação |
|----------|-------------|
| `stagedUploadsCreate` | Cria URL pré-assinada pra upload de JSONL |
| `bulkOperationRunMutation` | Executa mutation em massa via JSONL server-side |
| `productSet` | Cria/atualiza produto com variants, options, media num único call |

Todas documentadas em `shopify-docs/pages/api/admin-graphql/latest/mutations/`.

## Comparação de performance

| Método | 1400 produtos | Rate limit |
|--------|--------------|------------|
| REST sequencial (antigo) | ~2.7 horas | 2 req/s, bloqueado por imagens |
| GraphQL productSet sync | ~45 min | 1 req/s, throttled |
| **Bulk operation (este)** | **~4 min** | **Sem limit (server-side)** |

## Limitações

- 1 bulk mutation por loja ao mesmo tempo (pode ter 1 bulk query rodando em paralelo)
- JSONL max ~20MB por upload
- Imagens precisam ser URLs públicas acessíveis (CDN Shopify OK)
- Não suporta metafields de namespace custom sem declaração prévia
- **SEO (seo.title/seo.description) NÃO é copiado** — a fonte é REST `products.json`, que não expõe SEO. Se o source tem SEO customizado (caso clone-store loja→loja), rodar pós-deploy um bulk `productUpdate` copiando `seo` por handle via GraphQL (feito no clone Goalkit→Jersey Ten, 2026-06-11). Fix definitivo = migrar a fonte pra GraphQL.

## Lib compartilhada

- `../../lib/shopify-api.mjs` — `shReq`, `shopifyGraphQL`, `nextPageUrl`, `getCreds`
- `../../lib/supabase-rest.mjs` — `fetchClient`
