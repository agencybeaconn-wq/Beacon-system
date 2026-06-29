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
  const { name } = parseArgs(args);
  if (!name) throw new Error('Uso: publish --name "Welcome Series"');

  const log = new RunLogger(`publish_${name.replace(/\W+/g, '-')}`);
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    log.info(`STUB — abrir flow="${name}" e clicar Publish (com confirmação)`);
    // TODO ao vivo: navegar, clicar Publish, capturar confirmação modal, screenshot do badge "Live"
    await log.snap(page, 'state');
  } finally {
    await context.close();
  }
}
