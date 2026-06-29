#!/usr/bin/env node
// Cria desconto BXGY na Shopify de um cliente.
// Uso: node create-discount.mjs <clientId> <preset> [--shop=...] [--code=...] [--collections="Titulo1,Titulo2"]
//
// Exemplos:
//   node create-discount.mjs 15d0144e-c02a-4302-94ca-f903d1c19ba8 PAGUE2LEVE3
//   node create-discount.mjs 15d0144e-c02a-4302-94ca-f903d1c19ba8 PAGUE3LEVE5 --code=NATAL2026
//   node create-discount.mjs 15d0144e-c02a-4302-94ca-f903d1c19ba8 PAGUE2LEVE3 --collections="Todas as Camisas,Conjuntos Infantis"

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env da raiz do projeto
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (!fs.existsSync(envPath)) throw new Error('.env não encontrado: ' + envPath);
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
  return env;
}

const env = loadEnv();
const SUPA_URL = env.VITE_SUPABASE_URL;
const SUPA_KEY = env.VITE_SUPABASE_ANON_KEY;

// Validação explícita — falha cedo com mensagem clara
{
  const missing = [];
  if (!SUPA_URL) missing.push('VITE_SUPABASE_URL');
  if (!SUPA_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
  if (missing.length) {
    console.error(`\n❌ Variáveis de ambiente faltando: ${missing.join(', ')}.`);
    console.error(`   Configure em .env na raiz do projeto antes de rodar esta skill.`);
    process.exit(1);
  }
}

// ─── PRESETS ──────────────────────────────────────────────────────────────
const PRESETS = {
  PAGUE1LEVE2: { buy: 1, get: 1, label: 'Compre 1 Leve 2' },
  PAGUE2LEVE3: { buy: 2, get: 1, label: 'Compre 2 Leve 3' },
  PAGUE3LEVE4: { buy: 3, get: 1, label: 'Compre 3 Leve 4' },
  PAGUE3LEVE5: { buy: 3, get: 2, label: 'Compre 3 Leve 5' },
  PAGUE4LEVE6: { buy: 4, get: 2, label: 'Compre 4 Leve 6' },
  PAGUE5LEVE7: { buy: 5, get: 2, label: 'Compre 5 Leve 7' },
};

const DEFAULT_COLLECTIONS = ['Todas as Camisas', 'Conjuntos Infantis'];

// ─── HELPERS ──────────────────────────────────────────────────────────────
function supaGet(pathUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPA_URL);
    https.request({
      hostname: u.hostname,
      path: '/rest/v1' + pathUrl,
      method: 'GET',
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    }).on('error', reject).end();
  });
}

function shReq(shop, token, method, pathUrl, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: shop,
      path: pathUrl,
      method,
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const link = res.headers.link || '';
        try { resolve({ status: res.statusCode, body: JSON.parse(b), link }); }
        catch { resolve({ status: res.statusCode, body: b, link }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function shopifyGraphQL(shop, token, query, variables) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: shop,
      path: '/admin/api/2026-04/graphql.json',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { reject(new Error('parse: '+b.slice(0,300))); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function nextPageUrl(link) {
  const m = link.match(/<([^>]+)>;\s*rel="next"/);
  if (!m) return null;
  const u = new URL(m[1]);
  return u.pathname + u.search;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { _: [] };
  argv.slice(2).forEach(a => {
    if (a.startsWith('--')) {
      const [k, ...v] = a.slice(2).split('=');
      args[k] = v.join('=');
    } else args._.push(a);
  });
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const clientId = args._[0];
  const preset = args._[1];

  if (!clientId || !preset) {
    console.error('Uso: node create-discount.mjs <clientId> <preset>');
    console.error('Presets:', Object.keys(PRESETS).join(', '));
    process.exit(1);
  }

  if (!PRESETS[preset]) {
    console.error(`Preset "${preset}" desconhecido. Opções:`, Object.keys(PRESETS).join(', '));
    process.exit(1);
  }

  const { buy, get, label } = PRESETS[preset];
  const code = args.code || preset;
  const collectionTitles = (args.collections || DEFAULT_COLLECTIONS.join(','))
    .split(',').map(s => s.trim()).filter(Boolean);

  // 1) Credenciais
  const creds = await supaGet(`/agency_clients?select=name,shopify_domain,shopify_access_token&id=eq.${clientId}`);
  if (!creds?.[0]) { console.error('Cliente não encontrado:', clientId); process.exit(1); }
  const { name, shopify_domain: shop, shopify_access_token: token } = creds[0];
  console.log(`Cliente: ${name}`);
  console.log(`Shop:    ${shop}`);
  console.log(`Preset:  ${preset} (${label})`);
  console.log(`Código:  ${code}`);
  console.log(`Coleções: ${collectionTitles.join(', ')}`);

  // 2) Verifica escopo
  const scopeRes = await shReq(shop, token, 'GET', '/admin/oauth/access_scopes.json');
  const scopes = (scopeRes.body?.access_scopes || []).map(s => s.handle);
  if (!scopes.includes('write_discounts')) {
    console.error('\n❌ App não tem escopo "write_discounts".');
    console.error('   Escopos atuais:', scopes.join(', '));
    console.error('\n   Fix: Atualizar SHOPIFY_SCOPES no Supabase + reconectar esta loja via OAuth.');
    process.exit(1);
  }
  console.log('✓ Escopo write_discounts presente');

  // 3) Resolver IDs das coleções
  const smartAll = [];
  const customAll = [];
  let p = '/admin/api/2026-04/smart_collections.json?limit=250';
  while (p) { const r = await shReq(shop, token, 'GET', p); smartAll.push(...(r.body.smart_collections || [])); p = nextPageUrl(r.link); }
  p = '/admin/api/2026-04/custom_collections.json?limit=250';
  while (p) { const r = await shReq(shop, token, 'GET', p); customAll.push(...(r.body.custom_collections || [])); p = nextPageUrl(r.link); }
  const all = [...smartAll, ...customAll];

  const colIds = [];
  for (const title of collectionTitles) {
    const col = all.find(c => c.title.trim().toLowerCase() === title.toLowerCase());
    if (!col) {
      console.error(`\n❌ Coleção "${title}" não encontrada.`);
      console.error('   Coleções disponíveis (amostra):', all.slice(0, 20).map(c => c.title).join(' | '));
      process.exit(1);
    }
    colIds.push(`gid://shopify/Collection/${col.id}`);
  }
  console.log(`✓ ${colIds.length} coleção(ões) resolvida(s)`);

  // 4) Criar desconto via GraphQL
  const MUT = `mutation createBxgy($bxgyCodeDiscount: DiscountCodeBxgyInput!) {
    discountCodeBxgyCreate(bxgyCodeDiscount: $bxgyCodeDiscount) {
      codeDiscountNode { id codeDiscount { ... on DiscountCodeBxgy { title summary codes(first:1) { edges { node { code } } } } } }
      userErrors { field message code }
    }
  }`;

  const input = {
    title: code,
    code,
    startsAt: new Date().toISOString(),
    customerSelection: { all: true },
    customerBuys: {
      items: { collections: { add: colIds } },
      value: { quantity: String(buy) },
    },
    customerGets: {
      items: { collections: { add: colIds } },
      value: {
        discountOnQuantity: {
          quantity: String(get),
          effect: { percentage: 1.0 },
        },
      },
    },
    appliesOncePerCustomer: false,
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    },
  };

  console.log('\nCriando desconto...');
  const r = await shopifyGraphQL(shop, token, MUT, { bxgyCodeDiscount: input });
  const errs = r.data?.discountCodeBxgyCreate?.userErrors || [];
  if (errs.length || r.errors) {
    console.error('\n❌ Erro ao criar desconto:');
    console.error(JSON.stringify(errs.length ? errs : r.errors, null, 2));
    process.exit(1);
  }
  const node = r.data.discountCodeBxgyCreate.codeDiscountNode;
  const gid = node.id;
  const numericId = gid.split('/').pop();
  console.log('\n✅ Desconto criado!');
  console.log('   ID:    ', gid);
  console.log('   Admin: ', `https://${shop}/admin/discounts/${numericId}`);
  console.log('   Código:', code);
  console.log('   Resumo:', node.codeDiscount?.summary || '(n/a)');
}

main().catch(e => { console.error('\n❌ Erro:', e.message); process.exit(1); });
