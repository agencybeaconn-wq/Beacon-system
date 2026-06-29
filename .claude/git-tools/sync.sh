#!/usr/bin/env bash
#
# sync.sh — Mantém sua branch alinhada com o que o squad fez no main.
#
# Uso (na raiz do repo): bash .claude/git-tools/sync.sh
# Atalho recomendado:    git sync   (ver setup no CLAUDE.md)
#
# O que faz:
#   1. git fetch origin (puxa estado remoto sem mudar working dir)
#   2. checa se sua branch tá limpa (sem mudanças não-commitadas)
#   3. troca pra main, dá pull
#   4. volta pra sua branch e faz merge do main
#   5. reporta quantos commits do squad chegaram e quais áreas mudaram
#
# Se você tem trabalho não-commitado, ele NÃO sobrescreve — avisa e sai.

set -euo pipefail

# cores
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
DIM="\033[2m"
NC="\033[0m"

cd "$(git rev-parse --show-toplevel)"

current_branch=$(git branch --show-current)

if [[ "$current_branch" == "main" ]]; then
  echo -e "${YELLOW}Você está no main. Pra sincronizar, basta:${NC}"
  echo "  git pull"
  exit 0
fi

# checar working dir
if [[ -n "$(git status --porcelain)" ]]; then
  echo -e "${RED}Você tem mudanças não-commitadas:${NC}"
  git status --short | head -10
  echo ""
  echo -e "${YELLOW}Faça uma das opções abaixo antes de rodar sync:${NC}"
  echo "  1) git add . && git commit -m 'wip: ...'   (commit do que tá fazendo)"
  echo "  2) git stash                              (guarda temporariamente)"
  echo ""
  exit 1
fi

echo -e "${BLUE}→ Fetching origin...${NC}"
git fetch origin --quiet

# quantos commits novos no main vs sua branch?
new_in_main=$(git rev-list --count "${current_branch}..origin/main")

if [[ "$new_in_main" == "0" ]]; then
  echo -e "${GREEN}✓ Sua branch '${current_branch}' já tá up-to-date com main. Nada a sincronizar.${NC}"
  exit 0
fi

echo -e "${BLUE}→ Main tem ${new_in_main} commit(s) novo(s) desde sua última sync. Mergeando...${NC}"
echo ""

# atualizar main local
git checkout main --quiet
git pull origin main --quiet
git checkout "$current_branch" --quiet

# merge (sem rebase, mais seguro pra time misto)
if ! git merge main --no-edit; then
  echo ""
  echo -e "${RED}✗ Conflito ao mergear main → ${current_branch}${NC}"
  echo -e "${YELLOW}Resolva os conflitos, depois:${NC}"
  echo "  git add . && git commit  (finaliza o merge)"
  echo "  ou: git merge --abort    (cancela e volta pro estado anterior)"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Sincronizado! Resumo dos ${new_in_main} commit(s) que chegaram:${NC}"
echo ""

# resumo: commits + autores
git log --pretty=format:"  ${DIM}%h${NC} %s ${YELLOW}(%an)${NC}" -"${new_in_main}" HEAD
echo ""
echo ""

# resumo: áreas mexidas
echo -e "${BLUE}Áreas mexidas:${NC}"
git diff --stat "HEAD~${new_in_main}" HEAD | tail -n 11 | sed 's/^/  /'
echo ""

echo -e "${GREEN}Tudo pronto. Pode codar.${NC}"
