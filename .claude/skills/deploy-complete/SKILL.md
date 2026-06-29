---
name: deploy-complete
description: Orquestrador end-to-end de deploy de loja nova. Roda preflight → edge function full_deploy (theme+collections+pages+menus+products+license) → pós-deploy polish (bulk-product-meta vendor+SEO, audit-smart-collections, sort-collections BR-first, fix-theme-license). Mede tempo total e lista pendências manuais (banners, logo).
---

# deploy-complete

Deploy end-to-end de uma loja Shopify nova em **um único comando**. Combina extract/transform/deploy da edge function + polish pós-deploy das skills. Gera relatório com tempo total e checklist de itens manuais restantes.

## Quando usar

- Cliente novo chegou com Shopify conectado + briefing preenchido + pricing importado
- Quer medir tempo total do deploy ponta-a-ponta
- Quer sair de `preflight: READY` pra "loja pronta pra banners" sem babysitting

## Pré-requisitos

Rodar `preflight-deploy "<cliente>"` antes. Só executa se verdict = `READY`.

## Uso

```bash
# DRY-RUN — imprime todas as skills que vai rodar sem executar
node .claude/skills/deploy-complete/deploy-complete.mjs "<cliente>"

# Aplicar
node .claude/skills/deploy-complete/deploy-complete.mjs "<cliente>" --apply

# Skipar preflight (não recomendado)
node .claude/skills/deploy-complete/deploy-complete.mjs "<cliente>" --apply --skip-preflight

# Só pós-deploy (tema já foi deployado antes)
node .claude/skills/deploy-complete/deploy-complete.mjs "<cliente>" --apply --skip-edge
```

## Fluxo

```
1. PREFLIGHT      → preflight-deploy (verdict deve ser READY)
2. EDGE DEPLOY    → store-deployment edge function action=full_deploy
                     ├─ theme (config + settings + license)
                     ├─ collections (smart + custom do template)
                     ├─ pages (legal pages do briefing)
                     ├─ menus (main-menu + footer)
                     └─ products (catálogo base copiado + pricing aplicado)
3. POST-DEPLOY    → (sequencial, mesma loja = bucket Shopify único)
   a) bulk-product-meta --vendor="<cliente>" --seo-auto --apply
   b) audit-smart-collections --apply --no-create (fix disjunctive bugs)
   c) sort-collections --only-handles=lancamentos,feminina,infantil --priority-br --apply  (BR only)
   d) sort-collections --apply (todas as coleções)
   e) fix-theme-license (verifica + fix Supabase se divergente)
4. VERIFY         → quality-gate --triggered-by=post-deploy --json
5. REPORT         → tempo total, scores, pendências manuais
```

## Flags

- `--apply` — sem isso é DRY-RUN (só lista)
- `--skip-preflight` — pula preflight (uso: quando já rodou preflight manualmente)
- `--skip-edge` — pula store-deployment (uso: tema já foi deployado, só quer post-deploy)
- `--only-post` — alias de --skip-edge
- `--json` — output estruturado no final

## Pendências que a skill NÃO resolve (lista pra humano)

Apesar de fazer a maior parte automaticamente, requer input manual depois:
- **Banners da home** (slides hero, promoções) — via Customize UI
- **Logo** — upload via Customize UI (a menos que já esteja no briefing)
- **Licença** — se o cache compilado do Shopify servir valor antigo, skill adjusta Supabase (ver fix-theme-license). Para garantia, cliente salva qualquer coisa via Customize UI uma vez.
- **Imagens de coleção** — se o tema usa imagens custom por collection handle (ver collection-list-tabs.liquid)
- **Descrição LP custom** — se houver imagem de LP fornecida, rodar depois `bulk-descriptions --set-file=<lp.html> --apply`

## Reusa

- `.claude/skills/preflight-deploy/` — valida antes
- `.claude/skills/bulk-product-meta/` — vendor + SEO
- `.claude/skills/audit-smart-collections/` — disjunctive fixes
- `.claude/skills/sort-collections/` — ordem Brasil-first + canônica
- `.claude/skills/fix-theme-license/` — validação pós-deploy de licença
- `.claude/skills/quality-gate/` — scoring final
- `supabase/functions/store-deployment` — edge function full_deploy

## Saída

Relatório consolidado em `$TMPDIR/deploy-complete-<cliente>-<ts>.json`:

```json
{
  "client": "JGS Sports",
  "start": "2026-04-18T23:00:00Z",
  "end": "2026-04-18T23:18:32Z",
  "elapsed_seconds": 1112,
  "steps": {
    "preflight": { "verdict": "READY", "ms": 1200 },
    "edge_deploy": { "ok": true, "stats": {...}, "ms": 420000 },
    "bulk_product_meta": { "ok": 1429, "fail": 0, "ms": 130000 },
    "audit_smart_collections": { "fixed": 14, "ms": 60000 },
    "sort_priority_br": { "ok": 3, "ms": 15000 },
    "sort_all": { "ok": 250, "ms": 180000 },
    "fix_theme_license": { "verdict": "OK", "ms": 8000 },
    "quality_gate": { "score": 92, "fail": 0, "warn": 2 }
  },
  "alerts": [],
  "manual_pending": [
    "Anexar banners da home via Customize UI",
    "Upload do logo (se não vem do briefing)"
  ]
}
```

## Estimativa de tempo

- JGS-size (1429 produtos): ~18-25 min total
- Lojas menores (< 500 produtos): ~10-15 min

## Anti-patterns

- **Nunca rode em paralelo na mesma loja** — mesmo bucket Shopify, vai estourar 429
- **Nunca pule preflight** em lojas novas — falhas silenciosas ficam difíceis de debugar
