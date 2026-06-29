---
name: quality-gate
description: Radar completo de qualidade de uma loja Shopify — 27 checks. v5 adiciona 3 checks de tema descobertos em treino Campo de Treinamento (emoji em texto, scarcity fake, smart catch-all). v4 adicionou 7 de conversão (PIX, bonus banners, CartPanda bypass, contact, troca personalizado, WhatsApp, tracking page). Flag --theme-id mira tema unpublished. Read-only, ~120s. Salva histórico em client_quality_runs.
argument-hint: [nome do cliente]
---

# Quality Gate v5 — Radar de Qualidade Completo

Diagnóstico completo (< 2 min, read-only) de **27 sinais críticos** de uma loja Shopify. Complementa `/audit-store` (mais detalhado mas mais lento). Salva histórico em `client_quality_runs` pra dashboard de tendências.

**Flag útil:** `--theme-id=X` mira tema específico (ex: unpublished pra treino/preview) em vez do role=main.

## Quando usar

- **Pré-flight**: antes de rodar `/update-prices`, `/deploy-store`, etc, pra confirmar que a loja está saudável
- **Diagnóstico rápido**: cliente reclama de algo, user quer overview em 20s
- **Scheduled daily**: rodar todo dia e alertar se novo FAIL apareceu
- **Comparar antes/depois** de uma operação massiva

## Os 14 checks

### Checks v1 (original)

| # | Check | PASS | WARN | FAIL |
|---|---|---|---|---|
| 1 | **Preços fora do padrão** (vs `client_pricing`) | < 1% variantes divergentes | 1-5% | > 5% |
| 2 | **Variantes esgotadas** (`inventory_quantity=0` + `inventory_policy=deny`) | 0 | < 5% | > 5% |
| 3 | **Produtos sem imagem** (`images.length === 0`) | 0 | < 2% | > 2% |
| 4 | **Coleções vazias** (`products_count < 3`) | < 5 vazias | 5-10 | > 10 |
| 5 | **SEO metafields** (`metafields_global_title_tag` vazio) | < 10% produtos sem SEO | 10-30% | > 30% |

### Checks v2 (novos)

| # | Check | Descrição |
|---|---|---|
| 6 | **Produtos duplicados** | Mesmo handle ou título idêntico → bug de import 2x |
| 7 | **Coleções obrigatórias** | Brasileirão, Copa do Mundo, Seleções, ligas principais (configurável por cliente em `client_quality_config.required_collections`) |
| 8 | **Menus quebrados** | Items de menu apontando pra coleção/página/produto inexistente (404) |
| 9 | **Produtos sem categoria** | `categorize()` retorna null — produto precisa ser renomeado ou é outro tipo |
| 10 | **Preço zero/null** | Variantes com price=0 → erro de import |
| 11 | **Smart rules vazias** | Smart collections sem rules → nunca populam |
| 12 | **Pricing no banco** | `client_pricing` vazio → check 1 fica sem referência |
| 13 | **Títulos com typo** | "Camisa X Feminino" em vez de "Feminina" → rode `/clean-titles` |
| 14 | **Compare_at_price bizarro** | `compare_at <= price` → promoção falsa |

### Checks v3 (Shopify Docs / Fase 6)

| # | Check | Detalhes |
|---|---|---|
| 15 | **API version outdated** | Confirma que a API_VERSION (hoje `2026-04`) ainda é aceita pelo Shopify — alerta se 404/406 |
| 16 | **checkout.liquid legacy** | Detecta uso de `layout/checkout.liquid` (deprecated em agosto/2026) → migrar pra Checkout UI Extensions |
| 17 | **Webhooks reativos** | Alerta se cliente não tem subscriptions pra `products/update` e `orders/paid` → rode `shopify-watch.mjs watch` |

### Checks v4 (Conversão / Onda 1 — 2026-05-19)

Cruzando padrões vencedores de Mantos PH + Nike Football BR + Classic Football Shirts UK (estudo [[conversao-vault]]).

| # | Check | PASS quando... | Origem |
|---|---|---|---|
| 18 | **Contact source consistency** | shop.email (do DONO) ≠ email publicado no tema (atendimento) | memory `feedback_contact_source` |
| 19 | **Troca de personalizado declarada** | Página de política cita personalização/nome/número/estampa | Vácuo Nike (NÃO faz) = moat Lever |
| 20 | **WhatsApp atendimento visível** | settings tem wa.me ou campo whatsapp configurado | Moat dormente Lever |
| 21 | **Página de rastreamento** | Existe /pages/rastreamento ou similar | Convergência 3/3 |
| 22 | **PIX badge presente e dinâmico** | `snippets/pix-badge.liquid` existe + tem listener `variantChange` | Mantos + Nike (2/2 BR) |
| 23 | **Cart drawer bonus banners** | 1+ `bonus_X_enabled === true` em settings_data.json | Mantos cascata (dopamina empilhada) |
| 24 | **CartPanda bypass ativo** | SE CartPanda conectado, cart-drawer tem `cartxTriggerCheckout` | Mantos pattern (pula /cart, economiza step) |

### Checks v5 (Gaps Treino Campo de Treinamento — 2026-05-19)

Gaps descobertos quando o agente lever-qa tentou diagnosticar o caos no Campo de Treinamento e detectou que checks v4 deixavam 6 de 18 bugs passarem. Boss refatorou e adicionou:

| # | Check | PASS quando... | Origem |
|---|---|---|---|
| 25 | **Emojis em texto visível (tema)** | 0 emojis em snippets/sections/layout (fora de `{% comment %}`) | memory `feedback_no_emojis_use_icons` (regra inquebrável) |
| 26 | **Scarcity heurística fake** | snippets de scarcity NÃO usam `variant.id\|modulo` / `random` / `now.seconds` sem `inventory_quantity` real | CFS pattern + memory `feedback_scarcity_via_sold_out_sizes` |
| 27 | **Smart collection catch-all** | Nenhuma smart com `disjunctive=true` + todas rules `not_contains` (=catch-all bug) | memory `feedback_sao_paulo_catchall_pattern` |

**Check #13 também ampliado:** agora pega Agasalho/Jaqueta/Short/Moletom/Regata/Calça/Calção/Polo/Sungão/Bermuda + duplicação "Masculino Feminino" (antes só Camisa/Camiseta).

**Custo-benefício:** dos 16 checks originalmente propostos, 7 foram implementados (esses), 6 ficaram deferred (dependem de features serem implementadas primeiro: bloco fluxo do pedido, prazo entrega, size chart inline, sold-out variants riscadas, reviews seeded, popup Klaviyo), 3 foram cortados por baixo ROI (banner recesso, business hours declared, tracking link no header — redundante).

Detalhes em [[conversao-vault/padroes/quality-gate-checks-novos]].

## Script executável

```bash
# Read-only, rápido
node .claude/skills/quality-gate/quality-gate.mjs "Nome do cliente"

# JSON output (pra automação/integração)
node .claude/skills/quality-gate/quality-gate.mjs "Nome do cliente" --json
```

## Output

```
=== Quality Gate: Nome do Cliente ===
✓ PASS  Preços fora do padrão: 0 divergentes em 1.165 produtos
⚠ WARN  Variantes esgotadas: 42 (3.1%)
✓ PASS  Produtos sem imagem: 0
✗ FAIL  Coleções vazias: 18 (limite 10)
⚠ WARN  SEO meta faltando: 180 produtos (15.5%)

Score: 60/100 (2 PASS, 2 WARN, 1 FAIL)
```

## Lib compartilhada

- [`../../lib/shopify-pricing.mjs`](../../lib/shopify-pricing.mjs) — `calcExpectedPrice()` pra detectar preço fora do padrão
- [`../../lib/shopify-api.mjs`](../../lib/shopify-api.mjs) — `shReq`, `paginate`, `getCreds`
- [`../../lib/supabase-rest.mjs`](../../lib/supabase-rest.mjs) — `fetchPricing()`
- [`../../lib/validate.mjs`](../../lib/validate.mjs) — asserts + log

## Integração com skills de escrita (pre-flight)

Skills destrutivas podem chamar quality-gate ANTES:

```js
// No começo de uma skill de escrita
const result = await runQualityGate(clientId);
if (result.fails.length) {
  console.error('⚠️  Loja tem problemas críticos. Rode /quality-gate pra ver.');
  // user pode forçar com --skip-gate
}
```

Hoje é **opt-in** por cliente (não default) pra evitar fricção.

## Fluxo Socrático

1. **VALIDATE** — assert cliente + Shopify conectada + pricing configurado (se check 1 for usar)
2. **EXECUTE** — roda os 5 checks em paralelo (lojas diferentes já)
3. **REPORT** — imprime PASS/WARN/FAIL + score
4. **LOG** — append em execution.jsonl

Processe $ARGUMENTS conforme os passos acima.
