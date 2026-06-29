import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from 'playwright';
import { openSession, ensureLoggedIn, DEV_DASHBOARD, partnersDistributionUrl } from '../lib/session.js';
import { findClientByName, createClient_, pingShopifyToken, triggerBackfill, waitForToken, updateShopifyCreds, db, type AgencyClient } from '../lib/db.js';
import { LEVER_SCOPES_CSV } from '../lib/scopes.js';
import { DEV_DASHBOARD_SELECTORS as DD, PARTNERS_SELECTORS as PT, SHOPIFY_OAUTH_SELECTORS as SO } from '../lib/selectors.js';
import { startRun, getRunDir, snap, info, warn, err } from '../lib/log.js';

export type OnboardArgs = {
  client: string;
  shop: string;
  clientType?: 'fixo' | 'avulso';
  fee?: number;
  commission?: number;
  dryRun?: boolean;
  onlyApp?: boolean;
  skipApp?: boolean;
  clientId?: string;
  clientSecret?: string;
  appId?: string;
  force?: boolean;
};

export async function runOnboard(args: OnboardArgs) {
  const runDir = startRun(`onboard_${args.client.replace(/\W+/g, '-')}`);
  info(`Onboard: ${args.client} → ${args.shop}`);
  info(`Dry-run: ${!!args.dryRun} | Only-app: ${!!args.onlyApp} | Skip-app: ${!!args.skipApp}`);

  // ─── 1. PRÉ-CHECK DB ─────────────────────────────────────────────────────
  info('[1] Pré-check DB');
  let client: AgencyClient | null = await findClientByName(args.client);
  if (!client) {
    if (!args.clientType) throw new Error(`Cliente "${args.client}" não existe e --client-type não foi passado`);
    if (args.dryRun) {
      info(`  [dry-run] Criaria cliente: ${args.client} (${args.clientType})`);
    } else {
      client = await createClient_({
        name: args.client,
        client_type: args.clientType,
        fee_fixed: args.fee,
        commission_rate: args.commission,
      });
      info(`  Cliente criado: ${client.id}`);
    }
  } else {
    info(`  Cliente existe: ${client.id} (${client.client_type})`);
    if (client.shopify_access_token && !args.force) {
      err(`  Cliente já tem shopify_access_token. Use --force pra sobrescrever.`);
      return;
    }
  }

  // ─── FASES A→C num único browser context (Dev Dashboard + Partners + loja) ──
  type AppCreds = { clientId: string; clientSecret: string; appName: string; appId: string };
  let appCreds: AppCreds | null = null;

  if (args.skipApp) {
    if (!args.clientId || !args.clientSecret) throw new Error('--skip-app requer --client-id e --client-secret');
    if (!args.appId) throw new Error('--skip-app requer --app-id (necessário pra distribuição/instalação)');
    appCreds = { clientId: args.clientId, clientSecret: args.clientSecret, appName: '(reused)', appId: args.appId };
    info('[2] Skip create-app — usando creds + appId passados');
  }

  const { page, close } = await openSession(); // headless via env HEADLESS (servidor)
  try {
    await ensureLoggedIn(page, false);

    // Fase A — Dev Dashboard: criar app + versão (42 escopos) + capturar creds
    if (!appCreds) appCreds = await createAppAndCaptureCreds(page, args, runDir);

    if (args.onlyApp) {
      info('--only-app: parando aqui');
      saveResult(runDir, { ...args, appCreds: { ...appCreds, clientSecret: '[REDACTED]' }, stoppedAt: 'after-app' });
      await close();
      return;
    }
    if (!client) throw new Error('client missing — pré-check falhou');

    // Salvar creds no DB (status=pending) — o callback OAuth lê client_id/secret daqui
    if (!args.dryRun) {
      await updateShopifyCreds(client.id, appCreds.clientId, appCreds.clientSecret, args.shop);
      info('  Creds salvas no DB (status=pending)');
    }

    // Fase B — Partners: distribuição Custom + gerar link de instalação
    const installLink = await configureDistribution(page, appCreds.appId, args.shop, args, runDir);

    // Fase C — Instalar via link + authorize → callback grava o token
    await installAndAuthorize(page, installLink, appCreds, client, args, runDir);

    await close();
  } catch (e) {
    await snap(page, 'ERROR_onboard');
    await uploadShot(page, 'onboard-error');
    await close();
    throw e;
  }

  if (args.dryRun) {
    info('[dry-run] encerrando sem validar token');
    saveResult(runDir, { ...args, appCreds: appCreds ? { ...appCreds, clientSecret: '[REDACTED]' } : null, dryRun: true });
    return;
  }

  if (!appCreds) throw new Error('appCreds missing após Fases A-C');

  // ─── VALIDAR NO DB ─────────────────────────────────────────────────────────
  info('[8] Validando no DB');
  const reloaded = await findClientByName(args.client);
  if (!reloaded?.shopify_access_token) {
    err('  Token não encontrado em agency_clients após Verificar Conexão. Loop manual no Lever System.');
    saveResult(runDir, { ...args, appCreds, error: 'no_token_after_verify' });
    return;
  }
  info(`  Token salvo: ${reloaded.shopify_access_token.slice(0, 8)}... (status=${reloaded.shopify_status})`);

  const ping = await pingShopifyToken(args.shop, reloaded.shopify_access_token);
  if (!ping.ok) {
    err(`  Ping GraphQL falhou: ${ping.error}`);
  } else {
    info(`  Ping OK — shop.name="${ping.shopName}"`);
  }

  // ─── 9. TRIGGER BACKFILL ──────────────────────────────────────────────────
  info('[9] Disparando backfill DW (90d)');
  const backfillOk = await triggerBackfill(reloaded.id, 90);
  info(`  Backfill request: ${backfillOk ? 'OK' : 'FAILED'}`);

  // ─── Result final ─────────────────────────────────────────────────────────
  saveResult(runDir, {
    ok: true,
    client: { id: reloaded.id, name: reloaded.name },
    shop: args.shop,
    app: { name: appCreds.appName, clientId: appCreds.clientId, clientSecret: '[REDACTED]' },
    connection: {
      status: reloaded.shopify_status,
      hasToken: !!reloaded.shopify_access_token,
      pingOk: ping.ok,
      shopName: ping.shopName,
    },
    backfillTriggered: !!backfillOk,
  });

  info(`\n✓ Onboard concluído: ${args.client}`);
}

// ============================================================================
// HELPERS — implementação dos passos UI (selectors podem precisar refinar na 1a run)
// ============================================================================

async function createAppAndCaptureCreds(
  page: Page,
  args: OnboardArgs,
  runDir: string,
): Promise<{ clientId: string; clientSecret: string; appName: string; appId: string }> {
  const appName = `Lever System - ${args.client}`;
  info(`[2] Criar app no Dev Dashboard: "${appName}"`);

  if (args.dryRun) {
    info('  [dry-run] pulando UI Dev Dashboard');
    return { clientId: 'DRY_RUN_CLIENT_ID', clientSecret: 'DRY_RUN_SECRET', appName, appId: 'DRY_RUN_APP_ID' };
  }

  await page.goto(`${DEV_DASHBOARD}/apps`, { waitUntil: 'networkidle' });
  await snap(page, 'apps_list');

  // Verificar se app já existe (idempotente — não duplica)
  const existing = page.locator(DD.appCardByName(appName));
  if (await existing.count() > 0) {
    info('  App já existe — abrindo');
    await existing.first().click();
    await page.waitForURL(/\/apps\/\d+/, { timeout: 30000 });
  } else {
    await page.locator(DD.buttonCreateApp).first().click();
    await page.waitForURL('**/apps/new', { timeout: 15000 });
    await page.fill(DD.inputAppName, appName);
    await snap(page, 'create_app_name_filled');
    await page.click(DD.buttonCreate);
    await page.waitForURL(/\/apps\/\d+/, { timeout: 30000 });  // navega pra /apps/{id} após criar
    await snap(page, 'app_created');
  }

  const appId = page.url().match(/\/apps\/(\d+)/)?.[1];
  if (!appId) throw new Error(`Não consegui extrair appId da URL: ${page.url()}`);
  info(`  appId: ${appId}`);

  // ─── Criar nova versão com escopos + URLs ──────────────────────────────────
  // Escopos e redirect URLs vivem na config da VERSÃO (não em Configurações).
  // A v1 criada automaticamente tem escopos vazios — esta versão é a que vale.
  info('[3] Nova versão (42 escopos + redirect URLs)');
  await page.goto(`${DEV_DASHBOARD}/apps/${appId}`, { waitUntil: 'networkidle' });
  await page.locator(DD.buttonNewVersion).first().click({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await snap(page, 'new_version_form');

  const appUrl = process.env.SHOPIFY_APP_URL || 'https://app.leverag.digital';
  const redirectUrls = process.env.SHOPIFY_REDIRECT_URLS ||
    'https://app.leverag.digital/api/shopify/callback,https://pxhmzpwvxvlwngjbjkrg.supabase.co/functions/v1/shopify-oauth-callback';

  await page.fill(DD.inputAppUrl, appUrl);
  await page.fill(DD.textareaScopes, LEVER_SCOPES_CSV);
  await page.fill(DD.textareaRedirectUrls, redirectUrls);
  // Webhooks API version (best-effort — default já é recente)
  try {
    await page.selectOption(DD.selectWebhookApi, process.env.SHOPIFY_WEBHOOKS_API_VERSION || '2026-04', { timeout: 3000 });
  } catch { /* mantém default */ }
  await snap(page, 'version_form_filled');

  // "Lançar" abre um modal de confirmação ("Lançar esta nova versão?") com um 2º "Lançar".
  // Sem confirmar no modal, a versão NÃO é lançada e a v1 (escopos vazios) continua ativa.
  await page.click(DD.buttonLaunch);
  const launchDialog = page.getByRole('dialog');
  await launchDialog.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await snap(page, 'launch_confirm_modal');
  if ((await launchDialog.count()) > 0) {
    await launchDialog.getByRole('button', { name: 'Lançar' }).click();
  } else {
    warn('  Modal de confirmação não apareceu — versão pode não ter lançado');
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await snap(page, 'version_launched');

  // ─── Capturar Client ID + Secret (Configurações) ───────────────────────────
  info('[3.5] Capturando Client ID + Secret');
  await page.goto(`${DEV_DASHBOARD}/apps/${appId}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click(DD.buttonRevealSecret);
  await page.waitForTimeout(700);
  await snap(page, 'credentials_revealed');

  // clientId + secret são os inputs com data-copy-to-clipboard-target="source".
  // Desambigua por valor: clientId casa hex32, secret começa com shpss_.
  const sources = page.locator(DD.credentialInputs);
  const n = await sources.count();
  let clientId = '';
  let clientSecret = '';
  for (let i = 0; i < n; i++) {
    const v = (await sources.nth(i).inputValue()).trim();
    if (/^[a-f0-9]{32}$/.test(v)) clientId = v;
    else if (/^shpss_/.test(v)) clientSecret = v;
  }
  if (!clientId) throw new Error('Client ID não encontrado nas Configurações');
  if (!clientSecret) throw new Error('Client Secret não encontrado (revelar falhou?)');

  info(`  Client ID: ${clientId.slice(0, 8)}… | Secret: ${clientSecret.slice(0, 6)}…`);
  return { clientId, clientSecret, appName, appId };
}

/**
 * FASE B — Shopify Partners: garante distribuição Custom e gera o link de instalação.
 * Custom distribution é IRREVERSÍVEL (2 confirmações). Idempotente: se já é custom,
 * pula a seleção; se o link já existe, reaproveita.
 */
async function configureDistribution(
  page: Page,
  appId: string,
  shop: string,
  args: OnboardArgs,
  runDir: string,
): Promise<string> {
  info('[B] Distribuição Custom (Partners) + link de instalação');
  if (args.dryRun) {
    info('  [dry-run] pulando Partners');
    return 'DRY_RUN_INSTALL_LINK';
  }

  // Partners é SPA pesada (long-poll/websocket) que NUNCA chega a 'networkidle' → timeout.
  // Usar 'domcontentloaded' + o waitForTimeout abaixo dá o tempo de assentar.
  await page.goto(partnersDistributionUrl(appId), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Partners mostra "Escolha uma conta para continuar para Partners" quando a sessão vem via
  // storageState (não tem a conta pré-selecionada como num profile persistente). Escolher a Lever
  // pra cair na página de distribuição. (Descoberto no 1º e2e — antes ficava esperando o botão de
  // distribuição que nunca aparecia nessa tela → timeout.)
  // A tela "Escolha uma conta" renderiza client-side e pode demorar >2.5s — esperar ela aparecer
  // (até 12s) em vez de checar na hora. Se aparecer, clicar na conta Lever; senão, seguir.
  try {
    await page.getByText('Escolha uma conta').waitFor({ state: 'visible', timeout: 12000 });
    info('  Partners pediu seleção de conta — escolhendo a conta Lever');
    await snap(page, 'partners_account_picker');
    await page.getByText('Lever Digital').first().click();
    await page.waitForTimeout(4000);
  } catch {
    info('  (sem tela de seleção de conta — seguindo)');
  }
  await snap(page, 'partners_distribution');

  // Estado 3 (idempotente): distribuição já custom E link já gerado → captura e retorna.
  let link = await captureInstallLink(page);
  if (link) {
    info('  Link de instalação já existe (distribuição já configurada)');
    await snap(page, 'partners_link_existing');
    return link;
  }

  // Estado 1: ainda não é custom (sem campo "Domínio da loja") → seleciona Custom (IRREVERSÍVEL)
  if ((await page.getByLabel(PT.inputShopDomain).count()) === 0) {
    info('  Selecionando Distribuição personalizada (IRREVERSÍVEL)');
    await page.locator(PT.optionCustom).first().click();
    await page.locator(PT.buttonSelectMethod).first().click();
    await page.locator(PT.buttonConfirmCustom).click({ timeout: 10000 }); // modal de confirmação
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    await snap(page, 'partners_custom_selected');
  }

  // Estado 2: form de domínio → preenche + gera link
  info(`  Gerando link de instalação pra ${shop}`);
  await page.getByLabel(PT.inputShopDomain).fill(shop);
  await page.waitForTimeout(400);
  await page.locator(PT.buttonGenerateLink).first().click();
  await page.waitForTimeout(1500);
  const dlg = page.getByRole('dialog'); // modal de confirmação ("Gerar link?")
  if ((await dlg.count()) > 0) {
    await snap(page, 'partners_link_modal');
    await dlg.getByRole('button', { name: 'Gerar link' }).click();
  }
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3500);
  link = await captureInstallLink(page);
  await snap(page, 'partners_link_generated');
  if (!link) throw new Error('Não consegui capturar o link de instalação (install_custom_app)');
  info('  Link de instalação capturado');
  return link;
}

/** Lê o link de instalação custom de um input da tela do Partners. */
async function captureInstallLink(page: Page): Promise<string | null> {
  const vals = await page.$$eval('input', (els) =>
    (els as HTMLInputElement[]).map((e) => e.value || '').filter((v) => /install_custom_app/.test(v)),
  );
  return vals[0] || null;
}

/**
 * FASE C — Instala o app na loja via link custom e dispara o OAuth.
 * O link custom (no_redirect) instala mas NÃO entrega o token; por isso, após instalar,
 * disparamos o authorize (state=client.id) → callback troca o code pelo token e salva no DB.
 */
async function installAndAuthorize(
  page: Page,
  installLink: string,
  appCreds: { clientId: string },
  client: AgencyClient,
  args: OnboardArgs,
  runDir: string,
) {
  info('[C] Instalar na loja + OAuth → token');
  if (args.dryRun) {
    info('  [dry-run] pulando install/OAuth');
    return;
  }
  const shop = args.shop;
  const shopHandle = shop.replace('.myshopify.com', '');

  // Estabelece o contexto da loja antes (reduz a chance do store-picker)
  await page.goto(`https://admin.shopify.com/store/${shopHandle}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2500);

  await page.goto(installLink, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await snap(page, 'install_screen');

  // Store-picker (fallback): clica a loja pelo handle no href
  try {
    const pick = page.locator(`a[href*="${shopHandle}"]`).first();
    if ((await pick.count()) > 0 && (await pick.isVisible())) {
      await pick.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3000);
    }
  } catch { /* sem picker */ }

  // Clica "Instalar" (habilitado agora que o link é válido)
  try {
    const btn = page.locator('button:has-text("Instalar"):not([disabled])').first();
    await btn.waitFor({ state: 'visible', timeout: 15000 });
    await btn.click();
    info('  App instalado');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    await snap(page, 'install_done');
  } catch {
    warn('  Botão "Instalar" não apareceu (app já instalado?) — seguindo pro authorize');
  }

  // Authorize → callback grava o token (state=client.id; redirect_uri whitelistado na versão)
  const redirectUri = process.env.SHOPIFY_OAUTH_REDIRECT_URI || 'https://app.leverag.digital/api/shopify/callback';
  const authorizeUrl = `https://${shop}/admin/oauth/authorize`
    + `?client_id=${encodeURIComponent(appCreds.clientId)}`
    + `&scope=${encodeURIComponent(LEVER_SCOPES_CSV)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&state=${encodeURIComponent(client.id)}`;
  info('  OAuth authorize → callback');
  await page.goto(authorizeUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await tryAuthorizeShopify(page, runDir);

  info('  Aguardando token cair no DB (até 120s)…');
  const tok = await waitForToken(client.id, 120000);
  info(`  ✓ Token salvo (status=${tok.status}, domain=${tok.domain})`);
  await snap(page, 'token_ok');
}

/**
 * Lida com a tela de autorização do Shopify (/admin/oauth/authorize). Tenta clicar
 * no botão de install/autorizar; se não aparecer em ~8s, assume auto-redirect (app
 * já instalado com os mesmos escopos) e segue pro polling do DB.
 */
async function tryAuthorizeShopify(page: Page, runDir: string) {
  try {
    const btn = page.locator(SO.buttonAuthorize).first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    await snap(page, 'oauth_install_button');
    info('  Tela de instalação detectada — clicando autorizar');
    await btn.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await snap(page, 'oauth_authorized');
  } catch {
    info('  Sem tela de instalação (auto-redirect / já instalado) — seguindo pro polling');
  }
}

function saveResult(runDir: string, payload: any) {
  const file = resolve(runDir, 'result.json');
  writeFileSync(file, JSON.stringify(payload, null, 2));
  info(`[result] ${file}`);
}

/**
 * Sobe o screenshot atual no bucket onboarder-profile (errors/<tag>.png, upsert) e loga uma signed
 * URL (24h). Observabilidade remota: dá pra VER a tela do worker da nuvem baixando a URL — sem
 * depender do PC de ninguém nem dos screenshots locais do container. Best-effort (nunca lança).
 */
async function uploadShot(page: Page, tag: string): Promise<void> {
  try {
    const buf = await page.screenshot({ fullPage: false });
    const path = `errors/${tag}.png`;
    const up = await db.storage.from('onboarder-profile').upload(path, buf, {
      contentType: 'image/png',
      upsert: true,
    });
    if (up.error) { warn(`  [shot] upload falhou: ${up.error.message}`); return; }
    const signed = await db.storage.from('onboarder-profile').createSignedUrl(path, 86400);
    if (signed.data?.signedUrl) info(`  [shot] ${signed.data.signedUrl}`);
  } catch (e: any) {
    warn(`  [shot] ${e.message}`);
  }
}
