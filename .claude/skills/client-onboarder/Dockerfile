# Runner client-onboarder — worker headless 24/7.
# Imagem oficial do Playwright já traz Chromium + todas as libs de sistema.
# ⚠️ A tag DEVE casar com a versão de `playwright` no package.json (pinada exata).
# Se divergir, o chromium do container não bate com o do playwright e o launch falha.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x docker-entrypoint.sh

ENV HEADLESS=true
# /data = volume persistente. No Railway o volume é provisionado pela plataforma (montado em /data),
# então NÃO usar a instrução `VOLUME` aqui — o builder do Railway rejeita
# ("docker VOLUME not supported, use Railway Volumes"). Em Docker puro, montar com `-v ...:/data`.
ENV STORAGE_STATE_PATH=/data/storage-state.json

# Entrypoint faz o seed do storageState (PROFILE_SEED_URL -> JSON) se ele nao existir no volume
ENTRYPOINT ["./docker-entrypoint.sh"]
# Consome a fila onboarding_jobs e executa o pipeline (access → onboard → connected)
CMD ["npm", "run", "worker"]
