#!/usr/bin/env node
// Extracts Monte Royal context from Claude Code session JSONL files.
// Output: clients/monte-royal/CONTEXTO_COMPLETO.md + clients/monte-royal/code-blocks/*.{liquid,json}

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const SESSIONS_DIR = '/Users/joaovithorbauer/.claude/projects/-Users-joaovithorbauer-Documents-Projetos-Lever-Lever-System';
const OUT_DIR = '/Users/joaovithorbauer/Documents/Projetos Lever/Lever System/clients/monte-royal';
const CODE_DIR = path.join(OUT_DIR, 'code-blocks');

const SESSION_FILES = [
  '70c1dcae-a129-4182-ba8b-13ede34569c8.jsonl',
  'cd87670f-2853-453f-8e33-805ee11d70d0.jsonl',
  '30172dd2-ca88-4328-8b06-f0fb0a0bce6c.jsonl',
];

// Match Monte Royal references (case-insensitive, multiple spellings)
const MR_RE = /\b(monte\s*royal|montroyal|monte-royal)\b/i;

fs.mkdirSync(CODE_DIR, { recursive: true });

function flattenContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((c) => {
      if (typeof c === 'string') return c;
      if (c?.type === 'text') return c.text || '';
      if (c?.type === 'tool_use') {
        // Capture write/edit operations & bash commands as they may contain section code
        const name = c.name || '';
        const input = c.input || {};
        if (name === 'Write' && input.file_path) {
          return `\n[TOOL: Write → ${input.file_path}]\n\`\`\`\n${(input.content || '').slice(0, 8000)}\n\`\`\`\n`;
        }
        if (name === 'Edit' && input.file_path) {
          return `\n[TOOL: Edit → ${input.file_path}]\nold:\n\`\`\`\n${(input.old_string || '').slice(0, 2000)}\n\`\`\`\nnew:\n\`\`\`\n${(input.new_string || '').slice(0, 2000)}\n\`\`\`\n`;
        }
        if (name === 'Bash' && input.command) {
          return `\n[TOOL: Bash] \`${(input.command || '').slice(0, 400)}\` — ${input.description || ''}\n`;
        }
        return `\n[TOOL: ${name}]\n`;
      }
      if (c?.type === 'tool_result') {
        const t = typeof c.content === 'string' ? c.content : JSON.stringify(c.content || '').slice(0, 500);
        return `\n[TOOL RESULT]: ${t.slice(0, 500)}${t.length > 500 ? '…' : ''}\n`;
      }
      return '';
    })
    .join('\n');
}

async function processFile(filePath) {
  const entries = [];
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'user' && obj.type !== 'assistant') continue;
      if (!obj.message) continue;
      const text = flattenContent(obj.message.content);
      if (!text || !text.trim()) continue;
      entries.push({
        ts: obj.timestamp,
        role: obj.message.role,
        text,
        sessionId: obj.sessionId,
        uuid: obj.uuid,
      });
    } catch {}
  }
  return entries;
}

function pickRelevant(entries) {
  // Mark direct hits, then expand window to ±3 entries to keep conversational context
  const hits = new Set();
  entries.forEach((e, i) => {
    if (MR_RE.test(e.text)) {
      for (let j = Math.max(0, i - 3); j <= Math.min(entries.length - 1, i + 3); j++) {
        hits.add(j);
      }
    }
  });
  return [...hits].sort((a, b) => a - b).map((i) => entries[i]);
}

function extractCodeBlocks(text, sessionShort, idx) {
  // Capture fenced code blocks; tag liquid/json/html
  const blocks = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let m;
  let n = 0;
  while ((m = re.exec(text)) !== null) {
    const lang = (m[1] || 'txt').toLowerCase();
    const body = m[2];
    if (body.length < 80) continue; // skip tiny snippets
    blocks.push({ lang, body, idx: n++ });
  }
  return blocks;
}

function fmt(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return ts;
  }
}

function shortRole(role) {
  return role === 'user' ? '👤 PEDRO' : '🤖 CLAUDE';
}

(async () => {
  console.log('Reading sessions…');
  const allRelevant = [];
  for (const f of SESSION_FILES) {
    const fp = path.join(SESSIONS_DIR, f);
    console.log('  →', f);
    const entries = await processFile(fp);
    const rel = pickRelevant(entries);
    console.log(`     ${entries.length} total, ${rel.length} relevant`);
    rel.forEach((e) => (e.session = f.slice(0, 8)));
    allRelevant.push(...rel);
  }

  // Sort by timestamp
  allRelevant.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));

  // Dedupe consecutive duplicates
  const dedup = [];
  for (const e of allRelevant) {
    const last = dedup[dedup.length - 1];
    if (last && last.text === e.text && last.role === e.role) continue;
    dedup.push(e);
  }

  console.log(`Total relevant entries: ${dedup.length}`);

  // Extract & save code blocks
  let codeFileCount = 0;
  const codeIndex = [];
  dedup.forEach((e, i) => {
    const blocks = extractCodeBlocks(e.text, e.session, i);
    blocks.forEach((b) => {
      const ext = b.lang === 'liquid' ? 'liquid' : b.lang === 'json' ? 'json' : b.lang === 'html' ? 'html' : b.lang === 'css' ? 'css' : b.lang === 'js' || b.lang === 'javascript' ? 'js' : b.lang === 'tsx' ? 'tsx' : b.lang === 'ts' || b.lang === 'typescript' ? 'ts' : 'txt';
      const fname = `${String(codeFileCount).padStart(3, '0')}_${e.session}_${e.role}_${b.lang}.${ext}`;
      fs.writeFileSync(path.join(CODE_DIR, fname), b.body);
      codeIndex.push({ fname, lang: b.lang, role: e.role, ts: e.ts, preview: b.body.slice(0, 120).replace(/\n/g, ' ') });
      codeFileCount++;
    });
  });

  // Build markdown
  let md = '';
  md += '# Monte Royal — Contexto Completo Resgatado\n\n';
  md += `_Gerado em: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}_\n\n`;
  md += `Resgate de **${SESSION_FILES.length}** sessões do Claude Code, **${dedup.length}** mensagens relevantes, **${codeFileCount}** blocos de código.\n\n`;
  md += '## Como usar\n\n';
  md += 'Este arquivo concentra todo o contexto da loja Monte Royal das sessões anteriores. ';
  md += 'Use como referência ao abrir nova sessão — cole o trecho relevante ou referencie o arquivo inteiro.\n\n';
  md += `Blocos de código completos estão em \`code-blocks/\` (${codeFileCount} arquivos).\n\n`;
  md += '---\n\n';
  md += '## Índice de Blocos de Código\n\n';
  if (codeIndex.length === 0) {
    md += '_Nenhum bloco de código relevante encontrado._\n\n';
  } else {
    md += '| # | Arquivo | Linguagem | Origem | Preview |\n|---|---|---|---|---|\n';
    codeIndex.forEach((c, i) => {
      md += `| ${i} | \`code-blocks/${c.fname}\` | ${c.lang} | ${c.role} | ${c.preview.replace(/\|/g, '\\|').slice(0, 80)}… |\n`;
    });
    md += '\n';
  }
  md += '---\n\n';
  md += '## Conversa (ordem cronológica)\n\n';

  let lastSession = null;
  dedup.forEach((e, i) => {
    if (e.session !== lastSession) {
      md += `\n### 📂 Sessão ${e.session}\n\n`;
      lastSession = e.session;
    }
    md += `#### [${i}] ${shortRole(e.role)} — ${fmt(e.ts)}\n\n`;
    // Truncate huge entries (over 6000 chars), but keep enough context
    const t = e.text.length > 6000 ? e.text.slice(0, 6000) + '\n\n_…[truncado, ver code-blocks/]_' : e.text;
    md += t + '\n\n---\n\n';
  });

  const outPath = path.join(OUT_DIR, 'CONTEXTO_COMPLETO.md');
  fs.writeFileSync(outPath, md);
  console.log(`\n✓ Markdown salvo em: ${outPath}`);
  console.log(`✓ ${codeFileCount} blocos de código em: ${CODE_DIR}`);
  console.log(`✓ Tamanho do markdown: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
})();
