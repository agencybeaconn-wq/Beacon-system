#!/usr/bin/env bash
#
# done.sh — Wrapper "vou parar agora": add + commit + push em 1 comando.
#
# Uso:
#   git done "feat(crm): adiciona drag-drop nos cards"
#   git done "fix: corrige redirect 401 no portal"
#   git done                       # prompta pra mensagem
#
# O que faz:
#   1. Mostra o que vai commitar (git status)
#   2. Pergunta confirmação
#   3. git add . (todos os arquivos)
#   4. git commit -m "..."
#   5. git push origin sua-branch
#
# Quando NÃO usar:
#   - Mudança que mistura áreas diferentes (faça commits separados)
#   - Você tem arquivos sensíveis modificados (.env, credenciais) — git done usa `git add .`
#   - Tá no main direto (script bloqueia, exige PR)

set -euo pipefail

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
DIM="\033[2m"
NC="\033[0m"

cd "$(git rev-parse --show-toplevel)"

current_branch=$(git branch --show-current)

# bloqueia commit direto em main
if [[ "$current_branch" == "main" ]]; then
  echo -e "${RED}✗ Você está no main. Não faça commit direto aqui.${NC}"
  echo -e "${YELLOW}Crie/troca pra sua branch:${NC}"
  echo "  git checkout sua-branch    (ou: git checkout -b feature/nova)"
  exit 1
fi

# nada pra commitar?
if [[ -z "$(git status --porcelain)" ]]; then
  echo -e "${GREEN}✓ Nada pra commitar. Sua branch está limpa.${NC}"
  # mas pode ter commit local sem push
  unpushed=$(git rev-list --count "origin/${current_branch}..HEAD" 2>/dev/null || echo "0")
  if [[ "$unpushed" -gt 0 ]]; then
    echo -e "${YELLOW}Mas você tem ${unpushed} commit(s) local(is) sem push.${NC}"
    read -p "Quer pushar agora? [Y/n] " resp
    if [[ ! "$resp" =~ ^[Nn]$ ]]; then
      git push origin "$current_branch"
    fi
  fi
  exit 0
fi

# mostra o que vai entrar no commit
echo -e "${BLUE}═══ ARQUIVOS QUE VÃO ENTRAR NO COMMIT ═══${NC}"
git status --short
echo ""

# aviso sobre arquivos sensíveis comuns
sensitive=$(git status --porcelain | awk '{print $2}' | grep -E '\.(env|key|pem)$|credentials|secret' || true)
if [[ -n "$sensitive" ]]; then
  echo -e "${RED}⚠️  ATENÇÃO: arquivos potencialmente sensíveis:${NC}"
  echo "$sensitive" | sed 's/^/  /'
  echo ""
  read -p "Tem certeza que quer commitar isso? [y/N] " resp
  if [[ ! "$resp" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Abortado. Adicione esses paths ao .gitignore se for segredo.${NC}"
    exit 1
  fi
fi

# pegar mensagem
msg="${1:-}"
if [[ -z "$msg" ]]; then
  echo -e "${BLUE}Mensagem do commit${NC} (formato: ${DIM}tipo(area): descrição${NC}):"
  read -p "› " msg
  if [[ -z "$msg" ]]; then
    echo -e "${RED}✗ Mensagem vazia. Abortado.${NC}"
    exit 1
  fi
fi

# valida formato (warning, não bloqueia)
if [[ ! "$msg" =~ ^(feat|fix|chore|docs|style|refactor|test|perf)(\([^)]+\))?:\ .+ ]]; then
  echo -e "${YELLOW}⚠️  Mensagem fora do padrão recomendado (tipo(area): desc).${NC}"
  echo -e "${DIM}   Exemplos: feat(crm): ..., fix(auth): ..., chore: ...${NC}"
  read -p "Commitar mesmo assim? [Y/n] " resp
  if [[ "$resp" =~ ^[Nn]$ ]]; then
    exit 1
  fi
fi

# confirmação final
echo ""
echo -e "${BLUE}═══ RESUMO ═══${NC}"
echo -e "  Branch:   ${YELLOW}${current_branch}${NC}"
echo -e "  Mensagem: ${msg}"
files_count=$(git status --porcelain | wc -l | tr -d ' ')
echo -e "  Arquivos: ${files_count}"
echo ""
read -p "Confirma? [Y/n] " resp
if [[ "$resp" =~ ^[Nn]$ ]]; then
  echo "Abortado."
  exit 0
fi

# executa
echo ""
echo -e "${BLUE}→ git add .${NC}"
git add .

echo -e "${BLUE}→ git commit${NC}"
git commit -m "$msg"

echo -e "${BLUE}→ git push origin ${current_branch}${NC}"
git push origin "$current_branch"

echo ""
echo -e "${GREEN}✓ Tudo feito. Squad vai ver no próximo \`git daily\`.${NC}"

# sugestão de PR se a branch tem 5+ commits à frente
ahead=$(git rev-list --count "origin/main..HEAD" 2>/dev/null || echo "0")
if [[ "$ahead" -ge 5 ]]; then
  echo ""
  echo -e "${YELLOW}💡 Sua branch tem ${ahead} commits à frente do main.${NC}"
  echo -e "${YELLOW}   Considere abrir PR: ${NC}gh pr create"
fi
