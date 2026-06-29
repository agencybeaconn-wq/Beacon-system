# Onboarding Automático Lever — Arquitetura & Roadmap

Handoff técnico (Pedro coordena/executa; João é o arquiteto). Validado end-to-end em
2026-05-28 com **Ninja Games** (`0e0qgn-mr.myshopify.com`): app criado, distribuição custom,
instalado, token `shpca_...` salvo, acesso à Admin API confirmado (produtos/pedidos reais).

## Visão

Pipeline que leva um cliente do **briefing** até **conectado no Lever System**, sem trabalho
manual repetitivo. Orquestrado via **Claude Code** (chat), executado por um **runner headless
no servidor da Lever**.

## Arquitetura (dois planos)

**Control plane = Claude Code (chat) + fila no Supabase.** O Pedro/squad NÃO usam uma UI React —
orquestram pelo Claude Code: dispara onboard, enfileira clientes, vê status/erros. A skill expõe
os comandos; a tabela `onboarding_jobs` (Supabase LS) é a fonte da verdade. (Sem tela pra construir.)

**Execution plane = runner Playwright HEADLESS no servidor da Lever.** Um "navegador padrão"
que carrega a sessão do `storage-state.json` (cookies+localStorage, **logado no Shopify + 2FA** — JSON portável cross-OS), rodando
como serviço (`HEADLESS=true`). Pega job da fila, executa as fases, escreve status/logs/screenshots
de volta no Supabase. Ninguém abre Chrome manualmente — é processo de sistema invisível.

### Por que precisa de browser (limitação do Shopify, não nossa)

Confirmado na doc oficial: a **Partner API não cria apps nem configura distribuição** (só consulta
dados); e o Shopify **removeu** tokens estáticos — todo token novo vem por **OAuth (grant no
browser)**. Logo, "abrir a porta" de cada loja (criar app → distribuição custom → 1º token) é
inerentemente via UI/OAuth. **Mas isso é só 1x por cliente.** Depois, operar a loja (produtos,
pedidos, temas…) é **100% API headless** com o token offline — que é o dia-a-dia da Lever.

### Token vs sessão (não confundir)

- **Token do cliente** (`shopify_access_token`, `shpca_...`): **permanente** — vale enquanto o app
  não for removido da loja. Nunca precisa "renovar".
- **Sessão do runner** (login Shopify no profile): expira ~14 dias. Só importa pra **onboardar
  clientes novos**. Renovação = re-login + 2FA (manutenção pontual, ~a cada 12 dias). Clientes já
  conectados não dependem disso.

## Máquina de estados (`onboarding_jobs.stage` — migration Fase 1)

1. `access_requested` — envia collaborator request no Partners (acesso total). [FEITO — `flows/access.ts`]
2. `access_pending` — monitora o aceite (admin da loja acessível?) com backoff `next_check_at`. [FEITO]
3. `access_granted` — loja acessível → dispara onboard.
4. `onboarding` — Fases A-C (app + distribuição + instalar + token). [FEITO]
5. `connected` — token salvo, ping ok, backfill DW disparado. [FEITO]
6. `failed` — erro; `error_message` + `logs` pro diagnóstico via Claude Code.

## Onboard automatizado (Fases A-C — `src/flows/onboard.ts`, validado)

- **A — Dev Dashboard:** cria/acha app "Lever System - <Cliente>" → versão com **42 escopos**
  (`scopes.ts`) + redirect URLs → lança (modal de confirmação) → captura Client ID + Secret.
- **Salva creds no DB** (`updateShopifyCreds`) — o callback OAuth lê client_id/secret daqui.
- **B — Partners:** garante **Distribuição Custom** (IRREVERSÍVEL) → gera/captura o **link de
  instalação** (`install_custom_app?...&signature=`). Idempotente (reaproveita link existente).
- **C — Loja:** abre o link (store-picker → loja) → "Instalar" → dispara `/admin/oauth/authorize`
  (state=client.id) → callback `shopify-oauth-callback` salva o token. `waitForToken` polla o DB.

## Comandos (orquestração via Claude Code)

```
npm run login          # 1x por servidor: loga Dev Dashboard + Lever System + passa 2FA (headful)
npm run doctor         # valida sessões + DB
npm run status         # resumo da fila por estágio + saúde dos runners (pro chat)
npm run flow -- onboard --client "<Nome>" --shop "<loja>.myshopify.com"
npm run flow -- enqueue --client "<Nome>" --shop "<loja>.myshopify.com"   # põe na fila
npm run worker         # loop que processa a fila (roda como serviço no servidor)
```

## Roadmap

- **Fase 0 — feito:** onboard end-to-end (estágios 4-5), validado no Ninja.
- **Fase 1 — fundação:** migration `supabase/migrations/20260528_onboarding_pipeline_stages.sql`
  (stage, logs, next_check_at, índice, tabela `onboarding_runners`). *Pedro: revisar e aplicar.*
- **Fase 2 — runner observável:** worker escreve stage/logs/screenshots/erros no Supabase +
  heartbeat em `onboarding_runners` (pra `status` mostrar saúde). Evoluir `claim_onboarding_job` por estágio.
- **Fase 3 — FEITO:** worker virou máquina de estados completa (access_requested → pending →
  granted → onboarding → connected) em `flows/worker.ts`. `sendCollabRequest` (acesso total) +
  `isAccessGranted` (acessa o admin direto, determinístico) em `flows/access.ts`. Validado
  access_pending→granted no Ninja via worker. **Falta testar o ENVIO real** numa loja onde ainda
  NÃO somos colaboradores (loja REAL — domínio fake não existe no Shopify e o envio falha).
  Obs: `ensureLoggedIn` agora só exige o Dev Dashboard (a UI do Lever System não é mais usada).
- **Gatilho briefing → fila — FEITO:** trigger SQL `enqueue_onboarding_from_briefing` na tabela
  `briefings` (migration `20260529`). Briefing com `answers.loja_myshopify` preenchido cria o job
  `access_requested` automaticamente (com `payload.collab_code`). Idempotente (não duplica loja com
  job ativo). Validado. **Falta só o worker rodando 24/7 (Fase 4) pra consumir a fila sozinho.**
- **Fase 4 — servidor:** subir o runner headless como serviço (`HEADLESS=true`), `npm run login`
  1x (via VNC/X no servidor pro 2FA), worker rodando. Renovar sessão ~a cada 12 dias.
- **Fase 5 — manutenção do 2FA:** marcar `onboarding_runners.session_ok=false` quando esfria
  (alerta via `status`) + investigar TOTP via "Usar um método diferente" no challenge
  (hoje é passkey/WebAuthn, não automatizável puro).

## Gotchas (não reaprender na marra)

- **Authorize genérico NÃO instala custom app** (dá "link inválido"). Precisa do link assinado do
  Partners. Depois de instalado, o authorize serve só pra disparar o OAuth e pegar o token.
- **Custom distribution é irreversível** (não vira Public). Single-store = certo pra cliente.
- **Bug de escopos corrigido:** o front pedia 13 escopos hardcoded → token capado. Agora usa os 42
  (`src/constants/shopifyScopes.ts`). Manter sync: skill `scopes.ts` + front `shopifyScopes.ts` + edge `shopify-auth-start`.
- **Código de colaborador (collab request code):** muitas lojas EXIGEM um código gerado pelo
  TITULAR (admin → Configurações → Usuários e permissões → Segurança) pra aceitar a solicitação.
  O campo `collaborator_request_code` só renderiza após o domínio validar. O **briefing do cliente
  precisa incluir esse código** (`payload.collab_code`). Sem ele, `sendCollabRequest` → `needs_code`
  e o job falha pedindo o código. Descoberto 2026-05-29 na loja i5pr3b-q6.
- **2FA = passkey/WebAuthn** — não automatizável puro. Profile persistente resolve; renovar quando esfria.
- **Seletores Dev Dashboard/Partners** em `src/lib/selectors.ts`, validados 2026-05-28 (UI PT-BR,
  org Lever Digital). Navegação por URL direta > clicar submenu.
- **Headless:** `HEADLESS=true` roda invisível (servidor). Sem a env, roda headful (dev/login/2FA).
  Atenção: o passar-2FA precisa de headful (VNC/X no servidor na 1ª vez).
