---
name: lever-context
description: Carrega o "cérebro vivo" da Lever (eventos, decisões, status de cliente, audit de uso) no início de qualquer sessão Claude que envolva a agência. Use AUTOMATICAMENTE quando o user mencionar Lever, qualquer cliente, ou começar uma análise/operação que precise de contexto agência. Reduz "vou checar X" pra zero — Claude já abre sabendo o estado atual.
---

# lever-context — pre-load do cérebro Lever

Quando rodar essa skill, **a PRIMEIRA coisa** que você faz é chamar a tool MCP `lever_brain_context` (default `hours=48`) pra puxar:

- Commits recentes no vault Lever QI (eventos novos, decisões novas, snapshots de cliente)
- Tail do `events/YYYY-MM.md` e `decisions/YYYY-MM.md` do mês corrente
- Audit `team_activity` — quem chamou qual tool, fila de `tool_requests` abertos

## Quando invocar (auto-trigger)

Use esta skill SEM o user pedir explicitamente, quando:

- A sessão começa e o user menciona "Lever", "agência", ou um cliente Lever (Mantos, Coringão, Diário, FG, etc)
- O user pede análise cross-cliente, status agência, ou qualquer coisa que se beneficie de "o que mudou desde a última vez"
- Antes de qualquer chain de `lever_*` tools — pre-carrega contexto pra você não precisar adivinhar

## Como usar o resultado

O `lever_brain_context` retorna `{vault, audit}`. Você deve:

1. **Ler o `vault.recent_commits`** — entende o que aconteceu nas últimas 48h sem precisar buscar
2. **Ler `vault.events_md_tail` + `vault.decisions_md_tail`** — registra mental: o que rolou, o que foi decidido
3. **Inspecionar `audit.pending_tool_requests`** — vê quais tools o squad pediu mas ainda não foram implementadas
4. **Não exibir o dump bruto pro user** — sintetiza em 2-3 linhas só se relevante. O contexto é pra VOCÊ, não pra display.

## Depois disso

Roda livre: `lever_list_clients`, `lever_revenue`, `lever_meta_*`, etc. Quando descobrir algo relevante (anomalia, win, queda), use `vault_log_event` ou `vault_client_snapshot` pra commitar no vault — virou memória institucional pra próxima sessão.

## Filosofia

O MCP da Lever é um cérebro coletivo. Cada sessão deveria começar carregada de contexto e terminar contribuindo de volta. Sem essa skill, cada sessão começa do zero — desperdiça leverage.

## Falhas comuns

- Se `vault_*` falharem com "LEVER_VAULT_GITHUB_TOKEN missing" → setup vault git ainda não foi feito (ver [00-operating-brain/vault-git-setup.md](../../../../Documents/Lever%20QI/00-operating-brain/vault-git-setup.md)). Os outros lever_* continuam funcionando.
- Se `lever_team_activity` retornar `not_allowed` → email não está em `mcp_oauth.allowed_users`. Pede pro João adicionar.
