#!/usr/bin/env tsx
const [, , cmd, ...rest] = process.argv;

const routes: Record<string, () => Promise<{ run: (args: string[]) => Promise<void> }>> = {
  login: () => import('./flows/login.ts'),
  doctor: () => import('./flows/doctor.ts'),
  review: () => import('./flows/review-flow.ts'),
  'edit-email': () => import('./flows/edit-email.ts'),
  publish: () => import('./flows/publish-flow.ts'),
  'discard-ab': () => import('./flows/discard-ab.ts'),
  'change-conversion': () => import('./flows/change-conversion.ts'),
  'edit-form': () => import('./flows/edit-form.ts'),
  'edit-email-html': () => import('./flows/edit-email-html.ts'),
  'probe-email-editor': () => import('./flows/probe-email-editor.ts'),
  'list-flow-messages': () => import('./flows/list-flow-messages.ts'),
  'probe-source-toggle': () => import('./flows/probe-source-toggle.ts'),
  'probe-button-edit': () => import('./flows/probe-button-edit.ts'),
  'assign-template': () => import('./flows/assign-template.ts'),
  'probe-change-template': () => import('./flows/probe-change-template.ts'),
  'probe-library': () => import('./flows/probe-library.ts'),
};

function help() {
  console.log(`
klaviyo-ui — Playwright skill para operar Klaviyo

Comandos:
  login                              → loga e persiste sessão
  doctor                             → checa sessão + abre flows list pra inspecionar
  review --name "X"                  → revisa estrutura de um flow
  edit-email --flow X --step N ...   → edita subject/preview/from de um email
  publish --name "X"                 → publica flow (draft → live)
  discard-ab --flow X --step N       → escolhe winner ou descarta A/B
  change-conversion --flow X --metric "..."
  edit-form --name "X" ...           → ajusta display/targeting de signup form

Uso típico:
  npm run login                      → 1x manual
  npm run flow -- doctor
  npm run flow -- review --name "Welcome Series"
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
