#!/usr/bin/env bash
# Setup do runner client-onboarder numa VM Ubuntu 22.04+ (rodar com sudo).
# Pré-requisito: o código da skill já copiado em /opt/lever-onboarder/client-onboarder
# (rsync da pasta SEM node_modules/profile/runs) e o profile/ copiado da máquina logada.
set -euo pipefail

APP_DIR=/opt/lever-onboarder/client-onboarder
SVC_USER=onboarder

echo "==> Node 20 + git"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

echo "==> usuário de serviço ($SVC_USER)"
id -u "$SVC_USER" >/dev/null 2>&1 || useradd -r -m -d /home/$SVC_USER "$SVC_USER"
chown -R "$SVC_USER:$SVC_USER" /opt/lever-onboarder

echo "==> deps do app + Chromium (Playwright)"
cd "$APP_DIR"
sudo -u "$SVC_USER" npm ci
sudo -u "$SVC_USER" npx playwright install chromium
# libs de sistema do Chromium headless
npx playwright install-deps chromium

echo "==> checagens"
[ -f "$APP_DIR/.env" ] || { echo "FALTA $APP_DIR/.env (copie do .env.example e preencha)"; exit 1; }
[ -d "$APP_DIR/profile" ] || echo "AVISO: profile/ ausente — copie da máquina logada (rsync) ou rode 'npm run login' via VNC"

echo "==> systemd service"
cp "$APP_DIR/deploy/onboarder-worker.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now onboarder-worker

echo "==> OK. Logs: journalctl -u onboarder-worker -f"
echo "    Status da fila:  sudo -u $SVC_USER npm --prefix $APP_DIR run status"
