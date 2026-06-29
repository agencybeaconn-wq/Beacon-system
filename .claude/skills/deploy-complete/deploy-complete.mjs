#!/usr/bin/env node
// deploy-complete — orquestrador end-to-end de deploy de loja Shopify nova.
// Roda: preflight → edge function full_deploy → post-deploy polish → verify → report
//
// Uso:
//   node deploy-complete.mjs "<cliente>"              # DRY-RUN (lista steps)
//   node deploy-complete.mjs "<cliente>" --apply      # Executa tudo
//   node deploy-complete.mjs "<cliente>" --apply --skip-edge  # Só post-deploy

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';
import { supaRest } from '../../lib/supabase-rest.mjs';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const args = { _: [], apply: false, skipPreflight: false, skipEdge: false, json: false, sourceClient: null, vendor: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--skip-preflight') args.skipPreflight = true;
    else if (a === '--skip-edge' || a === '--only-post') args.skipEdge = true;
    else if (a === '--json') args.json = true;
    else if (a.startsWith('--source-client=')) args.sourceClient = a.slice(16);
    else if (a.startsWith('--vendor=')) args.vendor = a.slice(9);
    else args._.push(a);
  }
  return args;
}

function loadEnv() {
  const env = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(p)) continue;
    fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    });
  }
  return env;
}

async function runSkill(cmd, tolerateExit = []) {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: PROJECT_ROOT,
      maxBuffer: 40 * 1024 * 1024,
      timeout: 30 * 60 * 1000,
    });
    return { ok: true, stdout, stderr, ms: Date.now() - start };
  } catch (e) {
    const code = typeof e.code === 'number' ? e.code : null;
    if (code !== null && tolerateExit.includes(code)) {
      return { ok: true, exitCode: code, stdout: e.stdout || '', stderr: e.stderr || '', ms: Date.now() - start };
    }
    return { ok: false, exitCode: code, error: e.message, stdout: e.stdout || '', stderr: e.stderr || '', ms: Date.now() - start };
  }
}

function callEdgeFullDeploy(env, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const url = new URL(env.VITE_SUPABASE_URL);
    const TOKEN = env.VITE_SUPABASE_ANON_KEY;
    const req = https.request({
      hostname: url.hostname,
      path: '/functions/v1/store-deployment',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${TOKEN}`,
        apikey: TOKEN,
      },
      timeout: 25 * 60 * 1000,
    }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ ok: false, status: res.statusCode, body: b }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

function extractFirstJson(stdout) {
  const m = stdout.match(/\{[\s\S]*\}$/m);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node deploy-complete.mjs "<cliente>" [--apply] [--skip-preflight] [--skip-edge]');
    process.exit(1);
  }

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const env = loadEnv();

  console.log(`\n=== deploy-complete ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`Cliente: ${client.name} (${client.shopify_domain})`);

  const start = Date.now();
  const report = {
    client: client.name,
    client_id: client.id,
    shop: client.shopify_domain,
    start: new Date().toISOString(),
    apply: args.apply,
    steps: {},
    manual_pending: [],
  };

  // Helper pra log de step
  const logStep = (name, status, detail = '') => {
    const icon = status === 'ok' ? '✓' : status === 'skip' ? '⏭' : '✗';
    console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
  };

  // STEP 1: Preflight
  if (!args.skipPreflight) {
    console.log(`\n[1/5] preflight...`);
    const srcFlag = args.sourceClient ? ` --source-client="${args.sourceClient}"` : '';
    const preCmd = `node ".claude/skills/preflight-deploy/preflight-deploy.mjs" "${client.name}"${srcFlag} --json`;
    const pre = await runSkill(preCmd);
    const preJson = extractFirstJson(pre.stdout);
    const preResult = Array.isArray(preJson) ? preJson[0] : preJson;
    report.steps.preflight = { verdict: preResult?.verdict, ms: pre.ms };
    if (!preResult || preResult.verdict !== 'READY') {
      logStep('preflight', 'fail', preResult?.verdict || 'no-result');
      if (preResult?.pending) preResult.pending.forEach(p => console.log(`    • [${p.code}] ${p.fix}`));
      console.error(`\n❌ Preflight bloqueou deploy. Resolva as pendências acima.`);
      report.end = new Date().toISOString();
      report.elapsed_seconds = (Date.now() - start) / 1000;
      process.exit(2);
    }
    logStep('preflight', 'ok', 'READY');
    report.locale = preResult.locale;
    report.briefing_id = preResult.briefing_id;
    report.source_template = preResult.source_template;
    report.source_client = preResult.source_client;
    report.source_client_id = preResult.source_client_id;
  } else {
    logStep('preflight', 'skip', '--skip-preflight');
    report.steps.preflight = { skipped: true };
  }

  // STEP 2: Edge function full_deploy
  if (!args.skipEdge) {
    console.log(`\n[2/5] edge function store-deployment action=full_deploy...`);
    if (!args.apply) {
      logStep('full_deploy', 'skip', '[DRY-RUN]');
      report.steps.edge_deploy = { dry_run: true };
    } else {
      // Determinar sourceClientId: --source-client override > preflight source > locale default
      const sourceName = args.sourceClient || report.source_client || report.source_template || 'Loja de Desenvolvimento - BR';
      const sourceRows = await supaRest('GET',
        `/agency_clients?select=id,name&name=eq.${encodeURIComponent(sourceName)}&limit=1`,
        null, { serviceRole: true });
      if (!sourceRows.length) {
        logStep('full_deploy', 'fail', `source não encontrado: ${sourceName}`);
        report.steps.edge_deploy = { ok: false, error: 'source not found' };
      } else {
        const sourceClientId = sourceRows[0].id;
        console.log(`  source: ${sourceName} (${sourceClientId})`);
        const edgeBody = {
          action: 'full_deploy',
          sourceClientId,
          targetClientId: client.id,
          briefingId: report.briefing_id || null,
          sourceBrandName: sourceName,
        };
        const stepStart = Date.now();
        const edge = await callEdgeFullDeploy(env, edgeBody);
        const ms = Date.now() - stepStart;
        if (edge.ok) {
          logStep('full_deploy', 'ok', `${(ms / 1000).toFixed(1)}s`);
          report.steps.edge_deploy = { ok: true, data: edge.body?.data, ms };
        } else {
          logStep('full_deploy', 'fail', edge.error || JSON.stringify(edge.body).slice(0, 200));
          report.steps.edge_deploy = { ok: false, error: edge.error || edge.body, ms };
          console.error(`\n⚠ Edge deploy falhou — seguindo com post-deploy mesmo assim.`);
        }
      }
    }
  } else {
    logStep('full_deploy', 'skip', '--skip-edge');
    report.steps.edge_deploy = { skipped: true };
  }

  // STEP 3: Post-deploy skills (sequencial, mesmo bucket Shopify)
  console.log(`\n[3/5] post-deploy polish...`);
  const applyFlag = args.apply ? '--apply' : '';
  const locale = report.locale || 'br';
  const vendorName = client.name;

  const effectiveVendor = args.vendor || vendorName;
  const postSteps = [
    {
      name: 'bulk-product-meta (vendor + SEO)',
      cmd: `node ".claude/skills/bulk-product-meta/bulk-product-meta.mjs" "${client.name}" --vendor="${effectiveVendor}" --seo-auto ${applyFlag}`,
      key: 'bulk_product_meta',
    },
    {
      name: 'audit-smart-collections (fix disjunctive)',
      cmd: `node ".claude/skills/audit-smart-collections/audit-smart-collections.mjs" "${client.name}" --no-create ${applyFlag}`,
      key: 'audit_smart_collections',
      tolerateExit: [1, 2],
    },
    ...(locale === 'br' ? [{
      name: 'sort-collections BR-first (lançamentos)',
      cmd: `node ".claude/skills/sort-collections/sort-collections.mjs" "${client.name}" --only-handles=lancamentos,feminina,infantil --priority-br ${applyFlag}`,
      key: 'sort_priority_br',
    }] : []),
    {
      name: 'sort-collections (todas as coleções)',
      cmd: `node ".claude/skills/sort-collections/sort-collections.mjs" "${client.name}" ${applyFlag}`,
      key: 'sort_all',
    },
    {
      name: 'fix-theme-license (verifica + fix Supabase se divergente)',
      cmd: `node ".claude/skills/fix-theme-license/fix-theme-license.mjs" "${client.name}" ${applyFlag}`,
      key: 'fix_theme_license',
    },
    {
      // project_template_br_duplicates: 12 duplicados na origem propagam pra clientes;
      // dedupe automático garante que loja nova nasce limpa
      name: 'dedupe-products (limpa duplicados herdados do template)',
      cmd: `node ".claude/skills/dedupe-products/dedupe-products.mjs" "${client.name}" --by=title ${applyFlag}`,
      key: 'dedupe_products',
      tolerateExit: [1],
    },
    {
      // feedback_active_vs_published: produtos ACTIVE sem publishedAt ficam invisíveis na storefront
      // Step inline pra contar (e publicar se --apply) — não depende de skill externa
      name: 'republish-unpublished (publica ACTIVE sem publishedAt no Online Store)',
      cmd: `node ".claude/skills/deploy-complete/republish-unpublished.mjs" "${client.name}" ${applyFlag}`,
      key: 'republish_unpublished',
      tolerateExit: [1],
    },
  ];

  for (const step of postSteps) {
    console.log(`  ▶ ${step.name}`);
    const r = await runSkill(step.cmd, step.tolerateExit || []);
    report.steps[step.key] = { ok: r.ok, ms: r.ms };
    if (!r.ok) {
      logStep(step.name, 'fail', (r.error || '').slice(0, 120));
      report.steps[step.key].error = r.error?.slice(0, 500);
    } else {
      const okMatch = r.stdout.match(/ok=(\d+).*fail=(\d+)/);
      const fixedMatch = r.stdout.match(/fixed=(\d+).*created=(\d+)/);
      const scoreMatch = r.stdout.match(/score=(\d+)/);
      const summary = okMatch ? `ok=${okMatch[1]} fail=${okMatch[2]}`
        : fixedMatch ? `fixed=${fixedMatch[1]} created=${fixedMatch[2]}`
        : scoreMatch ? `score=${scoreMatch[1]}` : 'done';
      logStep(step.name, 'ok', `${summary} (${(r.ms / 1000).toFixed(1)}s)`);
      report.steps[step.key].summary = summary;
    }
  }

  // STEP 4: Verify via quality-gate
  console.log(`\n[4/5] quality-gate final...`);
  const qg = await runSkill(
    `node ".claude/skills/quality-gate/quality-gate.mjs" "${client.name}" --json --triggered-by=post-deploy`,
    [1, 2] // WARN=1, FAIL=2 são válidos
  );
  const qgJson = extractFirstJson(qg.stdout);
  if (qgJson) {
    report.steps.quality_gate = { score: qgJson.score, counts: qgJson.counts, ms: qg.ms };
    logStep('quality-gate', 'ok', `score=${qgJson.score} PASS=${qgJson.counts.PASS} WARN=${qgJson.counts.WARN} FAIL=${qgJson.counts.FAIL}`);
    // Alerts pra revisão humana
    report.alerts = (qgJson.results || [])
      .filter(r => r.verdict === 'FAIL')
      .map(r => ({ label: r.label, detail: r.detail, suggestion: r.suggestion }));
  } else {
    logStep('quality-gate', 'fail', 'no JSON output');
    report.steps.quality_gate = { ok: false };
  }

  // STEP 5: Report + pendências manuais
  report.manual_pending = [
    'Banners da home (slides hero, promoções) — via Customize UI',
    'Logo da marca — upload via Customize UI (a menos que venha no briefing)',
    'Licença Lever — se overlay aparecer, save qualquer setting via Customize UI pra invalidar cache compilado (skill fix-theme-license já ajusta Supabase como workaround)',
    'Imagens custom por coleção — se loja usa logos de time via collection-list-tabs.liquid',
    'Descrição LP custom — rodar bulk-descriptions --set-file=<lp.html> --apply se houver',
  ];

  report.end = new Date().toISOString();
  report.elapsed_seconds = Math.round((Date.now() - start) / 1000);

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const reportPath = path.join(os.tmpdir(), `deploy-complete-${client.shopify_domain.replace('.myshopify.com', '')}-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n=== RELATÓRIO ===`);
  console.log(`Tempo total:  ${report.elapsed_seconds}s (${(report.elapsed_seconds / 60).toFixed(1)} min)`);
  if (report.steps.quality_gate?.score !== undefined) {
    console.log(`Score final:  ${report.steps.quality_gate.score}/100`);
  }
  if (report.alerts?.length) {
    console.log(`\nAlerts (${report.alerts.length}) pra revisão humana:`);
    report.alerts.forEach(a => console.log(`  • ${a.label}: ${a.detail}`));
  }
  console.log(`\nPendências manuais:`);
  report.manual_pending.forEach(p => console.log(`  • ${p}`));
  console.log(`\n✓ Relatório: ${reportPath}`);

  if (args.json) console.log('\n' + JSON.stringify(report, null, 2));
}

main().catch(e => { console.error('\n❌ FATAL:', e.message, e.stack); process.exit(1); });
