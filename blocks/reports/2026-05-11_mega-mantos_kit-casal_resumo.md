# Mega Mantos — Kit Casal completo (2026-05-11)

## O que foi feito
Aplicado pacote Kit Casal (picker dupla masc/fem + cart-drawer formatado + skip milestones + variants 7×7×4) nos 2 produtos Kit Casal Brasil 2026/27. Fonte: JGS Sports (versão evoluída do padrão Mantos PH com fixes acumulados).

## Blocos usados
- Snippet `kit-casal-variant-picker.liquid` (NEW, 412 linhas)
- Snippet `cart-item-kit-casal.liquid` (NEW, 75 linhas)
- Patch `product-variant-picker.liquid` (wrap if/else delegando)
- Patch `cart-progress-bar.liquid` (skip kit-casal dos milestones)
- Patch `cart-drawer.liquid` (badge KIT CASAL verde + render grid masc/fem)
- Tag `kit-casal` + `excluded-from-promo` nos 2 produtos
- Reestruturação de variants via `productSet` (3 options + 196 variants × 2 produtos)

## Erros
- **Falha silenciosa de cache no PUT do `cart-progress-bar.liquid`** — primeiro PUT retornou 200 mas re-fetch trouxe versão antiga (mesmo bug que rolou no JGS 2026-05-05). Retry imediato confirmou. Solução: implementar retry-com-confirmação no helper de PUT que comparado conteúdo após.

## Melhorias
- A própria skill `code-blocks` apply.mjs poderia ter retry automático até 3x quando `validate(.APPLIED).pitfalls === 0` mas conteúdo difere do .PATCHED (= falha silenciosa).
- Salvar um `apply.mjs` reutilizável em `blocks/patches/` pro próximo Kit Casal (Mantos do PH skill com fix do cursor pendente, outras lojas que peçam mesma operação).
- Pedro mencionou que vai propagar pra "umas 5 lojas com Kit Casal" — vale formalizar isso como candidato pro Template BR.

## Candidato?
**Sim — candidato a Template BR** (mesma evolução que rodou em JGS 2026-05-05 + Mega Mantos 2026-05-11). Pacote bem testado, validado em 2 lojas reais, com fixes que não existem nem na Mantos PH original (cursor invertido, badge verde Lever).

Adicionar em `blocks/candidates/RANKING.md` na categoria **produto → kit casal**.
