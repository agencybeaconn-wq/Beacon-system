import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';
import { selectors } from '../lib/selectors.ts';

function parseArgs(args: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) out[a.slice(2)] = args[i + 1] ?? '';
  }
  return out;
}

export async function run(args: string[]) {
  const { name } = parseArgs(args);
  if (!name) throw new Error('Uso: review --name "Welcome Series"');

  const log = new RunLogger(`review_${name.replace(/\W+/g, '-')}`);
  const { context, page } = await openSession({ headless: false });

  try {
    await ensureLoggedIn(page, false);
    await page.goto(`${KLAVIYO_BASE}/flows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await log.snap(page, 'flows-list');

    // TODO: este seletor precisa ser validado ao vivo
    const searchInput = page.locator(selectors.flowsList.searchInput).first();
    if (await searchInput.count()) {
      await searchInput.fill(name);
      await page.waitForTimeout(1500);
    }

    const link = page.locator(selectors.flowsList.flowLink(name)).first();
    if (!(await link.count())) {
      log.info(`Flow "${name}" não encontrado na lista visível.`);
      return;
    }
    await link.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await log.snap(page, 'flow-detail');

    // TODO: extrair estrutura (steps, A/B, status) — preencher quando selectors estiverem validados
    const status = await page
      .locator(selectors.flowEditor.statusBadge)
      .first()
      .textContent()
      .catch(() => null);

    const summary = {
      name,
      url: page.url(),
      status: status ?? 'unknown',
      capturedAt: new Date().toISOString(),
    };
    log.saveJSON('summary', summary);
    log.info(`Review concluído. Status=${summary.status}`);
  } finally {
    await context.close();
  }
}
