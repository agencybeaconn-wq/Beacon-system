---
name: dedupe-products
description: Detecta e remove produtos duplicados de uma loja Shopify (por handle ou título normalizado). Mantém o mais antigo por default, deleta os outros. Seguro, reversível (backup JSONL), background-safe (checkpoint + SIGINT).
argument-hint: [nome do cliente] [--apply] [--by=handle|title] [--resume] [--status]
---

# dedupe-products — Remove produtos duplicados

Detecta e remove produtos duplicados na loja Shopify de um cliente.

## Quando usar

- Quality gate reporta "N duplicatas detectadas" → corrigir pra zerar
- Depois de `/clean-titles` se criou colisões artificiais (remoção de marca)
- Após import massivo que pode ter criado dupes
- Antes de deploy final pra uma loja "template" canônica

## Triggers (linguagem natural)

- "produtos duplicados"
- "tem produto repetido"
- "merge duplicatas"
- "limpar duplicatas da loja X"
- "remover produtos repetidos"

## Estratégia

**Default: keep oldest (menor product ID) + delete os outros**
- Determinístico e reversível (backup do JSONL com produtos deletados antes de aplicar)
- Preserva histórico de pedidos do produto mais antigo
- Apply via `productDelete` mutation

**Modos de detecção** (flag `--by=`):
- `handle` (default): produtos com handle idêntico
- `title`: produtos com título normalizado idêntico (útil depois de clean-titles)
- `both`: ambos (fallback mais agressivo)

## Uso

```bash
# Dry-run — lista duplicatas sem deletar
node .claude/skills/dedupe-products/dedupe-products.mjs "De Boleiro"

# Apply — deleta (keep oldest por default)
node .claude/skills/dedupe-products/dedupe-products.mjs "De Boleiro" --apply

# Por título normalizado (útil pós clean-titles)
node .claude/skills/dedupe-products/dedupe-products.mjs "De Boleiro" --by=title --apply

# Ver progresso de execução pausada
node .claude/skills/dedupe-products/dedupe-products.mjs --status

# Retomar execução pausada
node .claude/skills/dedupe-products/dedupe-products.mjs "De Boleiro" --apply --resume
```

## Protocolo

VALIDATE → FETCH → DETECT → PREVIEW → CONFIRM → BACKUP → DELETE → LOG

1. **VALIDATE**: assert cliente existe + Shopify conectada
2. **FETCH**: pagina todos os produtos (id, handle, title, created_at, variants count, images count)
3. **DETECT**: agrupa por handle ou title normalizado
4. **PREVIEW**: mostra grupos, quais ficam, quais vão, impacto em variants/images
5. **CONFIRM**: exige `--apply` explícito
6. **BACKUP**: salva JSONL em `.claude/logs/dedupe-backup-<client>-<ts>.jsonl` com produtos que serão deletados (restore manual se precisar)
7. **DELETE**: via `productDelete` mutation (serial, 500ms delay)
8. **LOG**: append em execution.jsonl

## Background-safe

- Checkpoint após cada produto deletado
- SIGINT (Ctrl+C) salva state → retomar com `--resume`
- `--status` mostra progresso sem rodar
- Idempotente: rodar de novo encontra 0 duplicatas → exit 0

## Verificação

```bash
# Antes
node .claude/skills/quality-gate/quality-gate.mjs "De Boleiro"
# → ✗ FAIL Produtos duplicados: 10 duplicatas

# Rodar dedupe
node .claude/skills/dedupe-products/dedupe-products.mjs "De Boleiro" --apply

# Depois
node .claude/skills/quality-gate/quality-gate.mjs "De Boleiro"
# → ✓ PASS Produtos duplicados: 0 duplicatas
```

## Limitações

- **Não faz merge de variants**: se dois produtos duplicados têm variants diferentes, deletar o outro perde as variants únicas. O `--dry-run` mostra qual lose.
- **Não atualiza referências**: collections que apontam pros produtos deletados vão ter seus products count reduzidos (Shopify atualiza automaticamente). Smart collections populam pelo handle, então é OK. Custom collections manuais ficam com lista reduzida.
- **Merge mode é V2**: estratégia `--strategy=merge` planejada pra versão futura (copia variants únicas pro canônico antes de deletar).
