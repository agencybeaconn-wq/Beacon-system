#!/usr/bin/env bash
#
# stop-git-reminder.sh — Hook Stop do Claude Code.
# Quando a sessão termina, checa se há mudanças não-commitadas/não-pushadas
# e mostra um lembrete amigável.
#
# Não bloqueia (exit 0 sempre). Apenas avisa.

# Não falhar se o repo der erro — esse hook nunca pode quebrar a finalização da sessão.
set +e

cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0

current_branch=$(git branch --show-current 2>/dev/null)
[[ -z "$current_branch" ]] && exit 0

# 1. Mudanças não-commitadas
uncommitted=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

# 2. Commits locais sem push
unpushed=0
if [[ "$current_branch" != "main" ]]; then
  unpushed=$(git rev-list --count "origin/${current_branch}..HEAD" 2>/dev/null || echo "0")
fi

# Se está tudo limpo, não diz nada (não polui o output da sessão)
if [[ "$uncommitted" -eq 0 && "$unpushed" -eq 0 ]]; then
  exit 0
fi

# Aviso amigável
echo ""
echo "────────────────────────────────────────────────────"
echo "📋 Lembrete antes de fechar a sessão:"

if [[ "$uncommitted" -gt 0 ]]; then
  echo "   • ${uncommitted} arquivo(s) modificado(s) sem commit"
fi

if [[ "$unpushed" -gt 0 ]]; then
  echo "   • ${unpushed} commit(s) local(is) sem push pro GitHub"
fi

echo ""
echo "   Pra resolver tudo de uma vez:  git done \"mensagem\""
echo "   Pra ver o que vc mexeu:        git status"
echo "   Pra deixar pra depois:         git stash"
echo "────────────────────────────────────────────────────"

exit 0
