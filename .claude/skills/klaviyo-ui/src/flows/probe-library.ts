/**
 * probe-library — navega direto pra /library/templates do Klaviyo,
 * acha o template v2 e mapeia opções (Edit / Use in flow / etc).
 */
import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(_args: string[]) {
  const log = new RunLogger('probe-library');
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);

    // Tenta URL da library
    const urls = ['/email/templates', '/email-templates', '/library/templates', '/templates'];
    for (const u of urls) {
      await page.goto(`${KLAVIYO_BASE}${u}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      const url = page.url();
      log.info(`tried ${u} → landed at ${url}`);
      if (!url.endsWith('/dashboard') && !url.includes('/login')) {
        await log.snap(page, `library_${u.replace(/\W+/g, '_')}`);
      }
    }

    // Search por "Abandoned Cart V2"
    const searchBox = page.locator('input[placeholder*="Search" i], input[type="search"]').first();
    if (await searchBox.isVisible().catch(() => false)) {
      log.info('search box visible, filling...');
      await searchBox.fill('Abandoned Cart V2');
      await page.waitForTimeout(2500);
      await log.snap(page, 'searched');
    } else {
      log.info('no search box found on this page');
    }

    // Click no template v2 - Email 1
    log.info('Clicking on "Abandoned Cart V2 - Email 1 (T+1h soft)"');
    try {
      await page.locator(':text("Abandoned Cart V2 - Email 1 (T+1h soft)")').first().click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      await log.snap(page, 'template_opened');
      log.info(`URL after click: ${page.url()}`);
    } catch (e) {
      log.info(`Click failed: ${e instanceof Error ? e.message : e}`);
    }

    // Lista botões/menus dentro da página do template
    const items = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, [role="button"], a, [role="menuitem"]'));
      return all.slice(0, 60).map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 50),
        href: (el as HTMLAnchorElement).href || null,
      })).filter(b => b.text);
    });
    log.saveJSON('items', items);
  } finally {
    await context.close();
  }
}
