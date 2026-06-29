---
name: bulk-fix-prices
description: Audita e corrige precos de produtos na Shopify comparando com a tabela de precos do banco de dados.
argument-hint: "[nome do cliente]"
---

Audita preços comparando com `client_pricing`. Script `bulk-fix-prices.mjs` na mesma pasta.

## Fluxo
1. Identificar cliente em `agency_clients` por nome
2. Buscar `client_pricing` do banco. Vazio → avisar pra usar `/update-prices` primeiro
3. `CLIENT_ID=uuid node .claude/skills/bulk-fix-prices/bulk-fix-prices.mjs` (dry-run default)
4. Relatório por categoria + amostra de discrepâncias
5. Confirmar → rodar com `--apply`
6. Compare-at opcional: `COMPARE_AT_MARKUP=1.3 node ... --apply`

## Categorização (ordem de prioridade — `categorize()` em `shopify-pricing.mjs`)
**`patch` SEMPRE primeiro** — "Patch X" / "Kit Patch Y" NÃO é camisa, preço próprio (~R$30). Regex `^patch|^patches|^kit patch`.

Ordem: patch → retro → jogador/authentic/player → infantil/kids (exceto "KidSuper") → agasalho → conjunto_treino → jaqueta/corta-vento → moletom/hoodie → short → **torcedor** (fallback).

## Chaves `client_pricing`
**Base** (`section=prices`): camisa_torcedor, camisa_jogador, camisa_retro, conjunto_infantil, agasalho_viagem, conjunto_treino, jaqueta, moletom, short

**Extras** (`section=extras`): personalizacao, manga_longa, patch, tamanho_2gg, tamanho_3gg, tamanho_4gg, patrocinio_extra

## `calcExpectedPrice(title, variant, pricing)` em `shopify-pricing.mjs`
- Base = `pricing[categorize(title)]`
- +manga_longa se título contém "manga longa/longsleeve"
- +personalizacao se option contém "personalizar/customize" (não "Não/No"). EN: "customize/yes"
- +patch se option contém "patch" (não "sem patch")
- +tamanho_NGG se option contém 2GG/2XL, 3GG/3XL, 4GG/4XL (BIG_SIZES na lib)
- `status=active` no fetch (drafts ignorados)

## Rate limit + Output
REST write 350-500ms entre PUTs (6 req/s bucket) · paginação Link header · bulk mutations p/ >500 produtos.

Auditoria: resumo por categoria (total/OK%/erradas) · `price-audit-result.json` com detalhes (productId, variantId, current, expected, extras, options) · 20 primeiros no console.

## Lições

- Patch como camisa = bug clássico → regex `^patch|^patches|^kit patch` tem prioridade
- "KidSuper" é marca, não infantil → excluir no match de `kids`
- `categorize` usa `title` (produto), não `variant.title` (variante)
- Se nenhum preço base mapeado → `{price: null, reason: 'sem preco base'}`, não assume
