---
name: import-missing
description: Compara produtos da loja do cliente com o template e importa os que estao faltando, aplicando precos do cliente.
argument-hint: [nome do cliente]
---

# Import Missing Products

Compara catálogo do cliente com o template (BR ou EN) via fuzzy match de handle/title, identifica produtos faltantes, categoriza, e calcula preço esperado pra cada um.

## Segue o [PROTOCOL.md](../../PROTOCOL.md)

VALIDATE → DRY-RUN → PREVIEW → CONFIRM → EXECUTE → LOG

## Lib compartilhada

- [`../../lib/shopify-pricing.mjs`](../../lib/shopify-pricing.mjs) — `categorize()`, `calcExpectedPrice()`
- [`../../lib/shopify-api.mjs`](../../lib/shopify-api.mjs), [`supabase-rest.mjs`](../../lib/supabase-rest.mjs), [`validate.mjs`](../../lib/validate.mjs)

## Templates

Auto-detecção pela skill:
- **BR** (`5e836736-7411-42d8-b99e-bcad1e55919d`) — testeloja-9899.myshopify.com
- **EN** (`17089519-4779-41bb-96ca-9791e0677cf8`) — loja-de-estruturacao-e-desenvolvimento-en.myshopify.com

Override via `--template=<id>`.

## Script executável (read-only)

```bash
# Lista produtos faltantes + preço esperado
node .claude/skills/import-missing/import-missing.mjs "Nome do cliente"

# Força template específico
node .claude/skills/import-missing/import-missing.mjs "Nome do cliente" --template=39d74aff-...
```

## Importação de fato: usar `/deploy-store`

**Importante:** este wrapper é **read-only**. Ele identifica os faltantes + preço esperado, mas a importação real (copiar produto com imagens + variantes + metafields) é feita pela skill **`/deploy-store`** (step `products`).

**Fluxo recomendado:**
1. `/import-missing <cliente>` → lista faltantes + preview
2. User decide: quer importar todos? alguns?
3. `/deploy-store <cliente>` → pipeline completo com images + variantes
4. `/update-prices <cliente>` → aplica preços corretos (se não foram aplicados no deploy)

## ⚠️ Pricing por variante (extras)

**NUNCA aplicar preço flat único** ignorando extras do cliente. A lib `calcExpectedPrice` faz isso automaticamente **por variante**, aplicando:

1. **Base por categoria** — schema v7 (`camisa_torcedor`, `camisa_torcedor_patrocinios`, `camisa_torcedor_2024`, `camisa_feminina`, `camisa_jogador_total90`, etc.) tem precedência. Se a sub-key específica existir, usa ela em vez da base genérica:
   - título contém `Com Patrocínios` → `camisa_torcedor_patrocinios` ou `camisa_jogador_patrocinios`
   - título contém `Feminina/Woman` → `camisa_feminina`
   - título com ano ≤ 2024 (ex: `2023/24`, `2024/25`, `2024`) → `camisa_torcedor_2024` ou `camisa_jogador_2024`
   - título com `Total 90` → `camisa_*_total90`
2. **Personalização** (`extras.personalizacao`, default R$30) — aplicado se `variant.optionN === 'Personalizar'`
3. **Big size** (`extras.tamanho_2gg`, `tamanho_3gg`, `tamanho_4gg`, default R$10) — aplicado se `option1 ∈ {2GG, 3GG, 4GG, GGG, GGGG}`
4. **Patrocínio fallback** (`extras.patrocinio_extra`, default R$45) — só se a sub-key v7 `_patrocinios` NÃO foi usada como base (senão duplicaria)
5. **Manga longa** (`extras.manga_longa`, default R$30)

**Antes de importar**, SEMPRE verificar:
```js
const pricing = await fetchPricing(clientId);
console.log('extras configurados:', Object.keys(pricing.extras));
console.log('products keys:', Object.keys(pricing.products));
```
Se `extras` tiver entradas, a lib as aplica. Se produtos de referência existirem na loja, conferir a **moda de preço** dos existentes pra validar.

**Incidente 2026-04-13 (não repetir)**: importei 36 produtos Corinthians pro Coringão com preço flat R$219.99 ignorando:
- `extras.personalizacao` (R$30) → variantes "Personalizar" ficaram sem o +30
- `extras.tamanho_2gg/3gg/4gg` (R$10) → variantes big size sem o +10
- `camisa_torcedor_patrocinios` (R$339.99) → "Com Patrocínios" ficaram a R$219.99
- `camisa_torcedor_2024` (R$209.99) → produtos 2023/24 ficaram a R$219.99

Tive que reprecificar 332 variantes depois. Use `calcExpectedPrice` direto — ela faz tudo certo desde [commit desta atualização].

## Fuzzy match

O script compara por **handle normalizado** E **title normalizado** (`normalize()` remove acentos, espaços, traços, case). Se QUALQUER um bater, o produto é considerado "presente".

Exemplo: "Camisa Flamengo 25/26 I" no cliente bate com "Camisa Flamengo 25 / 26 I" no template (normalizado: `camisaflamengo2526i`).

## Exemplo

**Cenário**: Cliente tem 500 produtos, template tem 650. Precisa descobrir o que falta.

```
/import-missing Julico Sports
```

1. Busca 500 + 650 em paralelo (lojas diferentes = seguro)
2. Indexa cliente por handle+title normalizado
3. Pra cada produto do template, checa se está no cliente
4. Categoriza + calcula preço esperado pros faltantes
5. Mostra: "120 faltantes, maioria em camisa_torcedor e camisa_retro"
6. Salva plano em `.tmp_import_missing_plan.json`
7. Usuário decide próximo passo (deploy-store ou ignorar)

Processe $ARGUMENTS conforme os passos acima.
