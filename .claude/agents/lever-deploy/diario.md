# Diário — Agente Deploy

> Cérebro persistente. Cada deploy registra entrada aqui. Antes de mexer numa loja, ler entradas anteriores dela.

## Como ler este diário
- Entradas em ordem cronológica reversa (mais novo no topo)
- Filtrar por loja: Ctrl+F nome do cliente
- Filtrar por tipo: Ctrl+F categoria (#preflight, #deploy-full, #pos-deploy)

## Fontes que alimentaram este cérebro (Fase 0 — 2026-05-18)
- 59 tasks históricas "Implementação Shopify" no `client_tasks`
- Skill `implement` (`.claude/skills/implement/SKILL.md`) — pipeline canônico
- Skill `deploy-complete` — orquestrador end-to-end
- Memories: `project_store_deploy_checklist`, `project_brasileirissimo_english`, `project_gm_sports_english`, `project_matchwear_english`, `project_goalnations_english`, `project_template_br_duplicates`, `feedback_collection_dedupe_prefer_lever`, `feedback_pages_briefing_fallback`, `feedback_contact_source`

## Padrões destilados

### Pipeline canônico (top 7 títulos recorrentes)
1. Conectar Shopify e importar tema Lever (12×) — **manual**, pré-requisito
2. Importar coleções e menus (11×) — `deployStep collections`
3. Configurar licença, tema e contato (11×) — `deployStep theme`
4. Criar e adaptar páginas (10×) — `deployStep pages` + patch briefing
5. Revisão geral (10×) — **manual**
6. Importar produtos e configurar preços (9×) — `deployStep bulk_products`
7. Configurar promoções no carrinho (9×) — `deployStep theme` (milestones)

### Lojas EN conhecidas (template EN obrigatório)
- Brasileirissimo, GM Sports, MatchWear, Goal Nations

### Polish pós-deploy (não vem nas tasks, mas é obrigatório)
- `bulk-product-meta` vendor+SEO
- `audit-smart-collections`
- `sort-collections --priority-br` (só lojas BR) ou canonical (EN)
- `fix-theme-license` se houver overlay Lever Digital

---

## Entradas

<!-- Formato:
### YYYY-MM-DD — [Cliente] — [tipo]
**Loja:** dominio.myshopify.com
**O que foi feito:** ...
**Tempo:** Xh
**Achados:** ...
**Pendências manuais:** ...
**Lições:** ...
-->

_Sem entradas ainda. Primeira entrada será criada na próxima execução._
