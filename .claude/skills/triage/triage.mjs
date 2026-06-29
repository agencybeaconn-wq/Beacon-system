#!/usr/bin/env node
// triage V2 — heurística + LLM (Gemini) + load balancing.
//
// Uso:
//   node triage.mjs                              # dry-run todas pending (heuristic + LLM)
//   node triage.mjs --no-llm                     # só heurística
//   node triage.mjs --id=UUID                    # só uma demanda
//   node triage.mjs --status=approved            # demandas já aprovadas
//   node triage.mjs --apply                      # grava triage_result + triaged_at no banco
//
// Output enriquecido:
//   type, complexity, suggestedSkill, canAutoExecute, suggestedRole, suggestedAssignee,
//   confidence, readinessScore, missingInfo[], blockers[], suggestedNextSteps[], reasoning

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classify } from './rules.mjs';
import { classifyWithGemini, mergeTriage } from './gemini-classifier.mjs';
import { loadTeamConfig, pickAssignee, fetchActiveLoad } from './load-balancer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const ENV_PATH = path.join(REPO_ROOT, '.env');

function loadEnv() {
  const src = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const rawLine of src.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

function parseArgs() {
  const args = { id: null, status: 'pending', apply: false, noLlm: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--no-llm') args.noLlm = true;
    else if (a.startsWith('--id=')) args.id = a.slice(5);
    else if (a.startsWith('--status=')) args.status = a.slice(9);
  }
  return args;
}

function supa(env, method, p, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: env.VITE_SUPABASE_URL.replace(/https?:\/\//, '').replace(/\/$/, ''),
      path: '/rest/v1' + p,
      method,
      headers: {
        'apikey': env.VITE_SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        ...(method !== 'GET' ? { 'Prefer': 'return=minimal' } : {}),
      },
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const args = parseArgs();
  const env = loadEnv();
  const team = loadTeamConfig();

  let filter = '';
  if (args.id) filter = `?id=eq.${args.id}`;
  else filter = `?status=eq.${args.status}&order=created_at.desc`;

  const demands = await supa(env, 'GET', `/demand_requests${filter}&select=id,title,description,area,client_priority,status,client_id,created_at,agency_clients(name)`);
  if (!Array.isArray(demands) || demands.length === 0) {
    console.log(`Nenhuma demanda encontrada (filter: ${filter})`);
    return;
  }

  console.log(`\n=== TRIAGE V2 ${args.apply ? '[APPLY]' : '[DRY-RUN]'} — ${demands.length} demandas ===`);
  console.log(`Modo LLM: ${args.noLlm ? 'DESATIVADO' : 'ATIVADO (Gemini)'}\n`);

  // Carrega carga atual do time
  const loadMap = await fetchActiveLoad(env);
  console.log(`Carga atual do time: ${loadMap.size} membros com tarefas ativas\n`);

  const results = [];
  const stats = { byType: {}, byRole: {}, autoExecutable: 0, confident: 0, llmCalls: 0, llmErrors: 0 };

  for (let i = 0; i < demands.length; i++) {
    const d = demands[i];

    // 1. Heurística (fast)
    const heuristic = classify(d.title, d.description);

    // 2. LLM (slow, optional)
    let llm = null;
    if (!args.noLlm) {
      try {
        process.stdout.write(`\r[${i + 1}/${demands.length}] LLM classificando: ${d.title.slice(0, 40)}...`);
        llm = await classifyWithGemini({
          title: d.title,
          description: d.description,
          clientName: d.agency_clients?.name,
          area: d.area,
          client_priority: d.client_priority,
        }, env);
        stats.llmCalls++;
      } catch (e) {
        stats.llmErrors++;
        process.stdout.write(`\n  [${i + 1}/${demands.length}] LLM erro: ${e.message.slice(0, 80)}\n`);
      }
    }

    // 3. Merge heurística + LLM
    const merged = mergeTriage(heuristic, llm);

    // 4. Load balancing — decide pessoa específica
    const assignee = pickAssignee(merged.suggestedRole, loadMap, team);
    merged.suggestedAssignee = assignee;

    results.push({ ...d, triage: merged });

    stats.byType[merged.type] = (stats.byType[merged.type] || 0) + 1;
    stats.byRole[merged.suggestedRole] = (stats.byRole[merged.suggestedRole] || 0) + 1;
    if (merged.canAutoExecute) stats.autoExecutable++;
    if ((merged.confidence || 0) >= 0.7) stats.confident++;

    // Reserva carga do assignee pros próximos (simulação em-memória)
    if (assignee?.userId) loadMap.set(assignee.userId, (loadMap.get(assignee.userId) || 0) + 1);
  }

  console.log(`\n\n=== RESULTADO ===`);
  const icons = { claude: '🤖', junior: '🟢', senior: '🟡', lead: '🔴' };
  for (const r of results) {
    const t = r.triage;
    const icon = icons[t.suggestedRole] || '⚪';
    const skill = t.suggestedSkill ? `/${t.suggestedSkill}` : '—';
    const assignee = t.suggestedAssignee?.name || '?';
    const ready = t.readinessScore != null ? `R:${t.readinessScore}` : '';
    const missing = t.missingInfo?.length ? ` ❓${t.missingInfo.length}` : '';
    console.log(`${icon} ${r.title.slice(0, 50).padEnd(52)} | ${t.type.padEnd(15)} | → ${assignee.padEnd(15)} | ${skill.padEnd(20)} | ${ready}${missing}`);
  }

  console.log(`\n=== STATS ===`);
  console.log(`Por tipo:       `, stats.byType);
  console.log(`Por role:       `, stats.byRole);
  console.log(`Auto-executável: ${stats.autoExecutable}/${demands.length}`);
  console.log(`Com confiança ≥70%: ${stats.confident}/${demands.length}`);
  console.log(`LLM calls: ok=${stats.llmCalls} errors=${stats.llmErrors}`);

  const outPath = path.join(REPO_ROOT, '.tmp_triage_result.json');
  fs.writeFileSync(outPath, JSON.stringify({ stats, results }, null, 2));
  console.log(`\nRelatório: ${outPath}`);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra gravar triage_result + triaged_at no banco.`);
    return;
  }

  // Apply: patch cada demanda
  let ok = 0, fail = 0;
  for (const r of results) {
    try {
      await supa(env, 'PATCH', `/demand_requests?id=eq.${r.id}`, {
        triage_result: r.triage,
        triaged_at: new Date().toISOString(),
      });
      ok++;
    } catch (e) {
      fail++;
      console.log(`  ✗ ${r.id}: ${e.message}`);
    }
  }
  console.log(`\nApply: ok=${ok} fail=${fail}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
