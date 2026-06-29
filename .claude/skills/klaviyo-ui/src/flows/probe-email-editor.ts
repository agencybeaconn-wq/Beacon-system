/**
 * probe-email-editor — exploratório: navega, abre Email #1, e MAPEIA caminhos
 * possíveis pra abrir o editor de conteúdo HTML. Não modifica nada.
 */
import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';

export async function run(_args: string[]) {
  const log = new RunLogger('probe-email-editor');
  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    log.info('Session OK.');

    // Flows list
    await page.goto(`${KLAVIYO_BASE}/flows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Click "Kron Abandoned Cart"
    log.info('Clicando no flow Kron Abandoned Cart');
    await page.getByText('Kron Abandoned Cart', { exact: false }).first().click();
    await page.waitForTimeout(5000);
    await log.snap(page, 'flow_opened');

    const urlAfterFlow = page.url();
    log.info(`URL after flow open: ${urlAfterFlow}`);

    // Estratégia A: double-click no card Email #1
    log.info('Estratégia A: tentando DOUBLE-CLICK no card Email #1');
    const emailCard = page.locator(':text("Email #1")').first();
    try {
      await emailCard.dblclick({ timeout: 5000 });
      await page.waitForTimeout(4000);
      await log.snap(page, 'A_after_dblclick');
      const urlA = page.url();
      log.info(`URL pós-dblclick: ${urlA}`);
      // Olha se mudou pra um editor diferente
      if (urlA !== urlAfterFlow) {
        log.info(`A: URL mudou — provavelmente abriu editor: ${urlA}`);
        log.saveJSON('result', { strategy: 'double-click', editorUrl: urlA });
        return;
      }
    } catch (e) {
      log.info(`A: double-click falhou: ${e instanceof Error ? e.message : e}`);
    }

    // Estratégia B: clicar no 3-dots (⋮) do card Email #1
    log.info('Estratégia B: tentando 3-dots dentro do card Email #1');
    // Tenta achar botão de "more" dentro do card
    // O card tem "Email #1" texto + 3-dots adjacente
    const cardCandidates = [
      () => page.locator(`button[aria-label*="more" i]`).first(),
      () => page.locator(`button[aria-haspopup]`).filter({ has: page.locator(':scope') }).first(),
      () => page.locator('button:has(svg)').filter({ hasText: '' }).nth(0),
    ];

    // Tira screenshot pra ver estado atual
    await log.snap(page, 'B_before_dots');

    // Lista TODOS os botões na página com aria-label
    const buttons = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, [role="button"]'));
      return all.slice(0, 80).map((el, i) => ({
        i,
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 50),
        aria: el.getAttribute('aria-label')?.slice(0, 80) || null,
        title: el.getAttribute('title')?.slice(0, 80) || null,
        testid: el.getAttribute('data-testid')?.slice(0, 80) || null,
      })).filter(b => b.text || b.aria || b.title);
    });
    log.saveJSON('buttons-on-page', buttons);
    log.info(`Total buttons listed: ${buttons.length}`);

    // Lista todos os elementos com texto "Edit"
    const editTexts = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const matched = [];
      for (const el of all) {
        const txt = (el.textContent || '').trim();
        if (/^Edit( |$)/i.test(txt) && txt.length < 30) {
          matched.push({
            tag: el.tagName,
            text: txt.slice(0, 50),
            cls: el.className?.toString().slice(0, 80) || null,
            href: (el as HTMLAnchorElement).href || null,
          });
        }
      }
      return matched.slice(0, 30);
    });
    log.saveJSON('edit-elements', editTexts);
    log.info(`'Edit*' elements found: ${editTexts.length}`);

    // Lista links que parecem pra editor de email
    const editLinks = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a'));
      return all.filter(a => a.href && /edit|message|content|template/i.test(a.href)).slice(0, 20).map(a => ({
        href: a.href,
        text: (a.textContent || '').trim().slice(0, 50),
      }));
    });
    log.saveJSON('candidate-links', editLinks);
    log.info(`Candidate edit links: ${editLinks.length}`);

  } catch (err) {
    log.info(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
    await log.snap(page, '_error');
  } finally {
    await context.close();
  }
}
