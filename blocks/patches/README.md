# Patches Reutilizáveis

Scripts de transformação que nasceram de uma operação mas podem reaplicar em outras lojas.

Ver SKILL.md (`.claude/skills/code-blocks/SKILL.md` → seção "Patches reutilizáveis") pra convenção completa.

## Nomeação

`YYYY-MM-DD_categoria_descricao.mjs`

Ex: `2026-04-16_cart-drawer_bxgy-split.mjs`

## Cabeçalho obrigatório

```javascript
// Patch: [descrição curta]
// Origem: blocks/history/[arquivo md]
// Aplicável a: [lojas com pré-requisito]
// Pré-requisito: [ex: cart-drawer v3 do Template BR]
```

## Regras

- NÃO commitar secrets/tokens — ler do `.env` via lib compartilhada
- Importar de `.claude/lib/` (shopify-api, validate, backup) — não reimplementar
- Idempotente sempre que possível: rodar 2× = mesmo resultado
- Se patch virou candidato no Template, marcar no cabeçalho com `# APROVADO YYYY-MM-DD` e mover pra `blocks/patches/approved/`
