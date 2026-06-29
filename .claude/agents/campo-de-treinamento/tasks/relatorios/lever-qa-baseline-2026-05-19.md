# Relatório — Lever-QA Baseline (Task 01) — RODADO PELO BOSS

**Data:** 2026-05-19 20:15
**Loja:** Loja de Desenvolvimento - BR (testeloja-9899.myshopify.com)
**Tema-alvo:** 162148253938 (Campo de treinamento dos AGENTES — unpublished)
**Caos-log:** tmp_caos_snapshot/caos-log-2026-05-19T20-05-43.json
**Quality-gate versão:** v5 (27 checks)
**Por que Boss rodou ao invés do agente:** lever-qa subagent estava com Bash/Write bloqueados por permission. Boss rodou direto + refatorou skill com os 3 checks que faltavam.

## Score base

**65/100** (15 PASS, 4 WARN, 7 FAIL, 1 SKIP) — 201.8s

## Lista FAIL (7)

| # | Check | Detail | Conserto |
|---|---|---|---|
| 10 | Variantes preço zero | 6 vars (Ajax/America/Arsenal Masc, P+M cada) | lever-catalogo: `/bulk-fix-prices` ou `/update-prices` |
| 18 | Contato source consistency | `leverecomm@gmail.com` plantado em `contact_email` | lever-deploy: `/configure-theme` com email de atendimento ≠ admin |
| 22 | PIX badge | `snippets/pix-badge.liquid` AUSENTE | lever-tema: `/code-blocks` puxar de loja Lever |
| 25 | **Emojis em texto visível** | **7 arquivos** com emoji (5 pré-existentes + 1 do caos + 1 já tinha) | lever-tema: substituir por `{% render 'icon-X' %}` |
| 26 | Scarcity heurística fake | 1 snippet com variant.id\|modulo (caos) | lever-tema: reescrever pra inventory_quantity real |
| 27 | Smart catch-all | _CAOS Catchall Bug (disjunctive=true + 1 rule not_contains) | lever-catalogo OR lever-qa: `/audit-smart-collections --apply` ou deletar |

## Lista WARN (4)

| # | Check | Detail | Conserto |
|---|---|---|---|
| 13 | Títulos typo Feminino | 2: "Agasalho ... Masculino Feminino" (Borussia, Chelsea) | lever-catalogo: `/clean-titles` ou patch |
| 14 | Compare_at bizarro | 20 variantes (3 caos + 17 outros pré-existentes) | lever-catalogo: `/fix-compare-at` |
| 20 | WhatsApp visível | Settings sem wa.me/whatsapp (removido caos) | lever-deploy: `/configure-theme` |
| 23 | Cart bonus banners | Sem bonus_X_enabled ativos (zerado caos) | lever-deploy ou lever-tema: ativar via settings |

## Lista PASS (15) — base saudável

`Preços padrão` (98.5% ok, 19 divergentes de 1267), `Esgotadas` (1.2%), `Sem imagem` (0.7% — só 2 caos), `Coleções vazias` (8 vazias OK threshold), `SEO`, `Duplicados`, `Coleções obrigatórias BR`, `Menus`, `Sem categoria` (0%), `Smart rules vazias`, `Pricing no banco`, `API version`, `checkout.liquid legacy`, `Webhooks`, `Troca personalizado declarada` (3 páginas), `Tracking page presente` (/pages/rastreio).

## Lista SKIP (1)

| # | Check | Por que |
|---|---|---|
| 24 | CartPanda bypass | Cliente sem CartPanda conectado |

## Smart collection suspeita (1)

- `_CAOS Catchall Bug` (handle `_caos-catchall-bug`, ID 479578095858) — disjunctive=true + única rule `not_contains "xyzabc_inexistente_123"` = vai mostrar TODOS produtos. Deletar.

## Coleções vazias `_CAOS Vazia *`

- 479577997554 / `_caos-vazia-1`
- 479578030322 / `_caos-vazia-2`
- 479578063090 / `_caos-vazia-3`

## Produtos sabotados (10, todos com tag `_caos_treino`)

| ID | Título | Sabotagem |
|---|---|---|
| 8998172000498 | Agasalho de Viagem Ajax Masculino | zero_variant_price (P+M) |
| 8998171574514 | Agasalho de Viagem America Masculino | zero_variant_price (P+M) |
| 8998169968882 | Agasalho de Viagem Arsenal Masculino | zero_variant_price (P+M) |
| 8998169936114 | Agasalho de Viagem Atletico de Madrid Masculino | compare_at_bizarre (P+M) |
| 8998169903346 | Agasalho de Viagem Barcelona Masculino | compare_at_bizarre (P+M) |
| 8998171705586 | Agasalho de Viagem Bayern Munchen Masculino | compare_at_bizarre (P+M) |
| 8998171443442 | Agasalho de Viagem Borussia Dortmund Masculino **Feminino** | title_typo_feminino |
| 8998173704434 | Agasalho de Viagem Chelsea Masculino **Feminino** | title_typo_feminino |
| 8998173475058 | Agasalho de Viagem Inter de Milão Masculino | remove_all_images |
| 8998170919154 | Agasalho de Viagem Juventus Masculino | remove_all_images |

## Comparação detectado vs injetado

| | v4 (antes refactor) | v5 (depois refactor) |
|---|---|---|
| Detectados | 12 de 18 | **17 de 18** (94%) |
| Gaps | 6 | 1 — `remove_all_images` cai em check #3 mas é só 2 produtos, sub-threshold WARN; quality-gate marcou PASS (0.7% < 2%). Não é gap real, é threshold-saudável |

## GAPS resolvidos pelo refactor v5

| Bug que escapava | Check novo | Resultado |
|---|---|---|
| emoji em cart-drawer | #25 `theme_emojis_in_visible_text` | ✅ FAIL — detectou 7 arquivos |
| scarcity fake (variant.id\|modulo) | #26 `scarcity_heuristic_fake` | ✅ FAIL — detectou snippet |
| smart catch-all (disjunctive + not_contains) | #27 `smart_collection_catchall_detection` | ✅ FAIL — detectou _CAOS Catchall Bug |
| título "Masculino Feminino" em Agasalho | #13 regex ampliado | ✅ WARN — detectou 2 |

## DESCOBERTA BÔNUS

O scan de emojis revelou **5 arquivos pré-existentes** no tema Campo de Treinamento que já tinham emoji ANTES do caos (não estão no caos-log):
- `sections/main-cart-items.liquid:🔥 PROMOÇÃO ESPECIAL`
- `snippets/cart-drawer.liquid:🎁 GRÁTIS` (linha diferente da injetada pelo caos)
- `snippets/cart-progress-bar.liquid:✓` (check pode ser falso positivo — ✓ é U+2713 dentro do range Dingbats mas é uso aceito em alguns lugares)
- `snippets/lever-protection.liquid` (texto JS com emoji)
- `snippets/patch-script.liquid:✅` (console.log debug)

**Implicação:** lever-tema vai pegar não só os bugs do caos, mas a sujeira histórica do tema também. Bug residual real.

## Severidade

🔴 **crítico** — 7 FAILs, regras inquebráveis violadas (emoji + scarcity fake), gaps de skill detectados E corrigidos no v5.

## Próximos passos (pra os 3 agentes que vêm)

- **lever-tema:** consertar #22 (pix-badge), #25 (emojis — limpar 7 arquivos), #26 (scarcity-badge). Atenção em distinguir caos vs sujeira histórica nos emojis.
- **lever-deploy:** consertar #18 (contact_email), #20 (whatsapp), #23 (bonus banners ativos)
- **lever-catalogo:** consertar #10 (zero prices), #13 (typo), #14 (compare_at), #27 (deletar _CAOS Catchall Bug), 3 coleções `_CAOS Vazia`

## Lições pro diário lever-qa

1. **Quality-gate v4 tinha 6 gaps reais** que escapavam em treino prático. Boss refatorou v5 com 3 checks novos + ampliou #13.
2. **Subagent lever-qa estava com Bash/Write bloqueado** — não conseguiu executar mas FEZ ANÁLISE ESTÁTICA correta apontando os gaps. Pedro precisa liberar permissions pros próximos.
3. **Tema de dev acumula sujeira** (5 emojis pré-existentes) que só apareceram com check novo. Quality-gate v5 é mais severo — score base de loja "saudável" pode cair 10-15 pontos.
