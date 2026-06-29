---
name: fix-empty-collections
description: Investiga e corrige coleções vazias — distingue entre REALLY_EMPTY (delete), TYPO_CANDIDATE (auto-corrige rule), RULE_TOO_STRICT (relaxa rule) e SYNC_LAG (skip). Preview detalhado antes de aplicar.
argument-hint: [nome do cliente] [--apply] [--no-delete] [--min-products=3]
---

# fix-empty-collections — Corrige coleções vazias

Quality gate detecta "N coleções vazias". Este skill investiga cada uma e aplica a correção apropriada.

## Quando usar

- Quality gate reporta "60 coleções vazias no BR dev" etc
- Após criar smart collections em batch (rules podem ter typo)
- Deploy de template em loja nova onde muitas smart rules não batem com o catálogo local
- Limpeza pré-handoff pra cliente

## Triggers (linguagem natural)

- "coleção vazia"
- "smart collection não popula"
- "collections sem produto"
- "limpar coleções vazias"

## Categorias detectadas

Para cada smart collection vazia, o skill **simula as rules localmente** contra o catálogo da loja pra classificar:

- **`REALLY_EMPTY`** — rules não batem com NADA no catálogo, e o nome da coleção não tem match parcial → **delete** (confirmação)
- **`TYPO_CANDIDATE`** — rule tem erro de digitação (ex: `contains "Feminina"` → trocar pra `contains "femin"` que pega ambos) → **auto-corrige** rule
- **`RULE_TOO_STRICT`** — rule usa `contains` com palavra muito específica que não bate, mas fragmento parcial pega produtos → **relaxa** rule
- **`SYNC_LAG`** — simulação local bate N produtos mas Shopify reporta 0 → **skip** (Shopify vai popular sozinho em poucos minutos)

## Uso

```bash
# Dry-run — investiga + categoriza + preview
node .claude/skills/fix-empty-collections/fix-empty-collections.mjs "Loja de Desenvolvimento - BR"

# Apply — corrige (delete + auto-corrige + relaxa)
node .claude/skills/fix-empty-collections/fix-empty-collections.mjs "Loja de Desenvolvimento - BR" --apply

# Apply sem deletar (só corrige rules)
node .claude/skills/fix-empty-collections/fix-empty-collections.mjs "Loja de Desenvolvimento - BR" --apply --no-delete

# Threshold custom (default: coleção com < 3 produtos = vazia)
node .claude/skills/fix-empty-collections/fix-empty-collections.mjs "Loja de Desenvolvimento - BR" --min-products=1
```

## Protocolo

VALIDATE → FETCH catalog + smart collections → CLASSIFY → PREVIEW por categoria → CONFIRM → APPLY → LOG

- Fetch uma vez o catálogo completo da loja (pra simular rules localmente)
- Fetch smart_collections (por endpoint REST) + products_count via `/products/count.json?collection_id=X`
- Só considera smart collections (custom collections podem estar vazias intencionalmente)

## Estratégias de correção de rule

### Typo fix
Se a rule é `title contains "Feminina"` e local tem 0 produtos, mas "femin" aparece em N títulos:
- Troca por `title contains "femin"` (pega "feminina", "feminino", "feminina masculina", etc)

### Relax
Se rule tem múltiplas palavras em AND (disjunctive=false) e juntas batem 0, mas qualquer uma bate > 3 produtos:
- Troca pra disjunctive=true (OR) ou reduz pra 1 regra mais ampla

## Limitações

- Só mexe em **smart collections** — custom collections são ignoradas (manual user input)
- Só classifica rules no campo `title` — rules em vendor, type, tag etc são skipadas (skill assume safe)
- **Não restaura** collections deletadas — rode com dry-run primeiro pra revisar

## Verificação

```bash
# Antes
node .claude/skills/quality-gate/quality-gate.mjs "Loja de Desenvolvimento - BR" | grep "Coleções"
# → ✗ FAIL Coleções vazias: 60 de 167

# Aplica
node .claude/skills/fix-empty-collections/fix-empty-collections.mjs "Loja de Desenvolvimento - BR" --apply

# Depois
node .claude/skills/quality-gate/quality-gate.mjs "Loja de Desenvolvimento - BR" | grep "Coleções"
# → ✓ PASS Coleções vazias: < 10
```
