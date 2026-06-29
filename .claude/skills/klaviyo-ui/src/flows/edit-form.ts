import { openSession, ensureLoggedIn } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

function parseArgs(args: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) out[a.slice(2)] = args[i + 1] ?? '';
  }
  return out;
}

export async function run(args: string[]) {
  const { name, delay, frequency, excludeUrls } = parseArgs(args);
  if (!name) throw new Error('Uso: edit-form --name "Exit Intent UK" [--delay 5] [--frequency once_per_session] [--excludeUrls "/cart,/checkout/*"]');

  const log = new RunLogger(`edit-form_${name.replace(/\W+/g, '-')}`);
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    log.info(`STUB — form="${name}" delay=${delay} freq=${frequency} excludeUrls=${excludeUrls}`);
    // TODO ao vivo: abrir signup form, aba Behaviors, ajustar delay/frequency/exclude rules, salvar
    await log.snap(page, 'state');
  } finally {
    await context.close();
  }
}
