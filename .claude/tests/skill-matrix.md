# Skill Test Matrix — Lever System

Matriz de smoke tests das skills. Cada entry documenta:
- **Test Task**: tarefa mínima pra verificar que a skill funciona
- **BR / EN**: status da última execução em Template BR / Template EN
- **Parallel-safe**: se dá pra rodar em paralelo (em múltiplos clientes) sem dar 429
- **Notes**: observações específicas

**Legenda:**
- ✓ OK — rodou e retornou resultado esperado
- ✗ FAIL — erro conhecido, documentado nas notes
- ⚠ WARN — funciona mas flaky (rate limit, timeout ocasional, etc)
- – N/A — skill não se aplica a essa loja
- ? TBD — ainda não testado

---

## Última run: 2026-04-10 (inicial — manual parcial)

| Skill | Test Task | BR | EN | Parallel-safe | Notes |
|---|---|---|---|---|---|
| **audit-store** | Rodar relatório completo read-only | ? | ? | yes (múltiplas lojas) | 11 checks, ~2-5min; read-only, seguro em paralelo |
| **bulk-fix-prices** | DRY-RUN em loja com pricing configurado | ✓ | ? | **NO (mesma loja)** | Wrapper novo rodou 0 divergentes em De Boleiro (13738 variantes) |
| **clean-titles** | Dry-run + apply em 1 título com "Feminino" | ✓ | – | yes | Rodado hoje — 9 fixes BR, 9 Boleiro, 0 EN (sem typos PT em EN) |
| **code-blocks** | Copiar 1 seção entre BR e EN | ? | ? | **NO** | Operações atomizadas por seção; lock manual |
| **component** | Criar componente React de teste | – | – | yes | Sem Shopify, interno |
| **configure-theme** | Aplicar briefing dummy em Template BR | ? | ? | **NO (mesma loja)** | Updates sections JSON via proxy |
| **create-discount** | Criar PAGUE2LEVE3 preset em cliente teste + deletar | ? | ? | yes | Requer `write_discounts` scope (reconexão pendente) |
| **deploy-store** | Deploy de 1 coleção teste | ? | ? | **NO** | Pipeline atômico; não mistura lojas |
| **edge-function** | Scaffold de função teste | – | – | yes | Sem Shopify, interno |
| **fix-handles** | Corrigir handle PT→EN em 1 coleção EN | – | ? | yes | Só EN tem esse problema |
| **fix-options** | Renomear Option1 pra "Tamanho" em 1 produto | ? | ? | yes (lojas diferentes) | Rate limit OK se lojas separadas |
| **implement** | Rodar task automatizável do kanban | ? | ? | **NO** | Orquestra sub-skills, uma de cada vez |
| **import-missing** | Listar faltantes (read-only) | ? | ? | yes | Wrapper refatorado hoje; dry-run lê 2 lojas em paralelo |
| **lever-theme pull** | Pull tema BR → 408 arquivos | ✓ | ✓ | yes | Rodado hoje: BR 408/408, EN 398/398 ✅ |
| **lever-theme diff-br-en** | Comparar BR vs EN locais | ✓ | – | yes | Rodado: 46 diffs + 10 só BR + 4 só EN identificados |
| **lever-theme push-dev** | Push 1 arquivo de volta pra DEV | ? | ? | yes | Rate limit OK (delay 400ms) |
| **lever-theme propagate** | Propagar 1 snippet pra cliente teste | ? | ? | **NO (mesma loja)** | Allowlist: só sections/snippets/assets |
| **lever-theme diff <cliente>** | Diff cliente vs dev BR | ? | ? | **NO (por loja)** | Rate limit: cada cliente serial |
| **plan** | Pedir plano pra "atualizar preços" | ✓ | ✓ | yes | Read-only, só analisa |
| **quality-gate** | Rodar 5 checks em loja | ✓ | ? | yes (lojas diferentes) | Rodado em De Boleiro: score 40/100 (80s) |
| **shopify** | Listar coleções via natural language | ✓ | ✓ | yes | Generic fallback |
| **sort-collections** | Ordenar 1 coleção teste | ✓ | ? | **NO (propagation delay)** | Rodado hoje: 173 coleções, 4 retry needed |
| **update-prices** | DRY-RUN em loja com pricing | ✓ | ? | **NO (mesma loja)** | Wrapper refatorado hoje, 0 changes (pricing já aplicado) |
| **yampi-checkout** | Aplicar Yampi em loja teste | ? | – | **NO** | Só BR tem Yampi |

---

## Regras de paralelismo (obrigatório ler antes de orquestrar)

1. **Read-only + lojas diferentes**: **sempre paralelo OK**
   - ex: rodar `/quality-gate` em 10 lojas simultaneamente ✓

2. **Writes + lojas diferentes**: paralelo **OK até ~5 concurrent**
   - ex: `/update-prices` em 5 clientes ao mesmo tempo ✓
   - Acima de 5, talvez aparecer throttling no nosso IP ou no Shopify central

3. **Writes + mesma loja**: **SEMPRE serializar**
   - ex: NUNCA rodar `/sort-collections Cliente X` + `/update-prices Cliente X` ao mesmo tempo
   - Shopify REST 429 em ~6 req/s na mesma loja

4. **Operações de tema na mesma loja**: **serializar com delay 500ms+**
   - Asset API tem bucket próprio mas respeitar

5. **DRY-RUNs** (qualquer skill): paralelo OK (leituras puras)

---

## Como atualizar esta matriz

### Manual

Após rodar uma skill, edite a linha dela:
- Coluna BR ou EN: `✓` / `✗` / `⚠`
- Coluna Notes: o que aconteceu, quando, links pra logs

### Automatizado (run-matrix.mjs — TBD)

Um runner Node vai ler a matrix, rodar cada teste automatizável (aqueles que não requerem confirmação humana), e atualizar timestamps. Não está pronto ainda — fase futura.

---

## Observações gerais

- **Tests em Template BR**: `testeloja-9899.myshopify.com` (client id `39d74aff-7977-4104-88d4-ca468e00d310`)
- **Tests em Template EN**: `loja-de-estruturacao-e-desenvolvimento-en.myshopify.com` (client id `17089519-4779-41bb-96ca-9791e0677cf8`)
- **De Boleiro** (`15d0144e-c02a-4302-94ca-f903d1c19ba8`) é o cliente "real" usado pra smoke tests de volume (1.358 produtos) — bom pra validar performance
- Todo run de teste deve logar em `.claude/logs/execution.jsonl`

## Skills testadas durante refactor (2026-04-10)

Durante a implementação da Fase 2 (lib compartilhada), foram validadas:
- ✓ `update-prices.mjs` (dry-run De Boleiro, 50 produtos)
- ✓ `bulk-fix-prices.mjs` (dry-run De Boleiro, 0 divergentes em 13738 variantes = lib idêntica ao script antigo)
- ✓ `shopify-pricing.mjs` unit tests (15 categorize + 5 calcExpectedPrice)
- ✓ `supabase-rest.mjs` integration (fetchClient + fetchPricing)
- ✓ `shopify-api.mjs` via wrappers
- ✓ `validate.mjs` via wrappers

Durante Fase 3 (tema local):
- ✓ `theme-pull.mjs` (BR 408/408 + EN 398/398, 0 falhas no retry)
- ✓ `theme-diff.mjs` br-en (46 diffs reais detectados)

Durante Fase 4 (quality-gate):
- ✓ `quality-gate.mjs` (De Boleiro em 80s, identificou 235 coleções vazias + 100% sem SEO — bugs nos checks foram corrigidos)
