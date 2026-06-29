# Bloco: Kit Casal variant picker (UI dupla masc/fem)

## Operação
- **Data:** 2026-05-05
- **Origem:** Mantos do PH (`a9dc24-2.myshopify.com`) — tema "Draft 2026-04-22 (Mantos do PH - Cartpanda)" `142261027011`
- **Destino:** JGS Sports (`tx7qw4-dy.myshopify.com`) — tema "Tema Lever" `157841686758`
- **Idioma:** BR → BR (sem tradução)
- **Validação:** 100% (0 pitfalls origem · 0 pitfalls .PATCHED · 0 pitfalls .APPLIED)
- **Status:** Aplicado ✓ (PDP funcional — cart-drawer parcial, ver "limitações")

## Contexto

Kit Casal é um produto especial da Lever: 1 produto Shopify representa um par (camisa masculina + camisa feminina). Estrutura de variants combinada:
- **Cor** (Amarela / Azul)
- **Tamanho** (combinado, ex: `M/G` = masculino M + feminino G — total 25 combinações P/P até 2GG/2GG)
- **Personalização** (Nenhum / Só Masculina / Só Feminina / Ambos — preços +0/+30/+30/+60)

A UI padrão Shopify renderiza isso como dropdown único com 25 valores combinados (ruim UX). A Mantos do PH tem snippet customizado (`kit-casal-variant-picker.liquid`) que renderiza UI dupla — 2 cards (azul masc / rosa fem) com seletores de tamanho independentes + toggles de personalização por lado.

Task que motivou: portal `f5de48d7-41df-4ab8-ba8b-075bd5fb8066` — "Subir produto kit casal" na JGS Sports. Produto subido em sessão anterior (200 variants OK) mas faltava UI customizada.

## Arquivos tocados

| Arquivo | Antes | Depois | Diff |
|---|---:|---:|---:|
| `snippets/kit-casal-variant-picker.liquid` | (não existia) | 410 linhas | +25.706 chars (novo) |
| `snippets/product-variant-picker.liquid` | 125 linhas | 132 linhas | +359 chars / +7 linhas |

## Features adicionadas

1. **`snippets/kit-casal-variant-picker.liquid`** — cópia 1:1 da Mantos (BR→BR, sem adaptação). Renderiza:
   - 2 grupos visuais (masc azul / fem rosa)
   - Seletor de tamanho separado por lado (P/M/G/GG/2GG)
   - Toggle "Personalizar +R$30" independente por lado
   - JS interno que sincroniza option `Tamanho` (combinado `M/G`) e `Personalização` (Nenhum/Só M/Só F/Ambos) com seleção do user
   - Suporta 2 modos de produto: legado (options `Tamanho Masculino` + `Tamanho Feminino` separadas) e novo (options `Tamanho` combinada + `Personalização`). Nosso produto é o "novo".

2. **`snippets/product-variant-picker.liquid`** — patch cirúrgico (não substituiu inteiro). Wrapper if/else delegando:
   ```liquid
   {%- if product.tags contains 'kit-casal' -%}
     {% render 'kit-casal-variant-picker', product: product, block: block, product_form_id: product_form_id, section: section %}
   {%- else -%}
     ... (lógica original intacta) ...
   {%- endif -%}
   ```
   Produtos sem tag `kit-casal` continuam usando picker padrão. **Zero impacto em produtos existentes.**

## Properties emitidas no carrinho

Quando user adiciona ao carrinho, o snippet emite line item properties:
- `properties[Nome Masculino]`
- `properties[Número Masculino]`
- `properties[Nome Feminino]`
- `properties[Número Feminino]`
- `properties[_pair_count]` (privada, com underscore — escondida no cart drawer)

## Validações feitas

- **validateAll origem:** 0 pitfalls (kit-casal-variant-picker.liquid + product-variant-picker.liquid da Mantos)
- **validateAll .PATCHED:** 0 pitfalls
- **validateAll .APPLIED (re-fetch pós PUT):** 0 pitfalls
- **CRLF→LF normalizado** antes do PUT (pitfall #13)
- **Deps verificadas** na JGS antes do apply: `snippets/product-variant-options.liquid` ✓, `snippets/customization-inputs.liquid` ✓
- **Storefront markers** confirmados via fetch HTML pós-apply: `data-kit-section`, `data-kit-mode`, `data-kit-tam-radio`, `data-kit-pers-radio`, "Tamanho Masculino", "Tamanho Feminino", "Personalizar camisa masculina", "Personalizar camisa feminina" — todos presentes.

## Backup

`blocks/backups/2026-05-05_jgs-sports_snippets__product-variant-picker.liquid.bak`

Pra reverter: `restoreAsset(shopFn, themeId, 'snippets/product-variant-picker.liquid', 'jgs-sports')` + delete do snippet `kit-casal-variant-picker.liquid` via API.

## Limitações conhecidas

1. **Cart drawer não tem formatação especial pra kit casal.** A Mantos tem `snippets/cart-drawer.liquid` com 594 linhas e lógica que agrupa as 4 properties em seções "Masculino" / "Feminino" formatadas. A JGS tem 422 linhas e usa `for property in item.properties` genérico. Resultado: as 4 personalizações aparecem como linhas avulsas (Nome Masculino / Número Masculino / Nome Feminino / Número Feminino) com label legível, mas sem agrupamento visual. **Funcional, não bonito.**

2. **`properties[_pair_count]` com underscore** — pitfall #15 (properties privadas vazam em checkout custom Yampi/Cartpanda). JGS Sports usa Cartpanda? Se sim, esse `_pair_count` pode aparecer na finalização. Validar com cliente.

3. **Cart-drawer da Mantos tem +172 linhas de lógica kit-casal** que não foi propagada — operação pendente caso queira UI igual à Mantos no carrinho.

## Próximas operações sugeridas

- Se quiser cart-drawer formatado bonito → cirurgia mais profunda no `snippets/cart-drawer.liquid` da JGS (172 linhas a injetar — risco maior porque cart-drawer já tem milestones, BxGy, progress bar, customization drawer)
- Auditar checkout: cliente da JGS Sports usa Cartpanda ou checkout default? Se Cartpanda, verificar se `_pair_count` vaza visualmente

## Adendo 2026-05-05 (2) — Skip kit-casal no cart-progress-bar

**Motivação:** Pedro avisou que Kit Casal "não conta na barra de progressão" porque já é promoção em si. Investigação revelou que a Mantos do PH tem o skip implementado em `snippets/cart-progress-bar.liquid` linha 50-51 (`if item.product.tags contains 'kit-casal' assign is_shirt = false`). JGS não tinha.

**Patch cirúrgico aplicado em `snippets/cart-progress-bar.liquid` da JGS** (+5 linhas, +152 chars):

```liquid
    elsif p_title contains 'patch'
       unless p_title contains 'camisa' or ... or p_title contains 'kit'
          assign is_shirt = false
       endunless
    endif

+   # Kit Casal: já é promoção à parte, não conta nos milestones
+   if item.product.tags contains 'kit-casal'
+     assign is_shirt = false
+   endif

    if is_shirt
```

**Backup:** `blocks/backups/2026-05-05_jgs-sports_snippets__cart-progress-bar.liquid.bak`
**Validação:** 0 pitfalls origem · 0 .PATCHED · 0 .APPLIED (após retry — primeiro PUT teve falha silenciosa por cache, segundo PUT confirmou)
**Outras ações na mesma sessão:**
- Tag `excluded-from-promo` adicionada no Kit Casal (preventivo, prepara solução completa via smart collection no futuro)
- Kit Casal movido pro topo das 5 coleções da vitrine: `brasil`, `selecoes`, `selecoes-lancamentos`, `todas-as-camisas`, `masculino-brasil` (todas MANUAL, reorder via `collectionReorderProducts`)

**Pendente (não aplicado):**
- Smart collection `Camisas Promo` + atualizar BxGy `customerBuys/Gets` — Mantos não usa esse padrão (ela tb deixa kit casal entrar no Discount, só skipa na progress-bar visual). JGS pode seguir o mesmo padrão sem mexer nos descontos.
- Kit Casal aparece em `conjuntos-infantis` e `masculino` — smart rules erradas, investigar.

## Adendo 2026-05-05 (3) — Cart drawer formatado (grid masc/fem)

**Motivação:** Pedro mostrou print do carrinho lateral atual da JGS — properties Kit Casal apareciam como linhas avulsas (Cor, Tamanho, Personalização, Nome Feminino, Número Feminino). Pediu pra ficar igual à Mantos: 2 cards lado a lado (Camisa Masculina / Feminina) com Qtd, Tamanho e Personalização agrupados.

**Estratégia escolhida — mais limpa que a Mantos (que tem inline):** snippet novo encapsulando a grid, e cart-drawer só delega via if. Mantém arquitetura consistente com o `kit-casal-variant-picker.liquid` (mesma sessão).

**Arquivos:**

1. **`snippets/cart-item-kit-casal.liquid`** 🆕 CRIAR (3095 chars, ~85 linhas)
   - Encapsula a grid 2 colunas (Camisa Masculina / Feminina) com Qtd/Tamanho/Personalização
   - Suporta os DOIS modos de produto:
     - **Legado:** options `Tamanho Masculino` + `Tamanho Feminino` separadas (como produto antigo da Mantos)
     - **Novo:** option `Tamanho` combinada (`M/G`) + option `Personalização` (Nenhum/Só M/Só F/Ambos) — caso do nosso Kit Casal subido na JGS. Faz `split: '/'` da option `Tamanho` pra extrair masc/fem.
   - Properties lidas: `Nome Masculino`, `Número Masculino`, `Nome Feminino`, `Número Feminino`. Se ambos blank no lado, exibe "Não".
   - CSS inline da grid (mesmo da Mantos linha 341-348)

2. **`snippets/cart-drawer.liquid`** ✏️ PATCH cirúrgico (+14 linhas / +1415 chars)
   - **Injeção 1 (badge):** após `<a class="cart-item__name">{{ item.product.title }}</a>`, antes de `cart-item__price-row`. Adiciona `<span class="kit-casal-tag">` com SVG + "KIT CASAL" + CSS inline da tag (gradient azul→rosa).
   - **Injeção 2 (wrapper if/else):** envolvendo o bloco `<dl class="cart-item__properties">...</dl>`. Se `kit-casal`, renderiza `cart-item-kit-casal`; senão, mantém o `<dl>` original intacto.
   - Resultado: produtos sem tag `kit-casal` continuam usando o cart-drawer normal (zero impacto).

**Backup:** `blocks/backups/2026-05-05_jgs-sports_snippets__cart-drawer.liquid.bak`

**Validação:**
- Origem (Mantos cart-drawer): n/a (extraí blocos específicos, não o arquivo inteiro)
- `cart-item-kit-casal.PATCHED`: 0 pitfalls
- `cart-drawer.PATCHED`: 0 pitfalls
- Pós-PUT: ambos `kit-casal-tag` e `kit-casal-cart-grid` confirmados via re-fetch

**Vantagens vs cópia 1:1 da Mantos:**
- Snippet isolado (~85 linhas) vs ~60 linhas inline duplicadas no cart-drawer
- Suporta modo NOVO (split `Tamanho`) que a Mantos não tem (ela é só legado)
- Adicionar lógica de kit casal em outro lugar do tema = `{% render 'cart-item-kit-casal' %}` em vez de copiar HTML

**Como testar:**
1. Adicionar Kit Casal ao carrinho na JGS
2. Abrir cart drawer
3. Ver: badge "KIT CASAL" gradient depois do título · grid 2 colunas com Camisa Masculina/Feminina · cada lado com Qtd 1 + Tamanho parseado + Personalização (nome+num ou "Não")

## Adendo 2026-05-05 (4) — Fix bug "PEDRO vira ORDEP" no input de Nome

**Sintoma reportado pelo Pedro:** ao digitar o Nome no input de personalização, o texto saía invertido. Ex: digitar "PEDRO" produzia "ORDEP". Cursor sempre voltava pro início depois de cada tecla.

**Root cause** — `snippets/kit-casal-variant-picker.liquid` linha 402 (importado 1:1 da Mantos):
```js
el.setSelectionRange(pos - 1 < 0 ? 0 : pos - 1, pos - 1 < 0 ? 0 : pos - 1);
```
Quando o handler `data-kit-uppercase` transformava `p` → `P`, `changed = true` e o cursor era **forçado uma posição pra trás** (`pos - 1`). Resultado: cada letra nova era digitada no início do input, invertendo o texto.

**Fix** (linha 401-405):
```js
if (changed) {
  el.value = v;
  // Cursor mantém posição original (uppercase não muda length); cap em length se filtro removeu chars
  var newPos = Math.min(pos, v.length);
  try { el.setSelectionRange(newPos, newPos); } catch (err) {}
}
```
- Uppercase: `v.length === pos.length`, `newPos = pos` — cursor fica depois da última letra digitada (esperado)
- Filtro letters/digits removeu char: `v.length < pos`, `newPos = v.length` — cursor não passa do fim do valor

**Aplicado:** PUT na JGS · validate 0 pitfalls · re-fetch confirmou (`Math.min(pos, v.length)` presente, `pos - 1 < 0` removido).

**Nota:** o bug existe na Mantos do PH também (snippet idêntico). Considerar propagar o fix pra lá quando for cirurgia separada.

## Adendo 2026-05-05 (5) — Verde Lever no badge + compare_at_price sincronizado

**Solicitações Pedro:**
1. Badge "KIT CASAL" tava com gradient azul→rosa (cópia 1:1 da Mantos). Padrão Lever é verde. Trocar.
2. Variants foram criadas sem `compare_at_price`. Replicar o padrão da Mantos.

**A) Cor do badge:**
- `snippets/cart-drawer.liquid` — trocado `linear-gradient(135deg, #2563eb 0%, #ec4899 100%)` por `linear-gradient(135deg, #22c55e 0%, #16a34a 100%)` (verde Lever padrão).

**B) compare_at_price:**
Padrão da Mantos no Kit Casal (descoberto via API):
- Apenas **50/200 variants** têm `compare_at_price` (todas com `Personalização: Nenhum`)
- Variants personalizadas (Só M / Só F / Ambos) ficam **sem compare_at**
- Ratio: ~1.05 (R$ 319,90 → R$ 339,90 = +R$ 20). **NÃO é 2x** como camisas individuais.
- Lógica: Kit Casal já é uma promo embutida (par com desconto). compare_at só pra mostrar "se comprar separado seria R$ 20 a mais".

Replicado 1:1 via `productVariantsBulkUpdate` em 1 batch de 75 variants. Resultado final JGS: 50/200 com compare_at, idêntico à Mantos.

**⚠️ Memória atualizada:** `feedback_compare_at_2x_rule` continua válida pra camisas individuais. Kit Casal é EXCEÇÃO — segue padrão da Mantos (~1.05x, só nas variants sem personalização).

## Lições / candidato?

- **Padrão de delegation por tag** (`if product.tags contains 'kit-casal' → render snippet alternativo`) é uma arquitetura limpa: zero impacto em produtos não-kit, fácil reverter (basta tirar a tag), reusável pra outros produtos especiais (combo de patches, kit família, etc).
- **Cart-drawer especializado por tipo de produto** é uma extensão natural — em vez de cart-drawer.liquid mega-monstro, podia ser `cart-line-{produto-tipo}.liquid` e o cart-drawer só delega.
- Padrão pode virar candidato pra Template BR — vale comparar com a Mantos (referência) e propagar pras outras lojas BR que tiverem produtos kit casal no futuro.
