#!/usr/bin/env node
// curator-pre-write hook — AUTOCONSCIENTE
// Decide se deve auditar baseado em contexto. Não roda em tudo cego.
// Bypass: env CURATOR_OFF=1, frontmatter do_not_curate:true, frase "bypass curator"

import fs from 'fs';
import path from 'path';
import os from 'os';

const STATE_FILE = path.join(os.tmpdir(), 'curator-state.json');
const VAULT_PATH = 'Lever QI';

// === BYPASS GLOBAL ===
if (process.env.CURATOR_OFF === '1') process.exit(0);

// === PAYLOAD ===
let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let payload;
try { payload = JSON.parse(raw); } catch { process.exit(0); }

const toolName = payload.tool_name || payload.name || '';
const toolInput = payload.tool_input || payload.input || {};
const filePath = toolInput.file_path || toolInput.path || '';

// === AUTOCONSCIÊNCIA: SHOULD I WORK? ===

// 1. Não é Write/Edit → skip
if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
  process.exit(0);
}

// 2. Não é no vault Lever QI → skip
if (!filePath.includes(VAULT_PATH)) {
  process.exit(0);
}

// 3. Path em pasta de archive/temp/sandbox → skip
const skipPaths = ['_archived', '_backup', '/tmp/', '/test', '/sandbox', '.bak', '/_drafts/'];
if (skipPaths.some(p => filePath.includes(p))) {
  process.exit(0);
}

// 4. Frontmatter do_not_curate:true → skip
if (fs.existsSync(filePath)) {
  try {
    const cur = fs.readFileSync(filePath, 'utf8');
    if (/^do_not_curate:\s*true/m.test(cur)) process.exit(0);
  } catch {}
}

// 5. Mass operation detection
const now = Date.now();
let state = { lastWrites: [] };
try {
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
} catch {}
state.lastWrites = (state.lastWrites || []).filter(t => now - t < 30000); // window 30s
state.lastWrites.push(now);
const writesIn30s = state.lastWrites.length;

// Se >5 writes em 30s → mass op → só audita 1 a cada 5
const isMassOp = writesIn30s > 5;
const isAuditTurn = writesIn30s % 5 === 0;

if (isMassOp && !isAuditTurn) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  // Em mass op fora do turno, só registra mas não audita
  console.error(`[curator] skip mass-op write ${writesIn30s}/30s`);
  process.exit(0);
}

fs.writeFileSync(STATE_FILE, JSON.stringify(state));

// === AGORA SIM AUDITA ===
const warnings = [];
const newContent = toolInput.content || toolInput.new_string || '';

// Severity: high priority = pedro-dev root canonical (tier:1 alta prioridade)
const isCanonical = /pedro-dev\/(00-profile|01-scope|02-deliverables|03-cadence|04-toolkit|README)\.md$/.test(filePath);

// Check 1: memory citada existe (sempre)
const memoryRefs = [...newContent.matchAll(/\[\[(feedback_[a-z_]+|project_[a-z_]+)\]\]/g)];
if (memoryRefs.length > 0) {
  const memoryDir = 'C:/Users/pedro/.claude/projects/c--Users-pedro-OneDrive-Documentos-Lever-System-Lever-System/memory';
  for (const m of memoryRefs) {
    const memName = m[1];
    if (!fs.existsSync(path.join(memoryDir, memName + '.md'))) {
      warnings.push(`Memory citada inexistente: [[${memName}]]`);
    }
  }
}

// Check 2: frontmatter tier (em canonical)
if (newContent.startsWith('---') && isCanonical) {
  const fm = newContent.split('---', 3).slice(1, 2).join('');
  if (!/^tier:/m.test(fm)) {
    warnings.push(`Tier 1 canonical sem 'tier:' — agente vai ler sempre`);
  }
}

// Check 3: MVP wall (só pra tier:1)
const tierMatch = newContent.match(/^tier:\s*(\d)/m);
const tier = tierMatch ? parseInt(tierMatch[1]) : null;
const lines = newContent.split('\n').length;
if (tier === 1 && lines > 100 && !/override_reason:/m.test(newContent)) {
  warnings.push(`Tier 1 com ${lines} linhas excede MVP wall (100) sem 'override_reason'`);
}

// Output
if (warnings.length > 0) {
  console.error(`[curator] ${warnings.length} flag(s) em ${path.basename(filePath)}${isMassOp ? ` (mass-op audit ${writesIn30s}/30s)` : ''}:`);
  warnings.forEach(w => console.error(`  - ${w}`));
}

process.exit(0);
