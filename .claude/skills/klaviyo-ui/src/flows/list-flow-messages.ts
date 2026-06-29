/**
 * list-flow-messages — abre um flow Klaviyo, encontra TODOS os emails dentro,
 * e mapeia messageId ↔ nome. Output: JSON com { name, messageId, editUrl }.
 *
 * Uso: npm run flow -- list-flow-messages --flow "Kron Abandoned Cart"
 */
import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(rawArgs: string[]) {
  const flowIdx = rawArgs.indexOf('--flow');
  const flowName = flowIdx > -1 ? rawArgs[flowIdx + 1] : null;
  if (!flowName) throw new Error('--flow obrigatório');

  const log = new RunLogger(`list-messages_${flowName.replace(/\s+/g, '-').toLowerCase()}`);
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    await page.goto(`${KLAVIYO_BASE}/flows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.getByText(flowName, { exact: false }).first().click();
    await page.waitForTimeout(5000);
    await log.snap(page, 'flow_open');

    // Hardcoded Email names — extensível depois
    const emailNames = ['Email #1', 'Email #2', 'Email #3'];
    const messages: Array<{ name: string; messageId: string; editUrl: string }> = [];
    for (const name of emailNames) {
      const card = page.locator(`:text("${name}")`).first();
      if (!(await card.isVisible().catch(() => false))) {
        log.info(`${name}: not visible on canvas, skipping`);
        continue;
      }
      log.info(`Clicking ${name}...`);
      try {
        await card.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await card.click({ timeout: 5000 });
        await page.waitForTimeout(2500);
        const editHref = await page.locator('a[href*="/flow/message/"][href*="/content/edit"]').first().getAttribute('href').catch(() => null);
        if (editHref) {
          const m = editHref.match(/\/flow\/message\/([^/]+)\/content\/edit/);
          if (m) {
            const full = editHref.startsWith('http') ? editHref : `${KLAVIYO_BASE}${editHref}`;
            messages.push({ name, messageId: m[1], editUrl: full });
            log.info(`  ${name} → messageId=${m[1]}`);
          }
        } else {
          log.info(`  ${name}: no editUrl found in panel`);
        }
        // Close painel: tenta botão X
        const closeBtn = page.locator('button[aria-label="Close"]').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click().catch(() => {});
          await page.waitForTimeout(800);
        }
      } catch (e) {
        log.info(`  ${name} failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    log.info(`Found ${messages.length} message editor links`);
    for (const m of messages) {
      log.info(`  ${m.cardText.padEnd(12)} → messageId=${m.messageId}`);
    }
    log.saveJSON('messages', messages);
  } finally {
    await context.close();
  }
}
