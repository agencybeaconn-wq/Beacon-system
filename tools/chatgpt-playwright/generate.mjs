// generate.mjs — Manda um prompt (com imagens de referência opcionais) e baixa a imagem gerada.
//
// Como usar:
//   node generate.mjs --prompt "transforme essa camisa em modelo posando estilo editorial" \
//                     --ref ./inputs/camisa-brasil.png \
//                     --out ./output/brasil-editorial.png
//
// Flags:
//   --prompt     Texto do prompt (obrigatório)
//   --ref        Caminho de imagem de referência (opcional, pode repetir múltiplas vezes)
//   --out        Caminho de saída (default: ./output/gen-{timestamp}.png)
//   --headed     Mostra o browser (default: roda visível; use --no-headed pra rodar headless)
//   --timeout    Timeout em ms pra geração (default: 240000 = 4min)
//   --debug      Loga steps intermediários
//   --keep-open  Em caso de erro/timeout, deixa o navegador aberto pra inspecionar

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '.session');
const OUTPUT_DIR = path.join(__dirname, 'output');

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

const PROMPT = argMap.prompt;
if (!PROMPT) {
  console.error('❌ --prompt é obrigatório');
  process.exit(1);
}
const OUT_PATH = argMap.out || path.join(OUTPUT_DIR, `gen-${Date.now()}.png`);
const HEADED = argMap.headed !== 'false';
const TIMEOUT = parseInt(argMap.timeout || '240000', 10);
const DEBUG = argMap.debug === 'true';
const KEEP_OPEN = argMap['keep-open'] === 'true';

if (!existsSync(SESSION_DIR)) {
  console.error('❌ Sessão não existe. Roda primeiro: node login.mjs');
  process.exit(1);
}
mkdirSync(path.dirname(OUT_PATH), { recursive: true });

const log = (...a) => DEBUG && console.log('[debug]', ...a);

// ---------- launch ----------
const browser = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: !HEADED,
  viewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = browser.pages()[0] || await browser.newPage();

console.log('🌐 Abrindo chat novo…');
await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// ---------- garante chat zerado (clica "Novo chat") ----------
log('forçando chat novo…');
try {
  // Tenta múltiplos seletores pro botão "Novo chat" / "New chat"
  const newChatBtn = page.locator(
    'a[href="/"], button:has-text("Novo chat"), button:has-text("New chat"), [data-testid="create-new-chat-button"], a[data-discover="true"][href="/"]'
  ).first();
  if (await newChatBtn.isVisible({ timeout: 3000 })) {
    await newChatBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    log('chat zerado');
  }
} catch (e) {
  log('botão "Novo chat" não encontrado, seguindo no estado atual');
}

// ---------- fecha modais/pop-ups que possam aparecer ----------
async function dismissModals() {
  // Tenta fechar coisas comuns: "Stay logged out", "What's new", "Got it", "Continue", "X"
  const dismissTexts = ['Got it', 'Stay logged out', 'Okay, let\'s go', 'Continue', 'Maybe later', 'Not now', 'Dismiss', 'Close'];
  for (const txt of dismissTexts) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(txt, 'i') });
      if (await btn.first().isVisible({ timeout: 500 })) {
        log(`fechando modal: "${txt}"`);
        await btn.first().click({ timeout: 2000 });
        await page.waitForTimeout(500);
      }
    } catch {}
  }
  // Fecha botão de fechar genérico (X) de modais
  try {
    const closeBtn = page.locator('[aria-label="Close" i], button[aria-label*="dismiss" i]');
    if (await closeBtn.first().isVisible({ timeout: 500 })) {
      await closeBtn.first().click({ timeout: 2000 });
      await page.waitForTimeout(500);
    }
  } catch {}
}
await dismissModals();

// ---------- espera campo de prompt visível ----------
log('esperando campo de prompt aparecer…');
const editor = page.locator('#prompt-textarea, div.ProseMirror[contenteditable="true"]').first();
await editor.waitFor({ state: 'visible', timeout: 30000 });

// ---------- upload refs ----------
if (refs.length) {
  console.log(`📎 Anexando ${refs.length} ref(s)…`);
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(refs.map(r => path.resolve(r)));
  await page.waitForTimeout(3000);
  log('refs anexados');
}

// ---------- digita prompt ----------
console.log('✍️  Digitando prompt…');
await editor.click();
await page.waitForTimeout(300);
// pressSequentially digita tecla por tecla (mais confiável que .fill em contenteditable)
await editor.pressSequentially(PROMPT, { delay: 10 });
await page.waitForTimeout(500);

// ---------- snapshot de imagens ANTES de enviar ----------
// Toda imagem que JÁ existe na página (ícones, GPTs, avatares) vai pro snapshot.
// Depois do prompt, só consideramos imagens NOVAS.
const preExistingUrls = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('img'))
    .map(img => img.getAttribute('src') || '')
    .filter(Boolean);
});
log(`snapshot: ${preExistingUrls.length} imgs pré-existentes ignoradas`);

// ---------- envia ----------
console.log('🚀 Enviando…');
const sendBtn = page.locator('button[data-testid="send-button"], button[data-testid="composer-send-button"], button[aria-label*="Send" i]').first();
try {
  await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
  await sendBtn.click();
} catch {
  log('fallback: Enter');
  await editor.press('Enter');
}

// ---------- aguarda geração ----------
console.log(`⏳ Aguardando geração (timeout ${TIMEOUT / 1000}s)…`);
const started = Date.now();

// Estratégia: poll pela MAIOR <img> da página INTEIRA.
// Não depende de selectors do ChatGPT (que mudam toda hora).
// Imagem gerada é tipicamente 1024x1024+, qualquer ícone/avatar é < 200px.
// Refs anexadas pelo user vêm como blob: → ignoradas.
let imageUrl = null;
let lastDebug = null;
const uploadedRefs = new Set(refs.map(r => path.basename(r))); // pra ignorar refs por nome

while (Date.now() - started < TIMEOUT) {
  const result = await page.evaluate((preExisting) => {
    const ignoreSet = new Set(preExisting);
    const allImgs = Array.from(document.querySelectorAll('img'));
    const candidates = allImgs
      .filter(img => {
        const src = img.getAttribute('src') || '';
        if (!src) return false;
        if (src.startsWith('data:')) return false;
        if (src.startsWith('blob:')) return false;
        if (ignoreSet.has(src)) return false; // já existia antes do prompt → ignora
        return true;
      })
      .filter(img => img.naturalWidth >= 400 && img.offsetWidth >= 200) // grande na fonte E visualmente
      .map(img => ({
        src: img.getAttribute('src'),
        w: img.naturalWidth,
        h: img.naturalHeight,
        displayed: img.offsetWidth,
      }))
      .sort((a, b) => b.w - a.w);

    return {
      url: candidates[0]?.src || null,
      totalImgsOnPage: allImgs.length,
      newImgs: allImgs.length - preExisting.length,
      bigCandidates: candidates.length,
      topCandidate: candidates[0] ? { w: candidates[0].w, h: candidates[0].h, displayed: candidates[0].displayed, src: candidates[0].src.slice(0, 80) } : null,
      reason: candidates.length === 0
        ? `${allImgs.length} imgs na página, 0 novas e grandes (gerando ainda…)`
        : 'achou imagem nova!',
    };
  }, preExistingUrls);
  lastDebug = result;
  if (result.url) {
    imageUrl = result.url;
    break;
  }
  log('aguardando…', result.reason);
  await page.waitForTimeout(2000);
}

if (!imageUrl) {
  console.error('❌ Timeout — nenhuma imagem detectada.');
  console.error('   Última inspeção:', JSON.stringify(lastDebug, null, 2));
  await page.screenshot({ path: OUT_PATH.replace(/\.png$/, '-error.png'), fullPage: true });
  console.error('📸 Screenshot salvo pra debug.');
  if (KEEP_OPEN) {
    console.error('🪟 Navegador deixado aberto pra inspeção (--keep-open). Feche manualmente quando terminar.');
  } else {
    await browser.close();
  }
  process.exit(2);
}

console.log('🖼️  Baixando imagem…');
log('url:', imageUrl);

// Baixa via fetch dentro do contexto da página (preserva auth)
const buffer = await page.evaluate(async (url) => {
  const r = await fetch(url);
  const b = await r.arrayBuffer();
  return Array.from(new Uint8Array(b));
}, imageUrl);

await fs.writeFile(OUT_PATH, Buffer.from(buffer));
console.log(`✅ Salvo em ${OUT_PATH}`);

await browser.close();
