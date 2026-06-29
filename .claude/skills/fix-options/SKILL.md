---
name: fix-options
description: Padroniza nomes de opções de produtos (Tamanho/Personalizar) e gerencia tamanhos de escassez (PP/5GG).
argument-hint: [nome do cliente] [option-names | scarcity | both]
---

# Fix Options — Padronizar Opções + Escassez

Padroniza nomes ("Size"→"Tamanho", "Customize"→"Personalizar") e gerencia tamanhos de escassez (PP/5GG com `inventory_policy: deny`).

## Modos
- `option-names` — só rename de opções
- `scarcity` — só PP/5GG (add em camisas adultas, remove em não-camisa/infantil)
- `both` (default)

## Helpers obrigatórios

Importar de `shopify-api.mjs` (`shReq`, `shopifyGraphQL`, `getCreds`, `delay`) — não duplicar `httpReq`.

```js
const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', '2GG', '3GG', '4GG', '5GG'];
const ADULT_SIZES = ['P', 'M', 'G', 'GG', '2GG', '3GG', '4GG'];
const SCARCITY_SIZES = ['PP', '5GG'];

const isShirt = t => /camisa|camiseta|jersey|manto|regata/i.test(t);
const isInfantil = t => /infantil|kids|conjunto infantil/i.test(t) && !/kidsuper/i.test(t);
const isNonShirtProduct = t => /chuteira|conjunto infantil|shorts|short |meião|meia |caneleira|bola |luva /i.test(t);
const hasAdultSizes = vs => vs.some(v => ADULT_SIZES.includes(v.option1));
const hasKidsSizes = vs => vs.some(v => /^\d+-\d+$/.test(v.option1));   // 2-3, 4-5...
```

## Fluxo

1. Identificar cliente em `agency_clients`
2. Determinar modo (default `both`)
3. Auditoria → `scripts/fix-options-report.json`
4. Preview + confirmação
5. Execute

## Auditoria — pra cada produto

**a) Option naming** (modos `option-names` / `both`):
- Opção "Size" → rename pra "Tamanho"
- Opção "Customize" → rename pra "Personalizar"

**b) Scarcity** (modos `scarcity` / `both`):
- `isShirt(title)` E `!isInfantil(title)` E `hasAdultSizes(variants)` E sem PP ou 5GG → **adicionar PP/5GG**
- (`!isShirt(title)` OU `isInfantil(title)`) E tem PP ou 5GG → **remover PP/5GG**
- `hasKidsSizes(variants)` (só tamanhos 2-3, 4-5...) → NÃO adicionar PP/5GG

**Report JSON:**
```json
{
  "optionRenames": [{ "productId", "title", "optionId", "from": "Size", "to": "Tamanho" }],
  "addScarcity": [{ "productId", "title", "missingPP": true, "missing5GG": true, "referencePrice": "249.90", "option2Value": "Não" }],
  "removeScarcity": [{ "productId", "title", "variantsToRemove": [{ "variantId", "size": "PP" }] }]
}
```

## Preview
```
- X produtos rename (Size→Tamanho, Customize→Personalizar)
- Y camisas precisam PP/5GG
- Z produtos não-camisa precisam limpeza (remover PP/5GG)
Confirmar?
```

## Execução

### 4a. Rename (GraphQL `productOptionUpdate`)
```js
mutation productOptionUpdate($productId: ID!, $option: OptionUpdateInput!) {
  productOptionUpdate(productId: $productId, option: $option) {
    product { id } userErrors { message } } }
// variables: { productId: "gid://shopify/Product/${id}", option: { id: "gid://shopify/ProductOption/${id}", name: r.to } }
```
delay(400) entre calls.

### 4b. Add scarcity (REST `POST /products/{id}/variants.json`)
```js
const variant = {
  option1: 'PP' || '5GG',
  price: p.referencePrice,           // preço da P ou M existente
  inventory_policy: 'deny',          // ESCASSEZ — não vende sem estoque
};
if (p.option2Value) variant.option2 = p.option2Value;  // "Não" se produto tem opção Personalizar
```
Após adicionar PP e/ou 5GG, **reordenar variantes** (4d).

### 4c. Remove scarcity (REST `DELETE /products/{pid}/variants/{vid}.json`)
delay(400) entre calls.

### 4d. Reorder variants
```js
const sorted = [...variants].sort((a, b) => {
  const ia = SIZE_ORDER.indexOf(a.option1), ib = SIZE_ORDER.indexOf(b.option1);
  if (ia === -1 && ib === -1) return 0;
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
});
// Aplicar PUT /products/{id}.json com { product: { id, variants: sorted.map(v => ({id: v.id})) } }
```
Ordem final: **PP → P → M → G → GG → 2GG → 3GG → 4GG → 5GG**

Se 2 opções (Tamanho + Personalizar): agrupar por tamanho mantendo ordem — `PP/Não, PP/Personalizar, P/Não, P/Personalizar, ...`

## Regras importantes

- **delay(400)** entre cada chamada à Shopify API
- **inventory_policy: 'deny'** para PP e 5GG (não vende sem estoque = escassez)
- **Não adicionar PP/5GG** a produtos infantis (isInfantil) mesmo se forem camisas
- **Não adicionar PP/5GG** a produtos que só têm tamanhos kids (2-3, 4-5, 6-8, etc)
- **referencePrice**: usar o preço da variante P ou M existente como referência para PP e 5GG
- **option2Value**: se o produto tem opção "Personalizar", setar option2 como "Não" para PP/5GG
- Rodar como script Node.js em background
- Salvar scripts em `scripts/` e reports em `scripts/`

## Custo-benefício (memory `feedback_custo_beneficio`)

Antes de aplicar, imprimir:
```
- N produtos rename (Size→Tamanho)
- M camisas vão receber PP/5GG (excluindo infantil)
- Tempo: ~600ms × (N+M) sequencial
- Calls: N PUTs option rename + M variants creates
```

```bash
node fix-options.mjs "Cliente"                          # dry-run
node fix-options.mjs "Cliente" --apply --expected=230   # apply com circuit-breaker
```

Quando virar .mjs, usar `lib/cost-estimate.mjs` (`printEstimate` + `abortIfTooLarge`).

Processe $ARGUMENTS conforme acima.
