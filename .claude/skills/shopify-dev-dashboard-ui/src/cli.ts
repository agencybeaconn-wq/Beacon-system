#!/usr/bin/env tsx
const [, , cmd, ...rest] = process.argv;

const routes: Record<string, () => Promise<{ run: (args: string[]) => Promise<void> }>> = {
  login: () => import('./flows/login.ts'),
  doctor: () => import('./flows/doctor.ts'),
  'create-app': () => import('./flows/create-app.ts'),
};

function help() {
  console.log(`
shopify-dev-dashboard-ui — Playwright skill para automatizar Shopify Dev Dashboard

Comandos:
  login                                    → loga 1x manual, persiste em profile/
  doctor                                   → checa sessão + lista apps existentes
  create-app --client "X" --shop "..."     → cria Custom App + scopes Lever + install + token

Flags create-app:
  --client "Mantos do PH"                  → nome usado no app + handle
  --shop "a9dc24-2.myshopify.com"          → loja onde instalar (myshopify domain)
  --scopes default|min|custom              → preset de scopes (default: 41 scopes Lever)
  --extra-scopes "scope1,scope2"           → só com --scopes custom
  --dry-run                                → só planeja, não executa
  --reveal-token                           → mostra token no result.json e stdout (CUIDADO!)

Exemplos:
  npm run login                            → 1x manual
  npm run flow -- doctor                   → valida sessão
  npm run flow -- create-app --client "Cliente X" --shop "loja-x.myshopify.com"
  npm run flow -- create-app --client "Y" --shop "loja-y.myshopify.com" --dry-run
  npm run flow -- create-app --client "Z" --shop "loja-z.myshopify.com" --reveal-token

Por que essa skill existe:
  Shopify descontinuou criação de Custom Apps "legacy" via Admin → Develop apps em
  1/jan/2026. O novo caminho é Dev Dashboard (dev.shopify.com/dashboard), que ainda
  exige UI manual (sem API pública pra appCreate). Esta skill automatiza esse loop
  repetitivo de onboarding de cliente novo no Lever — login 1x, depois cada cliente
  é um único comando.
`);
}

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    help();
    return;
  }
  const route = routes[cmd];
  if (!route) {
    console.error(`Comando desconhecido: ${cmd}`);
    help();
    process.exit(1);
  }
  const mod = await route();
  await mod.run(rest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
