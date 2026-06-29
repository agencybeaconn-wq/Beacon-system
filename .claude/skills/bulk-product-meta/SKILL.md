---
name: bulk-product-meta
description: Atualiza metadados de produtos em massa — vendor (fabricante/comerciante), SEO (meta title + description), product_type. Usa bulk operation pra velocidade. Padrão SEO Lever: "{título} | {loja}" + "Compre {título} com frete grátis. Entrega rápida para todo o Brasil."
---

# bulk-product-meta

Atualiza metadados (vendor, SEO, product_type) de produtos Shopify em massa via Bulk Operations.

## Quando usar

- Deploy de loja nova: aplicar vendor padrão e SEO em todos os produtos
- Rebranding: trocar vendor de todos os produtos pro novo nome da loja
- SEO refresh: aplicar padrão canônico Lever (title com pipe + loja, description com frete)
- Unificar produtos importados de múltiplos fornecedores sob um único vendor

## Triggers (linguagem natural)

- "trocar vendor/fabricante/comerciante dos produtos"
- "padronizar SEO dos produtos", "atualizar meta title e description"
- "aplicar SEO template"
- "setar product_type em massa"

## Modos

### `--vendor=<nome>` — Seta vendor

```bash
node .claude/skills/bulk-product-meta/bulk-product-meta.mjs "JGS Sports" --vendor="JGS Sports" --apply
```

### `--seo-auto` — Aplica padrão SEO canônico Lever

Padrão (CLAUDE.md):
- **Title**: `{título do produto} | {nome da loja}` (trunca em 70 chars com "...")
- **Description**: `Compre {título} com frete grátis. Entrega rápida para todo o Brasil.` (trunca em 160 chars)

```bash
# Nome da loja auto-detectado do agency_clients.name
node .claude/skills/bulk-product-meta/bulk-product-meta.mjs "JGS Sports" --seo-auto --apply

# Override nome da loja pra SEO (pra casos em que o cliente quer branding diferente)
node .claude/skills/bulk-product-meta/bulk-product-meta.mjs "JGS Sports" --seo-auto --store-name="JGS" --apply
```

### `--product-type=<tipo>` — Seta product_type

```bash
node .claude/skills/bulk-product-meta/bulk-product-meta.mjs "JGS Sports" --product-type="Camisa de Futebol" --apply
```

### Combinar múltiplas operações

```bash
# Vendor + SEO num único bulk op
node .claude/skills/bulk-product-meta/bulk-product-meta.mjs "JGS Sports" --vendor="JGS Sports" --seo-auto --apply
```

## Flags

- `--apply` — sem isso é DRY-RUN
- `--vendor=X` — seta vendor. Idempotente — skippa produtos que já têm vendor=X
- `--seo-auto` — aplica padrão canônico Lever (sempre sobrescreve — garante consistência)
- `--store-name=X` — override do nome da loja pro SEO (default: client.name)
- `--product-type=X` — seta product_type. Idempotente — skippa produtos que já têm product_type=X

## Protocolo

VALIDATE → FETCH → COMPUTE changes → PREVIEW → CONFIRM → BULK OP → LOG

## Reusa

- `.claude/lib/shopify-api.mjs` — paginate, API_VERSION
- `.claude/lib/shopify-bulk.mjs` — runBulkMutation (staged upload + poll)
- `.claude/lib/validate.mjs` — asserts + execution log

## Padrão Lever (canônico)

Quando deployar loja nova, rodar essa sequência pra cada cliente:

```bash
# 1. Vendor = nome da loja do cliente
node .claude/skills/bulk-product-meta/bulk-product-meta.mjs "<Cliente>" --vendor="<Cliente>" --apply

# 2. SEO padrão
node .claude/skills/bulk-product-meta/bulk-product-meta.mjs "<Cliente>" --seo-auto --apply
```

Nas lojas **template** (BR/EN), o vendor canônico é `Lever Ecomm` (fonte de verdade do catálogo).

## Performance

Bulk operations processam ~1400 produtos em ~2-3 min. Um `--apply` com vendor + SEO combinados é 1 bulk op só.

## Anti-patterns

- Nunca usar REST loop (PUT /products/X.json) pra mais de 50 produtos — gera 429 e é 10× mais lento que bulk
- Nunca aplicar sem `--apply` testado antes em DRY-RUN
