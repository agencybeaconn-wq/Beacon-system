#!/usr/bin/env node
// theme-preview — devolve a URL de preview do draft theme atual de um cliente.
//
// Uso:
//   node theme-preview.mjs <clientIdOrName>          # só imprime a URL
//   node theme-preview.mjs <clientIdOrName> --open   # tenta abrir no browser default

import { fetchClient } from '../../lib/supabase-rest.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

async function main() {
  const arg = process.argv[2];
  const openFlag = process.argv.includes('--open');
  if (!arg) {
    console.error('Uso: node theme-preview.mjs <clientIdOrName> [--open]');
    process.exit(1);
  }

  const client = await fetchClient(arg);
  if (!client) { console.error('Cliente não encontrado'); process.exit(1); }

  const metaFile = path.join(REPO_ROOT, `themes/client-${client.id.slice(0, 8)}/.theme-draft.json`);
  if (!fs.existsSync(metaFile)) {
    console.error(`\n❌ Nenhum draft criado pra "${client.name}".`);
    console.error(`   Rode: node .claude/skills/lever-theme/theme-duplicate.mjs "${client.name}"`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  console.log(`\n📋 Draft Theme — ${client.name}`);
  console.log(`\n   Nome:      ${meta.draftName}`);
  console.log(`   ID:        ${meta.draftThemeId}`);
  console.log(`   Criado:    ${meta.createdAt}`);
  console.log(`\n   🔗 Preview: ${meta.previewUrl}`);

  if (openFlag) {
    const cmd = process.platform === 'win32'
      ? `start "" "${meta.previewUrl}"`
      : process.platform === 'darwin'
      ? `open "${meta.previewUrl}"`
      : `xdg-open "${meta.previewUrl}"`;
    console.log(`\nAbrindo no browser...`);
    exec(cmd);
  }
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
