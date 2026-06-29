#!/usr/bin/env node
// clone-self-heal — passo de auto-correção pós-assemble.
//
// O que checa e corrige automaticamente:
//   1. Todos os *.json em config/, templates/ e sections/ — JSON.parse válido?
//      Se quebrar, tenta auto-fix (trailing comma, aspas duplas) ou stub mínimo.
//   2. Cada section ref em templates/*.json → o arquivo sections/<type>.liquid existe?
//      Se não, troca ref por placeholder válido (rich-text vazio).
//   3. Cada {% render 'X' %} → snippets/X.liquid existe?
//      Se não, COMENTA o render e loga.
//   4. Cada {{ 'X' | asset_url }} → assets/X existe?
//      Se não, GERA placeholder.svg (1×1 transparente) com o nome certo.
//   5. settings_schema.json: valida estrutura, fixa duplicate ids, garante "name" em cada bloco.
//   6. templates JSON: garante "order" array sem duplicatas, "sections" sem refs órfãs.
//   7. Roda `shopify theme check` no fim (se CLI disponível) e parseia output.
//
// Idempotente: se rodar 2x, 2ª vez não faz nada (já foi sanado).
//
// Uso:
//   node clone-self-heal.mjs <slug>
//   node clone-self-heal.mjs <slug> --dry-run   (só reporta, não muda)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const TRANSPARENT_PIXEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="transparent"/></svg>`;

function parseArgs() {
  const a = { slug: null, dryRun: false };
  for (const v of process.argv.slice(2)) {
    if (v === '--dry-run') a.dryRun = true;
    else if (!v.startsWith('--')) a.slug = v;
  }
  return a;
}

function walk(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (!ext || e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

// ============================================================
// HEAL 1 — JSON parse + auto-fix de erros comuns
// ============================================================

function tryParse(content) {
  try { return { ok: true, json: JSON.parse(content) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function autoFixJson(content) {
  let fixed = content;
  // Remove trailing commas
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  // Garante aspas duplas em chaves (best-effort)
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  return fixed;
}

function healJsonFiles(workspace, report, dryRun) {
  const dirs = ['config', 'templates', 'sections'].map(d => path.join(workspace, d));
  for (const dir of dirs) {
    for (const file of walk(dir, '.json')) {
      const rel = path.relative(workspace, file);
      const content = fs.readFileSync(file, 'utf8');
      const r1 = tryParse(content);
      if (r1.ok) continue;
      report.push(`[json-broken] ${rel}: ${r1.error}`);
      const fixed = autoFixJson(content);
      const r2 = tryParse(fixed);
      if (r2.ok) {
        if (!dryRun) fs.writeFileSync(file, JSON.stringify(r2.json, null, 2), 'utf8');
        report.push(`  ↳ auto-fix aplicado (trailing comma / aspas)`);
      } else {
        report.push(`  ↳ auto-fix falhou: ${r2.error}. Substituindo por stub mínimo.`);
        const stub = rel.startsWith('templates') ? { sections: {}, order: [] } : {};
        if (!dryRun) fs.writeFileSync(file, JSON.stringify(stub, null, 2), 'utf8');
      }
    }
  }
}

// ============================================================
// HEAL 2 — Template section refs → sections existentes
// ============================================================

function healTemplateSectionRefs(workspace, report, dryRun) {
  const tDir = path.join(workspace, 'templates');
  const sDir = path.join(workspace, 'sections');
  const availableSections = new Set(walk(sDir, '.liquid').map(f => path.basename(f, '.liquid')));

  for (const tFile of walk(tDir, '.json')) {
    const rel = path.relative(workspace, tFile);
    let json;
    try { json = JSON.parse(fs.readFileSync(tFile, 'utf8')); } catch { continue; }
    if (!json.sections) continue;

    let modified = false;
    for (const [key, sec] of Object.entries(json.sections)) {
      const type = sec.type;
      if (!type || availableSections.has(type)) continue;
      report.push(`[orphan-section-ref] ${rel}: "${key}" → type "${type}" não existe em sections/`);
      // Substitui por placeholder seguro (rich-text vazio)
      json.sections[key] = { type: 'rich-text', settings: {}, _replaced_from: type };
      modified = true;
    }

    if (modified && !dryRun) {
      fs.writeFileSync(tFile, JSON.stringify(json, null, 2), 'utf8');
      report.push(`  ↳ ${rel} sanitizado`);
    }
  }
}

// ============================================================
// HEAL 3 — {% render 'X' %} → snippets/X.liquid
// ============================================================

function healSnippetRefs(workspace, report, dryRun) {
  const snippetsDir = path.join(workspace, 'snippets');
  const available = new Set(walk(snippetsDir, '.liquid').map(f => path.basename(f, '.liquid')));

  const liquidFiles = [
    ...walk(path.join(workspace, 'sections'), '.liquid'),
    ...walk(path.join(workspace, 'layout'), '.liquid'),
    ...walk(snippetsDir, '.liquid'),
    ...walk(path.join(workspace, 'templates'), '.liquid'),
  ];

  const renderRe = /\{%-?\s*render\s+['"]([\w-]+)['"]/g;
  for (const f of liquidFiles) {
    let content = fs.readFileSync(f, 'utf8');
    let modified = false;
    const m = [...content.matchAll(renderRe)];
    for (const match of m) {
      const name = match[1];
      if (available.has(name)) continue;
      report.push(`[orphan-snippet] ${path.relative(workspace, f)}: render '${name}' não existe`);
      // Comenta o render quebrado
      const fix = match[0].replace(/\{%-?\s*render/, '{%- comment %}render');
      content = content.replace(match[0], fix + ` (snippet missing){%- endcomment -%}`);
      modified = true;
    }
    if (modified && !dryRun) fs.writeFileSync(f, content, 'utf8');
  }
}

// ============================================================
// HEAL 4 — {{ 'X' | asset_url }} → garante assets/X
// ============================================================

function healAssetRefs(workspace, report, dryRun) {
  const assetsDir = path.join(workspace, 'assets');
  const available = new Set(fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : []);

  const liquidFiles = [
    ...walk(path.join(workspace, 'sections'), '.liquid'),
    ...walk(path.join(workspace, 'layout'), '.liquid'),
    ...walk(path.join(workspace, 'snippets'), '.liquid'),
  ];

  const assetRe = /\{\{\s*['"]([^'"]+\.(?:css|js|svg|png|jpg|jpeg|webp))['"]\s*\|\s*asset_url/g;
  for (const f of liquidFiles) {
    const content = fs.readFileSync(f, 'utf8');
    for (const match of content.matchAll(assetRe)) {
      const name = match[1];
      if (available.has(name)) continue;
      report.push(`[missing-asset] ${path.relative(workspace, f)}: asset '${name}' não existe`);
      if (!dryRun) {
        const outPath = path.join(assetsDir, name);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const ext = path.extname(name).toLowerCase();
        if (ext === '.svg' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
          fs.writeFileSync(outPath, TRANSPARENT_PIXEL_SVG, 'utf8');
        } else if (ext === '.css') {
          fs.writeFileSync(outPath, `/* placeholder gerado por clone-self-heal */\n`, 'utf8');
        } else if (ext === '.js') {
          fs.writeFileSync(outPath, `// placeholder gerado por clone-self-heal\n`, 'utf8');
        }
        available.add(name);
      }
    }
  }
}

// ============================================================
// HEAL 5 — settings_schema.json: ids duplicados, blocks sem name
// ============================================================

function healSettingsSchema(workspace, report, dryRun) {
  const p = path.join(workspace, 'config', 'settings_schema.json');
  if (!fs.existsSync(p)) return;
  let arr;
  try { arr = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return; }
  if (!Array.isArray(arr)) return;

  const seenIds = new Set();
  let modified = false;
  for (const section of arr) {
    if (!section.name) {
      section.name = section.theme_author ? 'theme_info' : 'untitled-section';
      report.push(`[settings-schema] section sem name → ${section.name}`);
      modified = true;
    }
    if (Array.isArray(section.settings)) {
      for (const s of section.settings) {
        if (!s.id || s.type === 'header' || s.type === 'paragraph') continue;
        if (seenIds.has(s.id)) {
          const newId = `${s.id}_${Math.random().toString(36).slice(2, 6)}`;
          report.push(`[settings-schema] id duplicado "${s.id}" → "${newId}"`);
          s.id = newId;
          modified = true;
        }
        seenIds.add(s.id);
      }
    }
  }
  if (modified && !dryRun) fs.writeFileSync(p, JSON.stringify(arr, null, 2), 'utf8');
}

// ============================================================
// HEAL 6 — templates/*.json order sem refs órfãs
// ============================================================

function healTemplateOrder(workspace, report, dryRun) {
  const tDir = path.join(workspace, 'templates');
  for (const f of walk(tDir, '.json')) {
    let json;
    try { json = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    if (!json.sections || !json.order) continue;
    const keys = new Set(Object.keys(json.sections));
    const cleanOrder = json.order.filter(k => keys.has(k));
    const seen = new Set();
    const dedupOrder = cleanOrder.filter(k => { if (seen.has(k)) return false; seen.add(k); return true; });
    if (dedupOrder.length !== json.order.length) {
      report.push(`[template-order] ${path.relative(workspace, f)}: corrigido (era ${json.order.length}, agora ${dedupOrder.length})`);
      json.order = dedupOrder;
      if (!dryRun) fs.writeFileSync(f, JSON.stringify(json, null, 2), 'utf8');
    }
  }
}

// ============================================================
// HEAL 7 — shopify theme check (opcional, se CLI disponível)
// ============================================================

function runThemeCheck(workspace, report) {
  try {
    const out = execSync(`npx shopify theme check --output=json "${workspace}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      const j = JSON.parse(out);
      const errors = (j || []).filter(x => x.severity === 0 || x.severity === 'error');
      const warnings = (j || []).filter(x => x.severity === 1 || x.severity === 'warning');
      report.push(`[theme-check] ${errors.length} erros, ${warnings.length} warnings`);
      for (const e of errors.slice(0, 10)) report.push(`  ✗ ${e.path}:${e.start_row} — ${e.message}`);
    } catch {
      report.push(`[theme-check] CLI rodou mas output não é JSON parseável`);
    }
  } catch (e) {
    report.push(`[theme-check] não disponível (npx shopify CLI ausente?) — pulado`);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = parseArgs();
  if (!args.slug) { console.error('Uso: node clone-self-heal.mjs <slug> [--dry-run]'); process.exit(1); }
  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  if (!fs.existsSync(workspace)) { console.error(`Workspace não existe: ${workspace}`); process.exit(1); }

  console.log(`\n=== clone-self-heal ${args.dryRun ? '[dry-run]' : ''} ===`);
  console.log(`  Workspace: ${path.relative(REPO_ROOT, workspace)}`);

  const report = [];

  console.log(`\n  [1/7] JSON parse + auto-fix...`);
  healJsonFiles(workspace, report, args.dryRun);

  console.log(`  [2/7] Template section refs...`);
  healTemplateSectionRefs(workspace, report, args.dryRun);

  console.log(`  [3/7] Snippet renders...`);
  healSnippetRefs(workspace, report, args.dryRun);

  console.log(`  [4/7] Asset refs...`);
  healAssetRefs(workspace, report, args.dryRun);

  console.log(`  [5/7] settings_schema.json...`);
  healSettingsSchema(workspace, report, args.dryRun);

  console.log(`  [6/7] Template order dedup...`);
  healTemplateOrder(workspace, report, args.dryRun);

  console.log(`  [7/7] shopify theme check...`);
  runThemeCheck(workspace, report);

  // Save report
  const reportPath = path.join(workspace, '_design', 'self-heal.report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    slug: args.slug,
    dry_run: args.dryRun,
    ran_at: new Date().toISOString(),
    issues: report,
    total: report.length,
  }, null, 2), 'utf8');

  console.log(`\n  ${report.length === 0 ? '✓ Nenhuma issue encontrada — tema OK' : `⚠ ${report.length} issues processadas`}`);
  if (report.length > 0 && report.length <= 30) {
    for (const r of report) console.log(`    ${r}`);
  }
  console.log(`\n  Relatório: ${path.relative(REPO_ROOT, reportPath)}\n`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
