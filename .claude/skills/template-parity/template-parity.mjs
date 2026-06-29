#!/usr/bin/env node
// template-parity — compara themes/lever-br ↔ themes/lever-en arquivo por arquivo.
// Detecta drift estrutural sem se importar com tradução PT/EN.

import { readFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');

function parseArgs() {
  const args = { snippet: null, detail: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--detail') args.detail = true;
    else if (a.startsWith('--snippet=')) args.snippet = a.slice(10);
  }
  return args;
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function listFiles(dir, exts = ['.liquid', '.json']) {
  const out = [];
  if (!await exists(dir)) return out;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile() && exts.some(x => e.name.endsWith(x))) out.push(e.name);
  }
  return out.sort();
}

function lineCount(content) { return content.split('\n').length; }

// Extrai classes CSS usadas (.foo__bar) — proxy de "features" visuais
function extractClasses(content) {
  const out = new Set();
  const re = /\.([a-z][a-z0-9_-]+(?:__[a-z0-9_-]+)?(?:--[a-z0-9_-]+)?)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1].length >= 4 && m[1].includes('-')) out.add(m[1]);
  }
  return out;
}

// Snippets renderizados via {% render 'X' %}
function extractRenders(content) {
  const out = new Set();
  const re = /\{%-?\s*render\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) out.add(m[1]);
  return out;
}

// Block types do {% schema %} (JSON dentro do schema tag)
function extractSchemaBlocks(content) {
  const m = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) return new Set();
  try {
    const json = JSON.parse(m[1]);
    return new Set((json.blocks || []).map(b => b.type));
  } catch {
    return new Set();
  }
}

// Section JSON template — extrai block types do "blocks" object
function extractTemplateBlocks(content) {
  try {
    const json = JSON.parse(content);
    const out = new Set();
    for (const sectionId of Object.keys(json.sections || {})) {
      const section = json.sections[sectionId];
      for (const blockId of Object.keys(section.blocks || {})) {
        out.add(section.blocks[blockId].type);
      }
    }
    return out;
  } catch {
    return new Set();
  }
}

function setDiff(a, b) {
  const onlyA = [...a].filter(x => !b.has(x));
  const onlyB = [...b].filter(x => !a.has(x));
  return { onlyA, onlyB };
}

async function compareFile(relPath) {
  const brPath = join(REPO_ROOT, 'themes', 'lever-br', relPath);
  const enPath = join(REPO_ROOT, 'themes', 'lever-en', relPath);
  const brExists = await exists(brPath);
  const enExists = await exists(enPath);

  if (!brExists && !enExists) return null;
  if (!brExists) return { relPath, status: 'only-en', issues: [{ severity: 'ERROR', msg: 'Arquivo só existe em EN' }] };
  if (!enExists) return { relPath, status: 'only-br', issues: [{ severity: 'ERROR', msg: 'Arquivo só existe em BR' }] };

  const br = await readFile(brPath, 'utf8');
  const en = await readFile(enPath, 'utf8');
  const issues = [];

  const brLines = lineCount(br);
  const enLines = lineCount(en);
  const diff = brLines === 0 ? 0 : Math.abs(brLines - enLines) / brLines;
  if (diff > 0.3) {
    const sign = brLines > enLines ? 'BR maior' : 'EN maior';
    issues.push({
      severity: 'WARN',
      msg: `${brLines} BR vs ${enLines} EN (diff ${(diff * 100).toFixed(0)}%, ${sign})`,
    });
  }

  // Liquid-specific: classes, renders, schema blocks
  if (relPath.endsWith('.liquid')) {
    const cls = setDiff(extractClasses(br), extractClasses(en));
    if (cls.onlyA.length > 0) issues.push({ severity: 'ERROR', msg: `Classes só em BR: ${cls.onlyA.slice(0, 8).join(', ')}${cls.onlyA.length > 8 ? '...' : ''}` });
    if (cls.onlyB.length > 0) issues.push({ severity: 'ERROR', msg: `Classes só em EN: ${cls.onlyB.slice(0, 8).join(', ')}${cls.onlyB.length > 8 ? '...' : ''}` });

    const renders = setDiff(extractRenders(br), extractRenders(en));
    if (renders.onlyA.length > 0) issues.push({ severity: 'WARN', msg: `Render só em BR: ${renders.onlyA.join(', ')}` });
    if (renders.onlyB.length > 0) issues.push({ severity: 'WARN', msg: `Render só em EN: ${renders.onlyB.join(', ')}` });

    if (relPath.startsWith('sections/')) {
      const blocks = setDiff(extractSchemaBlocks(br), extractSchemaBlocks(en));
      if (blocks.onlyA.length > 0) issues.push({ severity: 'ERROR', msg: `Schema block só em BR: ${blocks.onlyA.join(', ')}` });
      if (blocks.onlyB.length > 0) issues.push({ severity: 'ERROR', msg: `Schema block só em EN: ${blocks.onlyB.join(', ')}` });
    }
  }

  // Templates JSON: comparar block types
  if (relPath.endsWith('.json') && relPath.startsWith('templates/')) {
    const blocks = setDiff(extractTemplateBlocks(br), extractTemplateBlocks(en));
    if (blocks.onlyA.length > 0) issues.push({ severity: 'ERROR', msg: `Block só em BR: ${blocks.onlyA.join(', ')}` });
    if (blocks.onlyB.length > 0) issues.push({ severity: 'ERROR', msg: `Block só em EN: ${blocks.onlyB.join(', ')}` });
  }

  return { relPath, status: issues.length ? 'diff' : 'ok', issues };
}

async function main() {
  const args = parseArgs();

  // Inventariar arquivos dos dois lados
  const subdirs = ['snippets', 'sections', 'templates', 'config'];
  const allFiles = new Set();
  for (const sub of subdirs) {
    const brList = await listFiles(join(REPO_ROOT, 'themes', 'lever-br', sub));
    const enList = await listFiles(join(REPO_ROOT, 'themes', 'lever-en', sub));
    for (const f of brList) allFiles.add(`${sub}/${f}`);
    for (const f of enList) allFiles.add(`${sub}/${f}`);
  }

  const filtered = args.snippet ? [...allFiles].filter(f => f.endsWith(args.snippet)) : [...allFiles].sort();

  console.log('═══════════════════════════════════════');
  console.log(`template-parity  br ↔ en  (${filtered.length} arquivos)`);
  console.log('═══════════════════════════════════════');

  let onlyBr = 0, onlyEn = 0, diff = 0, ok = 0, totalErr = 0, totalWarn = 0;

  for (const rel of filtered) {
    const r = await compareFile(rel);
    if (!r) continue;

    if (r.status === 'only-br') onlyBr++;
    else if (r.status === 'only-en') onlyEn++;
    else if (r.status === 'diff') diff++;
    else ok++;

    if (r.issues.length === 0 && !args.detail) continue;

    console.log(`\n[${r.relPath}]`);
    if (r.issues.length === 0) console.log(`  ✓ paridade ok`);
    for (const i of r.issues) {
      console.log(`  ${i.severity.padEnd(5)} ${i.msg}`);
      if (i.severity === 'ERROR') totalErr++;
      else if (i.severity === 'WARN') totalWarn++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`Resultado: ${ok} ok · ${diff} divergentes · ${onlyBr} só-BR · ${onlyEn} só-EN`);
  console.log(`           ${totalErr} ERROR · ${totalWarn} WARN`);
  console.log('═══════════════════════════════════════');

  process.exit(totalErr > 0 ? 1 : 0);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.stack); process.exit(1); });
