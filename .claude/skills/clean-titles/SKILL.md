---
name: clean-titles
description: Limpa títulos de produtos na Shopify removendo referências a marcas (Nike, Adidas, Puma, etc) e corrigindo inconsistências gramaticais comuns (ex. "Feminino" → "Feminina" em camisas).
argument-hint: [nome do cliente] [--fix-gender] [--remove-brands] [--apply] [--then-dedupe]
---

## Marcas removidas (`--remove-brands`)
`Nike, Adidas, Puma, Jordan, New Balance, Reebok, Kappa, Umbro, Joma, Hummel, Castore, Macron, Mizuno, Under Armour, Asics, Fila, Champion, Diadora, Errea/Errà, Mitre, Le Coq Sportif, Lotto, Topper, Olympikus`

**NÃO remover** (confundem com colorways de tênis): `Peak, Volt, Concord, Athleta`.

## Correção de gênero (`--fix-gender`)
Só em títulos que começam com "Camisa" ou "Camiseta": `Feminino → Feminina` (preserva caixa: FEMININO→FEMININA, feminino→feminina). **Conjunto/Tênis ficam masculinos — não mexer.**

## Função de limpeza
```js
const brandRe = new RegExp('\\b(' + BRANDS.map(esc).join('|') + ')\\b', 'gi');
t = t.replace(brandRe, '');
if (/^(camisa|camiseta)\b/i.test(t)) t = t.replace(/\bFeminino\b/g, 'Feminina');  // + caixa alta + minúscula
t = t.replace(/\s+/g, ' ').trim()
     .replace(/\s+-\s+-\s+/g, ' - ').replace(/^\s*-\s*/, '').replace(/\s*-\s*$/, '');
```

## Processo
1. **IDENTIFY** cliente em `agency_clients`
2. **FETCH** `GET /admin/api/2026-01/products.json?limit=250&fields=id,title` (paginado)
3. **PREVIEW** com amostra 15 + contagem total
4. **VALIDATE** títulos com <8 chars / vazios / perderam info crítica
4b. **DETECT HOMÔNIMOS** — se 2+ produtos terão mesmo título depois (ex: "Nike Flamengo I" + "Adidas Flamengo I" → ambas "Flamengo I"), alertar:
    > ⚠️ Remover marcas vai criar N grupos de homônimos. Use `--then-dedupe` ou rode `dedupe-products --by=title --apply` depois.
5. **CONFIRM** + **APPLY** `PUT /products/{id}.json` com `{ product: { id, title } }` (delay 600ms)
6. **THEN DEDUPE** se `--then-dedupe`: invoca `dedupe-products --by=title --apply` automático

```bash
node .claude/skills/clean-titles/clean-titles.mjs "Cliente" --remove-brands --apply --then-dedupe
```

⚠️ **Rate limit ~2 calls/s.** Não rodar 2+ scripts de escrita no mesmo shop simultaneamente (429 em ~2%).

Fluxo: IDENTIFY → FETCH → PREVIEW → VALIDATE → CONFIRM → APPLY → REPORT.

Processe $ARGUMENTS conforme acima.
