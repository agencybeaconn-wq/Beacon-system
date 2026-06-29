import { openSession, isLoggedIn, KLAVIYO_DASHBOARD } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(_args: string[]) {
  const log = new RunLogger('doctor');
  const { context, page } = await openSession({ headless: false });

  try {
    const loggedIn = await isLoggedIn(page);
    log.info(`logged_in=${loggedIn}`);
    log.info(`current_url=${page.url()}`);
    await log.snap(page, 'state');

    if (!loggedIn) {
      log.info('Sessão expirada. Rodar `npm run login` pra reautenticar.');
      return;
    }

    await page.goto(`${KLAVIYO_DASHBOARD.replace('/dashboard', '')}/flows`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await log.snap(page, 'flows-list');
    log.info('Flows list carregou. Use o screenshot pra inspecionar seletores.');
  } finally {
    await context.close();
  }
}
