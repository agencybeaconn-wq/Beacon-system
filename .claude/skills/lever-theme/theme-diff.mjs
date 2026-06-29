#!/usr/bin/env node
// theme-diff — compara 2 temas locais e detecta drift (arquivos faltantes, conteúdo diferente).
//
// Casos de uso:
//   1. /lever-theme diff-br-en → compara BR local vs EN local (detectar melhorias não-portadas)
//   2. /lever-theme diff <cliente> → compara cliente remoto vs local dev (detectar cliente desatualizado)
//
// Uso:
//   node theme-diff.mjs br-en                    # BR vs EN (2 temas locais)
//   node theme-diff.mjs client <clientIdOrName>  # cliente remoto vs dev local (baixa cliente temp)
//   node theme-diff.mjs client <clientIdOrName> --side=en  # compara com EN em vez de BR

import { getCreds, shReq, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { fetchClient } from '../../lib/supabase-rest.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BR_DIR = path.join(REPO_ROOT, 'themes/lever-br');
const EN_DIR = path.join(REPO_ROOT, 'themes/lever-en');

// Allowlist: arquivos que DEVEM ser sincronizados entre BR/EN e cliente
const ALLOWLIST_RE = [
  /^sections\/.*\.liquid$/,
  /^snippets\/.*\.liquid$/,
  /^assets\/.*\.(js|css|liquid)$/,
  /^layout\/.*\.liquid$/,
  /^config\/settings_schema\.json$/,
];

// Ignorelist: arquivos que esperadamente divergem (não reportar no diff-br-en)
const IGNORE_BR_EN_RE = [
  /^locales\//,               // traduções são por idioma
  /^config\/settings_data\.json$/, // config tem valores diferentes por loja
  /^templates\//,             // templates podem ter customizações
  /^sections\/header-group\.json$/, // config do header com dados da loja
  /^sections\/footer-group\.json$/, // idem footer
  /^\.theme-meta\.json$/,     // metadata do pull
];

function walkDir(dir, base = '') {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const item of fs.readdirSync(dir)) {
    if (item.startsWith('.') && item !== '.theme-meta.json') continue;
    const full = path.join(dir, item);
    const rel = base ? `${base}/${item}` : item;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) entries.push(...walkDir(full, rel));
    else entries.push({ key: rel, fullPath: full, size: stat.size });
  }
  return entries;
}

function isAllowlisted(key) {
  return ALLOWLIST_RE.some(re => re.test(key));
}

function shouldIgnoreBrEn(key) {
  return IGNORE_BR_EN_RE.some(re => re.test(key));
}

function hashFile(filePath) {
  // Simple content hash (SHA-like via string comparison)
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Normalize whitespace for comparison (avoid trailing newlines diff)
    return content.replace(/\r\n/g, '\n').trim();
  } catch (e) {
    return null;
  }
}

function diffLocalDirs(dirA, dirB, labelA, labelB, ignoreFn) {
  const filesA = walkDir(dirA);
  const filesB = walkDir(dirB);
  const mapA = new Map(filesA.map(f => [f.key, f]));
  const mapB = new Map(filesB.map(f => [f.key, f]));

  const onlyInA = [];
  const onlyInB = [];
  const differentContent = [];
  const identical = [];

  for (const [key, fileA] of mapA) {
    if (ignoreFn(key)) continue;
    if (!mapB.has(key)) {
      onlyInA.push(key);
      continue;
    }
    const contentA = hashFile(fileA.fullPath);
    const contentB = hashFile(mapB.get(key).fullPath);
    if (contentA !== contentB) differentContent.push(key);
    else identical.push(key);
  }
  for (const [key] of mapB) {
    if (ignoreFn(key)) continue;
    if (!mapA.has(key)) onlyInB.push(key);
  }

  return { onlyInA, onlyInB, differentContent, identical, labelA, labelB };
}

async function fetchRemoteAssets(shop, token, themeId) {
  // Lista assets do tema remoto (só lista, sem baixar valor)
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes/${themeId}/assets.json`);
  return r.body?.assets || [];
}

function reportDiff(diff, opts = {}) {
  const { labelA, labelB, onlyInA, onlyInB, differentContent, identical } = diff;
  const allowlistOnly = opts.allowlistOnly;

  const filterAllowlist = arr => allowlistOnly ? arr.filter(isAllowlisted) : arr;
  const a = filterAllowlist(onlyInA);
  const b = filterAllowlist(onlyInB);
  const d = filterAllowlist(differentContent);

  console.log(`\n## Diff: ${labelA} vs ${labelB}${allowlistOnly ? ' (allowlist only)' : ''}\n`);
  console.log(`Total allowlist:  iguais ${filterAllowlist(identical).length} | diferentes ${d.length} | só ${labelA} ${a.length} | só ${labelB} ${b.length}`);

  if (a.length) {
    console.log(`\n### ${a.length} arquivo(s) só no ${labelA}:`);
    a.slice(0, 30).forEach(k => console.log(`  + ${k}`));
    if (a.length > 30) console.log(`  ...+${a.length - 30} arquivos`);
  }
  if (b.length) {
    console.log(`\n### ${b.length} arquivo(s) só no ${labelB}:`);
    b.slice(0, 30).forEach(k => console.log(`  - ${k}`));
    if (b.length > 30) console.log(`  ...+${b.length - 30} arquivos`);
  }
  if (d.length) {
    console.log(`\n### ${d.length} arquivo(s) com conteúdo diferente:`);
    d.slice(0, 30).forEach(k => console.log(`  ~ ${k}`));
    if (d.length > 30) console.log(`  ...+${d.length - 30} arquivos`);
  }
}

async function diffBrEn() {
  console.log('\n=== diff-br-en: comparando temas BR vs EN ===');
  if (!fs.existsSync(BR_DIR) || !fs.existsSync(EN_DIR)) {
    console.error('Pastas themes/lever-br/ ou themes/lever-en/ não existem.');
    console.error('Rode `node .claude/skills/lever-theme/theme-pull.mjs br` e `en` primeiro.');
    process.exit(1);
  }

  const diff = diffLocalDirs(BR_DIR, EN_DIR, 'BR', 'EN', shouldIgnoreBrEn);

  // Reporte completo
  reportDiff(diff);

  // Reporte só allowlist (o que realmente importa sincronizar)
  console.log('\n\n════════════════════════════════════════════════════════');
  reportDiff(diff, { allowlistOnly: true });

  // Salva JSON
  const outFile = path.join(REPO_ROOT, 'themes/.diff-br-en.json');
  fs.writeFileSync(outFile, JSON.stringify({
    ts: new Date().toISOString(),
    ...diff,
  }, null, 2));
  console.log(`\nRelatório completo em themes/.diff-br-en.json`);

  // Resumo allowlist
  const filteredDiff = diff.differentContent.filter(isAllowlisted);
  const filteredOnlyBR = diff.onlyInA.filter(isAllowlisted);
  const filteredOnlyEN = diff.onlyInB.filter(isAllowlisted);

  console.log('\n## 🎯 Resumo allowlist (o que importa sincronizar)');
  console.log(`  ${filteredDiff.length} arquivos com conteúdo DIFERENTE entre BR e EN`);
  console.log(`  ${filteredOnlyBR.length} arquivos SÓ NO BR (melhorias não portadas pra EN?)`);
  console.log(`  ${filteredOnlyEN.length} arquivos SÓ NO EN`);
}

async function diffClient(clientArg, side = 'br') {
  console.log(`\n=== diff client vs ${side}: comparando tema do cliente com dev local ===`);

  const client = await fetchClient(clientArg);
  if (!client) { console.error(`Cliente "${clientArg}" não encontrado`); process.exit(1); }
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  // Pegar tema main do cliente
  const themesRes = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
    `/admin/api/${API_VERSION}/themes.json`);
  const themes = themesRes.body?.themes || [];
  const mainTheme = themes.find(t => t.role === 'main');
  if (!mainTheme) { console.error('Cliente sem tema main'); process.exit(1); }
  console.log(`✓ Tema cliente: ${mainTheme.name} (id=${mainTheme.id})`);

  // Listar assets do cliente (só nomes, sem baixar ainda)
  const clientAssets = await fetchRemoteAssets(client.shopify_domain, client.shopify_access_token, mainTheme.id);
  console.log(`  ${clientAssets.length} assets no cliente`);

  // Listar local
  const localDir = side === 'en' ? EN_DIR : BR_DIR;
  const label = side === 'en' ? 'EN (dev)' : 'BR (dev)';
  const localFiles = walkDir(localDir);
  const localMap = new Map(localFiles.map(f => [f.key, f]));
  console.log(`  ${localFiles.length} arquivos no ${label}`);

  // Comparar NOMES primeiro (rápido). Depois baixa só os arquivos da allowlist que existem em ambos pra diff de conteúdo.
  const clientKeys = new Set(clientAssets.map(a => a.key));
  const onlyInClient = [...clientKeys].filter(k => !localMap.has(k) && !shouldIgnoreBrEn(k));
  const onlyInLocal = [...localMap.keys()].filter(k => !clientKeys.has(k) && !shouldIgnoreBrEn(k));
  const inBoth = [...clientKeys].filter(k => localMap.has(k) && isAllowlisted(k));

  console.log(`\nArquivos na allowlist em ambos: ${inBoth.length}`);
  console.log(`Baixando ${inBoth.length} assets do cliente pra comparar conteúdo...`);

  const differentContent = [];
  let checked = 0;
  for (const key of inBoth) {
    const q = `asset[key]=${encodeURIComponent(key)}`;
    const r = await shReq(client.shopify_domain, client.shopify_access_token, 'GET',
      `/admin/api/${API_VERSION}/themes/${mainTheme.id}/assets.json?${q}`);
    const remoteAsset = r.body?.asset;
    if (remoteAsset?.value != null) {
      const remoteContent = remoteAsset.value.replace(/\r\n/g, '\n').trim();
      const localContent = hashFile(localMap.get(key).fullPath);
      if (remoteContent !== localContent) differentContent.push(key);
    }
    checked++;
    if (checked % 20 === 0) process.stdout.write(`\r  [${checked}/${inBoth.length}]  `);
    await delay(400);
  }
  console.log('');

  const diff = {
    labelA: `Cliente (${client.name})`,
    labelB: label,
    onlyInA: onlyInClient,
    onlyInB: onlyInLocal,
    differentContent,
    identical: inBoth.filter(k => !differentContent.includes(k)),
  };
  reportDiff(diff, { allowlistOnly: true });

  const outFile = path.join(REPO_ROOT, `themes/.diff-client-${client.id.slice(0, 8)}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ ts: new Date().toISOString(), client: client.name, side, diff }, null, 2));
  console.log(`\nRelatório em ${path.relative(REPO_ROOT, outFile)}`);
}

async function main() {
  const mode = process.argv[2];
  if (!mode || (mode !== 'br-en' && mode !== 'client')) {
    console.error('Uso:');
    console.error('  node theme-diff.mjs br-en                      # BR vs EN (local)');
    console.error('  node theme-diff.mjs client <clientIdOrName>    # Cliente remoto vs dev local');
    process.exit(1);
  }

  if (mode === 'br-en') {
    await diffBrEn();
  } else {
    const clientArg = process.argv[3];
    if (!clientArg) { console.error('Informe client'); process.exit(1); }
    const sideArg = process.argv.find(a => a.startsWith('--side='));
    const side = sideArg ? sideArg.slice(7) : 'br';
    await diffClient(clientArg, side);
  }
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
