---
name: template-parity
description: Compara themes/lever-br vs themes/lever-en arquivo por arquivo e flag gaps — features que estão num lado mas não no outro. Detecta drift entre templates (ex: cart-drawer BR ganha 443 linhas e EN fica defasado). Read-only.
argument-hint: "[--snippet=cart-drawer.liquid] [--detail]"
---

# template-parity — Detector de drift BR ↔ EN

Compara cada arquivo dos templates `themes/lever-br/` e `themes/lever-en/` e flag onde estão divergentes. Não compara conteúdo de strings (PT vs EN é esperado) — compara **estrutura, blocks, schemas, e features**.

## Quando usar

- Antes de subir uma feature pro Template BR, pra ver se EN também tá pronto
- Periodicamente como sanity check
- Após `/code-blocks` que portou feature pra um lado só

## O que compara

| Comparação | Como | Severity quando diverge |
|---|---|---|
| Lista de arquivos (existem nos dois lados?) | `readdir` em ambos `themes/lever-*/snippets/` etc | ERROR (arquivo só num lado) |
| Tamanho relativo (linhas) | `wc -l` ambos | WARN se diff > 30% |
| Schema blocks de cada section | parse `{% schema %}` JSON, extrai `blocks[].type` | ERROR se BR tem block que EN não tem |
| Snippets renderizados (`{% render 'X' %}`) | grep `render` em ambos | WARN se BR usa snippet que EN não usa |
| `<style>` selectors | extrair classes `.cart-item__*` etc | INFO |
| JS handlers (event listeners, classes) | grep `addEventListener\|class=` | INFO |

## Uso

```bash
# Compara tudo
node .claude/skills/template-parity/template-parity.mjs

# Foca em arquivo específico
node .claude/skills/template-parity/template-parity.mjs --snippet=cart-drawer.liquid

# Detail mode — imprime diff resumido (não unified completo)
node .claude/skills/template-parity/template-parity.mjs --detail
```

## Saída

```
═══════════════════════════════════════
template-parity  br ↔ en
═══════════════════════════════════════

[snippets/cart-drawer.liquid]
  BR: 720 linhas · EN: 287 linhas (diff +151%)
  WARN  Diff > 30% — possível defasagem
  ERROR Block "cart-item--free" só existe em BR
  ERROR Class "cart-item__breakdown" só existe em BR
  WARN  Snippet "icon-discount" usado em BR, não em EN

[sections/cart-progress-bar.liquid]
  ✓ paridade ok

[templates/cart.json]
  ERROR Block "milestones-3-5" só existe em EN

═══════════════════════════════════════
3 features only-BR · 1 only-EN · 4 paridade ok
═══════════════════════════════════════
```

## Limitações

- Não compara conteúdo de strings (PT vs EN é por design)
- Não detecta lógica equivalente em código diferente (ex: BR usa `for` e EN usa `each` — paridade lógica, não textual)
- Schema parsing assume JSON válido; arquivos com sintaxe quebrada são pulados com warning

## Integração

- `code-blocks` chama no passo 0 (Lê histórico) pra ver se feature já existe num lado e tá faltando no outro
- `template-lint` complementa: lint = regra de qualidade, parity = simetria entre lados

## Reusa

- Apenas Node.js puro + fs (sem Shopify API, sem DB)

## Não checa (fora de escopo)

- Themes em produção (pra isso use clone-store ou code-blocks pra port)
- Equivalência de comportamento em runtime (precisa preview navegador)
