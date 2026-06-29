# Deploy do runner na VM (Fase 4)

Sobe o `client-onboarder` worker como serviço 24/7 numa VM Linux. O gatilho (briefing → fila)
já roda no Supabase; o worker na VM é quem **consome** a fila e executa o pipeline.

## Requisitos da VM

- Ubuntu 22.04+ (1 vCPU / 2 GB RAM já roda; 2/4 confortável), **disco persistente** (pro `profile/`).
- Acesso SSH. Sem necessidade de IP público pra inbound (o runner só faz outbound).
- Provider à escolha (Hetzner CX22 ~€4/mês, DigitalOcean, etc).

## Passo a passo

### 1. Copiar o código pra a VM (sem node_modules/profile/runs)
Na máquina local (Windows: use WSL/git-bash pra rsync, ou scp):
```bash
rsync -av --exclude node_modules --exclude profile --exclude runs \
  ".claude/skills/client-onboarder/" root@SUA_VM:/opt/lever-onboarder/client-onboarder/
```

### 2. Copiar o profile/ logado (resolve o login + 2FA sem VNC)
O `profile/` da máquina onde você já fez `npm run login` (e passou o 2FA) carrega a sessão.
```bash
rsync -av ".claude/skills/client-onboarder/profile/" \
  root@SUA_VM:/opt/lever-onboarder/client-onboarder/profile/
```
> Quando a sessão Shopify esfria (~12-14 dias), `npm run status` mostra `session_ok=false`.
> Aí: re-logar na máquina local + recopiar o `profile/` (ou logar via VNC na VM).

### 3. Configurar o .env na VM
```
LEVER_SYSTEM_URL=https://app.leverag.digital
SUPABASE_URL=https://pxhmzpwvxvlwngjbjkrg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SHOPIFY_ORG_ID=181435365
HEADLESS=true
```

### 4. Rodar o setup (instala Node + Chromium + serviço)
```bash
ssh root@SUA_VM
cd /opt/lever-onboarder/client-onboarder
sudo bash deploy/setup-vm.sh
```

### 5. Validar
```bash
journalctl -u onboarder-worker -f          # logs do worker ao vivo
sudo -u onboarder npm --prefix /opt/lever-onboarder/client-onboarder run status
```
O `status` deve listar o runner com `session_ok=true` e a fila por estágio.

## Operação

- **Acompanhar:** `npm run status` (fila + saúde do runner) — ou via Claude Code.
- **Reiniciar:** `systemctl restart onboarder-worker`
- **Manutenção do 2FA:** quando `session_ok=false`, recopiar o `profile/` (passo 2) e
  `systemctl restart onboarder-worker`.
- **Atualizar código:** repetir o passo 1 (rsync) + `npm ci` + `systemctl restart onboarder-worker`.

## Opção B — Docker (Railway ou host Docker)

`Dockerfile` na raiz da skill usa a imagem oficial do Playwright (Chromium + libs já inclusos).
`PROFILE_DIR=/data/profile` → o profile vive num **volume persistente**.

### Host Docker próprio (VM/servidor com Docker) — mais simples pro profile
```bash
docker build -t lever-onboarder .claude/skills/client-onboarder
docker run -d --restart=always --name onboarder \
  --env-file .env -e HEADLESS=true \
  -v /caminho/do/profile-logado:/data/profile \
  lever-onboarder
```
O **bind mount** aponta direto pro `profile/` já logado (sessão + 2FA) → zero seed extra.

### Railway
1. Serviço a partir do repo apontando pro `Dockerfile` da skill.
2. **Volume persistente** montado em `/data`.
3. Vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ORG_ID`, `HEADLESS=true`.
4. **Seed do profile (ponto de atenção):** o volume nasce vazio → sem sessão → `session_ok=false`.
   Pra popular `/data/profile` com a sessão logada num container sem display:
   - (a) rodar o container **local** 1x com o volume = `profile/` local logado e deixar persistir, ou
   - (b) login via **noVNC** exposto temporariamente no container, ou
   - (c) subir o `profile/` logado pro volume via Railway shell/upload.

> **Honestidade:** o `profile/` + 2FA é o que torna container puro (Railway) mais trabalhoso que
> um host Docker com bind mount. O Chromium em si roda perfeito em container. Se quiser o caminho
> mais liso, Docker num host com filesystem acessível (VM) ganha do Railway puro nesse quesito.
