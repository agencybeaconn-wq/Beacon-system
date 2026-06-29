---
name: preflight-deploy
description: Valida pré-requisitos pra rodar um deploy completo de loja nova — conexão Shopify, briefing preenchido, pricing configurado, source template disponível. Gera checklist de pendências antes de invocar deploy-complete. Read-only.
---

NÃO executa deploy — só reporta pendências antes de `deploy-complete`. Use periodicamente em clientes pending pra ver o que falta.

## Checks
| # | Check | Fail = | Fix |
|---|---|---|---|
| 1 | Cliente em `agency_clients` | Não encontra nome | Criar registro |
| 2 | `shopify_status='connected'` | Status diferente | OAuth (UI admin) |
| 3 | `shopify_access_token` presente | NULL/vazio | Re-autorizar app |
| 4 | Token válido (`GET /shop.json`=200) | 401/403 | Re-conectar |
| 4b | Scope `write_publications` no token | Ausente → produtos ACTIVE mas unpublished (memory `feedback_active_vs_published`) | Re-autorizar com escopo correto |
| 5 | Briefing existe (nome ou client_group_id) | Não encontra | Preencher na UI |
| 6 | Briefing tem campos mínimos | Faltam `contato_email`, `contato_telefone`, `marca_nome` | Completar briefing |
| 7 | `client_pricing` ≥1 row | Vazio | Importar via `update-prices` |
| 8 | `LEVER_SITE_SERVICE_ROLE_KEY` no env | Ausente | `.env.local` (ou ignorar — edge function cria licença em prod) |
| 9 | Source template acessível (BR ou EN) | Cliente/loja não responde | Verificar saúde dos templates |

## Uso
```bash
node .claude/skills/preflight-deploy/preflight-deploy.mjs "<cliente>"
node .claude/skills/preflight-deploy/preflight-deploy.mjs --batch=pending|disconnected|connected
node .claude/skills/preflight-deploy/preflight-deploy.mjs "<cliente>" --locale=br|en   # default auto-detect por domínio
node .claude/skills/preflight-deploy/preflight-deploy.mjs "<cliente>" --json           # output pra deploy-complete consumir
```

## Verdicts
`READY` (deploy-complete pode rodar) · `MISSING_BRIEFING` · `MISSING_PRICING` · `NOT_CONNECTED` · `INVALID_TOKEN` · `MULTIPLE_BLOCKS` (lista todas pendências). Cada verdict lista as pendências com link de fix (URL UI admin pra preencher briefing, etc).

## Libs
- `validate.mjs` — `assertClientExists`
- `shopify-api.mjs` — `shReq` (testa access token)
- `supabase-rest.mjs` — `supaRest` com serviceRole (lê briefings + client_pricing)
