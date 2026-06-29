/**
 * probe-change-template — depois de clicar Manage template → Change template
 * → confirma warning modal, captura tela + URL + lista de botões/links.
 */
import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(_args: string[]) {
  const log = new RunLogger('probe-change-template');
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    await page.goto(`${KLAVIYO_BASE}/flow/message/XvFRyR/content/edit`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);

    await page.locator('button:has-text("Manage template")').first().click();
    await page.waitForTimeout(1200);
    await page.locator('[role="menuitem"]:has-text("Change template"), button:has-text("Change template")').first().click();
    await page.waitForTimeout(1500);
    // Confirm warning modal
    await page.locator('[role="dialog"] button:has-text("Change template")').first().click();

    // Wait long for the new view to render
    for (let i = 1; i <= 4; i++) {
      await page.waitForTimeout(3000);
      const url = page.url();
      log.info(`t=${i*3}s url=${url}`);
      await log.snap(page, `t${i*3}`);
    }

    // After 12s, dump complete state
    const finalUrl = page.url();
    log.info(`FINAL url=${finalUrl}`);
    const buttons = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"], a'));
      return all.slice(0, 120).map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 60),
        aria: el.getAttribute('aria-label')?.slice(0, 80) || null,
        href: (el as HTMLAnchorElement).href || null,
      })).filter(b => b.text || b.aria);
    });
    log.saveJSON('all-elements', buttons);
    log.info(`Elements: ${buttons.length}`);
    // Print suspicious ones
    for (const b of buttons) {
      if (/template|library|select|choose|use|search/i.test((b.text + (b.aria || '')))) {
        log.info(`  ${b.tag} text="${b.text}" aria="${b.aria || ''}" href="${b.href || ''}"`);
      }
    }
  } finally {
    await context.close();
  }
}
