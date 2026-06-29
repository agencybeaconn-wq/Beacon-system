// gerar-tudo-num-chat.mjs — 5 variações × (9:16 + 1:1) = 10 imagens NUM ÚNICO CHAT.
//
// FILOSOFIA (refino 2026-05-27): prompts CIRÚRGICOS, não briefing.
//   - V1 (base): comandos diretos "troque X / remova Y / adicione Z" — imagens carregam o contexto visual.
//   - V2-V5: cada uma muda UM eixo da V1, sem criar cenário novo. Referenciam V1-9:16 explicitamente
//     pra não contaminar com a 1:1 intermediária.
//   - Frase de conversão 9:16→1:1 é LITERAL E TRAVADA — não parafrasear.
//
// Fluxo:
//   1. Abre 1 chat só, anexa refs uma vez
//   2. Loop 5 variações:
//      a. Manda prompt 9:16 da variação N → aguarda → baixa
//      b. Manda frase travada "Apenas adapte essa arte gerada acima para a proporção 1:1" → aguarda → baixa
//   3. Fecha browser
//
// Se uma variação falhar (timeout), loga e continua a próxima.
//
// Como usar:
//   node gerar-tudo-num-chat.mjs \
//     --base-prompt-file ./prompts/brasil-puskas.txt \
//     --ref ./inputs/referencia.jpg --ref ./inputs/logo-puskas.png ... \
//     --out-dir ./output/brasil-puskas-XXX/ \
//     --timeout 300000

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

let BASE_PROMPT = argMap['base-prompt'];
if (argMap['base-prompt-file']) {
  BASE_PROMPT = (await fs.readFile(argMap['base-prompt-file'], 'utf-8')).trim();
}
const OUT_DIR = argMap['out-dir'] || `./output/variacoes-${Date.now()}/`;
const TIMEOUT = parseInt(argMap.timeout || '300000', 10);
const START_AT = parseInt(argMap['start-at'] || '1', 10);

if (!BASE_PROMPT) {
  console.error('❌ --base-prompt ou --base-prompt-file obrigatório');
  process.exit(1);
}
if (!existsSync(SESSION_DIR)) {
  console.error('❌ Sessão não existe. Rode: npm run login');
  process.exit(1);
}
await fs.mkdir(OUT_DIR, { recursive: true });

// ---------- VARIAÇÕES (angle-driven) ----------
// V1 = arte base validada (controle, INTOCADA). V2-V10 NÃO são mais variações cosméticas:
// cada uma muda a MENSAGEM/headline/emoção → vira um Entity ID distinto no Andromeda
// (artes visualmente iguais o algoritmo colapsa em ~1, desperdiçando exploração).
// Todas mantêm logo + fotos do produto + cores do time + idioma; muda SÓ o ângulo.
// Exemplos abaixo são contexto camisa de futebol — o chat já sabe o time/loja pela V1.
// Matriz Ângulo × Nível de Consciência (Schwartz): Lever QI/03-playbooks/sistema-criativos-meta.md (§3).
const VARIACOES = [
  // V1 — controle (arte validada, intocada)
  {
    instr_9x16: BASE_PROMPT,
    label: 'BASE — arte validada adaptada (controle)',
  },
  // V2 — cutuca a ferida / saudade (N1-2, frio, indireta)
  {
    instr_9x16: `Agora gere uma NOVA VARIAÇÃO da arte base original (a primeira que você gerou, em 9:16 — não a quadrada). MUDE O ÂNGULO para EMOÇÃO/SAUDADE (torcedor frio, nível 1-2): o título principal NÃO é sobre oferta — cutuca uma ferida ou saudade do torcedor (ex.: "Tem torcedor que parou no último título" / "Lembra da última vez que o estádio explodiu?"). A oferta entra discreta no rodapé, não como protagonista. Mantenha logo da loja, fotos do produto, cores do time e idioma idênticos — muda só a mensagem e o tom. Proporção 9:16.`,
    label: 'Cutuca a ferida / saudade — N1-2 (frio)',
  },
  // V3 — desafia o senso comum (N2-3)
  {
    instr_9x16: `Agora gere outra NOVA VARIAÇÃO da arte base original (9:16). MUDE O ÂNGULO para DESAFIAR O SENSO COMUM (nível 2-3): título com uma verdade contraintuitiva sobre camisa de torcedor (ex.: "A diferença entre a oficial e a 'parecida' não é o preço" / "Por que a camisa mais barata sai mais cara"). Mantenha logo, fotos do produto, cores do time e idioma idênticos. Proporção 9:16.`,
    label: 'Desafia o senso comum — N2-3',
  },
  // V4 — identidade / pertencimento (N2-3)
  {
    instr_9x16: `Agora gere outra NOVA VARIAÇÃO da arte base original (9:16). MUDE O ÂNGULO para IDENTIDADE/PERTENCIMENTO (nível 2-3): título que rotula a identidade do torcedor usando o apelido da torcida (ex.: "Tem manto que é mais que camisa, é parte do cara"). Foco no orgulho de vestir, não na oferta. Mantenha logo, fotos do produto, cores do time e idioma idênticos. Proporção 9:16.`,
    label: 'Identidade / pertencimento — N2-3',
  },
  // V5 — prova social (N3-4)
  {
    instr_9x16: `Agora gere outra NOVA VARIAÇÃO da arte base original (9:16). MUDE O ÂNGULO para PROVA SOCIAL (nível 3-4): inclua na arte um selo de avaliação (ex.: "⭐ 4,9 — +5 mil torcedores") ou um depoimento curto de cliente em destaque, reforçando confiança e qualidade. Mantenha logo, fotos do produto, cores do time e idioma idênticos. Proporção 9:16.`,
    label: 'Prova social / depoimento — N3-4',
  },
  // V6 — oferta direta + urgência real (N4-5, quente)
  {
    instr_9x16: `Agora gere outra NOVA VARIAÇÃO da arte base original (9:16). MUDE O ÂNGULO para OFERTA DIRETA + URGÊNCIA REAL (nível 4-5, público quente): a promoção principal em destaque máximo + um selo de urgência VERDADEIRA ("últimas unidades", "só até domingo"). Direto ao ponto. NÃO inventar escassez falsa. Mantenha logo, fotos do produto, cores do time e idioma idênticos. Proporção 9:16.`,
    label: 'Oferta direta + urgência real — N4-5 (quente)',
  },
  // V7 — ancoragem de preço / valor (N3)
  {
    instr_9x16: `Agora gere outra NOVA VARIAÇÃO da arte base original (9:16). MUDE O ÂNGULO para ANCORAGEM DE PREÇO/VALOR (nível 3): comunicar que o torcedor leva a mesma qualidade por uma fração do preço da oficial de loja física (ex.: comparação "de R$X por R$Y" ou "qualidade de oficial, sem o preço de oficial"). Sem denegrir marca nenhuma. Mantenha logo, fotos do produto, cores do time e idioma idênticos. Proporção 9:16.`,
    label: 'Ancoragem de preço / valor — N3',
  },
  // V8 — contraste emocional / antes-depois (N2-3)
  {
    instr_9x16: `Agora gere outra NOVA VARIAÇÃO da arte base original (9:16). MUDE O ÂNGULO para CONTRASTE EMOCIONAL (nível 2-3, emotional delta): composição que contrasta "antes" (arquibancada/peito sem o manto) e "depois" (vestindo, fazendo parte). Título que reforce o pertencimento conquistado. Mantenha logo, fotos do produto, cores do time e idioma idênticos. Proporção 9:16.`,
    label: 'Contraste emocional (antes/depois) — N2-3',
  },
  // V9 — curiosidade / loop aberto (N1-2)
  {
    instr_9x16: `Agora gere outra NOVA VARIAÇÃO da arte base original (9:16). MUDE O ÂNGULO para CURIOSIDADE / LOOP ABERTO (nível 1-2): título que abre um loop e faz querer saber mais (ex.: "O detalhe dessa camisa que só quem é da torcida percebe" / "Tem um motivo dessa camisa estar saindo tão rápido"). Não entregar tudo no título. Mantenha logo, fotos do produto, cores do time e idioma idênticos. Proporção 9:16.`,
    label: 'Curiosidade / loop aberto — N1-2',
  },
  // V10 — auto-seleção "se você…" (N2-3)
  {
    instr_9x16: `Agora gere outra NOVA VARIAÇÃO da arte base original (9:16). MUDE O ÂNGULO para AUTO-SELEÇÃO "SE VOCÊ…" (nível 2-3): título que identifica direto o público pelo apelido da torcida (ex.: "Se você é [apelido] de verdade, esse manto é seu"). Esse padrão também ajuda o algoritmo da Meta a achar o público certo. Mantenha logo, fotos do produto, cores do time e idioma idênticos. Proporção 9:16.`,
    label: '"Se você…" (auto-seleção) — N2-3',
  },
];

// Frase de conversão 9:16 → 1:1 — LITERAL E TRAVADA (não reescrever).
const PROMPT_1x1 = 'Apenas adapte essa arte gerada acima para a proporção 1:1';

// ---------- helpers ----------
const log = (...a) => console.log('[debug]', ...a);

async function dismissModals(page) {
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

async function captureUrlSnapshot(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img'))
      .map(img => img.getAttribute('src') || '')
      .filter(Boolean);
  });
}

async function waitForNewImage(page, preExisting, timeoutMs) {
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
        .map(img => ({ src: img.getAttribute('src'), w: img.naturalWidth }))
        .sort((a, b) => b.w - a.w);
      return {
        url: candidates[0]?.src || null,
        totalImgs: allImgs.length,
        newCount: candidates.length,
      };
    }, preExisting);
    lastDebug = result;
    if (result.url) { imageUrl = result.url; break; }
    await page.waitForTimeout(2000);
  }
  return { imageUrl, lastDebug };
}

async function downloadImage(page, url, outPath) {
  const buffer = await page.evaluate(async (url) => {
    const r = await fetch(url);
    const b = await r.arrayBuffer();
    return Array.from(new Uint8Array(b));
  }, url);
  await fs.writeFile(outPath, Buffer.from(buffer));
}

async function typeAndSend(page, prompt) {
  const editor = page.locator('#prompt-textarea, div.ProseMirror[contenteditable="true"]').first();
  await editor.waitFor({ state: 'visible', timeout: 15000 });
  await editor.click();
  await page.waitForTimeout(300);

  // FIX 2026-05-27: limpar editor antes de digitar.
  // Sem isso, texto residual de chats anteriores (mesma sessão Chromium) fica no ProseMirror
  // e pressSequentially insere o novo texto NO MEIO do antigo → prompt Frankenstein.
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(200);

  // FIX 2026-05-27: preservar quebras de linha do prompt.
  // No contenteditable do ChatGPT, \n é ignorado pelo pressSequentially. Pra quebrar linha
  // sem enviar a mensagem é preciso Shift+Enter explícito. Digito linha a linha intercalando.
  const lines = prompt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 0) {
      await editor.pressSequentially(lines[i], { delay: 3 });
    }
    if (i < lines.length - 1) {
      await page.keyboard.press('Shift+Enter');
    }
  }
  await page.waitForTimeout(500);

  const sendBtn = page.locator('button[data-testid="send-button"], button[data-testid="composer-send-button"], button[aria-label*="Send" i]').first();
  try {
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.click();
  } catch {
    log('fallback Enter');
    await editor.press('Enter');
  }
}

// ---------- launch ----------
console.log(`\n🎨 Iniciando ${VARIACOES.length - (START_AT - 1)} variações × 2 formatos = ${(VARIACOES.length - (START_AT - 1)) * 2} imagens`);
console.log(`📂 Output: ${OUT_DIR}`);
console.log(`📎 Refs: ${refs.length} arquivos\n`);

const startedAt = Date.now();
const results = [];

const browser = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = browser.pages()[0] || await browser.newPage();

try {
  // abre chat novo
  console.log('🌐 Abrindo ChatGPT…');
  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // força chat novo
  try {
    const newChatBtn = page.locator(
      'a[href="/"], button:has-text("Novo chat"), button:has-text("New chat"), [data-testid="create-new-chat-button"]'
    ).first();
    if (await newChatBtn.isVisible({ timeout: 3000 })) {
      await newChatBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1500);
    }
  } catch {}

  await dismissModals(page);

  const editor = page.locator('#prompt-textarea, div.ProseMirror[contenteditable="true"]').first();
  await editor.waitFor({ state: 'visible', timeout: 30000 });

  // anexa refs UMA vez só
  if (refs.length) {
    console.log(`📎 Anexando ${refs.length} ref(s) (uma vez só)…`);
    const fileInput = await page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(refs.map(r => path.resolve(r)));
    await page.waitForTimeout(4000);
  }

  // ===== LOOP DAS 10 VARIAÇÕES =====
  for (let i = START_AT - 1; i < VARIACOES.length; i++) {
    const num = i + 1;
    const numStr = String(num).padStart(2, '0');
    const v = VARIACOES[i];
    const out9x16 = path.join(OUT_DIR, `v${numStr}-9x16.png`);
    const out1x1 = path.join(OUT_DIR, `v${numStr}-1x1.png`);

    console.log(`\n══════ V${numStr}/${VARIACOES.length}: ${v.label} ══════`);
    const tStart = Date.now();

    // -------- 9:16 --------
    console.log(`✍️  [V${numStr} 9:16] enviando prompt…`);
    const snap1 = await captureUrlSnapshot(page);
    try {
      await typeAndSend(page, v.instr_9x16);
    } catch (e) {
      console.error(`❌ V${numStr} 9:16: erro digitando — ${e.message}`);
      results.push({ v: num, label: v.label, status: 'falha (digitar 9:16)' });
      continue;
    }

    console.log(`⏳ [V${numStr} 9:16] aguardando geração (timeout ${TIMEOUT/1000}s)…`);
    const r1 = await waitForNewImage(page, snap1, TIMEOUT);
    if (!r1.imageUrl) {
      console.error(`❌ V${numStr} 9:16: timeout`);
      try { await page.screenshot({ path: out9x16.replace(/\.png$/, '-error.png'), fullPage: true }); } catch {}
      results.push({ v: num, label: v.label, status: 'falha (timeout 9:16)' });
      continue;
    }
    try {
      await downloadImage(page, r1.imageUrl, out9x16);
      console.log(`✅ [V${numStr} 9:16] salvo: ${path.basename(out9x16)}`);
    } catch (e) {
      console.error(`❌ V${numStr} 9:16: erro baixando — ${e.message}`);
      results.push({ v: num, label: v.label, status: 'falha (download 9:16)' });
      continue;
    }

    // -------- 1:1 --------
    await page.waitForTimeout(2000);
    console.log(`✍️  [V${numStr} 1:1] enviando "agora na 1:1"…`);
    const snap2 = await captureUrlSnapshot(page);
    try {
      await typeAndSend(page, PROMPT_1x1);
    } catch (e) {
      console.error(`❌ V${numStr} 1:1: erro digitando — ${e.message}`);
      results.push({ v: num, label: v.label, status: 'parcial (só 9:16)' });
      continue;
    }

    console.log(`⏳ [V${numStr} 1:1] aguardando geração…`);
    const r2 = await waitForNewImage(page, snap2, TIMEOUT);
    if (!r2.imageUrl) {
      console.error(`❌ V${numStr} 1:1: timeout`);
      try { await page.screenshot({ path: out1x1.replace(/\.png$/, '-error.png'), fullPage: true }); } catch {}
      results.push({ v: num, label: v.label, status: 'parcial (só 9:16, timeout 1:1)' });
      continue;
    }
    try {
      await downloadImage(page, r2.imageUrl, out1x1);
      console.log(`✅ [V${numStr} 1:1] salvo: ${path.basename(out1x1)}`);
    } catch (e) {
      console.error(`❌ V${numStr} 1:1: erro baixando — ${e.message}`);
      results.push({ v: num, label: v.label, status: 'parcial (só 9:16, download 1:1 falhou)' });
      continue;
    }

    const elapsed = ((Date.now() - tStart) / 1000).toFixed(0);
    results.push({ v: num, label: v.label, status: 'ok', tempo: elapsed + 's' });
    console.log(`🎉 V${numStr} completa em ${elapsed}s`);

    // pequena pausa entre variações
    if (i < VARIACOES.length - 1) {
      await page.waitForTimeout(3000);
    }
  }
} catch (e) {
  console.error(`\n💥 Erro fatal: ${e.message}`);
  console.error(e.stack);
} finally {
  await browser.close();
}

// ---------- resumo ----------
const totalMin = ((Date.now() - startedAt) / 60000).toFixed(1);
const ok = results.filter(r => r.status === 'ok').length;
const parcial = results.filter(r => r.status.includes('parcial')).length;
const fail = results.filter(r => r.status.includes('falha')).length;

console.log(`\n${'═'.repeat(60)}`);
console.log(`🏁 FIM — ${totalMin} min total`);
console.log(`${'═'.repeat(60)}`);
console.log(`✅ ${ok} completas (9:16 + 1:1)`);
console.log(`⚠️  ${parcial} parciais (só 9:16)`);
console.log(`❌ ${fail} falhas totais`);
console.log(`\nDetalhes:`);
for (const r of results) {
  console.log(`  V${String(r.v).padStart(2, '0')} (${r.label}): ${r.status}${r.tempo ? ' [' + r.tempo + ']' : ''}`);
}
console.log(`\n📂 Imagens em: ${OUT_DIR}`);

await fs.writeFile(
  path.join(OUT_DIR, '_resumo.json'),
  JSON.stringify({ ok, parcial, fail, totalMin: parseFloat(totalMin), results }, null, 2)
);
