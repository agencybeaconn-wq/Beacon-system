#!/usr/bin/env node
// clone-validate — passo 1 do pipeline /clone-theme.
//
// Valida pré-condições antes de scrape:
// 1. .env tem credenciais Supabase
// 2. Cliente existe em agency_clients e tem shopify_status='connected'
// 3. URL alvo é acessível (HEAD com User-Agent realista)
// 4. Nome do tema não colide com tema existente na loja
// 5. Workspace local themes/clones/<slug>/ inspecionado (idempotência)
//
// Output:
//   - cria themes/clones/<slug>/.clone-meta.json com contexto pros scripts seguintes
//   - imprime status legível e próximo comando
//
// Uso:
//   node clone-validate.mjs --url https://luckyfours.com --to "Lucky Fours" --name "Tema Lucky Fours"
//   node clone-validate.mjs --url ... --to ... --name ... --force  # ignora workspace existente

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchClient } from '../../lib/supabase-rest.mjs';
import { assertShopifyConnected, assertEnv, appendExecutionLog } from '../../lib/validate.mjs';
import { shReq, API_VERSION } from '../../lib/shopify-api.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const args = { url: null, to: null, name: null, force: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--to') args.to = argv[++i];
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--force') args.force = true;
  }
  return args;
}

function slugify(s) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function headRequest(url) {
  const u = new URL(url);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    }, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.end();
  });
}

async function listThemes(shop, token) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/themes.json`);
  if (r.status !== 200) throw new Error(`GET /themes.json -> ${r.status}`);
  return r.body?.themes || [];
}

async function main() {
  const args = parseArgs();
  console.log('\n=== clone-validate ===');

  if (!args.url || !args.to || !args.name) {
    console.error('Uso: node clone-validate.mjs --url <url> --to "<cliente>" --name "<nome do tema>" [--force]');
    process.exit(1);
  }

  // 1. .env
  await assertEnv(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
  console.log('  [1/5] .env OK');

  // 2. Cliente
  const client = await fetchClient(args.to);
  if (!client) {
    console.error(`  [2/5] FALHA — cliente "${args.to}" não encontrado em agency_clients`);
    process.exit(1);
  }
  await assertShopifyConnected(client);
  console.log(`  [2/5] cliente: ${client.name} (${client.shopify_domain}) — connected`);

  // 3. URL alvo
  let urlObj;
  try { urlObj = new URL(args.url); }
  catch { console.error(`  [3/5] URL inválida: ${args.url}`); process.exit(1); }
  if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
    console.error(`  [3/5] protocolo não suportado: ${urlObj.protocol}`); process.exit(1);
  }
  const head = await headRequest(args.url);
  if (head.status === 0) {
    console.error(`  [3/5] URL inacessível: ${head.error}`); process.exit(1);
  }
  if (head.status >= 400) {
    console.error(`  [3/5] URL retornou ${head.status} — vai ser difícil scrape. Continuando mesmo assim.`);
  }
  console.log(`  [3/5] URL acessível (HTTP ${head.status})`);

  // 4. Nome de tema único
  const themes = await listThemes(client.shopify_domain, client.shopify_access_token);
  const collision = themes.find(t => t.name.toLowerCase() === args.name.toLowerCase());
  if (collision) {
    console.error(`  [4/5] FALHA — tema "${args.name}" já existe na loja (id=${collision.id}, role=${collision.role})`);
    console.error(`         Escolha outro nome ou delete o tema atual antes de continuar.`);
    process.exit(1);
  }
  console.log(`  [4/5] nome único na loja (${themes.length} temas existentes)`);

  // 5. Workspace local
  const slug = slugify(args.name);
  const workspace = path.join(REPO_ROOT, 'themes', 'clones', slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  let resume = false;
  if (fs.existsSync(workspace)) {
    if (args.force) {
      console.log(`  [5/5] workspace existe + --force → será sobrescrito ao decorrer dos próximos passos`);
    } else if (fs.existsSync(metaPath)) {
      const oldMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      console.log(`  [5/5] workspace existe (${slug}) — modo resume`);
      console.log(`         iniciado em: ${oldMeta.started_at}`);
      console.log(`         URL: ${oldMeta.url}`);
      console.log(`         (use --force pra recriar do zero)`);
      resume = true;
    } else {
      console.error(`  [5/5] workspace ${slug} existe sem .clone-meta.json — estado inconsistente. Use --force pra recriar.`);
      process.exit(1);
    }
  } else {
    fs.mkdirSync(workspace, { recursive: true });
    console.log(`  [5/5] workspace criado: themes/clones/${slug}/`);
  }

  // Cria/atualiza meta
  const meta = {
    url: args.url,
    target_url_host: urlObj.hostname,
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    theme_name: args.name,
    slug,
    started_at: resume ? JSON.parse(fs.readFileSync(metaPath, 'utf8')).started_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phase: 'validated',
    resume,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  await appendExecutionLog({
    skill: 'clone-theme',
    op: 'validate',
    slug,
    target_url: args.url,
    client_id: client.id,
    resume,
  });

  console.log('\n✓ Validação OK.');
  console.log(`\nPróximo: node .claude/skills/clone-theme/clone-prompts.mjs ${slug}`);
  console.log(`     ou: node .claude/skills/clone-theme/clone-discover.mjs ${slug}  (skip prompts, usa defaults)\n`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
