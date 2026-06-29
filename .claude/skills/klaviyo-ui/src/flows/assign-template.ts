/**
 * assign-template — atribui um template universal a uma flow-message
 * via UI Klaviyo (única forma — API retorna 405).
 *
 * Uso:
 *   npm run flow -- assign-template --message-id XvFRyR --template-name "Abandoned Cart V2 - Email 1 (T+1h soft)"
 *
 * Caminho UI:
 *   /flow/message/{id}/content/edit  → "Manage template" → "Change template"
 *   → modal abre → procura nome → clica → confirma
 */

import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';
import type { Page } from 'playwright';

function parseArgs(rawArgs: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--message-id') out.messageId = rawArgs[++i];
    else if (a === '--template-name') out.templateName = rawArgs[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  if (!out.messageId) throw new Error('--message-id obrigatório');
  if (!out.templateName) throw new Error('--template-name obrigatório');
  return out as { messageId: string; templateName: string; dryRun?: boolean };
}

async function clickFirst(page: Page, candidates: Array<() => ReturnType<Page['locator']>>, timeout = 6000) {
  let lastErr: unknown;
  for (const f of candidates) {
    try {
      const loc = f();
      await loc.first().waitFor({ timeout });
      await loc.first().click();
      return;
    } catch (err) { lastErr = err; }
  }
  throw new Error(`Não cliquei: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export async function run(rawArgs: string[]) {
  const args = parseArgs(rawArgs);
  const log = new RunLogger(`assign_${args.messageId}_${args.templateName.slice(0, 20).replace(/\W+/g, '-')}`);
  log.info(`messageId: ${args.messageId}`);
  log.info(`template: ${args.templateName}`);
  log.info(`mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`);

  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    log.info('session OK');

    // STEP 1: navega para o editor de conteúdo do email
    await page.goto(`${KLAVIYO_BASE}/flow/message/${args.messageId}/content/edit`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    await log.snap(page, '01_editor');

    // STEP 2: clica "Manage template"
    log.info('Step 2: click Manage template');
    await clickFirst(page, [
      () => page.getByRole('button', { name: /Manage template/i }),
      () => page.locator('button:has-text("Manage template")'),
    ], 8000);
    await page.waitForTimeout(1200);
    await log.snap(page, '02_manage_open');

    // STEP 3: clica "Change template" (item do dropdown Manage)
    log.info('Step 3a: click Change template (menu item)');
    await clickFirst(page, [
      () => page.getByRole('menuitem', { name: /Change template/i }),
      () => page.locator('[role="menuitem"]:has-text("Change template")'),
      () => page.getByText('Change template', { exact: true }),
    ], 6000);
    await page.waitForTimeout(1500);
    await log.snap(page, '03a_change_modal_warning');

    // STEP 3b: modal aviso "Any existing content will not be saved" → confirma com "Change template" preto
    log.info('Step 3b: confirm warning modal "Change template"');
    await clickFirst(page, [
      () => page.locator('[role="dialog"] button:has-text("Change template")'),
      () => page.locator('button:has-text("Change template"):not([aria-haspopup])').last(),
      () => page.getByRole('button', { name: /^Change template$/i }).last(),
    ], 6000);
    await page.waitForTimeout(4000);
    await log.snap(page, '03b_template_library');

    // STEP 4: agora estamos na library — search
    log.info(`Step 4: search template "${args.templateName}"`);
    const searchBox = page.locator('input[placeholder*="Search" i], input[type="search"], input[role="searchbox"]').first();
    try {
      await searchBox.waitFor({ timeout: 6000 });
      await searchBox.fill(args.templateName);
      await page.waitForTimeout(2000);
    } catch {
      log.info('  search box not found — listando tudo');
    }
    await log.snap(page, '04_search_filled');

    // STEP 5: clica no resultado
    log.info('Step 5: click template result');
    await clickFirst(page, [
      () => page.getByText(args.templateName, { exact: true }),
      () => page.locator(`[role="row"]:has-text("${args.templateName}")`),
      () => page.locator(`button:has-text("${args.templateName}")`),
      () => page.locator(`[data-testid*="template"]:has-text("${args.templateName}")`),
    ], 8000);
    await page.waitForTimeout(1500);
    await log.snap(page, '05_template_selected');

    // STEP 6: confirma (button "Use template" / "Apply" / "Select")
    log.info('Step 6: confirm');
    if (!args.dryRun) {
      await clickFirst(page, [
        () => page.getByRole('button', { name: /^Use template$/i }),
        () => page.getByRole('button', { name: /^Apply$/i }),
        () => page.getByRole('button', { name: /^Select$/i }),
        () => page.getByRole('button', { name: /^Confirm$/i }),
        () => page.getByRole('button', { name: /^Continue$/i }),
      ], 8000);
      await page.waitForTimeout(3000);
      await log.snap(page, '06_confirmed');

      // STEP 7: Klaviyo pode pedir confirmação extra ("Are you sure?")
      try {
        await clickFirst(page, [
          () => page.getByRole('button', { name: /^Yes/i }),
          () => page.getByRole('button', { name: /Replace/i }),
          () => page.getByRole('button', { name: /Continue/i }),
        ], 3000);
        await page.waitForTimeout(2000);
        await log.snap(page, '07_extra_confirm');
      } catch {
        log.info('No extra confirmation needed');
      }
    } else {
      log.info('--dry-run: skip confirm click');
    }

    log.info('DONE');
  } catch (err) {
    log.info(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
    await log.snap(page, '_error');
    throw err;
  } finally {
    await context.close();
  }
}
