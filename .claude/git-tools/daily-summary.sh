#!/usr/bin/env bash
#
# daily-summary.sh — Mostra o que o squad fez nas últimas 24h (ou janela custom).
#
# Uso:
#   bash .claude/git-tools/daily-summary.sh           (últimas 24h, default)
#   bash .claude/git-tools/daily-summary.sh 3.days    (últimos 3 dias)
#   bash .claude/git-tools/daily-summary.sh 1.week    (última semana)
#
# Atalho recomendado: git daily   (ver setup no CLAUDE.md)
#
# Útil pra rodar de manhã antes de começar a trabalhar.

set -euo pipefail

# cores
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
DIM="\033[2m"
NC="\033[0m"

cd "$(git rev-parse --show-toplevel)"

WINDOW="${1:-24.hours}"

echo -e "${BLUE}→ Fetching origin...${NC}"
git fetch origin --quiet

echo ""
echo -e "${BLUE}═══ ATIVIDADE DO SQUAD — últimas ${WINDOW//./ } ═══${NC}"
echo ""

# 1. commits no main
echo -e "${GREEN}Commits no main:${NC}"
main_commits=$(git log origin/main --since="${WINDOW} ago" --pretty=format:"  %h %s ${YELLOW}(%an, %cr)${NC}")
if [[ -z "$main_commits" ]]; then
  echo -e "  ${DIM}(nenhum)${NC}"
else
  echo -e "$main_commits"
fi
echo ""

# 2. branches com atividade
echo -e "${GREEN}Branches com atividade recente:${NC}"
git for-each-ref --sort=-committerdate refs/remotes/origin \
  --format='%(committerdate:relative)|%(refname:short)|%(authorname)' \
  | awk -F'|' -v window="${WINDOW//./ }" '
    NR <= 15 {
      printf "  %-25s %-45s %s\n", $1, $2, $3
    }
  '
echo ""

# 3. arquivos quentes (mais mudados na janela)
echo -e "${GREEN}Arquivos mais alterados:${NC}"
git log origin/main --since="${WINDOW} ago" --name-only --pretty=format: \
  | grep -v '^$' \
  | sort | uniq -c | sort -rn | head -10 \
  | awk '{ printf "  %-4s %s\n", $1, $2 }'
echo ""

# 4. seu estado local
echo -e "${BLUE}═══ SEU ESTADO LOCAL ═══${NC}"
current_branch=$(git branch --show-current)
echo -e "Branch atual: ${YELLOW}${current_branch}${NC}"

# commits seus à frente do main
ahead=$(git rev-list --count "origin/main..HEAD" 2>/dev/null || echo "?")
# commits do main que vc não tem
behind=$(git rev-list --count "HEAD..origin/main" 2>/dev/null || echo "?")
echo -e "  ${ahead} commits seus à frente do main · ${behind} commits do main não puxados"

# mudanças não-commitadas
uncommitted=$(git status --porcelain | wc -l | tr -d ' ')
if [[ "$uncommitted" -gt 0 ]]; then
  echo -e "  ${YELLOW}${uncommitted} arquivos com mudanças não-commitadas${NC}"
fi

echo ""

if [[ "$behind" -gt 0 && "$current_branch" != "main" ]]; then
  echo -e "${YELLOW}💡 Você tá ${behind} commits atrás do main. Rode 'git sync' antes de codar.${NC}"
fi
