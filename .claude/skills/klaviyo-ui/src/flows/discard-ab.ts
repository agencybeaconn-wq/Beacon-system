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
  const { flow, step, keep } = parseArgs(args);
  if (!flow || !step) throw new Error('Uso: discard-ab --flow "X" --step N [--keep A|B|discard]');

  const log = new RunLogger(`discard-ab_${flow.replace(/\W+/g, '-')}_${step}`);
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    log.info(`STUB — flow="${flow}" step=${step} keep=${keep ?? 'discard'}`);
    // TODO ao vivo: localizar step com A/B, abrir controle de winner, escolher A/B/discard, confirmar
    await log.snap(page, 'state');
  } finally {
    await context.close();
  }
}
