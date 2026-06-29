#!/usr/bin/env node
// clone-package — passo final do pipeline /clone-theme.
//
// Empacota themes/clones/<slug>/ num .zip instalável manualmente no Shopify admin
// (Online Store → Themes → Add theme → Upload zip).
//
// Inclui APENAS os diretórios oficiais do tema Shopify:
//   assets/, config/, layout/, locales/, sections/, snippets/, templates/
// E exclui o que é interno do pipeline:
//   _raw/, _design/, _preview/, .clone-meta.json, .shopify/, .git/, README.md, LICENSE
//
// Uso:
//   node clone-package.mjs <slug>

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const THEME_DIRS = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const THEME_FILES_ROOT = ['release-notes.md']; // arquivos opcionais na raiz que Shopify aceita

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' }).trim();
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n++;
  }
  return n;
}

function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let s = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) s += dirSize(full);
    else s += fs.statSync(full).size;
  }
  return s;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Uso: node clone-package.mjs <slug>');
    process.exit(1);
  }

  console.log('\n=== clone-package ===');

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  if (!fs.existsSync(metaPath)) {
    console.error(`Não achei ${metaPath}.`);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  // Conta arquivos pra reporte
  let totalFiles = 0;
  for (const d of THEME_DIRS) {
    const src = path.join(workspace, d);
    if (!fs.existsSync(src)) {
      console.log(`  [count] ${d}/ não existe — skip`);
      continue;
    }
    const n = countFiles(src);
    totalFiles += n;
    console.log(`  [count] ${d}/ → ${n} arquivos`);
  }

  // Empacota via `shopify theme package` (CLI oficial, formato Shopify-válido garantido).
  // PowerShell `Compress-Archive` usava `\` nos paths internos do ZIP — Shopify rejeita
  // com erro "missing template layout/theme.liquid". Aprendizado validado contra
  // shop-mont-royal.myshopify.com em 2026-05-13.
  const zipName = `${slug}.zip`;
  const zipPath = path.join(workspace, zipName);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  console.log(`  [zip] rodando 'shopify theme package'...`);
  try {
    // `theme package` salva no cwd, então faz cd no workspace antes
    run(`npx shopify theme package`, { cwd: workspace });
  } catch (e) {
    console.error(`  [zip] shopify theme package falhou: ${e.message}`);
    process.exit(1);
  }

  // Shopify CLI gera "Dawn-X.Y.Z.zip" (lê version do release-notes do Dawn).
  // Renomeia pro nome do slug.
  const generated = fs.readdirSync(workspace).filter(f => f.match(/^Dawn-[\d.]+\.zip$/));
  if (generated.length === 0) {
    console.error(`  [zip] CLI rodou mas nenhum Dawn-*.zip foi encontrado em ${workspace}`);
    process.exit(1);
  }
  fs.renameSync(path.join(workspace, generated[0]), zipPath);
  console.log(`  [zip] renomeado ${generated[0]} → ${zipName}`);

  const zipSize = fs.statSync(zipPath).size;
  console.log(`  [zip] ✓ ${zipName} criado (${(zipSize / 1024 / 1024).toFixed(2)} MB)`);

  // Update meta
  meta.phase = 'packaged';
  meta.updated_at = new Date().toISOString();
  meta.package = {
    zip_path: path.relative(REPO_ROOT, zipPath).replace(/\\/g, '/'),
    zip_bytes: zipSize,
    files_total: totalFiles,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  // Print instruções
  console.log(`\n✓ ZIP pronto pra instalar manualmente na Shopify.\n`);
  console.log(`📦 ${path.relative(REPO_ROOT, zipPath).replace(/\\/g, '/')}\n`);
  console.log(`Opção 1 — Upload manual no admin Shopify (sem CLI, sem código):`);
  console.log(`  1. Abra Shopify admin → Online Store → Themes`);
  console.log(`  2. Clique "Add theme" → "Upload zip file"`);
  console.log(`  3. Seleciona o arquivo acima`);
  console.log(`  4. Tema sobe como "unpublished" — abra preview pra ver`);
  console.log(`\nOpção 2 — Preview local via Shopify CLI dev:`);
  console.log(`  npx shopify theme dev --path="themes/clones/${slug}" --store=<seu-shop>.myshopify.com`);
  console.log(`  → abre localhost:9292 com o tema rodando linkado na loja escolhida\n`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
