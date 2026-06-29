import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// storageState = cookies + localStorage do Playwright em JSON PLAINTEXT. Diferente do profile cru
// do Chromium (cujos cookies são criptografados pela chave do SO de origem — Windows DPAPI etc — e
// NÃO abrem em outro SO), o storageState é portável: loga no Windows, roda no container Linux.
// É o que permite semear a sessão do PC do João pro runner headless. Container: /data/storage-state.json.
const STORAGE_STATE = process.env.STORAGE_STATE_PATH || resolve(__dirname, '../../storage-state.json');

export const SHOPIFY_ORG_ID = process.env.SHOPIFY_ORG_ID || '181435365';
export const DEV_DASHBOARD = `https://dev.shopify.com/dashboard/${SHOPIFY_ORG_ID}`;
export const SHOPIFY_LOGIN = 'https://accounts.shopify.com/store-login';
export const LEVER_SYSTEM_URL = process.env.LEVER_SYSTEM_URL || 'https://app.leverag.digital';
// Distribuição (Custom + link de instalação) vive no Shopify Partners, não no Dev Dashboard.
export const partnersDistributionUrl = (appId: string) =>
  `https://partners.shopify.com/org/${SHOPIFY_ORG_ID}/org_apps/${appId}/distribution`;

export type SessionOptions = {
  headless?: boolean;
  slowMo?: number;
};

export type Session = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /** Fecha contexto + browser. Chamar SEMPRE no finally (launch() não fecha sozinho). */
  close: () => Promise<void>;
};

export async function openSession(opts: SessionOptions = {}): Promise<Session> {
  // No servidor: HEADLESS=true roda invisível (serviço). Local/login: headful (pra 2FA).
  const browser = await chromium.launch({
    headless: opts.headless ?? process.env.HEADLESS === 'true',
    slowMo: opts.slowMo,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  // Carrega a sessão salva (se existir). Ausente = contexto limpo → ensureLoggedIn pede login.
  const context = await browser.newContext({
    storageState: existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined,
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const close = async () => {
    await context.close();
    await browser.close();
  };
  return { browser, context, page, close };
}

/** Salva a sessão atual (cookies + localStorage) no storageState JSON. Chamado após o login. */
export async function saveStorageState(context: BrowserContext): Promise<void> {
  const dir = dirname(STORAGE_STATE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await context.storageState({ path: STORAGE_STATE });
}

export async function isLoggedInDevDashboard(page: Page): Promise<boolean> {
  await page.goto(DEV_DASHBOARD, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const url = page.url();
  return url.includes(`dev.shopify.com/dashboard/${SHOPIFY_ORG_ID}`) && !url.includes('login');
}

export async function isLoggedInLever(page: Page): Promise<boolean> {
  await page.goto(`${LEVER_SYSTEM_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const url = page.url();
  // Lever System redireciona pra /login se não autenticado
  return !url.includes('/login');
}

export async function ensureLoggedIn(page: Page, interactive = true): Promise<void> {
  // Só o Shopify Dev Dashboard importa: o fluxo (collab request, app, distribuição, OAuth)
  // roda todo no Shopify. As credenciais vão direto pro DB (updateShopifyCreds), então a UI
  // do Lever System NÃO é mais usada — não exigimos login nela.
  const devOk = await isLoggedInDevDashboard(page);
  if (devOk) return;

  if (!interactive) {
    throw new Error('Sessão do Shopify (Dev Dashboard) expirada. Run `npm run login`.');
  }

  console.log('\n=== LOGIN MANUAL ===');
  console.log('Logue no Shopify Dev Dashboard (Partner/Collaborator) e passe o 2FA');
  await page.goto(DEV_DASHBOARD);
  await waitUntilUrl(page, (u) => u.includes(`dev.shopify.com/dashboard/${SHOPIFY_ORG_ID}`) && !u.includes('login'));
  console.log('OK — Dev Dashboard logado.');
}

async function waitUntilUrl(page: Page, predicate: (url: string) => boolean, timeoutMs = 10 * 60 * 1000) {
  const startedAt = Date.now();
  const POLL = 3000;
  while (Date.now() - startedAt < timeoutMs) {
    await page.waitForTimeout(POLL);
    if (predicate(page.url())) return;
  }
  throw new Error(`Timeout aguardando URL match. URL atual: ${page.url()}`);
}
