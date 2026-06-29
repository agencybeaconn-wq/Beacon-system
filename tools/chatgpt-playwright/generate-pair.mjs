// generate-pair.mjs — Gera 9:16 + 1:1 da mesma arte no MESMO chat.
//
// Fluxo:
//   1. Abre chat novo, anexa refs
//   2. Envia prompt 9:16 → aguarda → baixa
//   3. Envia "Agora gere na 1:1" → aguarda → baixa
//   4. Fecha
//
// Como usar:
//   node generate-pair.mjs \
//     --prompt-9x16 "..." \
//     --prompt-1x1 "Agora gere a mesma arte na proporção 1:1 (formato quadrado, feed Instagram), mantendo todos os elementos visuais e textuais." \
//     --ref ./inputs/a.jpg --ref ./inputs/b.png ... \
//     --out-9x16 ./output/v01-9x16.png \
//     --out-1x1 ./output/v01-1x1.png \
//     --timeout 360000 --debug

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '.session');

// ---------- args ----------
const args = process.argv.slice(2);
const argMap = {};
const refs = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--ref') { refs.push(args[++i]); continue; }
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const val = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[++i] : 'true';
    argMap[key] = val;
  }
}

const PROMPT_9x16 = argMap['prompt-9x16'];
const PROMPT_1x1 = argMap['prompt-1x1'] || 'Agora gere a mesma arte na proporção 1:1 (formato quadrado, feed Instagram), mantendo todos os elementos visuais e textuais idênticos. Só ajuste a composição para caber no formato quadrado.';
const OUT_9x16 = argMap['out-9x16'];
const OUT_1x1 = argMap['out-1x1'];
const TIMEOUT = parseInt(argMap.timeout || '240000', 10);
const DEBUG = argMap.debug === 'true';

if (!PROMPT_9x16 || !OUT_9x16 || !OUT_1x1) {
  console.error('❌ Faltam args. Necessários: --prompt-9x16, --out-9x16, --out-1x1');
  process.exit(1);
}
if (!existsSync(SESSION_DIR)) {
  console.error('❌ Sessão não existe. Rode: npm run login');
  process.exit(1);
}
mkdirSync(path.dirname(OUT_9x16), { recursive: true });
mkdirSync(path.dirname(OUT_1x1), { recursive: true });

const log = (...a) => DEBUG && console.log('[debug]', ...a);

// ---------- launch ----------
const browser = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = browser.pages()[0] || await browser.newPage();

async function dismissModals() {
  const dismissTexts = ['Got it', 'Stay logged out', "Okay, let's go", 'Continue', 'Maybe later', 'Not now', 'Dismiss', 'Close'];
  for (const txt of dismissTexts) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(txt, 'i') });
      if (await btn.first().isVisible({ timeout: 500 })) {
        await btn.first().click({ timeout: 2000 });
        await page.waitForTimeout(500);
      }
    } catch {}
  }
}

async function findEditor() {
  return page.locator('#prompt-textarea, div.ProseMirror[contenteditable="true"]').first();
}

async function findSendBtn() {
  return page.locator('button[data-testid="send-button"], button[data-testid="composer-send-button"], button[aria-label*="Send" i]').first();
}

async function captureUrlSnapshot() {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img'))
      .map(img => img.getAttribute('src') || '')
      .filter(Boolean);
  });
}

async function waitForNewImage(preExisting, timeoutMs) {
  const started = Date.now();
  let imageUrl = null;
  let lastDebug = null;
  while (Date.now() - started < timeoutMs) {
    const result = await page.evaluate((preExisting) => {
      const ignoreSet = new Set(preExisting);
      const allImgs = Array.from(document.querySelectorAll('img'));
      const candidates = allImgs
        .filter(img => {
          const src = img.getAttribute('src') || '';
          if (!src) return false;
          if (src.startsWith('data:')) return false;
          if (src.startsWith('blob:')) return false;
          if (ignoreSet.has(src)) return false;
          return true;
        })
        .filter(img => img.naturalWidth >= 400 && img.offsetWidth >= 200)
        .map(img => ({ src: img.getAttribute('src'), w: img.naturalWidth, h: img.naturalHeight }))
        .sort((a, b) => b.w - a.w);
      return {
        url: candidates[0]?.src || null,
        newImgs: allImgs.length - preExisting.length,
        reason: candidates.length === 0
          ? `${allImgs.length} imgs, 0 novas e grandes (gerando…)`
          : 'achou!',
      };
    }, preExisting);
    lastDebug = result;
    if (result.url) { imageUrl = result.url; break; }
    log('aguardando…', result.reason);
    await page.waitForTimeout(2000);
  }
  return { imageUrl, lastDebug };
}

async function downloadImage(url, outPath) {
  const buffer = await page.evaluate(async (url) => {
    const r = await fetch(url);
    const b = await r.arrayBuffer();
    return Array.from(new Uint8Array(b));
  }, url);
  await fs.writeFile(outPath, Buffer.from(buffer));
}

async function typeAndSend(prompt) {
  const editor = await findEditor();
  await editor.click();
  await page.waitForTimeout(300);
  await editor.pressSequentially(prompt, { delay: 5 });
  await page.waitForTimeout(500);
  const sendBtn = await findSendBtn();
  try {
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.click();
  } catch {
    log('fallback: Enter');
    await editor.press('Enter');
  }
}

// ---------- main ----------
console.log('🌐 Abrindo chat novo…');
await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// força chat novo
try {
  const newChatBtn = page.locator(
    'a[href="/"], button:has-text("Novo chat"), button:has-text("New chat"), [data-testid="create-new-chat-button"], a[data-discover="true"][href="/"]'
  ).first();
  if (await newChatBtn.isVisible({ timeout: 3000 })) {
    await newChatBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
  }
} catch {}

await dismissModals();

const editor = await findEditor();
await editor.waitFor({ state: 'visible', timeout: 30000 });

// upload refs (uma vez só, ficam no chat)
if (refs.length) {
  console.log(`📎 Anexando ${refs.length} ref(s)…`);
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(refs.map(r => path.resolve(r)));
  await page.waitForTimeout(3000);
}

// ===== ETAPA 1: 9:16 =====
console.log('✍️  [1/2] Digitando prompt 9:16…');
const snapshot1 = await captureUrlSnapshot();
log(`snapshot: ${snapshot1.length} imgs pré-existentes`);
await typeAndSend(PROMPT_9x16);

console.log(`⏳ [1/2] Aguardando 9:16 (timeout ${TIMEOUT/1000}s)…`);
const r1 = await waitForNewImage(snapshot1, TIMEOUT);
if (!r1.imageUrl) {
  console.error('❌ Timeout no 9:16.');
  console.error('   Debug:', JSON.stringify(r1.lastDebug, null, 2));
  await page.screenshot({ path: OUT_9x16.replace(/\.png$/, '-error.png'), fullPage: true });
  await browser.close();
  process.exit(2);
}
console.log('🖼️  [1/2] Baixando 9:16…');
await downloadImage(r1.imageUrl, OUT_9x16);
console.log(`✅ Salvo: ${OUT_9x16}`);

// ===== ETAPA 2: 1:1 (mesmo chat) =====
console.log('✍️  [2/2] Digitando prompt 1:1…');
const snapshot2 = await captureUrlSnapshot();
log(`snapshot: ${snapshot2.length} imgs pré-existentes (incluindo a 9:16 anterior)`);
await typeAndSend(PROMPT_1x1);

console.log(`⏳ [2/2] Aguardando 1:1 (timeout ${TIMEOUT/1000}s)…`);
const r2 = await waitForNewImage(snapshot2, TIMEOUT);
if (!r2.imageUrl) {
  console.error('❌ Timeout no 1:1 (mas 9:16 já foi baixada).');
  console.error('   Debug:', JSON.stringify(r2.lastDebug, null, 2));
  await page.screenshot({ path: OUT_1x1.replace(/\.png$/, '-error.png'), fullPage: true });
  await browser.close();
  process.exit(3);
}
console.log('🖼️  [2/2] Baixando 1:1…');
await downloadImage(r2.imageUrl, OUT_1x1);
console.log(`✅ Salvo: ${OUT_1x1}`);

await browser.close();
console.log('\n🎉 Par completo!');
