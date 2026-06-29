import { chromium, type BrowserContext, type Page } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(__dirname, '../../profile');

export const DEV_DASHBOARD = 'https://dev.shopify.com/dashboard';
export const SHOPIFY_LOGIN = 'https://accounts.shopify.com/store-login';

export type SessionOptions = {
  headless?: boolean;
  slowMo?: number;
};

export async function openSession(opts: SessionOptions = {}): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: opts.headless ?? false,
    slowMo: opts.slowMo,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto(DEV_DASHBOARD, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const url = page.url();
  // Dev Dashboard URLs contain /dashboard when logged in; redirect to accounts.shopify.com if not
  return url.includes('dev.shopify.com/dashboard') && !url.includes('login');
}

export async function ensureLoggedIn(page: Page, interactive = true): Promise<void> {
  if (await isLoggedIn(page)) return;

  if (!interactive) {
    throw new Error(
      'Shopify Dev Dashboard session expired. Run `npm run login` to re-authenticate.',
    );
  }

  console.log('\n=== LOGIN MANUAL ===');
  console.log('1. Faça login no Shopify Dev Dashboard no Chromium que acabou de abrir');
  console.log('2. Use a conta Partner/Collaborator com acesso às lojas dos clientes');
  console.log('3. Complete 2FA se pedido');
  console.log('4. Quando chegar em dev.shopify.com/dashboard, o script detecta e fecha sozinho');
  console.log('Timeout: 10min — depois disso aborta.');
  console.log('=====================\n');

  await page.goto(DEV_DASHBOARD, { waitUntil: 'domcontentloaded' });

  // Polling — checa a cada 3s, max 10min
  const startedAt = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000;
  const POLL_INTERVAL = 3000;
  while (Date.now() - startedAt < TIMEOUT_MS) {
    await page.waitForTimeout(POLL_INTERVAL);
    const url = page.url();
    // Heuristic: chegou no Dev Dashboard logado
    if (url.includes('dev.shopify.com/dashboard') && !url.includes('login') && !url.includes('auth')) {
      // Confirma com check de URL atual (sem re-navegar)
      console.log(`Login detectado: ${url}`);
      console.log('OK — sessão salva em profile/');
      return;
    }
  }
  throw new Error('Timeout 10min — login não detectado. Re-run npm run login.');
}
