# FutNations — Audit de variants: loja EN com catálogo importado em PT

**Data:** 2026-05-11
**Loja:** FutNations (`loja-futnation.myshopify.com` → `www.futnationshop.com`)
**Status:** Diagnosticado, não aplicado (Pedro pediu só reportar)
**Severidade:** Crítica (Bug 2 está custando dinheiro real toda venda)

## Contexto

Cliente reclamou que patches não cobravam no carrinho. Durante o fix, Pedro pediu pente fino nas variants (2G/3G/4G, Customize, sponsors, manga longa). Auditei os 592 produtos da loja.

## Achados

### Bug 1 — Tamanhos em PT na loja EN: 144 produtos

Loja é EN (USD, lang=en), mas variants de tamanho usam padrão PT (P/M/G/GG/2GG/3GG/4GG/XG/XGG). Deveria ser S/M/L/XL/2XL/3XL/4XL conforme `feedback_en_sizes_xl`.

**Exemplos:**
- `[7502254997562]` Bobojaco Nike Corinthians 2025 → `P, M, G, GG, XG, XGG`
- `[7502253817914]` Camisa Feminina Reebok Botafogo 2025/26 IV → `P, M, G, GG, 2GG`
- `[7502250180666]` Camisa Adidas Feminina Treino Flamengo 2025/26 → `P, M, G, GG, 2GG, 3GG`
- `[7502250246202]` Camisa Adidas Flamengo 2025/26 I → `P, M, G, GG, 2GG, 3GG`
- `[7502250344506]` Camisa Adidas Flamengo Authentic Com Patrocínios → `P, M, G, GG, 2GG, 3GG, 4GG`

Lista completa salva em `c:/tmp/futnation-audit.json` (gerada durante audit).

### Bug 2 — Customize Yes ao mesmo preço de Customize No: 109 produtos (CRÍTICO)

109 produtos têm a opção `Customize (+$10)` com `Yes` e `No`, mas a variant `Yes` está com o **mesmo preço** que `No`. Cliente seleciona Customize Yes, paga só o valor base — os $10 do acréscimo não cobram.

**Impacto:** loja perde $10 toda venda com personalização nesses 109 produtos. Não é só um problema cosmético — é perda de receita direta.

**Causa raiz provável:** quando o catálogo foi importado/clonado de BR, os preços foram unificados sem aplicar o incremento de Customize. Memory `feedback_pricing_increments` diz personalização é **acréscimo** sobre preço base, nunca igual.

**Exemplos:**
- `[7502254932026]` Atletico Mineiro 2025/26 I Home Jersey - Fan Version → S/No $90, S/Yes $90 (diff $0)
- `[7502252113978]` Atletico Mineiro 2025/26 II Away Jersey - Fan Version → S/No $90, S/Yes $90 (diff $0)
- `[7502262960186]` Camisa Feminina São Paulo 2025/26 Third → tamanho/No $90, tamanho/Yes $90 (diff $0) — todos tamanhos
- `[7502263517242]` Camisa Feminina São Paulo 25/26 Away → idem

Cliente que selecionar "Yes" hoje leva personalização grátis.

### Bug 3 — Nomes de option em PT / inconsistentes

| Option name | Qtd | Status |
|---|---|---|
| `Size` | 566 | OK |
| `Customize (+$10)` | 213 | OK |
| `Customize Jersey (+$10)` | 54 | OK |
| `CUSTOMIZE (+$10)` | 28 | caixa alta inconsistente |
| `Customize Jersey  (+$10)` | 4 | typo (duplo espaço) |
| `Adicionar Patches` | 64 | PT |
| `ADICIONAR PATCHS` | 4 | PT + typo "Patchs" |
| `ADICIONAR PATCHS ` | 1 | PT + typo + espaço final |
| `Personalização ( Grátis )` | 1 | PT + viola `feedback_personalizacao_minimo_30` (diz Grátis) |
| `Todos os Patrocinadores +R$50` | 1 | PT + BRL em loja USD |

### Bug 4 — Combos Customize incompletos

Zero problemas. Todos os produtos com option Customize têm pares Yes/No completos.

## Causa raiz

Catálogo da FutNations foi **clonado/importado de loja BR** (provavelmente Template BR) sem conversão pros padrões EN. Tamanhos, nomes de option e até preços de acréscimo ficaram no formato BR.

Isso bate com o sintoma original ("patches não cobravam"): catálogo bagunçado + tema desconfigurado.

## Responsabilidade: do cliente, não da Lever

Evidências de que o catálogo NÃO foi importado pela Lever:

| Sinal | Valor | Conclusão |
|---|---|---|
| Vendor dos 592 produtos | 100% `FutNation` (zero `Lever Ecomm`) | Não passou pela nossa importação |
| Cliente cadastrado na Lever | 2026-05-05 | Recente |
| Cliente conectou Shopify | 2026-05-07 | 2 dias depois |
| Produtos criados antes de 2026-05-05 | ~88% (520+ de 592) | Catálogo pré-existente |
| `store_deployments` rows pra `client_id=c04c8f31-...` | 0 | Nunca rodamos deploy Lever pra esse cliente |
| Datas de criação | 2026-01-30 (118), 2026-02-23 (22), espalhado fev-mar | Imports espaçados feitos por terceiro |

Cliente subiu **catálogo BR em loja EN** por conta própria antes de virar nosso cliente. Os bugs (sizes PT, "Personalização Grátis", "Todos os Patrocinadores +R$50", typos como "PATCHS") são todos padrões BR — vieram de fonte de import dele (CSV de fornecedor estilo Mantos/Dropfut/etc), não do nosso Template EN.

Pra defender no atendimento: **isso é problema estrutural do catálogo importado pelo cliente, anterior à entrada dele na Lever**. A Lever pode corrigir como serviço extra (a partir do plano de fix em 4 fases abaixo), mas não é bug nosso.

## Plano de fix (quando Pedro decidir atacar)

### Fase 1 — Bug 2 (CRÍTICO, $$$)
Atualizar `compare_at_price` e `price` das 109 variants `Yes` pra ficar exatamente $10 acima da `No` correspondente. Aplicar via `productVariantsBulkUpdate` da GraphQL Admin API. Possível usar `fix-options` skill ou ad-hoc script.

```graphql
mutation { productVariantsBulkUpdate(productId: ..., variants: [{ id: ..., price: "100.00", compareAtPrice: "..." }]) { ... } }
```

### Fase 2 — Bug 1 (sizes PT → EN)
Para cada um dos 144 produtos: renomear option values (P→S, M→M, G→L, GG→XL, 2GG→2XL, 3GG→3XL, 4GG→4XL, XG→XL, XGG→2XL). Via `productOptionUpdate` ou `productSet`. Cuidado: rename de option value preserva o variant; criar/deletar variant não é necessário.

### Fase 3 — Bug 3 (nomes option PT → EN)
Renomear via `productOptionUpdate`:
- `Adicionar Patches` → `Add Patches`
- `ADICIONAR PATCHS` / `ADICIONAR PATCHS ` → `Add Patches` (e arrumar typo)
- `CUSTOMIZE (+$10)` → `Customize (+$10)` (caixa baixa consistente)
- `Customize Jersey  (+$10)` → `Customize Jersey (+$10)` (remover duplo espaço)
- `Personalização ( Grátis )` → `Customize (+$10)` (+ aplicar preço incremento de $10)
- `Todos os Patrocinadores +R$50` → `All Sponsors (+$10)` (converter BRL→USD com taxa do cliente)

### Fase 4 — Validar sistêmica
Re-rodar audit pra confirmar bugs zerados. Adicionar essas checagens no `quality-gate` skill pra detectar drift futuro nas lojas EN.

## Não-bugs / pontos OK

- Todos os patches (16 produtos com `Patch` no title) têm estrutura OK
- Variants pareadas Yes/No: zero gaps
- 566/592 produtos têm option `Size` (correto)
- Status `connected` na FutNations restaurado em 2026-05-11 18:50 BRT

## Acesso

Token FutNations no DB foi renovado por Pedro hoje (`shpca_e27f6f...`), está funcionando. Audit completo gerado a partir de `/admin/api/2024-10/products.json` (592 produtos, 1 página com paginação).
