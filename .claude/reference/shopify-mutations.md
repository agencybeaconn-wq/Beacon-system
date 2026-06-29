# Shopify GraphQL Admin — Mutations essenciais

Cheatsheet das mutations mais usadas pelo Lever System na API **`2026-04`**.
Organizado por categoria. Cada entrada tem: nome, path na doc, e quando usar.

Consultar detalhes: `node .claude/lib/shopify-docs.mjs "<nome da mutation>"`

---

## 🛒 Products

### ⭐ `productSet` (moderno, substitui combos)
- **Path**: [`shopify-docs/pages/api/admin-graphql/latest/mutations/productSet/`](../../shopify-docs/pages/api/admin-graphql/latest/mutations/productSet/content.md)
- **Uso**: Criar/atualizar produto em 1 call (inclui variants, options, media, metafields)
- **Modos**: sync (poucos produtos) | async (grandes payloads — retorna `productSetOperation`)
- **Wrapper**: `productSet(shop, token, input, { synchronous })` em `.claude/lib/shopify-api.mjs`
- **Skill que usa**: `/import-missing --apply`

### `productUpdate`
- Update específico de campos do produto (title, description, seo, tags, status)
- Melhor que `productSet` quando só muda um campo

### `productVariantsBulkUpdate`
- Update em massa de múltiplas variants de 1 produto
- Usado em `/update-prices` e `/bulk-fix-prices`

### `productVariantsBulkCreate` / `productVariantsBulkDelete`
- Criar/deletar variants em lote

### `publishablePublish` (substitui `productPublish` deprecated)
- Publica produto num channel (online store, POS, etc)

---

## ⚡ Bulk Operations

### ⭐ `bulkOperationRunMutation`
- **Path**: [`shopify-docs/pages/api/admin-graphql/latest/mutations/bulkOperationRunMutation/`](../../shopify-docs/pages/api/admin-graphql/latest/mutations/bulkOperationRunMutation/content.md)
- **Uso**: Executar 1 mutation N vezes (ex: 1300 productVariantsBulkUpdate) via JSONL
- **Fluxo**: stagedUploadsCreate → upload JSONL → bulkOperationRunMutation → poll → download
- **Wrapper**: `runBulkMutation(shop, token, mutation, items)` em `.claude/lib/shopify-bulk.mjs`
- **Skills que usam**: `/update-prices`, `/bulk-fix-prices`, `/clean-titles` (default em --apply)

### `bulkOperationRunQuery`
- Exportação massiva de dados via GraphQL query
- Wrapper: `runBulkQuery(shop, token, query)`

### `stagedUploadsCreate`
- Cria staged upload pra enviar JSONL/CSV ao Shopify
- Wrapper: `stagedUploadCreate(shop, token, [{ filename, mimeType, fileSize }])`

---

## 📦 Collections

### `collectionCreate`
- Cria custom/smart collection via GraphQL (substitui REST)
- Campo `ruleSet` pra smart collection

### `collectionUpdate`
- Update de título, descrição, rules, products (manual collection)

### `collectionReorderProducts`
- Reordena produtos dentro de uma collection manual — usado em `/sort-collections`

### `collectionDelete`
- Remove collection

---

## 🍔 Menus

### `menuCreate` / `menuUpdate` / `menuDelete`
- Cada item precisa do campo `type` obrigatório: `FRONTPAGE`, `HTTP`, `COLLECTION`, `PAGE`, `SHOP_POLICY`, `SEARCH`
- Ver skill `/shopify` SKILL.md pra exemplos completos

---

## 💰 Discounts

### ⭐ `discountCodeBxgyCreate`
- **Uso**: Cria desconto Buy X Get Y (Pague 2 Leve 3, etc)
- **Skill**: `/create-discount PAGUE2LEVE3 cliente`

### `discountAutomaticBxgyCreate`
- Desconto automático (sem cupom) Buy X Get Y

### `discountCodeBasicCreate`
- Cupom de % ou valor fixo

### `priceRuleCreate` (REST legacy, não usar)
- Deprecated — use GraphQL discounts

---

## 🗒️ Metaobjects

### `metaobjectCreate` / `metaobjectUpsert` / `metaobjectUpdate`
- Cria estruturas custom reusáveis (FAQ, authors, spec tables, histórico de quality-gate)
- Binding no tema: `shop.metaobjects.<type>.values`

### `metaobjectDefinitionCreate`
- Define o schema do metaobject type

---

## 🔔 Webhooks

### `webhookSubscriptionCreate`
- **Wrapper**: `webhookSubscriptionCreate(shop, token, topic, callbackUrl)`
- **Topics úteis**: `PRODUCTS_UPDATE`, `PRODUCTS_CREATE`, `PRODUCTS_DELETE`, `COLLECTIONS_UPDATE`, `ORDERS_PAID`, `ORDERS_CREATE`, `INVENTORY_LEVELS_UPDATE`
- **Script**: `node .claude/skills/shopify/shopify-watch.mjs watch <cliente>`

### `webhookSubscriptionUpdate` / `webhookSubscriptionDelete`
- Reconfigura ou remove subscription

---

## 🎨 Themes / Files

### `fileCreate`
- Upload de arquivo (imagem, vídeo, 3D model) pro asset library
- Usar com `originalSource` apontando pro resourceUrl do stagedUploadsCreate

### `themeFilesUpsert`
- Update múltiplos assets de tema em 1 call

---

## 📊 Inventory

### `inventoryAdjustQuantities` (⭐ moderno em 2026-04)
- **Delta-based + idempotent** — substitui `inventoryAdjustQuantity` + `inventorySetOnHandQuantities`
- Permite ajuste incremental sem race conditions

---

## 🏪 Markets / Regions

### `marketCreate`
- Multi-region automation (múltiplos países com moedas/idiomas distintos)

---

## 📝 Drafts & Orders

### `draftOrderCreate` / `draftOrderUpdate`
- Cria pedidos rascunho (pra envio manual, B2B, etc)

### `orderEdit` (pra pedidos já fechados)
- Edita pedido já confirmado (add line items, etc)

---

## Convenções

- Todo wrapper em `.claude/lib/shopify-api.mjs` tem:
  - Retry automático em 429 (5 tentativas, backoff exponencial)
  - Detecção de THROTTLED em GraphQL errors
  - Log verboso opcional via `SHOPIFY_VERBOSE=1`
- Antes de criar mutation nova: **consulte `shopify-docs/` primeiro** via `node .claude/lib/shopify-docs.mjs "<termo>"`
