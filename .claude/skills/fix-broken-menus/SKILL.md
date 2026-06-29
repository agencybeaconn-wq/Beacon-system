---
name: fix-broken-menus
description: Detecta menu items apontando pra collections, pages ou products que não existem e remove (ou reescreve) esses items. Usa GraphQL pra validar cada item antes de decidir.
argument-hint: [nome do cliente] [--apply] [--strategy=remove|frontpage]
---

# fix-broken-menus — Corrige links quebrados em menus

Quality gate detecta, mas não corrige. Este skill corrige.

## Quando usar

- Quality-gate reporta "N items de menu apontam pra recursos inexistentes"
- Deploy novo onde o menu veio do template mas os handles não batem
- Depois de `/fix-handles` (que renomeia collections e pode deixar menu items órfãos)

## Triggers (linguagem natural)

- "menu com links quebrados"
- "consertar menu"
- "itens de menu órfãos"
- "menu apontando pra página que não existe"

## Estratégias

- `--strategy=remove` (**default**) — remove o item quebrado do menu
- `--strategy=frontpage` — reescreve apontando pra FRONTPAGE (mantém item no menu mas aponta pra home)

## Detecção

Usa GraphQL pra validar cada item:
- `/collections/<handle>` → `collectionByHandle(handle: X)`
- `/pages/<handle>` → query de pages por handle
- `/products/<handle>` → `productByHandle(handle: X)`
- `/` ou FRONTPAGE → sempre válido
- External URLs (http://, https://) → sempre válido (fora do escopo)

Items inválidos:
- Apontam pra entidade que não existe na loja
- Retornam null do resolver GraphQL

## Uso

```bash
# Dry-run — só lista quebrados
node .claude/skills/fix-broken-menus/fix-broken-menus.mjs "Loja de Desenvolvimento - BR"

# Apply — remove os quebrados (strategy default = remove)
node .claude/skills/fix-broken-menus/fix-broken-menus.mjs "Loja de Desenvolvimento - BR" --apply

# Apply com strategy alternativa
node .claude/skills/fix-broken-menus/fix-broken-menus.mjs "Loja de Desenvolvimento - BR" --apply --strategy=frontpage
```

## Protocolo

VALIDATE → FETCH menus → VALIDATE cada item → PREVIEW → CONFIRM → REWRITE menus → **POST-VERIFY** → LOG

Usa `menuUpdate` GraphQL mutation (não tem método pra remover 1 item específico — tem que reenviar a lista completa sem o item removido).

### ⚠️ Fetch correto: `menus(first: 20)`, NUNCA `menus(query: "handle:foo")`

GraphQL `menus(query:)` da Shopify **não filtra** — sempre retorna o primeiro menu (bug conhecido, ver memory `feedback_menu_query_filter_bug`). Resultado: você acha que tá editando o menu X, mas tá editando o `main-menu`. Risco real de quebrar a loja.

**Implementação correta (já aplicada):** `menus(first: 20)` lista TODOS os menus → filtrar por handle em JS:

```js
const allMenus = await gql(MENUS_QUERY); // menus(first: 20)
const target = allMenus.menus.edges.find(e => e.node.handle === wantedHandle);
```

### POST-VERIFY (obrigatório após apply)

Refazer query `menus(first:20)` e confirmar:
1. O menu alvo tem `items.length` esperado (count antes − removidos)
2. Nenhum item removido voltou
3. Nenhum item esperado sumiu

Se divergir → reportar como falha e parar (não tenta retry, pode ter sido edição concorrente).

## Limitações

- Só mexe em menus com handle conhecido (`main-menu`, `footer`, `nossas-politicas`, etc)
- Items aninhados (submenus) são validados recursivamente
- Se ALL items de um menu ficam órfãos, o menu fica vazio (não é deletado automaticamente)

## Verificação

```bash
# Antes
node .claude/skills/quality-gate/quality-gate.mjs "Loja de Desenvolvimento - BR" | grep "Menus"
# → ✗ FAIL Menus com links quebrados: 11 items

# Aplica fix
node .claude/skills/fix-broken-menus/fix-broken-menus.mjs "Loja de Desenvolvimento - BR" --apply

# Depois
node .claude/skills/quality-gate/quality-gate.mjs "Loja de Desenvolvimento - BR" | grep "Menus"
# → ✓ PASS Menus com links quebrados: 0 items
```
