#!/usr/bin/env node
// audit-smart-collections — audita smart collections + alinha com tema Lever.
//
// Detecta:
//  - CATCH_ALL_OR: disjunctive:true + not_contains = catch-all
//  - RULE_TOO_STRICT: disjunctive:false com AND=0 mas OR>0
//  - ONLY_EXCLUSIONS: só not_contains (warn)
//  - MISSING_THEME_HANDLE: handle do tema sem coleção correspondente
//  - EMPTY_THEME_HANDLE: coleção existe mas vazia (< min-products)
//
// Uso:
//   node audit-smart-collections.mjs "<cliente>"                             # DRY-RUN
//   node audit-smart-collections.mjs "<cliente>" --apply                     # Aplica fixes
//   node audit-smart-collections.mjs "<cliente>" --apply --no-create         # Não cria faltantes
//   node audit-smart-collections.mjs "<cliente>" --locale=en                 # Força locale
//   node audit-smart-collections.mjs "<cliente>" --rollback=/tmp/xxx.jsonl   # Desfaz

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { shReq, paginate, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';
import {
  countMatches,
  detectDisjunctiveBug,
  canonicalRuleForHandle,
} from '../../lib/smart-collections.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = { _: [], apply: false, noCreate: false, locale: null, rollback: null, minProducts: 3 };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--no-create') args.noCreate = true;
    else if (a.startsWith('--locale=')) args.locale = a.slice(9);
    else if (a.startsWith('--rollback=')) args.rollback = a.slice(11);
    else if (a.startsWith('--min-products=')) args.minProducts = parseInt(a.slice(15)) || 3;
    else args._.push(a);
  }
  return args;
}

async function fetchAllProducts(shop, token) {
  return paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title`, 'products', 500);
}

async function fetchSmartCollections(shop, token) {
  return paginate(shop, token,
    `/admin/api/${API_VERSION}/smart_collections.json?limit=250`, 'smart_collections', 500);
}

async function fetchCustomCollections(shop, token) {
  return paginate(shop, token,
    `/admin/api/${API_VERSION}/custom_collections.json?limit=250&fields=id,handle,title`, 'custom_collections', 500);
}

async function getCollectionCount(shop, token, colId) {
  const r = await shReq(shop, token, 'GET',
    `/admin/api/${API_VERSION}/products/count.json?collection_id=${colId}`);
  return r.body?.count ?? 0;
}

function detectLocale(shop) {
  const s = shop.toLowerCase();
  if (s.includes('desenvolvimento-en') || s.includes('-en.myshopify') || s.includes('en.myshopify')) return 'en';
  return 'br';
}

function loadThemeHandles() {
  const p = path.join(__dirname, 'theme-handles.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function allExpectedHandles(themeHandles, locale) {
  const l = themeHandles[locale] || {};
  return Array.from(new Set([
    ...(l.teams_br || []), ...(l.teams_intl || []),
    ...(l.national || []), ...(l.leagues || []),
    ...(l.categories || []),
  ]));
}

async function doRollback(shop, token, rollbackPath) {
  console.log(`\n=== ROLLBACK de ${rollbackPath} ===`);
  const lines = fs.readFileSync(rollbackPath, 'utf8').split('\n').filter(Boolean);
  let reverted = 0, failed = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.action === 'fix_disjunctive') {
        const payload = { smart_collection: { id: entry.collection_id, disjunctive: entry.before.disjunctive } };
        const r = await shReq(shop, token, 'PUT',
          `/admin/api/${API_VERSION}/smart_collections/${entry.collection_id}.json`, payload);
        if (r.status >= 200 && r.status < 300) { reverted++; console.log(`  ✓ Revertido: ${entry.collection_title}`); }
        else { failed++; console.log(`  ✗ Falhou: ${entry.collection_title} (${r.status})`); }
      } else if (entry.action === 'create_collection') {
        const r = await shReq(shop, token, 'DELETE',
          `/admin/api/${API_VERSION}/smart_collections/${entry.collection_id}.json`);
        if (r.status >= 200 && r.status < 300) { reverted++; console.log(`  ✓ Deletado: ${entry.handle}`); }
        else { failed++; console.log(`  ✗ Falhou deletar: ${entry.handle}`); }
      }
      await delay(400);
    } catch (err) {
      failed++;
      console.log(`  ✗ Erro parseando linha: ${err.message}`);
    }
  }
  console.log(`\nRollback: ${reverted} revertidos, ${failed} falhas.`);
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node audit-smart-collections.mjs <cliente> [--apply] [--no-create] [--locale=br|en] [--rollback=<path>]');
    process.exit(1);
  }

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const shop = client.shopify_domain;
  const token = client.shopify_access_token;

  // Rollback mode
  if (args.rollback) {
    await doRollback(shop, token, args.rollback);
    return;
  }

  const locale = args.locale || detectLocale(shop);
  console.log(`\n=== audit-smart-collections ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`Cliente: ${client.name} (${shop})`);
  console.log(`Locale:  ${locale}${args.locale ? ' (forçado)' : ' (auto)'}`);

  // FETCH
  console.log(`\nBuscando dados da loja...`);
  const [products, smart, custom] = await Promise.all([
    fetchAllProducts(shop, token),
    fetchSmartCollections(shop, token),
    fetchCustomCollections(shop, token),
  ]);
  console.log(`  ${products.length} produtos | ${smart.length} smart | ${custom.length} custom`);

  const existingHandles = new Set([
    ...smart.map(c => c.handle),
    ...custom.map(c => c.handle),
  ]);
  const smartByHandle = new Map(smart.map(c => [c.handle, c]));

  // CLASSIFY
  const themeHandles = loadThemeHandles();
  const expectedHandles = allExpectedHandles(themeHandles, locale);

  const bugs = [];       // {col, detection}
  const missing = [];    // {handle, canonical}
  const emptyTheme = []; // {handle, col, count}

  console.log(`\nAnalisando ${smart.length} smart collections...`);
  for (const col of smart) {
    const rules = col.rules || [];
    if (rules.length <= 1) continue;
    const detection = detectDisjunctiveBug(rules, col.disjunctive, products);
    if (detection) bugs.push({ col, detection });
  }

  console.log(`Checando ${expectedHandles.length} handles esperados pelo tema...`);
  for (const handle of expectedHandles) {
    if (!existingHandles.has(handle)) {
      const canonical = canonicalRuleForHandle(handle, locale);
      missing.push({ handle, canonical });
    } else {
      // Existe — checa se tá vazio
      const col = smartByHandle.get(handle);
      if (col) {
        const localCount = countMatches(products, col.rules || [], col.disjunctive);
        if (localCount < args.minProducts) emptyTheme.push({ handle, col, count: localCount });
      }
    }
  }

  // REPORT
  console.log(`\n=== RELATÓRIO ===`);
  console.log(`BUGS detectados:      ${bugs.length}`);
  console.log(`  CRITICAL:           ${bugs.filter(b => b.detection.severity === 'CRITICAL').length}`);
  console.log(`  HIGH:               ${bugs.filter(b => b.detection.severity === 'HIGH').length}`);
  console.log(`  WARN:               ${bugs.filter(b => b.detection.severity === 'WARN').length}`);
  console.log(`Handles FALTANTES:    ${missing.length} (de ${expectedHandles.length} esperados)`);
  console.log(`  Com rule canônica:  ${missing.filter(m => m.canonical).length}`);
  console.log(`  Sem regra óbvia:    ${missing.filter(m => !m.canonical).length}`);
  console.log(`Handles VAZIOS:       ${emptyTheme.length}`);

  if (bugs.length) {
    console.log(`\n━━━ BUGS (${bugs.length}) ━━━`);
    for (const b of bugs.slice(0, 20)) {
      console.log(`  [${b.detection.severity}] ${b.col.title} (id=${b.col.id}, handle=${b.col.handle})`);
      console.log(`    ${b.detection.type}: ${b.detection.reason}`);
    }
    if (bugs.length > 20) console.log(`  ...+${bugs.length - 20}`);
  }

  if (missing.length) {
    console.log(`\n━━━ FALTANTES (${missing.length}) ━━━`);
    for (const m of missing.slice(0, 20)) {
      const c = m.canonical;
      if (c) console.log(`  + ${m.handle} → "${c.title}" [${c.fromDict ? 'dict' : 'derived'}] ${c.rules.length} rules`);
      else   console.log(`  + ${m.handle} → ??? (sem regra canônica)`);
    }
    if (missing.length > 20) console.log(`  ...+${missing.length - 20}`);
  }

  if (emptyTheme.length) {
    console.log(`\n━━━ VAZIOS/FRACOS (${emptyTheme.length}) ━━━`);
    for (const e of emptyTheme.slice(0, 20)) {
      console.log(`  ! ${e.handle} → ${e.count} produtos (simulação local)`);
    }
    if (emptyTheme.length > 20) console.log(`  ...+${emptyTheme.length - 20}`);
  }

  if (!bugs.length && !missing.length && !emptyTheme.length) {
    console.log(`\n✓ Tudo OK. Nada a corrigir.`);
    return;
  }

  const totalFixes = bugs.length + missing.length + emptyTheme.length;
  printEstimate({ count: totalFixes, opName: 'fix smart collections (rules + create + relax)', rateLimitMs: 600, unit: 'coleções' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: totalFixes, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra aplicar os fixes.`);
    return;
  }

  // APPLY
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(os.tmpdir(), `audit-smart-${shop.replace('.myshopify.com', '')}-${ts}.jsonl`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  console.log(`\n=== APLICANDO ===`);
  console.log(`Log (rollback): ${logPath}`);

  let fixed = 0, created = 0, failed = 0, skipped = 0;

  // 1. Fix disjunctive bugs
  for (const b of bugs) {
    if (!b.detection.fix) { skipped++; continue; }
    try {
      const beforeState = { disjunctive: b.col.disjunctive };
      const payload = { smart_collection: { id: b.col.id, ...b.detection.fix } };
      const r = await shReq(shop, token, 'PUT',
        `/admin/api/${API_VERSION}/smart_collections/${b.col.id}.json`, payload);
      if (r.status >= 200 && r.status < 300) {
        fixed++;
        console.log(`  ✓ FIX [${b.detection.type}] ${b.col.title} — ${b.detection.reason}`);
        logStream.write(JSON.stringify({
          action: 'fix_disjunctive', collection_id: b.col.id, collection_title: b.col.title,
          handle: b.col.handle, before: beforeState, after: b.detection.fix,
          detection_type: b.detection.type,
        }) + '\n');
      } else {
        failed++;
        console.log(`  ✗ FAIL ${b.col.title}: ${r.status} ${JSON.stringify(r.body).slice(0, 180)}`);
      }
      await delay(500);
    } catch (err) {
      failed++;
      console.log(`  ✗ ERROR ${b.col.title}: ${err.message}`);
    }
  }

  // 2. Criar faltantes (se --no-create não setado)
  if (!args.noCreate) {
    for (const m of missing) {
      if (!m.canonical) { skipped++; continue; }
      try {
        const payload = {
          smart_collection: {
            handle: m.handle,
            title: m.canonical.title,
            rules: m.canonical.rules,
            disjunctive: m.canonical.disjunctive,
            published: true,
            published_scope: 'global',
          },
        };
        const r = await shReq(shop, token, 'POST',
          `/admin/api/${API_VERSION}/smart_collections.json`, payload);
        if (r.status >= 200 && r.status < 300) {
          created++;
          const newId = r.body?.smart_collection?.id;
          console.log(`  + CREATE ${m.handle} → "${m.canonical.title}" (id=${newId})`);
          logStream.write(JSON.stringify({
            action: 'create_collection', collection_id: newId, handle: m.handle,
            title: m.canonical.title,
          }) + '\n');
        } else {
          failed++;
          console.log(`  ✗ FAIL criar ${m.handle}: ${r.status} ${JSON.stringify(r.body).slice(0, 180)}`);
        }
        await delay(500);
      } catch (err) {
        failed++;
        console.log(`  ✗ ERROR criar ${m.handle}: ${err.message}`);
      }
    }
  }

  logStream.end();

  console.log(`\nResultado: fixed=${fixed} created=${created} skipped=${skipped} failed=${failed}`);
  console.log(`Rollback: node .claude/skills/audit-smart-collections/audit-smart-collections.mjs "${client.name}" --rollback=${logPath}`);

  await appendExecutionLog({
    skill: 'audit-smart-collections',
    client_id: client.id,
    client_name: client.name,
    shop,
    locale,
    bugs: bugs.length,
    missing: missing.length,
    empty_theme: emptyTheme.length,
    fixed, created, skipped, failed,
    dry_run: false,
    log_path: logPath,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message, e.stack); process.exit(1); });
