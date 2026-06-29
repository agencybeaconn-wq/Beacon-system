# Onboarding — Lever System (dev)

> Setup de 10 minutos pra entrar no fluxo do squad. Faça uma vez por máquina.

## 0. Pré-requisitos

- macOS, Linux ou Windows com WSL (bash funciona)
- Git instalado (`git --version` deve responder algo)
- Conta GitHub com acesso ao repo `leveragency/LeverSystem` (peça acesso ao João Vithor se não tiver)

## 1. Clonar o repo

```bash
git clone https://github.com/leveragency/LeverSystem.git
cd LeverSystem
```

## 2. Autenticar GitHub CLI

```bash
# Instala se não tiver (Mac: brew install gh; Win: winget install GitHub.cli)
gh auth login
```

Quando perguntar, escolha:
- **GitHub.com**
- **HTTPS**
- **Yes, authenticate Git with credentials** (importante)
- **Login with a web browser**
- Faz login com a conta que tem acesso ao repo

Confirma que funcionou:
```bash
gh auth status
git fetch origin
```

Se `git fetch` der erro "Repository not found", o token não tem acesso. Avisa o João Vithor.

## 3. Criar sua branch pessoal

Se ainda não existe sua branch:
```bash
git checkout -b seu-nome
git push -u origin seu-nome
```

Se já existe (veja `git branch -r` pra conferir):
```bash
git checkout seu-nome
```

**Branches por pessoa hoje:** `joao-vithor`, `Juvito` (João Victor), `pedro`, `Campanhã` (Felipe), etc.

## 4. Configurar os aliases Git do squad

Copia e cola tudo de uma vez no terminal:

```bash
git config --global alias.sync  '!bash "$(git rev-parse --show-toplevel)/.claude/git-tools/sync.sh"'
git config --global alias.daily '!bash "$(git rev-parse --show-toplevel)/.claude/git-tools/daily-summary.sh"'
git config --global alias.done  '!bash "$(git rev-parse --show-toplevel)/.claude/git-tools/done.sh"'
```

Testa que funcionou:
```bash
git daily
```

Deve aparecer um relatório do que o squad fez nas últimas 24h. Se aparecer erro, avisa.

## 5. Instalar dependências do projeto

```bash
npm install
```

## 6. Configurar `.env`

```bash
cp .env.example .env
# (edita .env com as credenciais — pede pro João Vithor as keys)
```

## 7. Rodar local

```bash
npm run dev
```

Abre `http://localhost:5173` (ou a porta que aparecer).

---

## Sua rotina diária a partir de agora

### De manhã (ao começar a trabalhar)

```bash
git daily        # vê o que o squad fez ontem
git sync         # puxa o main atualizado pra sua branch
```

Se o `git sync` der **conflito de merge**:
- Abre os arquivos com `<<<<<<<` no VSCode
- Resolve manualmente, ou pede ajuda no canal
- `git add <arquivo>` e `git commit` pra finalizar
- Ou `git merge --abort` pra cancelar e pensar

### Ao terminar uma sub-tarefa OU ao fechar o PC

```bash
git done "feat(area): o que você fez"
```

Isso vai:
1. Mostrar quais arquivos vão entrar no commit
2. Pedir confirmação
3. `git add .` + `git commit` + `git push origin sua-branch`

**Formato de mensagem (segue convenção):**
- `feat(area): nova feature` — `feat(crm): drag-drop kanban`
- `fix(area): correção` — `fix(auth): redirect 401`
- `chore: tarefa de manutenção` — `chore: bump deps`
- `docs: documentação` — `docs: atualiza README`
- `refactor(area): refatoração` — `refactor(skills): remove dead code`
- `style(area): só CSS/visual` — `style(button): rounded corners`

### Ao terminar uma feature inteira

Abre PR pro João Victor ou Pedro revisarem:
```bash
gh pr create
```

---

## "Esqueci de commitar antes de fechar"

Não tem problema, o **hook Stop do Claude Code** te avisa quando você fecha a sessão com trabalho não-salvo. Mensagem padrão:

```
📋 Lembrete antes de fechar a sessão:
   • 5 arquivo(s) modificado(s) sem commit

   Pra resolver tudo de uma vez:  git done "mensagem"
   Pra ver o que vc mexeu:        git status
   Pra deixar pra depois:         git stash
```

---

## Convenções importantes

1. **Nunca commita direto no `main`.** Sempre via PR.
2. **`git sync` antes de mexer em código compartilhado** (`src/components/lever-os/`, `supabase/functions/`, `.claude/skills/`). Pra pasta isolada de cliente, pode esperar.
3. **Commits frequentes** (a cada chunk de trabalho lógico). Não acumular 18 arquivos como "trabalho do dia".
4. **Arquivos sensíveis (`.env`, `*.key`, credenciais)** nunca vão pro Git. O `git done` te avisa se detectar tentativa.
5. **Quando entrar em conflito de merge complexo:** pergunta no canal antes de forçar resolução.

---

## Troubleshooting

### `git sync` falha com "case-insensitive filesystem"

Significa que existe alguma branch remota com nome conflitante (ex: `Juvito` e `juvito`). Avisa o João Vithor ou João Victor pra deletar a duplicata.

### `git fetch` retorna "Repository not found"

Seu token GitHub não tem acesso. Rode `gh auth status` pra ver com qual conta tá logado. Se for conta errada: `gh auth login` de novo.

### Hook do Claude Code não aparece quando fecho sessão

Confere que o arquivo é executável: `chmod +x .claude/hooks/stop-git-reminder.sh`. Se ainda assim não funcionar, avisa o João Vithor.

### "Quero desfazer meu último commit"

```bash
git reset --soft HEAD~1   # mantém os arquivos modificados, desfaz só o commit
```

Se já tinha pushado:
```bash
git reset --soft HEAD~1
git push --force-with-lease origin sua-branch   # cuidado, sobrescreve remoto
```

**Não use `--force-with-lease` no `main`. Nunca.**

---

## Quem ajuda em quê

- **Bug no setup ou no Git:** João Vithor ou Pedro
- **Code review / aprovação de PR:** João Victor (COO) ou Pedro (dev)
- **Credenciais/acessos:** João Vithor
- **Design / Figma:** Felipe Campanha
- **Tráfego / análise:** Wesley

Detalhes em [Lever QI vault → 07-team/](https://obsidian.md) (Obsidian).
