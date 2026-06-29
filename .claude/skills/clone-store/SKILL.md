---
name: clone-store
description: Clona uma loja Shopify inteira de outra (tema + coleções + páginas + menus + produtos) sem depender da edge function store-deployment. Usa API Shopify direta + bulk-deploy-products pros produtos. Mede tempo por fase.
---

# clone-store

Clone completo de loja → loja via Shopify Admin API direta. Substitui o fluxo da edge function `store-deployment full_deploy` quando essa não está disponível (CLI auth issues, bugs pendentes, etc).

## Quando usar

- Backup operacional (cloná uma loja de produção pra uma de teste)
- Replicação de tema entre lojas (ex: Boutique Principal → BDB Backup)
- Onboarding rápido onde source é uma loja real já configurada (e não os templates BR/EN canônicos)
- Quando a edge function `store-deployment` está indisponível

## Uso

```bash
# DRY-RUN — só lista o que seria clonado
node .claude/skills/clone-store/clone-store.mjs --source="<origem>" --target="<destino>"

# APPLY — clona tudo
node .claude/skills/clone-store/clone-store.mjs --source="<origem>" --target="<destino>" --apply

# Skipar etapas específicas
node clone-store.mjs --source=X --target=Y --apply --skip=products,theme
```

## Fluxo

```
1. VALIDATE     → ambas lojas connected, tokens válidos
2. COLLECTIONS  → fetch custom + smart do source → criar no target (dedup por handle)
3. PAGES        → GraphQL pages query no source → pageCreate no target
4. MENUS        → fetch menus → menuUpdate matching handles no target
5. THEME        → copia assets do tema main do source pro main do target
                  (config/*, sections/*, templates/*, snippets que mudaram)
6. PRODUCTS     → invoca bulk-deploy-products --source-id=<UUID> --apply
7. POST-DEPLOY  → invoca deploy-complete --skip-edge pra polish (vendor, SEO, sort, license)
8. REPORT       → tempo por fase, total, score quality-gate
```

## Flags

- `--source="<nome>"` — nome do cliente origem em `agency_clients` (obrigatório)
- `--target="<nome>"` — nome do cliente destino (obrigatório)
- `--apply` — sem isso, é DRY-RUN (lista sem escrever)
- `--skip=step1,step2` — pula etapas (`collections`, `pages`, `menus`, `theme`, `products`, `polish`)
- `--only=step` — só roda uma etapa
- `--target-theme=<id|nome>` — mira o step `theme` num tema específico da target (ex: rascunho não-publicado já importado), em vez do tema main. Essencial quando o main da target é outro tema (ex: Horizon) que não deve ser sobrescrito.

## Rate limiting

Clone em paralelo é **ruim** — mesma target loja = bucket único → 429.
Este script serializa tudo com `delay(500-800ms)` entre writes.

## Saída

Relatório em `$TMPDIR/clone-store-<target>-<ts>.json` com tempo por fase.

## Limitações conhecidas (descobertas no clone Goalkit→Jersey Ten, 2026-06-11)

- **Coleções manuais (custom) são criadas vazias** — a membership manual (collects) não viaja no create. Fix pós-clone: `collectionAddProductsV2` mapeando produtos por handle (depois do step products).
- **SEO de produtos não é copiado** — ver Limitações em `bulk-deploy-products/SKILL.md`.
- **Vídeos hospedados referenciados pelo tema** (`shopify://files/videos/...`) não existem na target → PUT do template dá 422. Fix: baixar do CDN source → `stagedUploadsCreate` (resource VIDEO) → `fileCreate` **sem** `filename` (o resourceUrl de vídeo não tem extensão; filename explícito sempre falha com "extension must match original source") → poll READY → reescrever a ref no template com o filename real criado.
- **Rodar theme e products em paralelo na mesma loja causa 429 em cascata** — o publish paralelo do bulk satura o bucket REST. Serializar: products primeiro, theme depois (ou vice-versa).

## Reusa

- `.claude/lib/shopify-api.mjs` — shReq, shopifyGraphQL, paginate
- `.claude/lib/supabase-rest.mjs` — supaRest com serviceRole
- `.claude/skills/bulk-deploy-products/` — produtos
- `.claude/skills/deploy-complete/` — polish (--skip-edge)
