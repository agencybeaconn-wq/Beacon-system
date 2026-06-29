#!/usr/bin/env node
// clone-prompts — passo 2 do pipeline /clone-theme.
//
// 3 perguntas estruturadas (Pré-Execução / JEB):
//   1. Escopo: minimal | full | custom
//   2. Substituições preventivas: fontes pagas, copyright, animações JS
//   3. Critério de pronto: theme check / + visual diff / + revisão externa
//
// Salva respostas em .clone-meta.json:
//   { opts: { scope, subs: {paid_fonts, copyright, js_animations}, gate } }
//
// Modos:
//   - Interativo (default): readline
//   - Auto via flags: --scope=full --subs=paid_fonts,copyright,js_animations --gate=preview

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const args = { slug: null, scope: null, subs: null, gate: null, force: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--scope=')) args.scope = a.slice(8);
    else if (a.startsWith('--subs=')) args.subs = a.slice(7);
    else if (a.startsWith('--gate=')) args.gate = a.slice(7);
    else if (a === '--force') args.force = true;
    else if (!a.startsWith('--')) args.slug = a;
  }
  return args;
}

function ask(rl, q) {
  return new Promise(resolve => rl.question(q, ans => resolve(ans.trim())));
}

async function interactive(meta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\nClonando: ${meta.url}`);
  console.log(`→ Cliente: ${meta.client_name} (${meta.shop})`);
  console.log(`→ Tema:    ${meta.theme_name}\n`);

  // P1 — escopo
  console.log('1) Escopo das páginas a clonar:');
  console.log('   [a] full     — home + 2 PDPs + 2 PLPs + cart + 5 pages + blog (~15)');
  console.log('   [b] minimal  — home + 1 PDP + 1 PLP + cart + 3 pages (~8)');
  console.log('   [c] custom   — você lista URLs depois');
  let scope = '';
  while (!['a', 'b', 'c'].includes(scope)) {
    scope = (await ask(rl, '   Resposta [a]: ')) || 'a';
    scope = scope.toLowerCase().charAt(0);
  }
  const scopeMap = { a: 'full', b: 'minimal', c: 'custom' };

  // P2 — substituições
  console.log('\n2) Substituições preventivas (Bloco 3 / O QUE NÃO QUERO):');
  const paidFonts = (await ask(rl, '   Fontes pagas → substituir por Geist? [S/n]: ')) || 's';
  const copyright = (await ask(rl, '   Imagens com copyright → flagar e parar pra revisar? [S/n]: ')) || 's';
  const jsAnim = (await ask(rl, '   Animações JS (GSAP/Lottie) → converter pra CSS simples? [S/n]: ')) || 's';

  // P3 — gate
  console.log('\n3) Como você sabe que terminou?');
  console.log('   [a] theme check 0 errors + preview offline (default)');
  console.log('   [b] acima + diff visual automático (screenshot clone vs alvo)');
  console.log('   [c] acima + revisão de 1 pessoa externa antes do upload');
  let gate = '';
  while (!['a', 'b', 'c'].includes(gate)) {
    gate = (await ask(rl, '   Resposta [a]: ')) || 'a';
    gate = gate.toLowerCase().charAt(0);
  }
  const gateMap = { a: 'preview', b: 'preview+diff', c: 'preview+diff+review' };

  rl.close();

  return {
    scope: scopeMap[scope],
    subs: {
      paid_fonts: paidFonts.toLowerCase().startsWith('s'),
      copyright: copyright.toLowerCase().startsWith('s'),
      js_animations: jsAnim.toLowerCase().startsWith('s'),
    },
    gate: gateMap[gate],
  };
}

function fromFlags(args) {
  const scope = args.scope || 'full';
  if (!['minimal', 'full', 'custom'].includes(scope)) {
    throw new Error(`--scope inválido: ${scope}. Use minimal|full|custom`);
  }
  const subsList = (args.subs || 'paid_fonts,copyright,js_animations').split(',').map(s => s.trim()).filter(Boolean);
  const subs = {
    paid_fonts: subsList.includes('paid_fonts'),
    copyright: subsList.includes('copyright'),
    js_animations: subsList.includes('js_animations'),
  };
  const gate = args.gate || 'preview';
  if (!['preview', 'preview+diff', 'preview+diff+review'].includes(gate)) {
    throw new Error(`--gate inválido: ${gate}`);
  }
  return { scope, subs, gate };
}

async function main() {
  const args = parseArgs();
  console.log('\n=== clone-prompts ===');

  if (!args.slug) {
    console.error('Uso: node clone-prompts.mjs <slug> [--scope=...] [--subs=...] [--gate=...] [--force]');
    process.exit(1);
  }

  const metaPath = path.join(REPO_ROOT, 'themes', 'clones', args.slug, '.clone-meta.json');
  if (!fs.existsSync(metaPath)) {
    console.error(`Não achei ${metaPath}. Rode clone-validate.mjs antes.`);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  if (meta.opts && !args.force && !args.scope && !args.subs && !args.gate) {
    console.log('Opts já configurados:');
    console.log(`   scope: ${meta.opts.scope}`);
    console.log(`   subs:  ${JSON.stringify(meta.opts.subs)}`);
    console.log(`   gate:  ${meta.opts.gate}`);
    console.log('(use --force pra reconfigurar)');
    console.log(`\nPróximo: node .claude/skills/clone-theme/clone-discover.mjs ${args.slug}\n`);
    return;
  }

  const useFlags = args.scope || args.subs || args.gate;
  const opts = useFlags ? fromFlags(args) : await interactive(meta);

  meta.opts = opts;
  meta.phase = 'configured';
  meta.updated_at = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  console.log('\n✓ Configurado:');
  console.log(`   scope: ${opts.scope}`);
  console.log(`   subs:  paid_fonts=${opts.subs.paid_fonts}, copyright=${opts.subs.copyright}, js_animations=${opts.subs.js_animations}`);
  console.log(`   gate:  ${opts.gate}`);
  console.log(`\nPróximo: node .claude/skills/clone-theme/clone-discover.mjs ${args.slug}\n`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
