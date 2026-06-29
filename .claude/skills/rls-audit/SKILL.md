---
name: rls-audit
description: >
  Audita e endurece RLS (Row Level Security) de um projeto Supabase multi-tenant —
  fecha vazamento entre tenants sem trancar usuário legítimo. Use quando o pedido
  envolver "auditar RLS", "vazamento multi-tenant", "row level security", "get_advisors
  de segurança", "dados de um cliente aparecendo pra outro", "travar acesso por tenant",
  ou hardening de segurança de um banco Supabase. Pensado pro Lever System (pxhmz) mas
  reutilizável em qualquer Supabase de cliente.
allowed-tools: Bash, Grep, Glob, Read, Write, Edit, Workflow, TodoWrite
---

# /rls-audit — auditoria e hardening de RLS multi-tenant (Supabase)

Fluxo destilado da sessão de hardening do Lever System (2026-05-29, ~29 tabelas).
**Princípio inegociável: numa base viva multi-tenant, fechar o vazamento NÃO pode trancar
usuário legítimo. Sempre valide os DOIS lados (não-tenant vê 0 / staff vê tudo).**

## Quando usar
- `get_advisors(type=security)` retorna findings de RLS (USING(true), `rls_disabled_in_public`, tabela exposta).
- "Dado de um cliente vaza pra outro", "trava isso por tenant", "audita a segurança do Supabase".

## Quando NÃO usar
- Bug funcional de query (não é RLS). Mudança de schema sem componente de segurança.

## Processo (read-first, apply-last)

### 1. Auditar
- `mcp__claude_ai_Supabase__get_advisors(type=security)`. Se o output estourar o limite, salva em arquivo e parseia.
- Liste por categoria: **credencial viva** (token/secret/password numa coluna) > **dado sensível** (financeiro, lista de clientes) > **operacional** > **referência/cache global**.

### 2. Mapear o modelo de tenancy
- Ache as chaves: `workspace_id` / `user_id` / `client_id` / `account_id` / `member_id`.
- Ache os helpers `SECURITY DEFINER` já existentes (`pg_proc` where `prosecdef`): no Lever System são `is_agency_member(ws)`, `is_workspace_admin(ws)`, `is_workspace_member(ws)`, `get_linked_client_id(ws)`, `is_agency_staff()`, `is_workspace_portal_client(ws)`. Eles **bypassam RLS por dentro** → não recursam. Espelhe-os; crie novos no mesmo padrão se faltar.
- `service_role` tem `bypassrls` → **edge functions nunca são afetadas por RLS**. Tabela só-edge pode ser trancada pra service_role (dropar policy de `authenticated`).

### 3. Mapear o acesso REAL no código (decisivo — não adivinhe)
- Localize o repo do front/edge (no Lever: `lever/` → `Documents/Lever System/Lever-System`).
- `Grep` por ``from\(['"`]<tabela>['"`]`` pra cada tabela: separe uso em `src/` (front, **RLS-subject**) de `supabase/functions/` (edge, **service_role**).
- Pra cada query do front anote operação (select/insert/update/delete) + filtro (`.eq`/`.in`) → revela por qual coluna o app já escopa e QUEM chama (staff / cliente de portal / aluno).

### 4. Triar
- **Credencial viva** → corrige JÁ (migration direta, validada na hora).
- **Sensível claro + escopo óbvio** (tem workspace_id, padrão conhecido) → lote único.
- **Ambíguo / alto raio de explosão** (toca várias telas, modelo de acesso incerto) → **workflow adversarial** (abaixo) ou confirma intenção com o dono.

### 5. Workflow adversarial (pro lote nuançado)
Um agente por bucket de tabelas: **investiga** (lê o código + schema, propõe o SQL exato) → **verifica adversarialmente** (tenta derrubar: alguma query legítima quebraria pra algum tipo de usuário? o vazamento fecha mesmo?). **Read-only — nenhum agente aplica migration.** Você aplica depois de revisar os vereditos (`apply` / `fix_then_apply` / `defer_to_human`). Veja o exemplo de script em `examples/` ou na nota `Lever QI/00-operating-brain/2026-05-29-rls-hardening-lever-system.md`.

### 6. Aplicar (idempotente)
- `mcp__claude_ai_Supabase__apply_migration`, em lotes nomeados.
- SEMPRE: `alter table ... enable row level security;` + `drop policy if exists` antes de `create policy` (cobre nomes legados também).
- Padrões: `workspace_id` → `is_agency_member(workspace_id)`; só `client_id` → `client_id in (select id from agency_clients)` (reusa a RLS já correta dela); client-facing → staff escreve / staff+cliente lê; user-próprio → `user_id = auth.uid()`; só-edge → drop da policy de `authenticated`.

### 7. Validar (os DOIS lados)
- Re-query `pg_policy`: zero `USING(true)`/`CHECK(true)` pra `authenticated`/`anon`/`public` (exceto opens intencionais documentados).
- Funcional: não-membro de outro tenant vê **0**; staff vê **N** (não zerou). Emule o predicado por tipo de usuário se não der pra logar como cada um.

### 8. Documentar
- Nota no vault (`Lever QI/00-operating-brain/<data>-rls-...md`) + memory `reference_*_rls_*`. Liste migrations, opens intencionais, e follow-ups de data-model.

## Gotchas que MORDEM (lições reais)
- **Schema default ≠ public.** O client supabase-js pode ter schema efetivo `ads` (lê `ad_accounts`/`insights` etc.). `.from('campaigns')` do front pode bater em `ads.campaigns`, não `public.campaigns`. **Confirme em qual schema a tabela viva ANTES de escrever a policy** — senão você tranca a tabela errada (órfã) e deixa a real vazando.
- **O "dono" (user_id) pode NÃO ser o staff.** No Lever, as 24 ad_accounts estão sob 4 logins legados; o time possui 0. Escopar por `user_id` zerou o dashboard de todos. **Conte donos distintos vs nº de staff antes de escopar por user_id.**
- **Valide o lockout, não só o leak.** Um fix que fecha o vazamento mas zera o app é um incidente. Cheque non-member=0 **E** staff>0.
- **Não drope tabela de dado que você não criou** (ex: `_backup_*`). Tranca com RLS (sem policy → só service_role) e deixa o drop pro humano.
- **Opens intencionais existem**: leaderboard, referência global (câmbio), cache global. Deixe aberto + documente, não "corrija".
- **`SECURITY DEFINER` evita recursão**: policy de `team_members` pode chamar `is_agency_member()` que lê `team_members` — sem loop, porque a função roda como owner e bypassa RLS.
- **Cliente de portal sem `linked_client_id` preenchido**: `get_linked_client_id(ws) IS NOT NULL` exclui esses. Use um helper que cheque membership por workspace (`is_workspace_portal_client`).

## Anti-patterns
- ❌ Aplicar policy em prod sem ler como o front usa a tabela.
- ❌ Confiar só no output do workflow nas tabelas de maior risco — re-verifique você mesmo o caminho de acesso real.
- ❌ Escopar por `user_id` sem checar quem realmente é dono dos dados.
- ❌ Esquecer `enable row level security` (policy sem RLS on é inerte).
- ❌ Dropar backups/dados alheios em vez de trancar.
