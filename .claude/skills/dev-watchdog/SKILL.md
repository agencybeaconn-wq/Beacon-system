---
name: dev-watchdog
description: Roda quality-gate + fixes automáticos seguros nas lojas de desenvolvimento (Template BR e EN) diariamente às 3h da manhã. Detecta drifts (títulos com marca, menus quebrados, smart collections com disjunctive bug, SEO/vendor fora do padrão) e corrige auto. Alerta pra problemas destrutivos (duplicados, delete, preços). Roda também manualmente via `node dev-watchdog.mjs --apply` pra manutenção preventiva.
---

# dev-watchdog

Orquestrador diário de qualidade das lojas de desenvolvimento.

## Quando usar

- **Diariamente automático** via trigger `/schedule` às 3h da madrugada (UTC-3)
- Manualmente antes de um deploy importante de cliente (valida que template está polido)
- Como CI das templates quando alguém editou algo manual no admin

## O que faz

Pra cada loja (BR + EN), em sequência:

1. **SCAN** — roda `quality-gate --json --triggered-by=daily`. Salva row em `client_quality_runs`.
2. **AUTO-FIX** — sequencial (mesmo bucket Shopify = SERIALIZE), aplica apenas fixes dev-safe:
   - Sempre: `bulk-product-meta --vendor="Lever Ecomm" --seo-auto --apply` (idempotente)
   - Sempre (só BR): `sort-collections --only-handles=lancamentos,feminina,infantil --priority-br --apply`
   - Condicional: se check FAIL/WARN, roda skill específica:
     - Títulos com typo → `clean-titles --fix-gender --remove-brands --apply`
     - Menus quebrados → `fix-broken-menus --strategy=remove --apply`
     - Smart rules → `audit-smart-collections --apply --no-create`
     - Handles PT em EN → `fix-handles --apply`
3. **ALERT** — coleta FAILs não auto-fixáveis (dedupe, empty delete, preços divergentes, produtos sem imagem).
4. **REPORT** — grava `/tmp/watchdog-YYYY-MM-DD.json` com scores + fixes + alerts por loja.

## Não faz (nunca auto-apply)

- `dedupe-products` (delete de produto requer confirmação humana)
- Delete de coleções `REALLY_EMPTY` (decisão humana)
- Correção de preços fora do padrão (requer verificação com `client_pricing`)
- Upload de imagens faltantes (requer asset humano)

Essas situações aparecem no campo `alerts` do relatório pra você revisar.

## Uso

```bash
# DRY-RUN (imprime o que faria, sem aplicar)
node .claude/skills/dev-watchdog/dev-watchdog.mjs

# Aplicar
node .claude/skills/dev-watchdog/dev-watchdog.mjs --apply

# Uma loja só (debug)
node .claude/skills/dev-watchdog/dev-watchdog.mjs --apply --only=br
node .claude/skills/dev-watchdog/dev-watchdog.mjs --apply --only=en
```

## Agendamento (cron)

Via skill `/schedule` do Claude Code:

```
cron: 0 6 * * *   (6h UTC = 3h Brasília)
prompt: "Roda a skill dev-watchdog com --apply nas lojas de desenvolvimento BR e EN."
```

## Saída

- Stdout: resumo por loja (score, fixes aplicados, alerts)
- `/tmp/watchdog-YYYY-MM-DD.json` — relatório estruturado:
  ```json
  [
    { "store": "Loja de Desenvolvimento - BR", "locale": "br", "score": 92, "counts": {...}, "fixes": [...], "alerts": [...] },
    { "store": "Loja de Desenvolvimento - EN", "locale": "en", "score": 88, "counts": {...}, "fixes": [...], "alerts": [...] }
  ]
  ```
- Supabase `client_quality_runs` — 1 row por loja com `triggered_by='daily'`

## Consultar histórico

```sql
SELECT client_id, score, counts, run_at
FROM client_quality_runs
WHERE triggered_by = 'daily'
ORDER BY run_at DESC
LIMIT 14;  -- últimos 7 dias (2 lojas × 7)
```

## Reusa

- `.claude/skills/quality-gate/` (--json --triggered-by=daily)
- `.claude/skills/bulk-product-meta/`
- `.claude/skills/clean-titles/`
- `.claude/skills/fix-broken-menus/`
- `.claude/skills/audit-smart-collections/`
- `.claude/skills/fix-handles/`
- `.claude/skills/sort-collections/`
- `.claude/lib/validate.mjs` — `assertClientExists`, `assertShopifyConnected`

## Anti-patterns

- Nunca chamar a watchdog concorrente na mesma loja (mesmo bucket Shopify = 429)
- Nunca pular o DRY-RUN antes de agendar — valida que o report tá coerente
- Nunca adicionar skills destrutivas na lista auto-fix sem validação manual extensa
