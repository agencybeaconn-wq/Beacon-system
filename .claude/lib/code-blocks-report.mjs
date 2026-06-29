// Auto-generated session report for /code-blocks operations
// Writes to blocks/reports/YYYY-MM-DD_loja_resumo.md (format per ~/.claude/CLAUDE.md)

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVER_SYSTEM_DEFAULT = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System';

function resolveLeverSystem() {
  if (process.env.LEVER_SYSTEM) return process.env.LEVER_SYSTEM;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, '..', '..');
  } catch {
    return LEVER_SYSTEM_DEFAULT;
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(str) {
  return String(str).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateReport({
  loja,
  data,
  resumo = '',
  blocos = [],
  erros = [],
  melhorias = [],
  candidato = 'pendente'
}) {
  const d = data || todayISO();
  const fmt = (arr) => arr.length ? arr.map(x => `  - ${x}`).join('\n') : '  - —';

  return [
    `# Relatório: ${loja} — ${d}`,
    '',
    `- **O que foi feito:** ${resumo || '—'}`,
    `- **Blocos usados:**`,
    fmt(blocos),
    `- **Erros:**`,
    fmt(erros),
    `- **Melhorias:**`,
    fmt(melhorias),
    `- **Candidato?:** ${candidato}`,
    ''
  ].join('\n');
}

export function writeReport(input) {
  const { loja, data } = input;
  if (!loja) throw new Error('writeReport: loja é obrigatório');

  const d = data || todayISO();
  const filename = `${d}_${slugify(loja)}_resumo.md`;
  const reportsDir = join(resolveLeverSystem(), 'blocks', 'reports');

  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

  const filepath = join(reportsDir, filename);
  const content = generateReport(input);
  writeFileSync(filepath, content, 'utf-8');

  return { filepath, filename };
}
