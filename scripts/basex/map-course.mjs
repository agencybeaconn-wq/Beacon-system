// Map BaseX EuroClub course structure using Lever Chrome profile (copied to temp)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const USER_DATA = process.env.TEMP + '/chrome-lever-copy';
const OUT_DIR = path.resolve(import.meta.dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ctx = await chromium.launchPersistentContext(USER_DATA, {
  headless: false,
  channel: 'chrome', // use Chrome binary for max compat
  viewport: { width: 1440, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = ctx.pages()[0] || await ctx.newPage();

await page.goto('https://basexeuroclub.astronmembers.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

const title = await page.title();
const url = page.url();
console.log('Title:', title);
console.log('URL:', url);

// Detect login state
const loggedIn = await page.evaluate(() => {
  const text = document.body.innerText.toLowerCase();
  return {
    hasMatheus: text.includes('matheus'),
    hasLogin: text.includes('login') || text.includes('entrar'),
    hasDashboard: text.includes('dashboard') || text.includes('continuar progresso'),
    bodySample: document.body.innerText.slice(0, 500),
  };
});
console.log('Login detect:', JSON.stringify(loggedIn, null, 2));

// Map module cards (carousel items on dashboard)
const modules = await page.evaluate(() => {
  // Look for card-like anchors with titles
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  return anchors
    .map(a => ({
      href: a.href,
      text: (a.innerText || a.textContent || '').trim().slice(0, 200),
      title: a.title || '',
    }))
    .filter(a => a.href && !a.href.endsWith('#') && a.href.includes('astronmembers'))
    .filter(a => a.text.length > 0);
});

console.log(`\n=== Found ${modules.length} anchors ===`);
// Dedupe by href
const seen = new Set();
const unique = modules.filter(m => { if (seen.has(m.href)) return false; seen.add(m.href); return true; });
console.log(`Unique: ${unique.length}`);

fs.writeFileSync(path.join(OUT_DIR, 'dashboard-anchors.json'), JSON.stringify(unique, null, 2));
console.log('\nSaved:', path.join(OUT_DIR, 'dashboard-anchors.json'));

// Also save full HTML for inspection
const html = await page.content();
fs.writeFileSync(path.join(OUT_DIR, 'dashboard.html'), html);
console.log('Saved HTML:', path.join(OUT_DIR, 'dashboard.html'));

console.log('\n--- Sample of unique anchors ---');
unique.slice(0, 30).forEach((m, i) => {
  console.log(`${i+1}. [${m.text.slice(0,60)}] → ${m.href}`);
});

console.log('\n*** Leaving browser open 60s for visual confirm ***');
await page.waitForTimeout(60000);

await ctx.close();
