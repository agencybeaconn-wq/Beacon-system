// login.mjs — Abre browser pra você logar manualmente uma vez.
// A sessão fica salva em ./.session/ e é reusada pelos outros scripts.
//
// Como usar:
//   1. node login.mjs
//   2. Loga normalmente no ChatGPT (Google, email, etc)
//   3. Quando ver a tela inicial do chat, volta no terminal e aperta ENTER
//   4. Sessão salva. Não precisa rodar de novo enquanto cookie estiver válido (~30 dias).

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '.session');

const browser = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = browser.pages()[0] || await browser.newPage();
await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });

console.log('\n👉 Faça login no ChatGPT na janela aberta.');
console.log('👉 Quando aparecer o campo de chat com "Ask anything", aperte ENTER aqui no terminal.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await new Promise(resolve => rl.question('', resolve));
rl.close();

console.log(`✅ Sessão salva em ${SESSION_DIR}`);
console.log('Agora você pode rodar: node generate.mjs');
await browser.close();
