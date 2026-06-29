---
name: update-prices
description: Atualiza preços de produtos na Shopify de um cliente a partir de texto livre (WhatsApp, briefing, etc). Cole uma tabela e diga qual loja.
argument-hint: [tabela de preços ou mensagem com valores]
---

> ⚠️ **EXTRAS SÃO ACRÉSCIMOS, NÃO ABSOLUTOS.** Personalização (R$30), 2GG/3GG/4GG (R$10), patch (R$30), manga longa (R$30), patrocínio (R$45) somam ao base. Variante "Torcedor + 2GG + Personalizar" = `209+10+30=R$249`. Quando user diz "altera preço da personalização pra X" → setar X como acréscimo, NÃO substituir variante. Memory `feedback_pricing_increments`.

Segue [PROTOCOL.md](../../PROTOCOL.md): VALIDATE → DRY-RUN → PREVIEW → CONFIRM → EXECUTE → LOG.

## Libs (não duplicar)
- `shopify-pricing.mjs` — `categorize()`, `calcExpectedPrice()`, `BIG_SIZES`
- `shopify-api.mjs` — `shReq`, `shopifyGraphQL`, `paginate`, `delay`, `getCreds`
- `supabase-rest.mjs` — `fetchClient`, `fetchPricing`, `upsertPricing`
- `validate.mjs` — `assertClientExists`, `assertShopifyConnected`, `assertPricingConfigured`

## Parse: texto → chaves canônicas
| Texto | section | key |
|---|---|---|
| torcedor/torcedora | products | torcedor |
| jogador/autêntic/player | products | jogador |
| retrô/retro | products | retro |
| infantil/kids/conjunto infantil | products | infantil |
| agasalho | products | agasalho |
| conjunto de treino | products | conjunto_treino |
| jaqueta/corta vento | products | jaqueta |
| moletom | products | moletom |
| short | products | short |
| patch | extras | patch |
| patrocínio/patrocinio extra | extras | patrocinio_extra |
| 2gg/3gg/4gg / acréscimo tamanho | extras | acrescimo_tamanho_grande |
| personalização/nome e número | extras | nome_numero |
| manga longa (extra) | extras | manga_longa |

## Processo
1. Parse texto → entries `{section, key, label, value, sort_order}`
2. Identifica cliente (fuzzy `fetchClient()`); precisa ter `shopify_status='connected'`
3. `upsertPricing(clientId, entries)` salva no banco
4. Rodar o script (lê do banco e aplica). Re-aplicar preços já salvos: pula passos 1-3, só roda o script.

```bash
node .claude/skills/update-prices/update-prices.mjs "Cliente"            # dry-run (sem --apply)
node .claude/skills/update-prices/update-prices.mjs "Cliente" --apply    # aplica
node .claude/skills/update-prices/update-prices.mjs "Cliente" --limit=50 # teste rápido
```

Script automatiza VALIDATE (assert cliente+Shopify+pricing) · DRY-RUN (1000+ produtos via `calcExpectedPrice()`) · PREVIEW por categoria + amostra com breakdown · EXECUTE `productVariantsBulkUpdate` (3 por vez, delay 500ms) · LOG em `.claude/logs/execution.jsonl`.

## Regras importantes

- **Extras são ADITIVOS** — um produto pode ter torcedor + patrocínio + personalizar + tamanho grande: `209 + 45 + 30 + 10 = 294`
- **Manga longa** é categoria própria (`camisa_manga_longa`) com preço base `torcedor + manga_longa` → `239`
- **"Com Patrocinio" no TÍTULO** → produto inteiro ganha +R$45 (afeta todas as variantes)
- **Option2 = "Personalizar"** → só aquela variante ganha +R$30
- **Tamanhos grandes** (2GG, 3GG, 4GG, GGG, GGGG) → +R$10
- Skip automático: tênis, chuteiras, gym sets, patches avulsos, bobojaco

Processe $ARGUMENTS conforme acima.
