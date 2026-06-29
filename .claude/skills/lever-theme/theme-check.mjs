#!/usr/bin/env node
// theme-check — wrapper pra rodar `shopify theme check` nos temas locais.
//
// Uso:
//   node theme-check.mjs br                       # roda em themes/lever-br
//   node theme-check.mjs en                       # roda em themes/lever-en
//   node theme-check.mjs br --fix                 # auto-correct
//   node theme-check.mjs br --fail-level=error    # só falha em error (default: error)
//   node theme-check.mjs br --json                # output JSON pra scripts

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function parseArgs() {
  const args = { _: [], fix: false, failLevel: 'error', json: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--fix') args.fix = true;
    else if (a === '--json') args.json = true;
    else if (a.startsWith('--fail-level=')) args.failLevel = a.slice(13);
    else args._.push(a);
  }
  return args;
}

function resolveThemePath(id) {
  // Retorna path RELATIVO a REPO_ROOT (evita problemas de espaço em absoluto no Windows)
  const candidates = [
    `themes/lever-${id}`,
    `themes/${id}`,
    `themes/lever-${id.toLowerCase()}`,
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(REPO_ROOT, c))) return c;
  }
  throw new Error(`Tema não encontrado pra "${id}". Tentei: ${candidates.join(', ')}`);
}

function runThemeCheck(relativeThemePath, args) {
  return new Promise((resolve, reject) => {
    const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    // Não usa shell=true — passa args direto pra evitar quebra em espaços
    const cliArgs = ['shopify', 'theme', 'check',
      `--path=${relativeThemePath}`,
      `--fail-level=${args.failLevel}`,
    ];
    if (args.fix) cliArgs.push('--auto-correct');
    if (args.json) cliArgs.push('--output=json');

    // shell:true é necessário no Windows pra executar .cmd.
    // Argumentos são seguros porque usamos path relativo (sem espaços).
    const proc = spawn(cli, cliArgs, {
      cwd: REPO_ROOT,
      stdio: args.json ? 'pipe' : 'inherit',
      shell: process.platform === 'win32',
    });

    let stdoutBuf = '';
    if (args.json) {
      proc.stdout.on('data', c => stdoutBuf += c);
      proc.stderr.on('data', c => process.stderr.write(c));
    }

    proc.on('close', (code) => {
      resolve({ code, stdout: stdoutBuf });
    });
    proc.on('error', reject);
  });
}

async function main() {
  const args = parseArgs();
  const id = args._[0];
  if (!id) {
    console.error('Uso: node theme-check.mjs <br|en|client-id> [--fix] [--fail-level=error] [--json]');
    process.exit(1);
  }

  const themePath = resolveThemePath(id);
  console.log(`\n=== theme-check: ${themePath} ===\n`);
  if (args.fix) console.log('  (auto-correct ON)\n');

  const result = await runThemeCheck(themePath, args);

  if (args.json && result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(result.stdout);
    }
  }

  if (result.code === 0) {
    console.log(`\n✓ Theme check passou (fail-level=${args.failLevel})`);
  } else {
    console.log(`\n❌ Theme check falhou (exit ${result.code})`);
  }
  process.exit(result.code);
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1); });
