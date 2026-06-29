#!/usr/bin/env node
// theme-watch — live preview editando tema duplicado via `shopify theme dev`.
//
// Fluxo:
//  1. Verifica se cliente tem draft (.theme-draft.json); se não, cria via theme-duplicate
//  2. Lê draftThemeId + shop do .theme-draft.json
//  3. Muda cwd pra themes/client-<id>/
//  4. Executa `npx shopify theme dev --theme=<draftId> --store=<shop>`
//  5. Shopify CLI cuida de file watcher + auto-push + live reload no localhost:9292
//
// Uso:
//   node theme-watch.mjs <clientIdOrName>
//   node theme-watch.mjs <clientIdOrName> --side=br   # usa tema local lever-br em vez do client folder
//
// Requisito: shopify CLI autenticado (via `shopify login` ou SHOPIFY_CLI_THEME_TOKEN)
//
// ⚠️ Processo fica vivo enquanto user está editando. Ctrl+C pra parar.

import { fetchClient } from '../../lib/supabase-rest.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const args = { _: [], side: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--side=')) args.side = a.slice(7);
    else args._.push(a);
  }
  return args;
}

function resolveThemeDir(client, side) {
  // Sides aceitos: 'br', 'en', ou nada (usa client-<id>)
  if (side === 'br') return 'themes/lever-br';
  if (side === 'en') return 'themes/lever-en';
  // Default: pasta específica do cliente
  const clientDir = `themes/client-${client.id.slice(0, 8)}`;
  if (!fs.existsSync(path.join(REPO_ROOT, clientDir))) {
    return null;
  }
  return clientDir;
}

function readDraftMeta(client) {
  const metaFile = path.join(REPO_ROOT, `themes/client-${client.id.slice(0, 8)}/.theme-draft.json`);
  if (!fs.existsSync(metaFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node theme-watch.mjs <clientIdOrName> [--side=br|en]');
    process.exit(1);
  }

  const client = await fetchClient(clientArg);
  if (!client) {
    console.error(`❌ Cliente "${clientArg}" não encontrado`);
    process.exit(1);
  }
  if (!client.shopify_access_token) {
    console.error(`❌ Cliente "${client.name}" sem Shopify conectada`);
    process.exit(1);
  }

  console.log(`\n=== theme-watch ===`);
  console.log(`Cliente: ${client.name} (${client.shopify_domain})`);

  // Determina theme target
  const shop = client.shopify_domain;
  let themeDir, targetTheme;

  if (args.side === 'br' || args.side === 'en') {
    themeDir = resolveThemeDir(client, args.side);
    console.log(`⚠ Modo template: usando ${themeDir} direto (sem draft).`);
    console.log(`⚠ ATENÇÃO: mudanças vão afetar o tema DEV da loja de desenvolvimento.`);
  } else {
    // Modo client draft
    const meta = readDraftMeta(client);
    if (!meta) {
      console.error(`\n❌ Nenhum draft criado pra "${client.name}".`);
      console.error(`   Rode primeiro: node .claude/skills/lever-theme/theme-duplicate.mjs "${client.name}"`);
      console.error(`   Ou use --side=br|en pra editar tema template diretamente na dev store.`);
      process.exit(1);
    }
    targetTheme = meta.draftThemeId;
    themeDir = `themes/client-${client.id.slice(0, 8)}`;
    console.log(`✓ Draft theme encontrado: id=${targetTheme} (${meta.draftName})`);
  }

  console.log(`✓ Diretório local: ${themeDir}`);

  const fullThemeDir = path.join(REPO_ROOT, themeDir);
  if (!fs.existsSync(fullThemeDir)) {
    console.error(`❌ Diretório ${fullThemeDir} não existe.`);
    console.error(`   Rode primeiro: node .claude/skills/lever-theme/theme-pull-client.mjs "${client.name}"`);
    process.exit(1);
  }

  // Monta comando
  const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const cliArgs = ['shopify', 'theme', 'dev',
    `--store=${shop}`,
  ];
  if (targetTheme) cliArgs.push(`--theme=${targetTheme}`);
  // Passa token via env var — CLI aceita isso
  const env = {
    ...process.env,
    SHOPIFY_CLI_THEME_TOKEN: client.shopify_access_token,
    SHOPIFY_FLAG_STORE: shop,
  };

  console.log(`\nExecutando: npx ${cliArgs.join(' ')}`);
  console.log(`cwd: ${themeDir}`);
  console.log(`\n⏯  Iniciando hot reload...`);
  console.log(`   → Preview em http://localhost:9292`);
  console.log(`   → Edite arquivos localmente e veja mudanças ao vivo no browser.`);
  console.log(`   → Ctrl+C pra parar.\n`);

  const proc = spawn(cli, cliArgs, {
    cwd: fullThemeDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });

  proc.on('error', (e) => {
    console.error(`\n❌ Erro executando shopify theme dev: ${e.message}`);
    console.error(`\nVerifique se o Shopify CLI está instalado e autenticado:`);
    console.error(`   npx shopify version`);
    console.error(`   npx shopify auth login`);
    console.error(`\nSe auth falhar com OAuth token:`);
    console.error(`   o token em agency_clients precisa ter escopo write_themes.`);
    process.exit(1);
  });

  proc.on('close', (code) => {
    if (code === 0) {
      console.log(`\n✓ theme-watch encerrado normalmente.`);
    } else if (code !== null) {
      console.error(`\n⚠ theme-watch encerrou com código ${code}.`);
    }
    process.exit(code || 0);
  });

  // Forward SIGINT pro child (Ctrl+C)
  process.on('SIGINT', () => {
    console.log(`\n⏸  Parando theme-watch...`);
    proc.kill('SIGINT');
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
