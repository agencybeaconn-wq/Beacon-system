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
  const { flow, metric } = parseArgs(args);
  if (!flow || !metric) throw new Error('Uso: change-conversion --flow "X" --metric "Placed Order"');

  const log = new RunLogger(`change-conversion_${flow.replace(/\W+/g, '-')}`);
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    log.info(`STUB — flow="${flow}" → conversion metric="${metric}"`);
    // TODO ao vivo: abrir flow settings, achar dropdown de conversion metric, selecionar, salvar
    await log.snap(page, 'state');
  } finally {
    await context.close();
  }
}
