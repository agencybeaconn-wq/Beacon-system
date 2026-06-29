---
name: fix-compare-at
description: Aplica/corrige compare_at_price (preço "de" riscado, vira "-X% OFF") em variantes em massa.
argument-hint: [cliente] [--pct=37|--multiplier=1.6|--fixed=399.99|--auto] [--category=X] [--dry-run|--apply]
---

Modos (arredondam .99):
- `--pct=N` → `price/(1-N/100)` (ex: 219.99@37% → 349.99)
- `--multiplier=M` → `price*M`
- `--fixed=V` → todas variantes mesmo valor
- `--auto` → % médio dos que JÁ têm na categoria, aplica nos faltantes

Filtros: `--category=K` (`categorize()` em shopify-pricing.mjs) · `--only-missing` (default) · `--force` · `--only-handle=h1,h2` · sem `--apply` = dry-run

Path: `.claude/skills/fix-compare-at/fix-compare-at.mjs` · idempotente · 600ms rate-limit · cálculo próprio (lib só categoriza).
