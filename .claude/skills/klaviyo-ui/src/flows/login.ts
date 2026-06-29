import { openSession, ensureLoggedIn } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(args: string[]) {
  const debug = args.includes('--debug');
  const log = new RunLogger('login');
  const { context, page } = await openSession({ headless: false });

  try {
    await ensureLoggedIn(page, true);
    await log.snap(page, 'dashboard');
    log.info('Login OK. Sessão persistida.');

    if (debug) {
      log.info('Modo debug: navegador fica aberto. Pressione Ctrl+C pra fechar.');
      await new Promise(() => {});
    }
  } finally {
    if (!debug) await context.close();
  }
}
