# Escopo — runner no Railway (Fase 4 — FEITO)

> **Status (2026-05-29):** worker no ar 24/7 no projeto Railway **"Lever Automation"**
> (`6ac736c5-...`, isolado dos ecomms de cliente), serviço `client-onboarder`. Pipeline
> briefing→fila→worker→browser provado. Sessão via **storageState** (ver "Por que" no fim).

Deixa o `client-onboarder` worker rodando 24/7 consumindo a fila `onboarding_jobs` (que o gatilho
do briefing alimenta). Código na branch `joao-vithor`.

## Pré-requisitos / inputs

- [ ] **Sessão logada** — `npm run login` na máquina local (headful, passa 2FA). Gera o
      `storage-state.json`. `npm run doctor` confirma Dev Dashboard logado.
- [ ] **SUPABASE_SERVICE_ROLE_KEY** do Lever System (pxhmzpwvxvlwngjbjkrg).
- [ ] Acesso ao Railway projeto **"Lever Automation"** (`6ac736c5-...`) — via MCP Railway ou UI.
- [ ] **Decisão:** onde guardar o `storage-state.json` (bucket privado). Hoje: Supabase Storage
      bucket `onboarder-profile` (privado) + signed URL longa.

## Checklist de execução

1. [ ] **Gerar a sessão:** `npm run login` → salva `storage-state.json` (JSON portável cross-OS —
       cookies+localStorage plaintext, NÃO o profile cru cujos cookies são presos ao SO de origem).
2. [ ] **Subir o `storage-state.json`** pro bucket privado (sobrescrevendo) → a signed URL vira `PROFILE_SEED_URL`.
       ⚠️ É a sessão do Shopify do João — bucket PRIVADO, URL com expiração longa, tratar como segredo.
3. [ ] **Serviço** a partir do repo `leveragency/LeverSystem`, root `.claude/skills/client-onboarder`, build Dockerfile.
4. [ ] **Volume** montado em `/data` (guarda o `storage-state.json` entre restarts).
5. [ ] **Variáveis:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ORG_ID=181435365`,
       `HEADLESS=true`, `PROFILE_SEED_URL=<url do passo 2>`.
6. [ ] **Deploy** → o `docker-entrypoint.sh` baixa o `storage-state.json` no 1º boot → `npm run worker`.

## Validação (critério de sucesso)

- [ ] Logs: `worker started`; ao pegar um job, NÃO loga "Sessão ... expirada".
- [ ] `onboarding_runners`: runner com heartbeat recente.
- [ ] Briefing de teste (loja onde já temos acesso) → trigger cria job → worker → `connected`.

## Riscos / atenção

- **storageState sensível:** é a sessão do Shopify do João. Bucket privado + expiração + rotacionar
  se vazar. O `.gitignore` já ignora `storage-state.json` (nunca commitar).
- **Versão do Playwright:** a imagem `mcr.microsoft.com/playwright:v1.60.0-jammy` **deve casar** com
  o `playwright` pinado (`1.60.0`) no `package.json`. Divergiu uma vez (1.48 × 1.60) e quebrou o
  launch do browser — manter em sync (comentado no Dockerfile).
- **Repo privado:** Railway precisa de acesso GitHub ao `leveragency/LeverSystem` + root directory na subpasta.
- **railway-agent não aplica var/delete** (só faz "stage") — usar dashboard ou GraphQL+token. Ver memory `reference_railway_agent_staging_unreliable`.

## Manutenção (recorrente — ~a cada 12-14d quando a sessão esfria)

1. `npm run login` na máquina local (re-loga + 2FA) → atualiza o `storage-state.json`.
2. Sobe o `storage-state.json` no bucket (sobrescreve o MESMO path → `PROFILE_SEED_URL` segue válida).
3. No serviço: setar `FORCE_PROFILE_RESEED=true` → redeploy (re-baixa o JSON fresco) → remover a var.
4. Re-enfileirar o job se tiver travado.

> **Por que storageState e não o profile cru:** o Chromium criptografa cookies com a chave do SO
> (Windows DPAPI etc), então um profile logado no Windows NÃO abre no container Linux — a sessão
> aparece deslogada. O `storage-state.json` é OS-independente. Possível 2ª camada: se o Shopify
> amarrar sessão por IP/device, pode exigir login de dentro do container (VNC). Ver memory
> `reference_chromium_cookie_cross_os_seed`.
