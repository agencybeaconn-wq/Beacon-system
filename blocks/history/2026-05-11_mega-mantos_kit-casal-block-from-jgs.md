# Bloco: Kit Casal completo (picker dupla + cart-drawer + tags)

## Operação
- **Data:** 2026-05-11
- **Origem:** JGS Sports (`tx7qw4-dy.myshopify.com`) — tema `157841686758` "Tema Lever"
- **Destino:** Mega Mantos (`loja-mega-manto.myshopify.com`) — tema MAIN `181847916655` "22/04 - Lever Atualizado"
- **Idioma:** BR → BR (sem tradução)
- **Validação:** 100% (0 pitfalls em todos os 5 .PATCHED e .APPLIED) · storefront markers confirmados
- **Status:** FASE A + FASE B Aplicado ✓ (operação completa)

## Contexto

Cliente Mega Mantos tem 2 Kit Casal Brasil 2026/27 (I + II) com layout padrão Shopify
(Tamanho único + Personalizar Sim/Não). Pedro pediu pra deixar igual à Mantos do PH:
2 cards visuais (Tamanho Masculino + Personalizar masc / Tamanho Feminino + Personalizar fem),
cart drawer com grid masc+fem, badge KIT CASAL e skip nos milestones.

JGS Sports já tem a versão "evoluída" do bloco (aplicada em 2026-05-05):
- Badge verde Lever (`#22c55e → #16a34a`), não azul/rosa da Mantos
- Fix do bug "PEDRO vira ORDEP" (cursor inversion)
- Snippet `cart-item-kit-casal.liquid` isolado (em vez de inline na cart-drawer da Mantos)

Usei JGS como fonte (mais limpa) em vez da Mantos original.

## Arquivos tocados (FASE A — código de tema)

| Arquivo | Antes | Depois | Diff | Modo |
|---|---:|---:|---:|---|
| `snippets/kit-casal-variant-picker.liquid` | (não existia) | 25823 chars / 412 linhas | +25823 | NEW (cópia 1:1) |
| `snippets/cart-item-kit-casal.liquid` | (não existia) | 3095 chars / 75 linhas | +3095 | NEW (cópia 1:1) |
| `snippets/product-variant-picker.liquid` | 5579 chars / 125 linhas | 5653 chars / 128 linhas | +74 | PATCH (wrap if/else) |
| `snippets/cart-progress-bar.liquid` | 19207 chars / 309 linhas | 19051 chars / 313 linhas | +5 linhas (líquido) | PATCH (skip kit-casal) |
| `snippets/cart-drawer.liquid` | 41537 chars / 839 linhas | 42952 chars / 853 linhas | +1415 | PATCH (badge + render) |

### Notas dos patches

1. **product-variant-picker.liquid** — wrap if/else delegando: produtos com tag `kit-casal` renderizam `kit-casal-variant-picker`, resto continua com lógica original.

2. **cart-progress-bar.liquid** — 5 linhas após o bloco patch detection (linha 31):
   ```
   # Kit Casal: já é promoção à parte, não conta nos milestones
   if item.product.tags contains 'kit-casal'
     assign is_shirt = false
   endif
   ```

3. **cart-drawer.liquid** — 2 injections:
   - Badge "KIT CASAL" verde Lever (com SVG ícone bag) após `</a>` do `cart-item__name`
   - Wrapper if/else envolvendo `<dl class="cart-item__properties">`: kit-casal → `{% render 'cart-item-kit-casal' %}`, resto → mantém `<dl>` original intacto.

   **Atenção:** o cart-drawer do MM tem **839 linhas vs 436 do JGS** — muita customização própria. Patch cirúrgico (não full-file). Anchors usados:
   - `<a href="{{ item.url }}" class="cart-item__name h4 break">` ✓ (linha 386 MM)
   - `<dl class="cart-item__properties">` ✓ (linha 444 MM)
   Ambos compatíveis com JGS sem mudança.

## Tags aplicadas nos produtos

| Produto | ID | Tags adicionadas |
|---|---|---|
| Kit Casal Torcedor Brasil 2026/27 I | `14999989354607` | `kit-casal`, `excluded-from-promo` |
| Kit Casal Torcedor Brasil 2026/27 II | `14999990534255` | `kit-casal`, `excluded-from-promo` |

## Validações
- `validateAll` origem JGS: 0 pitfalls em todos os 5
- `validateAll .PATCHED`: 0 pitfalls em todos os 5
- `validateAll .APPLIED`: 0 pitfalls em todos os 5
- CRLF → LF normalizado antes de cada PUT (pitfall #13)
- **Falha silenciosa de cache** rolou no `cart-progress-bar.liquid` (primeiro PUT retornou 200 mas re-fetch trouxe versão antiga — mesmo bug do histórico JGS 2026-05-05). Retry imediato confirmou.

## Backups

`blocks/backups/2026-05-11_mega-mantos_snippets__*.liquid.bak` (3 arquivos — apenas dos PATCH, NEW não tem backup):
- `product-variant-picker.liquid.bak`
- `cart-progress-bar.liquid.bak`
- `cart-drawer.liquid.bak`

Reverter: `restoreAsset(shopFn, 181847916655, '<key>', 'mega-mantos')` + delete dos 2 NEW snippets via API.

## FASE B — Aplicada: Reestruturação de variants via productSet

**Diretrizes Pedro (não copiar Mantos PH cegamente, adaptar pra Mega Mantos):**
- Preço base **não mexer** (Kit I e II ambos R$ 330) — preserved
- Acréscimos de tamanho **não mexer** (Mega Mantos não cobra a mais por GG/2GG/3GG/4GG — flat) — preserved
- Personalização **não mexer** (Mega Mantos cobra +R$ 30/lado) — preserved
- compare_at = **2x base price** nas variants `Personalização = Nenhum` (= R$ 660 com 50% OFF visível) — Lever standard, **não** o 1.05x da Mantos PH

**Estrutura nova (ambos os Kit Casal):**
- Options: `Tamanho Masculino` (P/M/G/GG/2GG/3GG/4GG) + `Tamanho Feminino` (P/M/G/GG/2GG/3GG/4GG) + `Personalização` (Nenhum/Só Masculina/Só Feminina/Ambas)
- Variants: 7 × 7 × 4 = **196 por produto** (392 total)
- compare_at em 49 variants/produto (Nenhum × 49 combinações tam_masc × tam_fem)
- Preços: R$ 330 (Nenhum) / R$ 360 (Só M ou Só F) / R$ 390 (Ambas)

**Implementação:**
- Mutation `productSet` com `synchronous: true`
- Kit I: 196 variants em 3.3s
- Kit II: 196 variants em 2.6s
- Zero `userErrors`. Title/vendor/type/description/media/SEO preservados (productSet só substituiu options + variants).

**Storefront verificado (markers do snippet):**
- `data-kit-section` ✓ · `data-kit-mode="legacy"` ✓ (3 options → modo correto)
- `Tamanho Masculino` × 8 · `Tamanho Feminino` × 8 (radio labels + variant titles)
- `Personalizar camisa masculina` × 2 · `Personalizar camisa feminina` × 2
- `data-kit-uppercase` × 6 (inputs Nome) · `data-kit-letters-only` × 3 · `data-kit-digits-only` × 3

URLs canônicas (primary domain):
- https://megamanto.com/products/kit-casal-torcedor-brasil-2026-27-i
- https://megamanto.com/products/kit-casal-torcedor-brasil-2026-27-ii

## Storefront — testar

- https://loja-mega-manto.myshopify.com/products/kit-casal-torcedor-brasil-2026-27-i
- https://loja-mega-manto.myshopify.com/products/kit-casal-torcedor-brasil-2026-27-ii

## Lições / candidato?

Esse bloco já é o pacote completo e validado em 2 lojas (JGS Sports 2026-05-05 + Mega Mantos 2026-05-11). Marca a evolução do padrão Mantos do PH com 3 fixes:
1. Cor verde Lever (não azul/rosa)
2. Fix do cursor invertido
3. Snippet isolado para cart drawer (em vez de inline)

**Candidato pra Template BR:** sim, com a ressalva de que requer estrutura de variants específica (legado ou novo) nos produtos kit-casal. Sem isso, snippet quebra.

A skill `code-blocks` já tem a base; o Template BR poderia ter o picker dupla como padrão pra qualquer produto futuro com tag `kit-casal`.
