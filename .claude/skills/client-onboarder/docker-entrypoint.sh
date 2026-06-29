#!/usr/bin/env bash
# Seed da sessão no boot: baixa o storageState (JSON do Playwright = cookies + localStorage em
# PLAINTEXT, portável cross-OS) de PROFILE_SEED_URL pro caminho local. Resolve o login no container
# sem display. storageState é OS-independente — diferente do profile cru do Chromium, cujos cookies
# são criptografados pela chave do SO de origem (Windows DPAPI etc) e não abrem em outro SO.
set -euo pipefail

STORAGE_STATE="${STORAGE_STATE_PATH:-/data/storage-state.json}"

# Reseed sob demanda: FORCE_PROFILE_RESEED truthy → remove o JSON pra re-baixar do PROFILE_SEED_URL
# (renovado). Usado quando a sessão Shopify esfria (~12-14d) e o storageState foi re-empacotado.
# Normaliza (tira aspas/espaços, lowercase) — robusto a como a var foi setada (true/"true"/TRUE/1/yes).
_reseed=$(printf '%s' "${FORCE_PROFILE_RESEED:-}" | tr -d "\"' " | tr '[:upper:]' '[:lower:]')
echo "[entrypoint] STORAGE_STATE=$STORAGE_STATE | FORCE_PROFILE_RESEED='${FORCE_PROFILE_RESEED:-<unset>}'"
case "$_reseed" in
  true|1|yes|on)
    echo "[entrypoint] FORCE_PROFILE_RESEED ativo — removendo $STORAGE_STATE pra re-semear"
    rm -f "$STORAGE_STATE"
    ;;
esac

if [ ! -f "$STORAGE_STATE" ]; then
  if [ -n "${PROFILE_SEED_URL:-}" ]; then
    echo "[entrypoint] storageState ausente — baixando seed de PROFILE_SEED_URL"
    mkdir -p "$(dirname "$STORAGE_STATE")"
    curl -fsSL "$PROFILE_SEED_URL" -o "$STORAGE_STATE"
    echo "[entrypoint] storageState populado em $STORAGE_STATE"
  else
    echo "[entrypoint] AVISO: storageState ausente e sem PROFILE_SEED_URL — o worker vai falhar no login"
  fi
else
  echo "[entrypoint] storageState já existe — seguindo"
fi

exec "$@"
