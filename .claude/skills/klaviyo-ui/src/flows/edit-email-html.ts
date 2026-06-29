/**
 * edit-email-html — abre um email dentro de um flow Klaviyo, vai pro view de
 * source code do HTML, faz find/replace e salva.
 *
 * Uso:
 *   npm run flow -- edit-email-html --flow "Kron Abandoned Cart" --email "Email #1" \
 *     --find '|default:"https://respeitasports.myshopify.com/cart"' \
 *     --replace "|default:'https://respeitasports.myshopify.com/cart'"
 *
 *   --find e --replace são strings literais (não regex)
 *   Repete --find/--replace pra múltiplas substituições por chamada
 *
 *   --dry-run: navega + abre source + faz preview do replace, mas NÃO salva
 */

import { openSession, ensureLoggedIn, KLAVIYO_BASE } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';
import { readFileSync } from 'node:fs';
import type { Page } from 'playwright';

type Args = {
  messageId: string;
  replacements: Array<{ find: string; replace: string }>;
  dryRun: boolean;
  replacementsFile?: string;
};

function parseArgs(rawArgs: string[]): Args {
  const out: Partial<Args> = { replacements: [], dryRun: false };
  const reps: Array<{ find?: string; replace?: string }> = [];
  let currentRep: { find?: string; replace?: string } = {};
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--messageId') out.messageId = rawArgs[++i];
    else if (a === '--find') {
      if (currentRep.find !== undefined) { reps.push(currentRep); currentRep = {}; }
      currentRep.find = rawArgs[++i];
    } else if (a === '--replace') {
      currentRep.replace = rawArgs[++i];
      reps.push(currentRep);
      currentRep = {};
    } else if (a === '--replacements-file') out.replacementsFile = rawArgs[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  if (currentRep.find !== undefined) reps.push(currentRep);
  out.replacements = reps.filter((r) => r.find && r.replace !== undefined) as Array<{ find: string; replace: string }>;

  if (!out.messageId) throw new Error('--messageId obrigatório (ex: --messageId XvFRyR)');
  if (!out.replacements.length && !out.replacementsFile) throw new Error('pelo menos um --find/--replace pair OU --replacements-file');
  return out as Args;
}

async function clickFirst(page: Page, candidates: Array<() => ReturnType<Page['locator']>>, timeoutMs = 5000) {
  let lastErr: unknown;
  for (const factory of candidates) {
    try {
      const loc = factory();
      await loc.first().waitFor({ timeout: timeoutMs });
      await loc.first().click();
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Nenhum candidate clicável: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export async function run(rawArgs: string[]) {
  const args = parseArgs(rawArgs);
  // Carrega replacements de arquivo se fornecido
  if (args.replacementsFile) {
    const fileData = JSON.parse(readFileSync(args.replacementsFile, 'utf8'));
    if (Array.isArray(fileData)) args.replacements = fileData;
  }
  const log = new RunLogger(`edit-email-html_${args.messageId}`);

  log.info(`MessageId: ${args.messageId}`);
  log.info(`Replacements: ${args.replacements.length}`);
  for (const r of args.replacements) {
    log.info(`  FIND: ${r.find.slice(0, 100)}`);
    log.info(`  REPL: ${r.replace.slice(0, 100)}`);
  }
  log.info(`Mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`);

  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    log.info('Session OK.');

    // STEP 1-4 substituídos: navegação direta pro editor de conteúdo
    const editorUrl = `${KLAVIYO_BASE}/flow/message/${args.messageId}/content/edit`;
    log.info(`Step 1: navegando direto pro editor: ${editorUrl}`);
    await page.goto(editorUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await log.snap(page, '01_editor_open');

    // STEP 5: muda pro source/HTML view
    log.info('Step 5: abre source code view');
    // Klaviyo HTML editor: pode ter botão "Source", "</>", ou similar
    await clickFirst(page, [
      () => page.getByRole('button', { name: /source/i }),
      () => page.getByRole('button', { name: /<\/>/ }),
      () => page.getByRole('button', { name: /HTML/i }),
      () => page.locator('[data-testid*="source"]'),
      () => page.locator('button[title*="Source"]'),
    ], 8000);
    await page.waitForTimeout(2500);
    await log.snap(page, '05_source_view');

    // STEP 6: pega o HTML atual via textarea / contenteditable
    log.info('Step 6: lendo HTML atual');
    const textareaSelector = 'textarea, [contenteditable="true"]';
    const editor = page.locator(textareaSelector).first();
    await editor.waitFor({ timeout: 8000 });

    const currentHtml = await editor.inputValue().catch(() => null) ?? await editor.textContent().catch(() => null) ?? '';

    if (!currentHtml || currentHtml.length < 100) {
      log.info('HTML aparenta estar vazio ou inacessível — abortando antes de quebrar conteúdo');
      await log.snap(page, '_FAIL_empty_html');
      throw new Error('HTML source não foi lido — selector errado ou editor diferente');
    }
    log.info(`HTML length: ${currentHtml.length} chars`);

    // STEP 7: aplica substituições em memória
    let updated = currentHtml;
    const stats: Array<{ find: string; matches: number }> = [];
    for (const r of args.replacements) {
      const matches = (updated.match(new RegExp(r.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      stats.push({ find: r.find.slice(0, 80), matches });
      if (matches === 0) {
        log.info(`  ZERO matches pra: ${r.find.slice(0, 100)}`);
      } else {
        log.info(`  ${matches} matches pra: ${r.find.slice(0, 80)}`);
        updated = updated.split(r.find).join(r.replace);
      }
    }
    log.info(`HTML após replace: ${updated.length} chars (delta=${updated.length - currentHtml.length})`);

    if (updated === currentHtml) {
      log.info('Nenhuma mudança aplicada (zero matches em todos os find).');
      log.saveJSON('result', { messageId: args.messageId, changed: false, stats });
      return;
    }

    if (args.dryRun) {
      log.info('--dry-run: ABORT antes de escrever no editor');
      log.saveJSON('result', { messageId: args.messageId, changed: true, stats, dryRun: true });
      // Salva preview do HTML pra inspeção
      log.saveJSON('html-preview-snippet', { before: currentHtml.slice(0, 500), after: updated.slice(0, 500) });
      return;
    }

    // STEP 8: substitui o HTML no editor
    log.info('Step 8: escrevendo novo HTML no editor');
    if (await editor.evaluate((el) => el.tagName === 'TEXTAREA').catch(() => false)) {
      await editor.fill(updated);
    } else {
      // contenteditable
      await editor.focus();
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
      await page.keyboard.press('Delete');
      await editor.fill(updated);
    }
    await page.waitForTimeout(1500);
    await log.snap(page, '06_html_replaced');

    // STEP 9: salvar
    log.info('Step 9: clica Save');
    await clickFirst(page, [
      () => page.getByRole('button', { name: /^Save$/i }),
      () => page.getByRole('button', { name: /save and close/i }),
      () => page.getByRole('button', { name: /save changes/i }),
    ], 8000);
    await page.waitForTimeout(4000);
    await log.snap(page, '07_after_save');

    log.info('OK — salvo.');
    log.saveJSON('result', { messageId: args.messageId, changed: true, stats });
  } catch (err) {
    log.info(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
    await log.snap(page, '_error_state');
    throw err;
  } finally {
    await context.close();
  }
}
