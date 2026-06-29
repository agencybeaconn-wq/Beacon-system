# Operação: Unlock 3GG e 4GG masc no Kit Casal Brasil Home 26/27

## Operação
- **Data:** 2026-05-19
- **Loja:** Mantos do PH (`a9dc24-2.myshopify.com`) — tema MAIN `142261027011` (Cartpanda forkado)
- **Produto:** `Kit Casal 2 Camisas Brasil Home 26/27 - Torcedor` (gid `8248726585539`, handle `kit-casal-camisa-brasil-home-26-27-nike-torcedor`)
- **Modo:** unlock-de-escassez + criação de variants (NÃO é code-blocks; mudança pontual interna na loja)
- **Status:** Aplicado — snippet patchado · 40/40 variants criadas (0 userErrors) · SHA pós-PUT bate · spot-check 3/3 OK · cache do storefront 80% convergido (propagação edge GRU ainda terminando)
- **Agente:** lever-tema
- **Aval:** explícito do Pedro via print do storefront + print do admin com 25 variants atuais; instrução literal "aqui Claude é só adicionar"

## Contexto

Cliente identificou que os tamanhos 3GG e 4GG da camisa MASCULINA do Kit Casal apareciam riscados no picker, mas a camisa MASCULINA avulsa (não-kit) já tem esses tamanhos disponíveis em estoque. O Kit Casal tinha sido criado com escassez fake nos dois lados (masc + fem) — herança da fonte canônica Mantos PH 2026-05-15. Agora o masc precisa abrir; o fem fica fechado (escassez mantida pelo lado feminino).

## Decisão arquitetural

**Patch cirúrgico de 1 linha + criação de 40 SKUs novos.** Não há reuso de feature entre lojas. Apenas:
1. Snippet `kit-casal-variant-picker.liquid` — linha 65 troca `'3GG,4GG'` por `''` (mantém `disabled_fem = '3GG,4GG'` intocado).
2. `productVariantsBulkCreate` em 2 lotes de 20 com delay 600ms (regra Lever de serialização de writes na mesma loja).

Sem outras mudanças: nem CSS, nem JS, nem template, nem option do produto (a option `Tamanho` aceita strings, então `3GG/X` e `4GG/X` são valores novos válidos sem precisar editar `options`).

## Arquivos tocados

| Arquivo | Antes | Depois | Diff | Modo |
|---|---:|---:|---:|---|
| `snippets/kit-casal-variant-picker.liquid` | 36816 bytes / 640 linhas | 36809 bytes / 640 linhas | -7 bytes | PATCH linha 65 |

**Recursos não-arquivo (Admin API):**

| Recurso | Antes | Depois | Operação |
|---|---:|---:|---|
| Variants do produto Kit Casal Brasil 26/27 | 100 | 140 | `productVariantsBulkCreate` × 2 lotes |

## Pricing detection (pré-criação)

Rodei `step3b-pricing-detect.mjs` pra mapear a matriz real de preços das 100 variants existentes e validar a fórmula. **0 mismatches em 100 variants:**

```
base = 319.90        (P/P + Nenhum)
compareAt = 450.00   (constante)
inventoryPolicy = CONTINUE

pers_extra:
  Nenhum            = 0
  Só Masculina      = +30
  Só Feminina       = +30
  Ambos             = +60

size_extra (somado por LADO):
  P, M, G, GG       = 0
  2GG               = +10
  3GG               = +20
  4GG               = +30

price = base + size_extra(masc) + size_extra(fem) + pers_extra
```

Aprendizado: **o relatório anterior dessa missão (entregue antes pelo agente) informava base=339.90 e nomes pers `Só Camisa Masculina/Ambas as camisas`. Estavam errados.** Real: base=319.90 e nomes `Só Masculina/Ambos`. Confirmação direta na API contornou esse risco.

## Plano de criação (40 variants)

| Tamanho masc | Tamanhos fem (×5) | Personalizações (×4) | Subtotal |
|---|---|---|---:|
| 3GG | P/M/G/GG/2GG | Nenhum/Só Masculina/Só Feminina/Ambos | 20 |
| 4GG | P/M/G/GG/2GG | Nenhum/Só Masculina/Só Feminina/Ambos | 20 |

Amostra de range:
- `3GG/P + Nenhum` → 339.90
- `3GG/GG + Só Masculina` → 369.90
- `4GG/2GG + Ambos` → 419.90 (variant mais cara)

## Validações

- ✅ Snippet patch — SHA-256 antes/depois local idêntico ao live (após retry, pitfall #13)
  - SHA pré-patch: `baea0710da38817a96f0cd81d8c0f60e29554d4d93557695e1b8a54e76976f4a`
  - SHA pós-patch: `ace58893b74251a0f179cd4fc81e6447d98c70f3794f2f51afc57f65be836318`
- ✅ `productVariantsBulkCreate` × 2 lotes: 20+20 criadas, 0 userErrors
- ✅ Re-query GraphQL: 140 variants total
- ✅ Spot-check 3/3:
  - `3GG/P + Nenhum` → 339.90 / 450.00 ✓
  - `4GG/2GG + Ambos` → 419.90 / 450.00 ✓
  - `3GG/GG + Só Masculina` → 369.90 / 450.00 ✓
- ✅ Storefront PDP — 6/6 markers core do picker (`data-kit-section`, `data-kit-mode`, `Tamanho Masculino`, `Tamanho Feminino`, `Personalizar camisa masculina`, `Personalizar camisa feminina`)
- ⏳ Storefront PDP — convergência de cache edge GRU em 80% (8/10 fetches já trazem masc 3GG/4GG **UNLOCKED** + fem 3GG/4GG **LOCKED**, conforme especificado). 2/10 ainda servem versão velha. Convergência completa prevista em <5 min.
- ✅ Regra inquebrável #5: nenhuma `properties[_*]` introduzida (snippet original já tinha `_pair_count` herdado da Mantos PH original — não alterado).
- ✅ Regra inquebrável #13: snippet editado **no tema main publicado** apenas, sem duplicar pro draft.
- ✅ Regra inquebrável #18: Kit Casal continua com `tag excluded-from-promo` → segue fora de BxGy.

## Pitfalls registrados

1. **Cache do storefront não invalida automaticamente.** Após o 1º PUT do snippet (linha 65), o storefront continuou servindo a versão velha mesmo com cache-buster na URL. Forçar com PUT no-op de comentário no fim do arquivo resolveu (mas resultou em convergência parcial — alguns nodes do edge GRU servem velho, outros novo, por alguns minutos). Posteriormente removi o comentário pra deixar o snippet limpo.
2. **Cache stale do Admin Assets API (pitfall #13) — confirmado 4ª vez hoje.** Primeiro GET pós-PUT trouxe SHA antigo. Retry após 1.5s trouxe SHA novo. Já é padrão hoje na Mantos: esperar 1-2s + retry no verify.
3. **Pricing matrix incorreta no relatório anterior.** Nomes de personalização eram `Só Masculina/Só Feminina/Ambos` no produto real (relatório anterior dizia `Só Camisa Masculina/...`). Base era 319.90 (relatório dizia 339.90). Aprendizado: SEMPRE rodar detection real da matriz de preços antes de criar variants. Tem 4 valores únicos por personalização × 7 tamanhos masc × 7 tamanhos fem; basta 1 GraphQL query com `variants(first: 250)` pra validar.

## Backups

- `blocks/backups/2026-05-19_mantos-ph_kit-casal-variant-picker__pre-unlock-3gg-4gg.liquid` (36816 bytes — snippet LIVE pré-patch)

Rollback completo (se necessário):
```js
// 1) Restaurar snippet
import { getCreds, shReq } from '.claude/lib/shopify-api.mjs';
import fs from 'fs';
const c = await getCreds('053f7258-95f4-4ca9-81ad-4032b18829ba');
const original = fs.readFileSync('blocks/backups/2026-05-19_mantos-ph_kit-casal-variant-picker__pre-unlock-3gg-4gg.liquid', 'utf8');
await shReq(c.shop, c.token, 'PUT', '/admin/api/2026-04/themes/142261027011/assets.json', { asset: { key: 'snippets/kit-casal-variant-picker.liquid', value: original } });

// 2) Deletar as 40 variants criadas (IDs em scripts/theme_dump/kit-casal-migration/2026-05-19/unlock-3gg-4gg-create-log.json)
// Mutation: productVariantsBulkDelete(productId, variantsIds)
```

## Lições / candidato a propagar?

- **Sim — padrão de detecção de pricing matrix.** Antes de criar variants em Kit Casal de qualquer loja, rodar uma query `variants(first: 250) { selectedOptions price compareAtPrice }` e cruzar com fórmula `base + size_extra + pers_extra`. Garante 0 mismatch + zero chute. Já é template (`step3b-pricing-detect.mjs`).
- **Sim — cache busting no PUT idempotente.** Pra mudanças minúsculas no snippet (1 linha, poucos bytes), Shopify pode não invalidar o cache do storefront. PUT no-op de comentário no fim força reconciliação. Padrão deve virar pitfall registrado.
- **Não propagar a operação em si:** é local ao produto de Kit Casal Brasil 26/27 da Mantos PH. Outras lojas com Kit Casal podem ou não ter restrição masc 3GG/4GG conforme política da loja.

## Storefront — confirmar

- https://mantosdoph.com.br/products/kit-casal-camisa-brasil-home-26-27-nike-torcedor
- Esperado:
  - Lado MASCULINO: P / M / G / GG / 2GG / 3GG / 4GG todos clicáveis. 2GG mostra +R$ 10, 3GG mostra +R$ 20, 4GG mostra +R$ 30.
  - Lado FEMININO: P / M / G / GG / 2GG clicáveis. 3GG e 4GG riscados/disabled (escassez mantida).
  - Selecionar `3GG/P + Personalizar=Não/Não` → preço deve ficar 339.90.
  - Selecionar `4GG/2GG + Personalizar=Sim/Sim` → preço deve ficar 419.90.
  - Botão "Adicionar ao carrinho" funciona pra qualquer combinação dessas 40 novas.
