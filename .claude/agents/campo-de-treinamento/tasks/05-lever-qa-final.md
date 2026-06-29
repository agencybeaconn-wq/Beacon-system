# Task 05 — lever-qa FINAL

> Agente: **lever-qa**
> Objetivo: validar que os 3 agentes anteriores consertaram tudo + comparar com baseline + relatório consolidado.

## Loja-alvo

- **Loja:** `Loja de Desenvolvimento - BR`
- **Tema:** `162148253938` (Campo de treinamento dos AGENTES — unpublished)

## Missão

1. Rodar `quality-gate` v4 com `--theme-id=162148253938` final:
   ```bash
   node .claude/skills/quality-gate/quality-gate.mjs "Loja de Desenvolvimento - BR" --theme-id=162148253938 --triggered-by=campo-treino-final --json > tmp_caos_snapshot/final-qa-AAAA-MM-DD.json
   ```

2. Rodar `audit-smart-collections` pra confirmar `_CAOS Catchall Bug` foi deletada/corrigida

3. **Comparar baseline vs final:**
   - Ler `tmp_caos_snapshot/baseline-qa-*.json`
   - Ler `tmp_caos_snapshot/final-qa-*.json`
   - Diff por check (PASS antes? PASS depois?)
   - Score evolution: baseline X/100 → final Y/100

4. **Avaliar performance de cada agente:**
   - lever-tema: consertou #22, #23, scarcity, emoji?
   - lever-deploy: consertou #18, #19, #20, #21?
   - lever-catalogo: consertou #10, #13, #14, #4?

5. **Salvar relatório FINAL em `.claude/agents/campo-de-treinamento/tasks/relatorios/00-RESUMO-FINAL-AAAA-MM-DD.md`:**

   ```markdown
   # Treino Campo de Treinamento — AAAA-MM-DD
   
   ## Score evolution
   - Baseline: X/100 (Y PASS, Z WARN, W FAIL, V SKIP)
   - Final: X'/100 (...)
   - Delta: +N pontos
   
   ## Performance por agente
   | Agente | Bugs alvo | Consertou | Falhou em | Tempo |
   |---|---|---|---|---|
   | lever-tema | 4 | 3 | scarcity-badge (motivo) | 12min |
   | lever-deploy | 4 | 4 | — | 14min |
   | lever-catalogo | 4 | 3 | sem imagem (esperado) | 9min |
   
   ## Bugs residuais
   - [check #X] motivo da residualidade
   
   ## Skills que precisaram de refactor (Boss anota pra próximo ciclo)
   - skill X: bug Y
   
   ## Próximo treino
   - Próxima rodada de caos: trazer bug novo Z
   ```

## Skills disponíveis

- `quality-gate` (--theme-id)
- `audit-smart-collections`
- `audit-store` (opcional, mais lento)

## Critério de sucesso

- Comparação baseline vs final feita
- Performance de cada agente avaliada honestamente (memory `feedback_sargento_modo_treino_agentes` — modo sargento, padrão é réplica ou MELHOR)
- Relatório FINAL salvo no path acima
- Bugs residuais listados com motivo

## Restrição

**Read-only.** NÃO corrige nada. Só valida + relata.
