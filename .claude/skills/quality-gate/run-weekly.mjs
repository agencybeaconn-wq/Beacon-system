#!/usr/bin/env node
// run-weekly — roda quality-gate em TODOS os clientes conectados e gera relatório.
//
// Uso:
//   node run-weekly.mjs                 # roda em todos e salva no DB
//   node run-weekly.mjs --dry-run       # lista clientes sem rodar
//   node run-weekly.mjs --top=10        # roda e mostra top 10 piores
//   node run-weekly.mjs --exclude=<id>  # pula um cliente específico
//
// Saída: relatório markdown em .claude/logs/weekly-{YYYY-MM-DD}.md
//        + insert em client_quality_runs (via saveRun)

import { supaRest } from '../../lib/supabase-rest.mjs';
import { runQualityGate, saveRun } from './quality-gate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const LOGS_DIR = path.join(REPO_ROOT, '.claude/logs');

function parseArgs() {
  const args = { dryRun: false, top: 10, exclude: [] };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--top=')) args.top = parseInt(a.slice(6)) || 10;
    else if (a.startsWith('--exclude=')) args.exclude.push(a.slice(10));
  }
  return args;
}

async function listClients() {
  const rows = await supaRest('GET',
    '/agency_clients?select=id,name,shopify_domain,shopify_status&shopify_status=eq.connected&order=name');
  return rows || [];
}

// Usa child_process pra rodar o quality-gate.mjs como subprocess por cliente
// (mais isolado que importar e chamar — erros num cliente não derrubam o batch)
import { spawn } from 'child_process';

function runGate(clientId, clientName) {
  return new Promise((resolve) => {
    const script = path.join(__dirname, 'quality-gate.mjs');
    const child = spawn('node', [script, clientId, '--json'], { cwd: REPO_ROOT });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    child.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        resolve({ ok: true, exitCode: code, ...result });
      } catch (e) {
        resolve({ ok: false, exitCode: code, error: stderr || stdout.slice(0, 500), clientId, clientName });
      }
    });
  });
}

async function main() {
  const args = parseArgs();
  console.log('\n=== Quality Gate — Run Weekly ===');

  const clients = await listClients();
  const filtered = clients.filter(c => !args.exclude.includes(c.id));
  console.log(`Clientes conectados: ${filtered.length}${args.exclude.length ? ` (excluídos: ${args.exclude.length})` : ''}`);

  if (args.dryRun) {
    console.log('\n[DRY-RUN] Lista de clientes que rodariam:');
    filtered.forEach(c => console.log(`  - ${c.name} (${c.shopify_domain})`));
    return;
  }

  // Rodar sequencialmente pra não sobrecarregar (cada cliente leva 80-120s)
  // Alternativa: concurrency=3 em paralelo (lojas diferentes = safe)
  const CONCURRENCY = 3;
  const results = [];
  const t0 = Date.now();

  for (let i = 0; i < filtered.length; i += CONCURRENCY) {
    const batch = filtered.slice(i, i + CONCURRENCY);
    console.log(`\n[Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(filtered.length / CONCURRENCY)}] Rodando: ${batch.map(c => c.name).join(', ')}`);
    const batchResults = await Promise.all(
      batch.map(c => runGate(c.id, c.name).then(r => ({ ...r, clientName: c.name, clientId: c.id })))
    );
    for (const r of batchResults) {
      if (r.ok) {
        console.log(`  ✓ ${r.clientName}: score ${r.score}/100`);
        results.push(r);
      } else {
        console.log(`  ✗ ${r.clientName}: erro (exit ${r.exitCode}) ${(r.error || '').slice(0, 100)}`);
        results.push({ ok: false, clientId: r.clientId, clientName: r.clientName, score: 0, error: r.error });
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // Ordena por score asc (piores primeiro)
  results.sort((a, b) => (a.score || 0) - (b.score || 0));

  // Relatório markdown
  const today = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const reportPath = path.join(LOGS_DIR, `weekly-${today}.md`);

  let md = `# Quality Gate Weekly Report — ${today}\n\n`;
  md += `- **Clientes processados:** ${results.length}\n`;
  md += `- **Duração total:** ${elapsed}s\n`;
  md += `- **Erros:** ${results.filter(r => !r.ok).length}\n\n`;

  md += `## Top ${args.top} piores scores\n\n`;
  md += '| Cliente | Score | PASS | WARN | FAIL |\n';
  md += '|---|---|---|---|---|\n';
  results.slice(0, args.top).forEach(r => {
    if (!r.ok) {
      md += `| ${r.clientName} | ERRO | - | - | - |\n`;
    } else {
      md += `| ${r.clientName} | **${r.score}** | ${r.counts?.PASS || 0} | ${r.counts?.WARN || 0} | ${r.counts?.FAIL || 0} |\n`;
    }
  });

  md += `\n## Todos os clientes\n\n`;
  md += '| Cliente | Score | Status |\n|---|---|---|\n';
  results.forEach(r => {
    const status = r.ok ? `${r.counts?.PASS || 0}P/${r.counts?.WARN || 0}W/${r.counts?.FAIL || 0}F` : 'ERRO';
    md += `| ${r.clientName} | ${r.ok ? r.score : '-'} | ${status} |\n`;
  });

  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`\n\n✓ Relatório salvo em ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`\nTop 5 piores:`);
  results.slice(0, 5).forEach(r => {
    if (r.ok) console.log(`  ${r.score}/100  ${r.clientName}`);
  });
  console.log(`\nDuração total: ${elapsed}s`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e); process.exit(1); });
