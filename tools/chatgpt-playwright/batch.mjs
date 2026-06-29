// batch.mjs — Roda múltiplas gerações em sequência a partir de um JSON.
//
// Como usar:
//   node batch.mjs --jobs ./jobs.json
//
// jobs.json formato:
// [
//   { "prompt": "transforma essa camisa em cena editorial preto e branco", "refs": ["./inputs/cam1.png"], "out": "./output/cam1-pb.png" },
//   { "prompt": "mesma camisa em modelo masculino correndo na praia", "refs": ["./inputs/cam1.png"], "out": "./output/cam1-praia.png" }
// ]
//
// IMPORTANT: Roda jobs SERIAIS (1 por vez). Múltiplos chats paralelos na mesma sessão
// quebram facilmente — ChatGPT rate-limita e às vezes confunde contexto.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const jobsFlag = args.indexOf('--jobs');
if (jobsFlag === -1) {
  console.error('❌ --jobs <path-to-json> obrigatório');
  process.exit(1);
}
const JOBS_PATH = args[jobsFlag + 1];

const jobs = JSON.parse(await fs.readFile(JOBS_PATH, 'utf-8'));
console.log(`📋 ${jobs.length} jobs encontrados`);

let ok = 0, fail = 0;
for (let i = 0; i < jobs.length; i++) {
  const job = jobs[i];
  console.log(`\n──── [${i + 1}/${jobs.length}] ${job.prompt.slice(0, 80)}…`);

  const cliArgs = ['generate.mjs', '--prompt', job.prompt, '--out', job.out];
  for (const ref of (job.refs || [])) {
    cliArgs.push('--ref', ref);
  }

  const code = await new Promise(resolve => {
    const child = spawn('node', cliArgs, { cwd: __dirname, stdio: 'inherit' });
    child.on('exit', resolve);
  });

  if (code === 0) ok++; else fail++;

  // Pausa entre jobs pra não bater rate limit
  if (i < jobs.length - 1) {
    console.log('⏸️  Aguardando 10s antes do próximo…');
    await new Promise(r => setTimeout(r, 10000));
  }
}

console.log(`\n══════════════════════`);
console.log(`✅ ${ok} sucesso  ❌ ${fail} falha`);
