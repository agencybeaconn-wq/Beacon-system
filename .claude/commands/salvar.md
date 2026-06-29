# /salvar — consolida o trabalho da sessão (squad Lever)

Comando do squad pra fechar a sessão sem perder nada: commita o código, atualiza o vault
Lever QI e registra learnings. **Use ao terminar qualquer sub-tarefa ou antes de fechar o PC.**

## O que faz

1. **Inventário** — olha `git status` no repo, o que foi discutido/decidido na conversa, e
   arquivos novos/modificados. Reporta um resumo antes de agir.

2. **Commit cirúrgico** (no repo LeverSystem, na sua branch):
   - `git add` por arquivo/pasta específica — **nunca `git add -A`/`.`** (evita vazar segredo).
   - Mensagem no padrão `area(scope): resumo` (feat/fix/chore/docs/refactor/style).
   - Termina com `Co-Authored-By: Claude` quando aplicável.
   - **Nunca no `main`** — sempre na sua branch pessoal, PR depois.

3. **Atualiza o Lever QI** (vault compartilhado do squad) quando a sessão produziu algo que o
   time precisa saber — decisão, cliente novo, processo, arquitetura. Doc em
   `Lever QI/` com **data ISO no nome** (ex: `00-operating-brain/2026-05-29-titulo.md`).
   Push do vault é ok (é o canal do squad).

4. **Memória** — registra fato/decisão/learning recorrente em `~/.claude/.../memory/` (índice
   `MEMORY.md`, 1 linha ≤200 chars). Pra você lembrar nas próximas sessões.

5. **Resumo final** — curto, em PT, plain language: o que foi commitado e onde, o que foi
   documentado, o que ficou pendente pra próxima.

## Regras de segurança (CRÍTICO)

- **NUNCA commitar** `.env*`, `*.key`, `*secret*`, `*_token*`, `profile/`, `runs/`, credenciais.
  Liste o que foi pulado.
- **NUNCA `git add -A`/`.`** — sempre por caminho específico.
- **NUNCA** `--no-verify`, skip de hooks ou force push.
- **Confirme antes de push** em código compartilhado (LeverSystem). Vault Lever QI pode pushar.

## Argumentos

- (sem arg) → escopo completo (commit + vault + memória + resumo)
- `dry-run` → mostra o que faria, sem commitar
- `+push` → faz push após os commits sem perguntar

## Cultura

Tudo que você constrói (skill, fix, doc, automação) **commita no mesmo dia**. Visibilidade total,
zero duplicação. O `/salvar` é o atalho pra isso virar hábito — rode sempre que fechar um chunk.
