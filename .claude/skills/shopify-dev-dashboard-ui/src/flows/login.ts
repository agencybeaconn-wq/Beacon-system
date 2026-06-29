import { openSession, ensureLoggedIn } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(args: string[]) {
  const debug = args.includes('--debug');
  const log = new RunLogger('login');
  const { context, page } = await openSession({ headless: false });

  try {
    await ensureLoggedIn(page, true);
    await log.snap(page, 'dashboard');
    log.info('Login OK. Sessão persistida em profile/.');
    log.info('Sessão típica dura ~14 dias. Re-run `npm run login` se expirar.');

    if (debug) {
      log.info('Modo debug: navegador fica aberto. Pressione Ctrl+C pra fechar.');
      await new Promise(() => {});
    }
  } finally {
    if (!debug) await context.close();
  }
}
