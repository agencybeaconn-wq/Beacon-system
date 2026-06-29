---
name: template-lint
description: Lint estático dos themes/lever-br e themes/lever-en — detecta emojis em texto visível, hardcodes BRL em loja EN, handles PT em tema EN, padrões que violam regras Lever (feedback_no_emojis_use_icons, feedback_no_brl_in_en). Read-only.
argument-hint: "[--theme=br|en|both] [--strict]"
---

# template-lint — Linter dos templates Lever

Roda checks estáticos em `themes/lever-br/` e `themes/lever-en/` antes de qualquer deploy ou code-blocks. Detecta violações de regras que vivem em memória mas nunca foram enforced.

## Quando usar

- Antes de subir uma feature pra Template (`/code-blocks` candidato)
- Periodicamente como sanity check (sem precisar de loja conectada)
- No `dev-watchdog` diário pra flagar drift

## Checks

| # | Check | Onde | Severity | Por quê |
|---|---|---|---|---|
| 1 | Emoji em `.liquid`/`.json` (texto visível) | `themes/lever-*/{snippets,sections,templates,config}/**` | ERROR | `feedback_no_emojis_use_icons` |
| 2 | Hardcode BRL cents (`= 2000`, `R\$`) em `themes/lever-en/` | `themes/lever-en/**/*.liquid` | ERROR | Loja EN não pode ter BRL |
| 3 | Handle PT (brasil, alemanha, italia...) em `themes/lever-en/templates/*.json` | `themes/lever-en/templates/*.json` | ERROR | Tema EN deve referenciar handles EN |
| 4 | `pers_fee = ` literal hardcoded (ambos) | `themes/lever-*/snippets/*.liquid` | WARN | Deveria ler `settings.personalization_fee_cents` |
| 5 | TODO/FIXME/XXX em arquivo do template | `themes/lever-*/**` | WARN | Tech debt |
| 6 | Comentário "removed" / "deprecated" | `themes/lever-*/**` | WARN | Lixo de código |

## Uso

```bash
# Lint nos dois temas (default)
node .claude/skills/template-lint/template-lint.mjs

# Só BR
node .claude/skills/template-lint/template-lint.mjs --theme=br

# Strict — exit code 2 se ERRORS encontrados
node .claude/skills/template-lint/template-lint.mjs --strict
```

## Saída

```
═══════════════════════════════════════
template-lint  themes/lever-br + lever-en
═══════════════════════════════════════

[BR] cart-drawer.liquid:539
  ERROR  Hardcode `2000` (BRL cents) — usar settings.personalization_fee_cents

[EN] templates/index.json:76
  ERROR  Handle PT "brasil" — esperado "brazil"

[BR] sections/footer.liquid:42
  WARN   Emoji 🎁 em texto visível — substituir por SVG icon

═══════════════════════════════════════
Resultado: 2 ERROR · 1 WARN
═══════════════════════════════════════
```

Exit codes:
- `0` — nenhum issue
- `1` — só WARN
- `2` — pelo menos 1 ERROR (com --strict, obriga fix antes de prosseguir)

## Integração com outras skills

- `code-blocks` chama no passo 3b (validar source) e 5 (validar proposta)
- `dev-watchdog` chama diariamente
- `deploy-complete` chama no preflight (bloqueia se ERROR no template)
- `quality-gate` chama como check 18 (novo)

## Reusa

- `lib/code-blocks-validate.mjs` — `validateLeverPitfalls()` (já tem regex emoji)
- Lista canônica de handles PT→EN do `fix-handles/SKILL.md`

## Não checa (fora de escopo)

- Lojas em produção (só os templates fonte). Pra produção use `quality-gate`.
- Dados (count de produtos, preços). Pra isso use `audit-store`.
