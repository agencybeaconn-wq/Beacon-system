#!/usr/bin/env node
// create-segments — Cria segmentos de clientes (Shopify Customer Segments) pra email marketing,
// exporta CSV consent-aware, e valida/corrige higiene de tag antes de confiar no segmento.
//
// Por que existe: a API de pedidos só enxerga 60 dias sem o escopo `read_all_orders`, então
// "quem comprou X há +90 dias" via orders dá ZERO silencioso. Customer Segments varrem o
// histórico inteiro — mas só são confiáveis se a tag estiver limpa. Ver SKILL.md.
//
// Uso:
//   # 1) Segmento "comprou produto da tag X" (+ win-back + exclusões) e export CSV
//   node create-segments.mjs "<loja>" --bought-tag=cruzeiro --winback-days=90 --export
//   node create-segments.mjs "<loja>" --bought-tag=cruzeiro --exclude-tags=flamengo,palmeiras --export --subscribed-only
//
//   # 2) Higiene de tag (SEMPRE rodar antes de confiar): compara tag:X vs title:*X*
//   node create-segments.mjs "<loja>" --verify-tag=cruzeiro            # dry (só relatório)
//   node create-segments.mjs "<loja>" --verify-tag=cruzeiro --fix-tag  # remove falsos+, adiciona faltando
//
//   # 3) Carrinho abandonado ESTRITAMENTE da tag X (sem outro clube) → CSV
//   node create-segments.mjs "<loja>" --abandoned-only-tag=cruzeiro --export
//
// Flags:
//   --bought-tag=<tag>      cria segmento products_purchased(tag)=true
//   --bought-ids=<a,b,...>  alternativa por IDs (máx ~10 — limite do Shopify)
//   --winback-days=<N>      adiciona "AND last_order_date < -Nd" (cold há N dias)
//   --exclude-tags=<csv>    adiciona "AND products_purchased(tag:'x')=false" (máx 8 — cap de 10 filtros)
//   --name="<nome>"         nome do segmento (default gerado)
//   --verify-tag=<tag>      audita tag vs título; lista falsos+ e faltando
//   --fix-tag               com --verify-tag: aplica tagsRemove/tagsAdd (ESCRITA no catálogo)
//   --abandoned-only-tag=<tag>  carrinhos abandonados só dessa tag (match por título) + neutros (patch/personalização)
//   --export                exporta membros do segmento pra CSV
//   --subscribed-only       também gera CSV só com marketing_consent=SUBSCRIBED
//   --out=<dir>             pasta de saída (default: ~/Downloads)
//   --dry-run               não cria segmento nem escreve (preview)

import fs from 'fs';
import path from 'path';
import os from 'os';
import { pathToFileURL, fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, '../../lib');
const { shopifyGraphQL, delay } = await import(pathToFileURL(path.join(LIB, 'shopify-api.mjs')).href);
const { assertClientExists, assertShopifyConnected } = await import(pathToFileURL(path.join(LIB, 'validate.mjs')).href);

// ---------- args ----------
const argv = process.argv.slice(2);
const store = argv.find(a => !a.startsWith('--'));
const flag = (k, d = undefined) => {
  const hit = argv.find(a => a === `--${k}` || a.startsWith(`--${k}=`));
  if (!hit) return d;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
};
const DRY = !!flag('dry-run', false);
const OUT = flag('out', path.join(os.homedir(), 'Downloads'));

if (!store) { console.error('ERRO: informe a loja. Ex: node create-segments.mjs "Mantos do PH" --bought-tag=cruzeiro --export'); process.exit(1); }

// ---------- helpers ----------
function csvEscape(v) { const s = (v ?? '').toString(); return /[",\n;\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function writeCsv(file, headers, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => csvEscape(r[h])).join(','));
  fs.writeFileSync(file, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
}
const isNeutral = (t = '') => /\bpatch(es)?\b/i.test(t) || /vale[\s-]?presente/i.test(t) || /gift\s?card/i.test(t) || /personaliza/i.test(t);

async function fetchProducts(shop, token, query) {
  let out = [], cursor = null;
  do {
    const r = await shopifyGraphQL(shop, token,
      `{ products(first:100${cursor ? `, after:"${cursor}"` : ''}, query:"${query}"){ pageInfo{hasNextPage endCursor} edges{node{ id title }} } }`);
    const cn = r?.data?.products;
    if (!cn) { console.error('  erro produtos:', JSON.stringify(r?.errors)); break; }
    out.push(...cn.edges.map(e => e.node));
    cursor = cn.pageInfo.hasNextPage ? cn.pageInfo.endCursor : null;
  } while (cursor);
  return out;
}

async function replaceSegment(shop, token, name, query) {
  // remove homônimo
  const ex = await shopifyGraphQL(shop, token, `{ segments(first:50, query:"name:'${name.replace(/'/g, "\\'")}'"){ edges{ node{ id name } } } }`);
  for (const e of (ex?.data?.segments?.edges || [])) if (e.node.name === name) {
    await shopifyGraphQL(shop, token, `mutation($id:ID!){segmentDelete(id:$id){deletedSegmentId}}`, { id: e.node.id });
  }
  const m = await shopifyGraphQL(shop, token,
    `mutation($n:String!,$q:String!){ segmentCreate(name:$n, query:$q){ segment{ id name } userErrors{ message } } }`, { n: name, q: query });
  const errs = m?.data?.segmentCreate?.userErrors;
  if (errs?.length) throw new Error('segmentCreate: ' + errs.map(e => e.message).join(' | '));
  return m.data.segmentCreate.segment.id;
}

async function exportMembers(shop, token, segId) {
  const rows = []; let cursor = null, page = 0;
  do {
    const res = await shopifyGraphQL(shop, token,
      `query($id:ID!,$after:String){ customerSegmentMembers(first:250, segmentId:$id, after:$after){
        totalCount edges{ cursor node{ firstName lastName defaultEmailAddress{ emailAddress marketingState } } } pageInfo{ hasNextPage } } }`,
      { id: segId, after: cursor });
    const conn = res?.data?.customerSegmentMembers;
    if (!conn) { console.error('  erro export:', JSON.stringify(res?.errors)); break; }
    for (const e of conn.edges) {
      const n = e.node, email = n.defaultEmailAddress?.emailAddress || '';
      if (!email) continue;
      rows.push({ email, nome: [n.firstName, n.lastName].filter(Boolean).join(' ').trim(), marketing_consent: n.defaultEmailAddress?.marketingState || '' });
    }
    cursor = conn.pageInfo.hasNextPage ? conn.edges[conn.edges.length - 1].cursor : null;
    page++;
    process.stdout.write(`  exportando... ${rows.length}\r`);
  } while (cursor && page < 60);
  const seen = new Map();
  for (const r of rows) if (!seen.has(r.email.toLowerCase())) seen.set(r.email.toLowerCase(), r);
  return [...seen.values()];
}

// ---------- main ----------
const client = await assertClientExists(store);
assertShopifyConnected(client);
const shop = client.shopify_domain, token = client.shopify_access_token;
console.log(`Loja: ${client.name} (${shop})${DRY ? '  [DRY-RUN]' : ''}\n`);

const verifyTag = flag('verify-tag');
const boughtTag = flag('bought-tag');
const boughtIds = flag('bought-ids');
const abandonedTag = flag('abandoned-only-tag');

// === MODO A: higiene de tag ===
if (verifyTag) {
  const tagProds = await fetchProducts(shop, token, `tag:${verifyTag}`);
  const titleProds = await fetchProducts(shop, token, `title:*${verifyTag}*`);
  const falsePos = tagProds.filter(p => !new RegExp(verifyTag, 'i').test(p.title));
  const missing = titleProds.filter(p => !tagProds.some(t => t.id === p.id));
  console.log(`tag:${verifyTag} = ${tagProds.length}  |  title:*${verifyTag}* = ${titleProds.length}`);
  console.log(`\nFALSOS POSITIVOS (tag mas título não bate) — ${falsePos.length}:`);
  falsePos.forEach(p => console.log('  -', p.title));
  console.log(`\nFALTANDO (título bate mas sem tag) — ${missing.length}:`);
  missing.forEach(p => console.log('  +', p.title));
  if (flag('fix-tag') && !DRY) {
    console.log('\nAplicando correções...');
    let r = 0, a = 0;
    for (const p of falsePos) {
      const m = await shopifyGraphQL(shop, token, `mutation($id:ID!,$t:[String!]!){ tagsRemove(id:$id, tags:$t){ userErrors{message} } }`, { id: p.id, t: [verifyTag] });
      if (!m?.data?.tagsRemove?.userErrors?.length) r++; await delay(300);
    }
    for (const p of missing) {
      const m = await shopifyGraphQL(shop, token, `mutation($id:ID!,$t:[String!]!){ tagsAdd(id:$id, tags:$t){ userErrors{message} } }`, { id: p.id, t: [verifyTag] });
      if (!m?.data?.tagsAdd?.userErrors?.length) a++; await delay(300);
    }
    console.log(`  ✓ removidas ${r}/${falsePos.length}, adicionadas ${a}/${missing.length}`);
    console.log('  ⏳ índice de busca do Shopify atualiza assíncrono (~30-60s) antes de tag: refletir 100%.');
  } else if (falsePos.length || missing.length) {
    console.log('\n→ rode com --fix-tag pra corrigir (escreve no catálogo).');
  }
  process.exit(0);
}

// === MODO C: carrinho abandonado estritamente da tag ===
if (abandonedTag) {
  const re = new RegExp(abandonedTag, 'i');
  const carts = []; let cursor = null, page = 0;
  do {
    const q = `{ abandonedCheckouts(first:50${cursor ? `, after:"${cursor}"` : ''}){ pageInfo{hasNextPage endCursor}
      edges{ node{ createdAt completedAt customer{ email firstName lastName emailMarketingConsent{ marketingState } }
        lineItems(first:100){ edges{ node{ title quantity } } } } } } }`;
    const res = await shopifyGraphQL(shop, token, q);
    const conn = res?.data?.abandonedCheckouts;
    if (!conn) { console.error('  erro:', JSON.stringify(res?.errors)); break; }
    for (const e of conn.edges) carts.push(e.node);
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null; page++;
  } while (cursor && page < 40);
  const seen = new Map();
  for (const n of carts) {
    if (n.completedAt) continue;
    const items = n.lineItems.edges.map(e => e.node);
    if (!items.length || !items.some(li => re.test(li.title))) continue;
    if (!items.every(li => re.test(li.title) || isNeutral(li.title))) continue;
    const email = (n.customer?.email || '').trim().toLowerCase();
    if (!email) continue;
    const d = new Date(n.createdAt);
    const row = { email, nome: [n.customer?.firstName, n.customer?.lastName].filter(Boolean).join(' ').trim(),
      data_abandono: d.toISOString().slice(0, 10),
      itens: items.filter(li => re.test(li.title)).map(li => `${li.title} x${li.quantity}`).join(' | '),
      marketing_consent: n.customer?.emailMarketingConsent?.marketingState || '', _d: d };
    const prev = seen.get(email); if (!prev || d > prev._d) seen.set(email, row);
  }
  const list = [...seen.values()].sort((a, b) => b._d - a._d).map(({ _d, ...r }) => r);
  console.log(`Carrinhos abandonados varridos: ${carts.length} | só ${abandonedTag}: ${list.length}`);
  if (flag('export') && !DRY) {
    const file = path.join(OUT, `abandoned_only_${abandonedTag}.csv`);
    writeCsv(file, ['email', 'nome', 'data_abandono', 'itens', 'marketing_consent'], list);
    console.log(`✓ ${file}`);
  }
  process.exit(0);
}

// === MODO B: segmento de compradores ===
if (!boughtTag && !boughtIds) {
  console.error('Nada a fazer. Use --bought-tag, --verify-tag ou --abandoned-only-tag.');
  process.exit(1);
}
let predicate;
if (boughtTag) predicate = `products_purchased(tag: '${boughtTag}') = true`;
else {
  const ids = boughtIds.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length > 10) console.warn(`  ⚠ ${ids.length} ids — Shopify aceita só ~10 por products_purchased. Use --bought-tag.`);
  predicate = `products_purchased(id: ${ids.join(', ')}) = true`;
}
const clauses = [predicate];
const winback = flag('winback-days');
if (winback) clauses.push(`last_order_date < -${parseInt(winback, 10)}d`);
const excl = flag('exclude-tags');
if (excl) {
  const tags = excl.split(',').map(s => s.trim()).filter(Boolean);
  if (clauses.length + tags.length > 10) console.warn(`  ⚠ ${tags.length} exclusões + ${clauses.length} → excede 10 filtros. Corto nas primeiras.`);
  for (const t of tags.slice(0, 10 - clauses.length)) clauses.push(`products_purchased(tag: '${t}') = false`);
}
const query = clauses.join(' AND ');
const name = flag('name') || `${boughtTag || 'segmento'}${winback ? ` +${winback}d` : ''} (auto)`;

console.log(`Query: ${query}`);
console.log(`Nome:  ${name}`);
if (DRY) { console.log('\n[DRY-RUN] não criei o segmento.'); process.exit(0); }

const segId = await replaceSegment(shop, token, name, query);
console.log(`✓ segmento: ${segId.split('/').pop()}`);

if (flag('export')) {
  const list = await exportMembers(shop, token, segId);
  const slug = (boughtTag || 'segmento').replace(/[^a-z0-9]+/gi, '_');
  const file = path.join(OUT, `segmento_${slug}${winback ? `_mais_${winback}dias` : ''}.csv`);
  writeCsv(file, ['email', 'nome', 'marketing_consent'], list);
  console.log(`\n✓ ${file} → ${list.length} contatos`);
  if (flag('subscribed-only')) {
    const subs = list.filter(r => r.marketing_consent === 'SUBSCRIBED');
    const sfile = file.replace(/\.csv$/, '_SUBSCRIBED.csv');
    writeCsv(sfile, ['email', 'nome', 'marketing_consent'], subs);
    console.log(`✓ ${sfile} → ${subs.length} (prontos pra disparar)`);
  }
}
