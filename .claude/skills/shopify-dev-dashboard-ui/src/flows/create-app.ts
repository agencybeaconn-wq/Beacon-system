/**
 * create-app — automatiza criação de Custom App no Shopify Dev Dashboard
 *                + escopos Lever + install na loja target + captura token.
 *
 * Uso:
 *   npm run flow -- create-app --client "Mantos do PH" --shop "a9dc24-2.myshopify.com"
 *   npm run flow -- create-app --client "Cliente X" --shop "loja.myshopify.com" --scopes min
 *   npm run flow -- create-app --client "Cliente Y" --shop "loja.myshopify.com" --scopes custom --extra-scopes "read_orders,write_orders"
 *   npm run flow -- create-app --client "Z" --shop "..." --dry-run   (não cria, só simula)
 *
 * Output:
 *   - runs/<ts>_create-app/result.json  → { app_id, app_name, scopes, shop, token (REDACTED unless --reveal-token) }
 *   - runs/<ts>_create-app/run.log
 *   - screenshots cobrindo cada etapa
 *
 * IMPORTANTE: alguns seletores podem precisar ajuste fino na primeira execução real.
 * Esta v1 cobre o caminho feliz; cada step com TODO documenta onde validar ao vivo.
 */

import { openSession, ensureLoggedIn, DEV_DASHBOARD } from '../lib/session.ts';
import { RunLogger } from '../lib/log.ts';
import { getScopesPreset, LEVER_DEFAULT_SCOPES } from '../lib/scopes.ts';
import type { Page } from 'playwright';

type Args = {
  client: string;
  shop: string;
  scopes: 'default' | 'min' | 'custom';
  extraScopes?: string[];
  dryRun: boolean;
  revealToken: boolean;
};

function parseArgs(rawArgs: string[]): Args {
  const out: Partial<Args> = { scopes: 'default', dryRun: false, revealToken: false };
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i]!;
    if (a === '--client') out.client = rawArgs[++i];
    else if (a === '--shop') out.shop = rawArgs[++i];
    else if (a === '--scopes') out.scopes = rawArgs[++i] as Args['scopes'];
    else if (a === '--extra-scopes') out.extraScopes = rawArgs[++i]?.split(',').map((s) => s.trim()) ?? [];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--reveal-token') out.revealToken = true;
  }
  if (!out.client) throw new Error('--client é obrigatório (ex: --client "Mantos do PH")');
  if (!out.shop) throw new Error('--shop é obrigatório (ex: --shop "a9dc24-2.myshopify.com")');
  return out as Args;
}

export async function run(rawArgs: string[]) {
  const args = parseArgs(rawArgs);
  const log = new RunLogger(`create-app_${args.client.replace(/\s+/g, '-').toLowerCase()}`);

  const scopes = getScopesPreset(args.scopes, args.extraScopes);
  const appName = `${args.client} — Lever MCP`;

  log.info(`Cliente: ${args.client}`);
  log.info(`Loja target: ${args.shop}`);
  log.info(`Nome do app: ${appName}`);
  log.info(`Scopes preset: ${args.scopes} (${scopes.length} scopes)`);
  log.info(`Scopes: ${scopes.join(', ')}`);

  if (args.dryRun) {
    log.info('--dry-run: simulação apenas. Nenhuma ação executada.');
    log.saveJSON('plan', { client: args.client, shop: args.shop, appName, scopes });
    return;
  }

  const { context, page } = await openSession({ headless: false });
  try {
    await ensureLoggedIn(page, false);
    log.info('Sessão Dev Dashboard OK.');

    // ─── Step 1: Apps list → Create app ───
    log.info('Step 1: Navegando pra Apps → Create app');
    await page.goto(`${DEV_DASHBOARD}/apps`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await log.snap(page, '01_apps_list');

    // TODO: ajustar seletor real ao primeiro contato. Dev Dashboard usa Polaris (botões com nome).
    await clickFirst(page, [
      () => page.getByRole('button', { name: /Create app/i }),
      () => page.getByRole('link', { name: /Create app/i }),
      () => page.locator('button:has-text("Create app")'),
    ]);
    await page.waitForTimeout(1500);
    await log.snap(page, '02_create_modal');

    // ─── Step 2: Start from Dev Dashboard ───
    log.info('Step 2: Start from Dev Dashboard');
    await clickFirst(page, [
      () => page.getByRole('button', { name: /Start from Dev Dashboard/i }),
      () => page.getByText(/Start from Dev Dashboard/i, { exact: false }),
    ]);
    await page.waitForTimeout(1000);

    // ─── Step 3: Nome do app ───
    log.info('Step 3: Preenchendo nome do app');
    await page.fill('input[type="text"]:visible, input[name="name"]:visible', appName).catch(async () => {
      // Fallback: tenta label
      const input = page.getByLabel(/App name|Name/i).first();
      await input.fill(appName);
    });
    await page.waitForTimeout(500);
    await log.snap(page, '03_app_named');

    await clickFirst(page, [
      () => page.getByRole('button', { name: /^Create$/i }),
      () => page.locator('button[type="submit"]:has-text("Create")'),
    ]);
    await page.waitForTimeout(3000);
    await log.snap(page, '04_app_created');

    const currentUrl = page.url();
    log.info(`App criado. URL: ${currentUrl}`);

    // App ID provavelmente no path: /apps/<app_id>/...
    const appIdMatch = currentUrl.match(/\/apps\/([^/?]+)/);
    const appId = appIdMatch?.[1] ?? 'unknown';
    log.info(`App ID detectado: ${appId}`);

    // ─── Step 4: Versions → New version → Configure ───
    log.info('Step 4: Configurando versão (URL, scopes, webhooks)');
    await clickFirst(page, [
      () => page.getByRole('tab', { name: /Versions/i }),
      () => page.getByRole('link', { name: /Versions/i }),
    ]).catch(() => log.warn('Tab Versions não encontrada — pode estar default no app criado'));

    await page.waitForTimeout(2000);
    await log.snap(page, '05_versions_tab');

    // App URL (default Shopify)
    log.info('Step 4a: App URL default');
    await page
      .getByLabel(/App URL|Application URL/i)
      .first()
      .fill('https://shopify.dev/apps/default-app-home')
      .catch(() => log.warn('App URL field não encontrado — pode estar pre-preenchido'));

    // ─── Step 5: Selecionar scopes ───
    log.info(`Step 5: Selecionando ${scopes.length} scopes`);
    for (const scope of scopes) {
      try {
        // Tenta achar checkbox pelo handle do scope
        const checkbox = page.getByLabel(new RegExp(`^${scope}$`), { exact: true }).first();
        await checkbox.waitFor({ timeout: 2000 });
        const checked = await checkbox.isChecked().catch(() => false);
        if (!checked) {
          await checkbox.check();
          log.info(`  ✓ ${scope}`);
        }
      } catch (e) {
        log.warn(`  scope NOT FOUND no DOM (precisa search?): ${scope}`);
        // TODO: Dev Dashboard pode ter scope search box. Investigar primeiro run e adicionar fluxo.
      }
    }
    await log.snap(page, '06_scopes_selected');

    // ─── Step 6: Release version ───
    log.info('Step 6: Release version');
    await clickFirst(page, [
      () => page.getByRole('button', { name: /^Release$/i }),
      () => page.locator('button:has-text("Release")'),
    ]);
    await page.waitForTimeout(3000);
    await log.snap(page, '07_version_released');

    // ─── Step 7: Install on store ───
    log.info(`Step 7: Install na loja ${args.shop}`);
    await clickFirst(page, [
      () => page.getByRole('button', { name: /Install on store|Select store|Install/i }),
      () => page.getByRole('link', { name: /Install on store|Install/i }),
    ]);
    await page.waitForTimeout(2000);

    // Modal pede shop URL
    await page
      .getByLabel(/Store URL|Shop domain|Store/i)
      .first()
      .fill(args.shop)
      .catch(async () => {
        await page.fill('input[placeholder*="myshopify"]', args.shop);
      });
    await page.waitForTimeout(500);
    await log.snap(page, '08_install_shop_filled');

    await clickFirst(page, [
      () => page.getByRole('button', { name: /^Install$|^Continue$/i }),
    ]);
    await page.waitForTimeout(3000);
    await log.snap(page, '09_oauth_screen');

    // ─── Step 8: OAuth grant na loja ───
    log.info('Step 8: Autorizando install na loja (OAuth grant)');
    // Esse passo redireciona pro admin da loja. Como collaborator/admin, precisamos clicar Install.
    await clickFirst(page, [
      () => page.getByRole('button', { name: /Install app|^Install$/i }),
    ]);
    await page.waitForTimeout(5000);
    await log.snap(page, '10_post_install');

    // ─── Step 9: Voltar pro Dev Dashboard → API credentials → Reveal token ───
    log.info('Step 9: Capturando Admin API access token');
    await page.goto(`${DEV_DASHBOARD}/apps/${appId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await clickFirst(page, [
      () => page.getByRole('tab', { name: /API credentials|Credentials/i }),
      () => page.getByRole('link', { name: /API credentials|Credentials/i }),
    ]);
    await page.waitForTimeout(2000);
    await log.snap(page, '11_api_credentials_tab');

    await clickFirst(page, [
      () => page.getByRole('button', { name: /Reveal token once|Reveal/i }),
    ]);
    await page.waitForTimeout(2000);
    await log.snap(page, '12_token_revealed');

    // Token está num input readonly ou code element. Tenta extrair.
    const tokenLocators = [
      page.locator('input[readonly][value^="shpat_"]'),
      page.locator('code:has-text("shpat_")'),
      page.locator('[data-token]'),
    ];
    let token: string | null = null;
    for (const loc of tokenLocators) {
      try {
        const val = (await loc.first().inputValue().catch(() => null)) || (await loc.first().textContent().catch(() => null));
        if (val && val.startsWith('shpat_')) {
          token = val.trim();
          break;
        }
      } catch {
        /* try next */
      }
    }

    if (!token) {
      log.warn('Token NÃO foi capturado automaticamente. Confira screenshot 12 e copie manualmente.');
      log.saveJSON('result', {
        client: args.client,
        shop: args.shop,
        appId,
        appName,
        scopes: [...scopes],
        token: null,
        note: 'Token não capturado — copiar do DOM/screenshot.',
      });
      return;
    }

    log.info(`Token capturado (${token.length} chars, prefix ${token.slice(0, 10)}...).`);

    log.saveJSON('result', {
      client: args.client,
      shop: args.shop,
      appId,
      appName,
      scopes: [...scopes],
      token: args.revealToken ? token : '[REDACTED — use --reveal-token pra mostrar no JSON]',
      tokenLength: token.length,
      tokenPrefix: token.slice(0, 10),
    });

    if (args.revealToken) {
      console.log(`\n=== TOKEN ===\n${token}\n=============\n`);
      console.log(`Próximo passo: adicionar no Vercel env vars ou Lever System Vault.`);
      console.log(`  SHOPIFY_${args.client.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_TOKEN=<token>`);
    } else {
      log.info('Token salvo em result.json (REDACTED). Re-run com --reveal-token pra extrair.');
    }
  } catch (err) {
    log.warn(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
    await log.snap(page, 'error_state');
    throw err;
  } finally {
    await context.close();
  }
}

// ─── Helpers ───

async function clickFirst(_page: Page, candidates: Array<() => ReturnType<Page['locator']>>) {
  let lastErr: unknown;
  for (const factory of candidates) {
    try {
      const loc = factory();
      await loc.first().waitFor({ timeout: 3000 });
      await loc.first().click();
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Nenhum candidate clicável: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}
