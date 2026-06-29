import { openSession, ensureLoggedIn, DEV_DASHBOARD } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(_args: string[]) {
  const log = new RunLogger('doctor');
  const { context, page } = await openSession({ headless: false });

  try {
    log.info('Verificando sessão...');
    await ensureLoggedIn(page, false);
    log.info('OK: logado no Dev Dashboard.');

    log.info('Navegando pra Apps...');
    await page.goto(`${DEV_DASHBOARD}/apps`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await log.snap(page, 'apps_list');

    // Try to enumerate existing apps
    const appsTitles = await page.locator('[data-app-name], h3, [role="link"]').allTextContents();
    log.saveJSON('apps_visible_in_dom', appsTitles.slice(0, 50));
    log.info(`Apps visíveis no DOM (top 50): ${appsTitles.slice(0, 10).join(' | ')}...`);

    log.info('Doctor OK. Sessão saudável, Dev Dashboard responsivo.');
  } catch (err) {
    log.warn(`Doctor FAIL: ${err instanceof Error ? err.message : String(err)}`);
    await log.snap(page, 'error_state');
    throw err;
  } finally {
    await context.close();
  }
}
