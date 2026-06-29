#!/usr/bin/env node
// dev-watchdog — orquestrador diário de qualidade das lojas de desenvolvimento.
//
// Fluxo por loja (BR + EN):
//   1. quality-gate --json --triggered-by=daily  → salva em client_quality_runs
//   2. auto-fixes seguros (sequencial, mesmo bucket Shopify)
//   3. coleta alerts (FAILs não auto-fixáveis)
//   4. grava /tmp/watchdog-YYYY-MM-DD.json + stdout
//
// Uso:
//   node dev-watchdog.mjs                  # DRY-RUN (imprime, não aplica)
//   node dev-watchdog.mjs --apply          # aplica fixes
//   node dev-watchdog.mjs --apply --only=br

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const STORES = [
  { key: 'br', name: 'Loja de Desenvolvimento - BR', locale: 'br' },
  { key: 'en', name: 'Loja de Desenvolvimento - EN', locale: 'en' },
];

function parseArgs() {
  const args = { apply: false, only: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a.startsWith('--only=')) args.only = a.slice(7);
  }
  return args;
}

// Roda um comando da skill, captura stdout/stderr/exit, não quebra fluxo em erro.
// Exit codes tolerados em `tolerateExit` são tratados como sucesso (ex: quality-gate 1=WARN, 2=FAIL).
async function runSkill(cmd, opts = {}) {
  const start = Date.now();
  const tolerateExit = opts.tolerateExit || [];
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: PROJECT_ROOT,
      maxBuffer: 20 * 1024 * 1024,
      timeout: opts.timeout || 15 * 60 * 1000,
    });
    return { ok: true, exitCode: 0, stdout, stderr, elapsed_ms: Date.now() - start };
  } catch (e) {
    const exitCode = typeof e.code === 'number' ? e.code : null;
    if (exitCode !== null && tolerateExit.includes(exitCode)) {
      return { ok: true, exitCode, stdout: e.stdout || '', stderr: e.stderr || '', elapsed_ms: Date.now() - start };
    }
    return {
      ok: false,
      exitCode,
      error: e.message,
      stdout: e.stdout || '',
      stderr: e.stderr || '',
      elapsed_ms: Date.now() - start,
    };
  }
}

// Extrai JSON do stdout do quality-gate (pode ter logs antes)
function parseQualityGateJson(stdout) {
  // quality-gate --json imprime só JSON. Mas se tiver logs extras, pegar do primeiro { válido.
  const match = stdout.match(/\{[\s\S]*\}$/m);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// Identifica quais checks do quality-gate estão FAIL/WARN
function checkDrifts(report) {
  const failed = new Set(), warned = new Set();
  for (const r of (report.results || [])) {
    if (r.verdict === 'FAIL') failed.add(r.label);
    if (r.verdict === 'WARN') warned.add(r.label);
  }
  return { failed, warned, allIssues: new Set([...failed, ...warned]) };
}

function needsFix(issueSet, patterns) {
  return [...issueSet].some(label => patterns.some(p => p.test(label)));
}

async function watchdogStore(store, args) {
  console.log(`\n━━━ ${store.name} ━━━`);
  const result = {
    store: store.name,
    locale: store.locale,
    timestamp: new Date().toISOString(),
    score: null,
    counts: null,
    fixes: [],
    alerts: [],
    skipped_dry_run: !args.apply,
  };

  // 1. SCAN
  console.log(`  [1/4] quality-gate...`);
  const qgCmd = `node ".claude/skills/quality-gate/quality-gate.mjs" "${store.name}" --json --triggered-by=daily`;
  const qg = await runSkill(qgCmd, { tolerateExit: [1, 2] }); // 1=WARN, 2=FAIL são saídas válidas
  if (!qg.ok) {
    console.log(`  ✗ quality-gate falhou: ${qg.error?.slice(0, 200)}`);
    result.error = 'quality-gate failed: ' + qg.error?.slice(0, 400);
    return result;
  }
  const report = parseQualityGateJson(qg.stdout);
  if (!report) {
    console.log(`  ✗ quality-gate não retornou JSON válido`);
    result.error = 'invalid quality-gate output';
    return result;
  }
  result.score = report.score;
  result.counts = report.counts;
  console.log(`    score=${report.score} counts=${JSON.stringify(report.counts)}`);

  // Safety gate: se score muito baixo ou muitos FAILs, pula auto-fix
  if (report.score < 50 || (report.counts?.FAIL || 0) >= 8) {
    console.log(`  ⚠ score/FAIL muito alto — skipando auto-fix, só coletando alerts`);
    result.alerts.push({ severity: 'HIGH', reason: 'Quality gate abaixo do threshold — revisão manual urgente', score: report.score });
    result.alerts.push(...(report.results || []).filter(r => r.verdict === 'FAIL').map(r => ({
      severity: 'FAIL', label: r.label, detail: r.detail, suggestion: r.suggestion,
    })));
    return result;
  }

  const drifts = checkDrifts(report);

  // 2. AUTO-FIX — ordem deliberada (idempotentes primeiro, condicionais depois)
  const applyFlag = args.apply ? '--apply' : '';

  const fixes = [
    // Sempre: vendor + SEO padrão Lever
    {
      name: 'bulk-product-meta vendor+seo',
      cmd: `node ".claude/skills/bulk-product-meta/bulk-product-meta.mjs" "${store.name}" --vendor="Lever Ecomm" --seo-auto ${applyFlag}`,
      always: true,
    },
    // Só BR: reorder Brasil-first nas 3 tabs de Lançamentos
    {
      name: 'sort-collections BR-first (lancamentos/feminina/infantil)',
      cmd: `node ".claude/skills/sort-collections/sort-collections.mjs" "${store.name}" --only-handles=lancamentos,feminina,infantil --priority-br ${applyFlag}`,
      always: true,
      if: () => store.locale === 'br',
    },
    // Condicional: títulos com marca ou typo
    {
      name: 'clean-titles',
      cmd: `node ".claude/skills/clean-titles/clean-titles.mjs" "${store.name}" --fix-gender --remove-brands ${applyFlag}`,
      if: () => needsFix(drifts.allIssues, [/t[ií]tulos/i, /typo.*gramatical/i, /marca/i]),
    },
    // Condicional: menus quebrados
    {
      name: 'fix-broken-menus',
      cmd: `node ".claude/skills/fix-broken-menus/fix-broken-menus.mjs" "${store.name}" --strategy=remove ${applyFlag}`,
      if: () => needsFix(drifts.failed, [/menus.*quebrad/i, /links.*404/i]),
    },
    // Condicional: smart collections com disjunctive bug
    {
      name: 'audit-smart-collections (disjunctive fix)',
      cmd: `node ".claude/skills/audit-smart-collections/audit-smart-collections.mjs" "${store.name}" --no-create ${applyFlag}`,
      if: () => needsFix(drifts.allIssues, [/smart rules/i, /cole[çc][aã]o/i, /disjunctive/i]),
    },
    // Condicional (EN only): handles em PT
    {
      name: 'fix-handles (EN)',
      cmd: `node ".claude/skills/fix-handles/fix-handles.mjs" "${store.name}" ${applyFlag}`,
      if: () => store.locale === 'en' && needsFix(drifts.allIssues, [/handle/i]),
    },
  ];

  console.log(`  [2/4] auto-fixes...`);
  for (const fix of fixes) {
    if (fix.if && !fix.if()) {
      continue;
    }
    console.log(`    ▶ ${fix.name}`);
    const r = await runSkill(fix.cmd);
    const entry = {
      name: fix.name,
      ok: r.ok,
      elapsed_ms: r.elapsed_ms,
      cmd: fix.cmd,
    };
    if (!r.ok) {
      entry.error = r.error?.slice(0, 500);
      entry.stderr = r.stderr?.slice(-500);
      console.log(`      ✗ falhou: ${r.error?.slice(0, 150)}`);
    } else {
      // Tenta extrair stats do stdout (heurística simples)
      const okMatch = r.stdout.match(/ok=(\d+).*fail=(\d+)/);
      if (okMatch) entry.summary = `ok=${okMatch[1]} fail=${okMatch[2]}`;
      const fixedMatch = r.stdout.match(/fixed=(\d+).*created=(\d+)/);
      if (fixedMatch) entry.summary = `fixed=${fixedMatch[1]} created=${fixedMatch[2]}`;
      console.log(`      ✓ ${entry.summary || 'done'} (${(r.elapsed_ms / 1000).toFixed(1)}s)`);
    }
    result.fixes.push(entry);
  }

  // 3. ALERTS — FAILs não auto-fixáveis
  console.log(`  [3/4] coletando alerts...`);
  const nonFixablePatterns = [/duplicad/i, /vazias/i, /pre[çc]o/i, /imagem/i, /compare_at/i];
  for (const r of (report.results || [])) {
    if (r.verdict === 'FAIL' && nonFixablePatterns.some(p => p.test(r.label))) {
      result.alerts.push({
        severity: 'FAIL',
        label: r.label,
        detail: r.detail,
        suggestion: r.suggestion,
      });
    }
  }
  if (result.alerts.length > 0) {
    console.log(`    ${result.alerts.length} alertas pra revisão humana`);
  } else {
    console.log(`    nenhum alerta — loja limpa`);
  }

  return result;
}

async function main() {
  const args = parseArgs();
  console.log(`\n=== dev-watchdog ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`Start: ${new Date().toISOString()}`);

  // Pre-flight: ambas as lojas existem e conectadas
  const targetStores = STORES.filter(s => !args.only || s.key === args.only);
  for (const store of targetStores) {
    try {
      const client = await assertClientExists(store.name);
      await assertShopifyConnected(client);
    } catch (e) {
      console.error(`✗ Pre-flight falhou em ${store.name}: ${e.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${targetStores.length} loja(s) validada(s)`);

  // Run per store em PARALELO — lojas diferentes = buckets Shopify independentes.
  // Dentro de cada loja os fixes são sequenciais (mesmo bucket).
  const results = await Promise.all(targetStores.map(async (store) => {
    try {
      return await watchdogStore(store, args);
    } catch (e) {
      console.error(`✗ Erro fatal em ${store.name}: ${e.message}`);
      return { store: store.name, error: e.message, fatal: true };
    }
  }));

  // 4. REPORT consolidado
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(os.tmpdir(), `watchdog-${date}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    run_at: new Date().toISOString(),
    apply: args.apply,
    results,
  }, null, 2));

  console.log(`\n━━━ RESUMO ━━━`);
  for (const r of results) {
    const fixCount = r.fixes?.filter(f => f.ok).length ?? 0;
    const fixFail = r.fixes?.filter(f => !f.ok).length ?? 0;
    console.log(`  ${r.store}: score=${r.score ?? '?'} fixes_ok=${fixCount} fixes_fail=${fixFail} alerts=${r.alerts?.length ?? 0}`);
  }
  console.log(`\n✓ Relatório: ${reportPath}`);
  console.log(`✓ End: ${new Date().toISOString()}`);
}

main().catch(e => {
  console.error('\n❌ FATAL:', e.message, e.stack);
  process.exit(1);
});
