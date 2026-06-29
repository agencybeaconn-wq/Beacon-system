/**
 * probe-button-edit — clica no botão "RETURN TO YOUR CART" no preview
 * e captura o painel lateral de edição (Link URL etc).
 */
import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(_args: string[]) {
  const log = new RunLogger('probe-button-edit');
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    await page.goto(`${KLAVIYO_BASE}/flow/message/XvFRyR/content/edit`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    await log.snap(page, '01_editor');

    log.info('Clicando no botão RETURN TO YOUR CART no preview');
    const btn = page.locator(':text("RETURN TO YOUR CART"), :text("Return to your cart")').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    await log.snap(page, '02_button_selected');

    // Lista inputs visíveis no painel lateral
    const inputs = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'));
      return all.map((el) => ({
        tag: el.tagName,
        name: (el as HTMLInputElement).name || null,
        type: (el as HTMLInputElement).type || null,
        placeholder: (el as HTMLInputElement).placeholder || null,
        value: (el as HTMLInputElement).value?.slice(0, 200) || null,
        aria: el.getAttribute('aria-label')?.slice(0, 80) || null,
        label: (() => {
          const id = el.id;
          if (id) {
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (lbl) return (lbl.textContent || '').trim().slice(0, 50);
          }
          const wrapLbl = el.closest('label');
          return wrapLbl ? (wrapLbl.textContent || '').trim().slice(0, 50) : null;
        })(),
      })).filter(i => i.value || i.placeholder || i.label || i.aria);
    });
    log.saveJSON('inputs', inputs);
    log.info(`Inputs found: ${inputs.length}`);
    for (const i of inputs) {
      const lbl = i.label || i.aria || i.placeholder || i.name || '?';
      const val = i.value ? ` = ${i.value.slice(0, 80)}` : '';
      log.info(`  ${lbl}${val}`);
    }
  } finally {
    await context.close();
  }
}
