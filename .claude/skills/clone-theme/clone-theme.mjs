#!/usr/bin/env node
// clone-theme — ORQUESTRADOR. Roda os 12 passos em sequência.
//
// Cada passo é resumível: se o output já existe, pula (idempotente).
// Forçar re-execução com --force.
//
// Uso:
//   node clone-theme.mjs <url> --slug <nome>                # pipeline completo (sem upload)
//   node clone-theme.mjs <url> --slug <nome> --limit 50     # cap em 50 produtos
//   node clone-theme.mjs <url> --slug <nome> --skip products  # pula clone-normalize-products
//   node clone-theme.mjs <url> --slug <nome> --skip audit-visual  # pula audit visual
//   node clone-theme.mjs <url> --slug <nome> --force        # re-executa tudo do zero
//   node clone-theme.mjs <url> --slug <nome> --stop-on-error  # para no primeiro erro

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const a = { url: null, slug: null, limit: 100, skip: [], force: false, stopOnError: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--slug') a.slug = argv[++i];
    else if (v === '--limit') a.limit = parseInt(argv[++i]);
    else if (v === '--skip') a.skip.push(argv[++i]);
    else if (v === '--force') a.force = true;
    else if (v === '--stop-on-error') a.stopOnError = true;
    else if (!v.startsWith('--') && !a.url) a.url = v;
  }
  return a;
}

function runStep(name, cmd, opts = {}) {
  const start = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${name}`);
  console.log(`  ${cmd}`);
  console.log('─'.repeat(60));
  try {
    execSync(cmd, { stdio: 'inherit', cwd: REPO_ROOT, ...opts });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return { ok: true, name, elapsed };
  } catch (e) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return { ok: false, name, elapsed, error: e.message };
  }
}

function shouldSkip(stepName, skipList) {
  return skipList.includes(stepName);
}

function fileExists(p) { return fs.existsSync(p); }

async function main() {
  const args = parseArgs();
  if (!args.url || !args.slug) {
    console.error('Uso: node clone-theme.mjs <url> --slug <nome> [--limit N] [--skip step] [--force] [--stop-on-error]');
    console.error('\nSteps:  validate, discover, scrape, detect, tokens, products, assemble, self-heal, audit, package, audit-visual');
    process.exit(1);
  }

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  fs.mkdirSync(workspace, { recursive: true });

  // Garante .clone-meta.json mínimo
  const metaPath = path.join(workspace, '.clone-meta.json');
  if (!fileExists(metaPath) || args.force) {
    fs.writeFileSync(metaPath, JSON.stringify({
      slug: args.slug, theme_name: args.slug, source_url: args.url,
      phase: 'init', created_at: new Date().toISOString(),
    }, null, 2));
  }

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  clone-theme PIPELINE                                    ║`);
  console.log(`║  URL:    ${args.url.padEnd(48)} ║`);
  console.log(`║  Slug:   ${args.slug.padEnd(48)} ║`);
  console.log(`║  Skip:   ${(args.skip.join(',') || '(nenhum)').padEnd(48)} ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`\nℹ  DICA: Se Claude está rodando esta skill interativamente E tem`);
  console.log(`        MCP Playwright disponível, recomendo seguir o playbook em`);
  console.log(`        .claude/skills/clone-theme/MCP-PLAYBOOK.md ANTES desta pipeline.`);
  console.log(`        Ganho: detector ~95% confidence + scrape de SPA 2x melhor.\n`);

  const SKILL = '.claude/skills/clone-theme';
  const steps = [
    { name: 'validate',     skill: 'validate',  cmd: `node ${SKILL}/clone-validate.mjs ${args.slug}`, optional: true },
    { name: 'discover',     skill: 'discover',  cmd: `node ${SKILL}/clone-discover.mjs ${args.slug}`, optional: true },
    { name: 'scrape',       skill: 'scrape',    cmd: `node ${SKILL}/clone-scrape.mjs ${args.slug}`, optional: true },
    { name: 'detect',       skill: 'detect',    cmd: `node ${SKILL}/clone-detect-platform.mjs ${args.slug} --url ${args.url}` },
    { name: 'tokens',       skill: 'tokens',    cmd: `node ${SKILL}/clone-tokens.mjs ${args.slug}`, optional: true },
    { name: 'products',     skill: 'products',  cmd: `node ${SKILL}/clone-normalize-products.mjs ${args.slug} --limit ${args.limit}`, optional: true },
    { name: 'assemble',     skill: 'assemble',  cmd: `node ${SKILL}/clone-assemble.mjs ${args.slug}` },
    { name: 'self-heal',    skill: 'self-heal', cmd: `node ${SKILL}/clone-self-heal.mjs ${args.slug}` },
    { name: 'audit',        skill: 'audit',     cmd: `node ${SKILL}/clone-audit.mjs ${args.slug}`, optional: true },
    { name: 'package',      skill: 'package',   cmd: `node ${SKILL}/clone-package.mjs ${args.slug}`, optional: true },
    // audit-visual rodado SEPARADO depois do upload (precisa preview URL)
  ];

  const results = [];
  for (const step of steps) {
    if (shouldSkip(step.name, args.skip)) {
      console.log(`\n⏭  Skip: ${step.name}`);
      results.push({ ok: true, name: step.name, skipped: true });
      continue;
    }
    const r = runStep(step.name, step.cmd);
    results.push(r);
    if (!r.ok && !step.optional) {
      console.log(`\n❌ Falha em step bloqueante: ${step.name}`);
      if (args.stopOnError) break;
    } else if (!r.ok && step.optional) {
      console.log(`\n⚠ ${step.name} falhou (opcional) — continuando`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`PIPELINE FINALIZADA`);
  console.log('═'.repeat(60));
  for (const r of results) {
    const icon = r.skipped ? '⏭' : (r.ok ? '✓' : '✗');
    const time = r.elapsed ? ` (${r.elapsed}s)` : '';
    console.log(`  ${icon} ${r.name}${time}`);
  }

  // Salva run-log
  const logPath = path.join(workspace, '_design', 'pipeline-run.json');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify({
    url: args.url, slug: args.slug, started_at: new Date().toISOString(),
    results,
  }, null, 2));
  console.log(`\n  Log: ${path.relative(REPO_ROOT, logPath)}`);
  console.log(`\n  Próximo passo manual: upload do ZIP em themes/clones/${args.slug}/${args.slug}.zip`);
  console.log(`  Depois: node ${SKILL}/clone-audit-visual.mjs ${args.slug} --target ${args.url} --clone <preview-url>\n`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
