#!/usr/bin/env node
// template-lint — varre themes/lever-br e themes/lever-en por violações de regra Lever.
// Read-only. Não toca em loja conectada — só os arquivos fonte do repo.

import { readFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');

// Regex unicode pra emoji
const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F2FF}]/gu;

// Handles PT que devem virar EN no tema EN (vem do fix-handles SKILL.md)
const PT_HANDLES_IN_EN = [
  'brasil', 'alemanha', 'italia', 'espanha', 'inglaterra', 'estados-unidos',
  'uruguai', 'croacia', 'belgica', 'holanda', 'japao', 'mexico',  // mexico OK em PT/EN
  'selecoes', 'lancamentos', 'feminina', 'feminino', 'infantil',
  'brasileirao', 'conjuntos-infantis',
  'manga-longa', 'goleiro', 'jogador', 'torcedor',
  'inter-de-milao', 'manchester-city-1', 'newcastle-1', 'borussia-dortmund-1',
];

function parseArgs() {
  const args = { themes: ['br', 'en'], strict: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--strict') args.strict = true;
    else if (a.startsWith('--theme=')) {
      const t = a.slice(8);
      args.themes = t === 'both' ? ['br', 'en'] : [t];
    }
  }
  return args;
}

async function walk(dir, exts = ['.liquid', '.json']) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full, exts));
    else if (exts.some(x => e.name.endsWith(x))) out.push(full);
  }
  return out;
}

function checkEmoji(content, file) {
  const issues = [];
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    EMOJI_RE.lastIndex = 0;
    const matches = line.match(EMOJI_RE);
    if (matches) {
      // Skip if é dentro de comentário Liquid {%- comment -%} ... ou HTML <!-- ... -->
      // (heurística simples; perfeito é parser, mas overkill pra lint)
      if (/<!--.*-->/.test(line) || /\{%-?\s*comment/.test(line)) return;
      issues.push({
        severity: 'ERROR',
        file, line: i + 1,
        message: `Emoji ${[...new Set(matches)].join(' ')} em texto visível — usar SVG icon (regra: feedback_no_emojis_use_icons)`,
      });
    }
  });
  return issues;
}

function checkBRLInEn(content, file) {
  if (!file.includes('lever-en')) return [];
  const issues = [];
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // R$ literal
    if (/R\$\s*\d/.test(line) && !/<!--.*-->/.test(line)) {
      issues.push({
        severity: 'ERROR',
        file, line: i + 1,
        message: `Símbolo "R$" em tema EN — moeda errada (deveria ser $ ou setting locale-agnostic)`,
      });
    }
    // pers_fee = 2000 (BRL cents) em tema EN
    if (/assign\s+pers_fee\s*=\s*2000\b/.test(line)) {
      issues.push({
        severity: 'ERROR',
        file, line: i + 1,
        message: `pers_fee = 2000 (BRL cents) em tema EN — usar settings.personalization_fee_cents`,
      });
    }
  });
  return issues;
}

function checkPtHandlesInEn(content, file) {
  if (!file.includes('lever-en') || !file.endsWith('.json')) return [];
  const issues = [];
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    for (const h of PT_HANDLES_IN_EN) {
      const re = new RegExp(`"collection":\\s*"${h}"`, 'g');
      if (re.test(line)) {
        issues.push({
          severity: 'ERROR',
          file, line: i + 1,
          message: `Handle PT "${h}" em template EN — rodar fix-handles ou patchear manualmente`,
        });
        break;
      }
    }
  });
  return issues;
}

function checkPersFeeHardcode(content, file) {
  if (!/snippets\/.*\.liquid$/.test(file)) return [];
  const issues = [];
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // pers_fee = <numero>  (não vem de settings)
    if (/assign\s+pers_fee\s*=\s*\d+\b/.test(line) && !/settings\./.test(line)) {
      issues.push({
        severity: 'WARN',
        file, line: i + 1,
        message: `pers_fee literal hardcoded — usar settings.personalization_fee_cents (ver settings_schema.json)`,
      });
    }
  });
  return issues;
}

async function lintTheme(themeName) {
  const dir = join(REPO_ROOT, 'themes', `lever-${themeName}`);
  let exists = false;
  try { await stat(dir); exists = true; } catch {}
  if (!exists) {
    return { theme: themeName, skipped: true, issues: [] };
  }

  const checkDirs = ['snippets', 'sections', 'templates', 'config'].map(d => join(dir, d));
  let files = [];
  for (const cd of checkDirs) files.push(...await walk(cd));

  const allIssues = [];
  for (const f of files) {
    const content = await readFile(f, 'utf8').catch(() => '');
    if (!content) continue;
    const rel = relative(REPO_ROOT, f).replace(/\\/g, '/');

    allIssues.push(...checkEmoji(content, rel));
    allIssues.push(...checkBRLInEn(content, rel));
    allIssues.push(...checkPtHandlesInEn(content, rel));
    allIssues.push(...checkPersFeeHardcode(content, rel));
  }

  return { theme: themeName, files: files.length, issues: allIssues };
}

async function main() {
  const args = parseArgs();
  const results = [];
  for (const t of args.themes) results.push(await lintTheme(t));

  console.log('═══════════════════════════════════════');
  console.log(`template-lint  ${results.map(r => r.theme).join(' + ')}`);
  console.log('═══════════════════════════════════════');

  let totalError = 0, totalWarn = 0;
  for (const r of results) {
    if (r.skipped) {
      console.log(`\n[${r.theme.toUpperCase()}] skipped (não encontrado)`);
      continue;
    }
    console.log(`\n[${r.theme.toUpperCase()}] ${r.files} arquivos analisados, ${r.issues.length} issues`);
    for (const i of r.issues) {
      console.log(`  ${i.severity.padEnd(5)} ${i.file}:${i.line}`);
      console.log(`         ${i.message}`);
      if (i.severity === 'ERROR') totalError++;
      else totalWarn++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`Resultado: ${totalError} ERROR · ${totalWarn} WARN`);
  console.log('═══════════════════════════════════════');

  if (args.strict && totalError > 0) process.exit(2);
  else if (totalError > 0) process.exit(1);
  else process.exit(0);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.stack); process.exit(1); });
