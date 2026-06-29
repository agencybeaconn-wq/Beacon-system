---
name: create-segments
description: Cria segmentos de clientes personalizados (Shopify Customer Segments) pra email marketing — compradores de uma tag/produto, win-back (comprou X + frio há N dias), exclusão de outros clubes, e carrinho abandonado estritamente de um time. Exporta CSV consent-aware (filtra SUBSCRIBED). Valida e corrige higiene de tag antes de confiar no segmento. Contorna a parede de 60 dias da API de pedidos.
argument-hint: "<loja>" --bought-tag=<tag> [--winback-days=N] [--export] | --verify-tag=<tag> [--fix-tag] | --abandoned-only-tag=<tag>
---

# create-segments

Monta listas de email marketing a partir do comportamento de compra do cliente. Output pronto pra Reportana/Klaviyo/Shopify Email.

## Quando usar

- "criar segmento de quem comprou camisa do Cruzeiro"
- "lista de win-back: comprou X e sumiu há 90 dias"
- "clientes que abandonaram carrinho só com produto do time Y"
- "lista de email de compradores de [tag/coleção]"
- Qualquer pedido de **lista de email baseada em compra/comportamento**

## ⚠️ A regra de ouro: a parede de 60 dias

A API de pedidos (REST e GraphQL `orders`) **só enxerga os últimos 60 dias** sem o escopo protegido `read_all_orders` — que as lojas Lever **não têm**. Então:

- ❌ "quem comprou X há +90 dias" via dados de pedido → **ZERO silencioso** (os pedidos antigos são invisíveis).
- ✅ **Customer Segments** varrem o **histórico inteiro** (sistema diferente, não sofre a parede). É sempre o caminho pra qualquer recorte histórico.

Checar escopo: `GET /admin/oauth/access_scopes.json` → procurar `read_all_orders`.

## ⚠️ Segundo: tag suja contamina TUDO

O segmento por `products_purchased(tag:'x')` é só tão bom quanto a tag. Tags ficam sujas porque produtos são **duplicados** (ex: uma "Camisa Flamengo Todos Patrocínios" criada a partir de uma do Cruzeiro herda a tag `cruzeiro`). Resultado: falsos positivos (outro clube na lista) e falsos negativos (produto do time sem a tag).

**SEMPRE validar antes de entregar:**
```bash
node .claude/skills/create-segments/create-segments.mjs "<loja>" --verify-tag=cruzeiro
```
Compara `tag:cruzeiro` vs `title:*Cruzeiro*` e lista divergências. A regra da **smart collection** do time costuma ser `TITLE CONTAINS "X"` — esse é o ground truth da loja, melhor que a tag. Se houver divergência, corrigir:
```bash
node .claude/skills/create-segments/create-segments.mjs "<loja>" --verify-tag=cruzeiro --fix-tag
```
(Remove a tag dos falsos+, adiciona nos faltando, via `tagsRemove`/`tagsAdd`. É **escrita no catálogo** — pedir OK do Pedro antes.) O índice de busca do Shopify atualiza **assíncrono (~30-60s)** após o fix.

## Sintaxe da Segment Query Language (dialeto Admin)

Não é o ShopifyQL com `MATCHES` que aparece em shopify.dev (esse dá `'MATCHES' is unexpected`). O `segmentCreate(name, query)` usa:

| Intenção | Query |
|---|---|
| Comprou produto da tag | `products_purchased(tag: 'cruzeiro') = true` ← o `= true` é **obrigatório** |
| Comprou produto por ID | `products_purchased(id: 123) = true` (máx **~10 ids**) |
| Win-back (comprou + frio Nd) | `products_purchased(tag: 'cruzeiro') = true AND last_order_date < -90d` |
| Excluir quem comprou outro time | `... AND products_purchased(tag: 'flamengo') = false` |

**Limites do Shopify:** máx **10 filtros** por segmento e **~10 ids** por `products_purchased`. Não dá pra listar 100+ produtos por id nem excluir 40 clubes — por isso **a tag tem que estar limpa**. Filtros disponíveis: `segmentFilters(first:250){edges{node{queryName}}}` (products_purchased, orders_placed, last_order_date, first_order_date, number_of_orders, customer_tags, storefront.product_viewed…).

## Carrinho abandonado (não existe em segmento)

`abandonedCheckouts` **não** sofre a parede de 60d e **não** é expressável em segmento — puxar via GraphQL e filtrar em código. "Estritamente do time X" = todo line item é do time (match por título) **ou** neutro. Neutros = `patch`/`personaliza`/`vale presente`/`gift card`. Personalização (Nome/Número) vem como `customAttributes` no item da camisa (não é item separado); patches são line items próprios titulados "Patch…". Filtrar `completedAt == null`.

## Uso

```bash
# Compradores de uma tag + win-back + export consent-aware
node .claude/skills/create-segments/create-segments.mjs "Mantos do PH" --bought-tag=cruzeiro --winback-days=90 --export --subscribed-only

# Só compradores (sem corte de recência)
node .claude/skills/create-segments/create-segments.mjs "<loja>" --bought-tag=cruzeiro --export

# Excluir quem também comprou outros times (cap de 8)
node .claude/skills/create-segments/create-segments.mjs "<loja>" --bought-tag=cruzeiro --exclude-tags=flamengo,palmeiras,atletico mineiro --export

# Higiene de tag (SEMPRE antes de confiar)
node .claude/skills/create-segments/create-segments.mjs "<loja>" --verify-tag=cruzeiro            # dry
node .claude/skills/create-segments/create-segments.mjs "<loja>" --verify-tag=cruzeiro --fix-tag  # corrige

# Carrinho abandonado estritamente do time
node .claude/skills/create-segments/create-segments.mjs "<loja>" --abandoned-only-tag=cruzeiro --export
```

## Flags

- `--bought-tag=<tag>` — segmento `products_purchased(tag)=true`
- `--bought-ids=<a,b,…>` — alternativa por IDs (máx ~10)
- `--winback-days=<N>` — adiciona `AND last_order_date < -Nd`
- `--exclude-tags=<csv>` — adiciona `= false` por tag (cap de 8, respeitando o limite de 10 filtros)
- `--name="<nome>"` — nome do segmento (default gerado)
- `--verify-tag=<tag>` / `--fix-tag` — auditoria e correção de higiene
- `--abandoned-only-tag=<tag>` — carrinhos abandonados só desse time
- `--export` / `--subscribed-only` — exporta CSV (+ versão só SUBSCRIBED)
- `--out=<dir>` — pasta de saída (default `~/Downloads`)
- `--dry-run` — preview, não cria/escreve

## Compliance (obrigatório)

O CSV sempre traz `marketing_consent`. **Disparar só `SUBSCRIBED`.** `UNSUBSCRIBED` **nunca**; `NOT_SUBSCRIBED` é zona cinza (depende da ferramenta/jurisdição — confirmar com o Pedro). Use `--subscribed-only` pra gerar a lista pronta.

## Reusa

- `.claude/lib/shopify-api.mjs` — `shopifyGraphQL`, `delay`
- `.claude/lib/validate.mjs` — `assertClientExists`, `assertShopifyConnected`

## Anti-patterns (evitar)

- Nunca prometer "comprou há +90 dias" via dados de pedido em loja sem `read_all_orders` — dá zero. Use segmento.
- Nunca entregar lista por tag **sem rodar `--verify-tag`** antes — tag suja entrega outro clube como se fosse o time.
- Nunca disparar pra `UNSUBSCRIBED`.
- Nunca afirmar "comprou SÓ o time X" via segmento — o cap de 10 filtros + produtos sem tag de clube impedem garantia 100%. Seja honesto sobre o melhor-esforço.

## Memory relacionada

- `reference_shopify_segments_e_parede_60d` — os fatos canônicos (parede 60d, dialeto, tag suja, compliance).
