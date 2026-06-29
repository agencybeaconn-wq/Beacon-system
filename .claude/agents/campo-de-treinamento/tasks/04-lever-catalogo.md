# Task 04 — lever-catalogo CONSERTA PREÇOS + PRODUTOS + COLEÇÕES

> Agente: **lever-catalogo**
> Objetivo: consertar bugs em produtos (preços, compare_at, títulos, imagens) + limpar coleções caos.

## Loja-alvo

- **Loja:** `Loja de Desenvolvimento - BR`
- Produtos sabotados têm tag `_caos_treino`
- Coleções sabotadas têm prefix `_CAOS`

## Missão

Boss bagunçou produtos e criou coleções lixo. Sua missão:

1. **Diagnóstico:**
   - Rodar `quality-gate` v4 (sem --theme-id, pois bugs são de catálogo) — checks #2, #3, #10, #13, #14, #4 vão estar afetados
   - Filtrar produtos por tag `_caos_treino` pra ver as vítimas
   - Listar coleções com prefix `_CAOS`

2. **Identificar e consertar (descobrir via diagnóstico — lista é referência):**

   ### Produtos
   - **Check #10** `zero/null prices` — 3 produtos com variants `price=0.00`. Rodar `/bulk-fix-prices` ou `/update-prices` pra recuperar preço da `client_pricing` table
   - **Check #14** `compare_at bizarro` — 3 produtos com `compare_at <= price`. Rodar `/fix-compare-at`
   - **Check #13** `título com typo Feminino` — 2 produtos com "Feminino" no título (deveria ser "Feminina" pra camisas). Rodar `/clean-titles` ou `/bulk-product-meta`
   - **Check #3** `produtos sem imagem` — 2 produtos com `images.length === 0`. Imagens precisam ser repostas MANUALMENTE (sem backup das URLs CDN originais) OU marcar como `status=draft` até reposição

   ### Coleções
   - **3 coleções vazias `_CAOS Vazia 1/2/3`** — deletar via Shopify Admin API ou `/fix-empty-collections`
   - **1 smart collection `_CAOS Catchall Bug`** — `audit-smart-collections` vai flag. Deletar (ou converter regra pra algo válido)

3. **Validação:**
   - Re-rodar `quality-gate` v4
   - Checks #10 PASS, #14 PASS, #13 PASS, #4 PASS (coleções vazias removidas)
   - #3 pode ficar WARN se ainda faltar imagens — aceitável se documentado no relatório

## Skills disponíveis

- `quality-gate`
- `bulk-fix-prices` / `update-prices`
- `fix-compare-at`
- `clean-titles`
- `bulk-product-meta`
- `fix-empty-collections`
- `audit-smart-collections` (com --apply pra deletar smart bug)
- `dedupe-products`

## Critério de sucesso

- quality-gate v4 na tua área: #10 PASS, #14 PASS, #13 PASS, #4 PASS
- 0 produtos com tag `_caos_treino` em estado bagunçado (preço/compare_at/título corretos)
- 0 coleções com prefix `_CAOS` (todas deletadas ou corrigidas)
- Salvar relatório em `tasks/relatorios/lever-catalogo-AAAA-MM-DD.md`

## Restrição

**NÃO mexer no tema** — isso é `lever-tema`.
**NÃO mexer em páginas** — isso é `lever-deploy`.
**Imagens deletadas pelo Boss não podem ser repostas automaticamente** — Boss perdeu as URLs originais. Documentar no relatório como pendência manual.

## ⚠️ Caso skill faltar / não cobrir caso

Reportar pra Boss. Boss refatora skill (ou cria nova). Agente NÃO improvisa workaround frágil.
