# Skills Compression Log

Histórico de compressões + restaurações. Serve pra: saber floor de cada skill, decidir se vale re-comprimir, rastrear perda de contexto.

## Fase 1 — 2026-04-17

Snapshot: `blocks/skills-snapshots/pre-compression-2026-04-17/`

| Skill | Antes | Depois | Redução | O que cortei |
|---|---|---|---|---|
| bulk-fix-prices | 462 | 62 | −86% | Scripts inline (audit + fix) duplicavam `.mjs` existente. Mantive: fluxo, categorize order, chaves pricing, lições |
| sort-collections | 332 | 73 | −78% | `proxy()` helper duplicado, script completo inline (já tem `.mjs`). Mantive: algoritmo sort (year/type/num), aliases EN, pitfalls (propagação sort_order, rate limit concorrente, Edição Especial) |
| fix-handles | 367 | 83 | −77% | Script completo inline duplicava .mjs. Mantive: fluxo, toHandle() canônico, mapa PT→EN, processo delete+recreate smart, aviso de handles críticos |

**Total Fase 1:** 1161 → 218 linhas (−943 linhas, 81%)

## Processo de restauração

Se ao invocar uma skill compressa eu perder contexto funcional:
1. Abro `blocks/skills-snapshots/pre-compression-YYYY-MM-DD/<skill>.md`
2. Localizo a seção específica que faltou
3. Restauro SÓ essa seção no SKILL.md (não o arquivo inteiro)
4. Anoto abaixo:

## Restaurações

_Nenhuma ainda._

Formato das entradas:
```
### <skill> — YYYY-MM-DD
- Contexto: "ao fazer X, percebi que faltou Y"
- Bloco restaurado: nome da seção
- Linhas re-adicionadas: N
```

## Regra de floor

Skill com 2+ restaurações = considerada no floor, NÃO re-comprimir.
Skill com 0 restaurações após 2 semanas de uso = pode aceitar +10% de corte.
