import { chromium, type BrowserContext, type Page } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(__dirname, '../../profile');

export const KLAVIYO_BASE = 'https://www.klaviyo.com';
export const KLAVIYO_DASHBOARD = `${KLAVIYO_BASE}/dashboard`;

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
  await page.goto(KLAVIYO_DASHBOARD, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const url = page.url();
  return !url.includes('/login') && !url.includes('/auth');
}

export async function ensureLoggedIn(page: Page, interactive = true): Promise<void> {
  if (await isLoggedIn(page)) return;

  if (!interactive) {
    throw new Error(
      'Klaviyo session expired. Run `npm run login` to re-authenticate.',
    );
  }

  console.log('\n=== LOGIN MANUAL ===');
  console.log('1. Faça login no Klaviyo no Chromium que acabou de abrir');
  console.log('2. Complete 2FA se pedido');
  console.log('3. Quando chegar no dashboard, o script detecta e fecha sozinho');
  console.log('Timeout: 10min — depois disso aborta.');
  console.log('=====================\n');

  await page.goto(`${KLAVIYO_BASE}/login`, { waitUntil: 'domcontentloaded' });

  // Polling: checa URL a cada 3s, max 10min
  const startedAt = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000;
  const POLL_INTERVAL = 3000;
  while (Date.now() - startedAt < TIMEOUT_MS) {
    await page.waitForTimeout(POLL_INTERVAL);
    const url = page.url();
    if (
      !url.includes('/login') &&
      !url.includes('/auth') &&
      (url.includes('klaviyo.com/dashboard') ||
        url.includes('klaviyo.com/flows') ||
        url.includes('klaviyo.com/campaigns') ||
        url.includes('klaviyo.com/lists') ||
        url.match(/klaviyo\.com\/[a-z0-9-]+\/?(\?|$)/))
    ) {
      console.log(`Login detectado: ${url}`);
      console.log('OK — sessão salva em profile/');
      return;
    }
  }
  throw new Error('Timeout 10min — login não detectado. Re-run npm run login.');
}
