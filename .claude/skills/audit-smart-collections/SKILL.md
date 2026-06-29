---
name: audit-smart-collections
description: Audita smart collections de uma loja Shopify detectando bugs semânticos (disjunctive OR + not_contains = catch-all, AND muito restrito), handles divergentes do tema, e coleções faltantes referenciadas pelo tema. Corrige disjunctive, cria coleções faltantes com rules canônicas, e opcionalmente flag órfãs.
---

# audit-smart-collections

Auditoria semântica de smart collections + alinhamento com tema Lever.

## Quando usar

- Usuário reporta coleção mostrando produtos errados (ex: "Retrô mostrando camisas normais")
- Antes de deploy de loja nova baseada em template — garantir que template está perfeito
- Periodicamente nas templates BR/EN pra manter fonte-de-verdade limpa

## O que detecta

| Padrão | Severidade | Fix |
|---|---|---|
| `disjunctive: true` + `not_contains` virou catch-all | CRITICAL | Flip pra `disjunctive: false` |
| `disjunctive: false` com AND=0 mas OR>0 | HIGH | Flip pra `disjunctive: true` |
| Só `not_contains` rules | WARN | Flag, revisar manualmente |
| Handle do tema sem coleção correspondente | HIGH | Cria smart collection com rule canônica |
| Coleção referenciada pelo tema mas vazia | MEDIUM | Tenta relax de rule ou cria novo |
| **Count fora do range esperado por handle** (semantic) | WARN | Sugere flip disjunctive ou relax. Usa `lib/collection-expectations.mjs` |

## Semantic check (range esperado por handle)

Memory `feedback_read_section_titles`: rule restrita demais → coleção subpopulada (ex: "retro" só com 3 produtos). Rule ampla demais → catch-all (ex: "lancamentos" com 3000 produtos). A skill cruza count atual com `lib/collection-expectations.mjs`:

```js
import { checkCount } from '../../lib/collection-expectations.mjs';
const issue = checkCount(coll.handle, coll.products_count, coll.title);
if (issue) report.semantic_warnings.push(issue);
```

Se count < min → provável rule muito restritiva (sugerir disjunctive=true ou ajustar tag).
Se count > max → provável catch-all (sugerir disjunctive=false ou adicionar AND restritivo).

## Uso

```bash
# DRY-RUN (só relatório)
node .claude/skills/audit-smart-collections/audit-smart-collections.mjs "JGS Sports"

# Aplicar fixes
node .claude/skills/audit-smart-collections/audit-smart-collections.mjs "JGS Sports" --apply

# Específico locale (default: auto-detecta por domínio)
node .claude/skills/audit-smart-collections/audit-smart-collections.mjs "Template EN" --apply --locale=en

# Não criar coleções faltantes (só corrige existentes)
node .claude/skills/audit-smart-collections/audit-smart-collections.mjs "<loja>" --apply --no-create

# Rollback de uma execução anterior
node .claude/skills/audit-smart-collections/audit-smart-collections.mjs "<loja>" --rollback=/tmp/audit-smart-xxx.jsonl
```

## Flags

- `--apply` — aplica fixes. Sem ela, só DRY-RUN
- `--locale=br|en` — força locale (default: auto via domínio)
- `--no-create` — não cria coleções faltantes, só corrige existentes
- `--no-delete` — não deleta órfãs vazias (default: nunca deleta sem confirmação)
- `--rollback=<path>` — desfaz fixes de um jsonl anterior

## Saída

- Stdout: preview estruturado (bug_detected, missing, orphan, fixed, failed)
- `/tmp/audit-smart-<domain>-<ts>.jsonl` — uma linha por fix com estado ANTES e DEPOIS (rollback)
- `execution.jsonl` via `appendExecutionLog` — trail auditável

## Reusa

- `.claude/lib/smart-collections.mjs` — `countMatches`, `ruleMatches`, `detectDisjunctiveBug`, `canonicalRuleForHandle`
- `.claude/lib/shopify-api.mjs` — `shReq`, `paginate`, `delay`
- `.claude/lib/validate.mjs` — `assertClientExists`, `assertShopifyConnected`, `appendExecutionLog`
- `theme-handles.json` local — lista canônica de handles esperados por locale

## Anti-patterns (evitar)

- Nunca confiar só em `products_count` da Shopify (tem sync lag) — sempre simular local com `countMatches`
- Nunca aplicar fix sem dry-run antes
- Nunca deletar coleção sem estar 100% certo que é órfã E vazia E usuário aprovou
