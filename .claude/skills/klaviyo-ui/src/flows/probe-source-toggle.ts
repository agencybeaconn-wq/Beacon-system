/**
 * probe-source-toggle — navega direto pro editor de Email #1, lista todos
 * os botões/menus disponíveis pra achar acesso ao "source code view".
 */
import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(_args: string[]) {
  const log = new RunLogger('probe-source-toggle');
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    await page.goto(`${KLAVIYO_BASE}/flow/message/XvFRyR/content/edit`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    await log.snap(page, '01_editor');

    // Lista TODOS os botões visíveis com texto/aria/title
    const buttons = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]'));
      return all.slice(0, 200).map((el) => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 60),
        aria: el.getAttribute('aria-label')?.slice(0, 80) || null,
        title: el.getAttribute('title')?.slice(0, 80) || null,
        testid: el.getAttribute('data-testid')?.slice(0, 80) || null,
      })).filter(b => b.text || b.aria || b.title);
    });
    log.saveJSON('buttons', buttons);
    log.info(`Buttons: ${buttons.length}`);

    // Clica nos 3 dotinhos no top-right (ao lado do Exit)
    log.info('Tentando clicar em menu ⋮ top-right (próximo do Exit)');
    const moreBtn = page.locator('button[aria-label*="more" i], button[aria-haspopup="menu"]').last();
    try {
      await moreBtn.scrollIntoViewIfNeeded();
      await moreBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await log.snap(page, '02_more_menu');
      const menuItems = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('[role="menuitem"], [role="menu"] button, [role="menu"] a'));
        return all.map(el => ({
          text: (el.textContent || '').trim().slice(0, 60),
          href: (el as HTMLAnchorElement).href || null,
        }));
      });
      log.saveJSON('menu-items', menuItems);
      log.info(`Menu items: ${menuItems.length}`);
      for (const it of menuItems) log.info(`  ${it.text}${it.href ? ' → ' + it.href : ''}`);
    } catch (e) {
      log.info('⋮ menu falhou: ' + (e instanceof Error ? e.message : e));
    }

    // Também clica em "Manage template" dropdown
    await page.keyboard.press('Escape'); // fecha menu anterior
    await page.waitForTimeout(500);

    log.info('Tentando clicar em Manage template');
    try {
      await page.locator('button:has-text("Manage template")').first().click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await log.snap(page, '03_manage_template_menu');
      const tplItems = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('[role="menuitem"], [role="menu"] button, [role="menu"] a'));
        return all.map(el => ({ text: (el.textContent || '').trim().slice(0, 60) }));
      });
      log.saveJSON('manage-template-items', tplItems);
      for (const it of tplItems) log.info(`  ${it.text}`);
    } catch (e) {
      log.info('Manage template falhou: ' + (e instanceof Error ? e.message : e));
    }
  } finally {
    await context.close();
  }
}
