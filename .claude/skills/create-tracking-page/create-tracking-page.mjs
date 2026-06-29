#!/usr/bin/env node
// create-tracking-page — cria uma página de rastreio (tracking) numa loja Shopify,
// powered by 17TRACK, SEM backend. Auto-contida no body_html da página.
//
// Por que sem backend: buscar status por NÚMERO de pedido exige Admin API (backend
// tipo dashboard Vercel / app com read_orders). A maioria das lojas Lever não tem isso.
// O 17TRACK resolve o status real (placed → em trânsito → delivered) a partir do
// CÓDIGO de rastreio, client-side. Por isso a página é tracking-code-cêntrica.
//
// Uso:
//   node create-tracking-page.mjs <clientIdOrName>                 # DRY-RUN
//   node create-tracking-page.mjs <clientIdOrName> --apply         # cria + menu + footer
//   node create-tracking-page.mjs <cli> --apply --no-menu          # não mexe no menu principal
//   node create-tracking-page.mjs <cli> --apply --no-footer        # não mexe no footer
//   node create-tracking-page.mjs <cli> --apply --handle=tracking --title=Tracking
//   node create-tracking-page.mjs <cli> --apply --contact-handle=contato
//
// Idempotente: se a página já existe (mesmo handle), atualiza o body_html. Se já está
// no menu/footer, não duplica.

import { shopifyGraphQL, shReq } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, 'templates', 'tracking-widget.html');
const API = '2026-04';

function parseArgs() {
  const a = { _: [], apply: false, handle: 'tracking', title: 'Tracking', contactHandle: 'contact', menu: true, footer: true };
  for (const x of process.argv.slice(2)) {
    if (x === '--apply') a.apply = true;
    else if (x === '--no-menu') a.menu = false;
    else if (x === '--no-footer') a.footer = false;
    else if (x.startsWith('--handle=')) a.handle = x.slice(9);
    else if (x.startsWith('--title=')) a.title = x.slice(8);
    else if (x.startsWith('--contact-handle=')) a.contactHandle = x.slice(17);
    else a._.push(x);
  }
  return a;
}

async function pageByHandle(shop, token, handle) {
  const q = `query($q:String!){ pages(first:1, query:$q){ edges{ node{ id handle title } } } }`;
  const r = await shopifyGraphQL(shop, token, q, { q: `handle:${handle}` });
  return r.data?.pages?.edges?.[0]?.node || null;
}

async function getMenus(shop, token) {
  const q = `{ menus(first:30){ edges{ node{ id handle title items{ id title type url resourceId tags items{ id title type url resourceId tags } } } } } }`;
  const r = await shopifyGraphQL(shop, token, q);
  return (r.data?.menus?.edges || []).map(e => e.node);
}

function mapItem(it) {
  const o = { id: it.id, title: it.title, type: it.type };
  if (it.url) o.url = it.url;
  if (it.resourceId) o.resourceId = it.resourceId;
  if (it.tags && it.tags.length) o.tags = it.tags;
  if (it.items && it.items.length) o.items = it.items.map(mapItem);
  return o;
}

async function addToMenu(shop, token, menu, pageGid, title, apply) {
  if (menu.items.some(it => it.title === title || (it.resourceId && it.resourceId === pageGid))) {
    return { changed: false, reason: 'já presente' };
  }
  if (!apply) return { changed: true, reason: 'seria adicionado (dry-run)' };
  const items = [...menu.items.map(mapItem), { title, type: 'PAGE', resourceId: pageGid }];
  const mut = `mutation($id:ID!,$title:String!,$handle:String!,$items:[MenuItemUpdateInput!]!){ menuUpdate(id:$id,title:$title,handle:$handle,items:$items){ menu{ id } userErrors{ field message } } }`;
  const r = await shopifyGraphQL(shop, token, mut, { id: menu.id, title: menu.title, handle: menu.handle, items });
  const ue = r.data?.menuUpdate?.userErrors || [];
  if (ue.length) return { changed: false, reason: 'ERRO: ' + JSON.stringify(ue) };
  return { changed: true, reason: 'adicionado' };
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node create-tracking-page.mjs <clientIdOrName> [--apply] [--handle=tracking] [--contact-handle=contact] [--no-menu] [--no-footer]');
    process.exit(1);
  }

  console.log(`\n=== create-tracking-page ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const shop = client.shopify_domain, token = client.shopify_access_token;
  console.log(`✓ Cliente: ${client.name} (${shop})`);

  // Contact URL — valida que a página de contato existe; senão usa o handle mesmo assim (warn)
  let contactUrl = `/pages/${args.contactHandle}`;
  const contact = await pageByHandle(shop, token, args.contactHandle);
  if (!contact) console.log(`⚠ Página de contato '/pages/${args.contactHandle}' não encontrada — botão "Contact Page" pode quebrar. Use --contact-handle=<handle> correto.`);
  else console.log(`✓ Contato: ${contactUrl}`);

  // Monta body a partir do template
  let body = fs.readFileSync(TEMPLATE, 'utf8').replace(/\{\{CONTACT_URL\}\}/g, contactUrl);

  // Página já existe?
  const existing = await pageByHandle(shop, token, args.handle);
  console.log(`\n• Página /pages/${args.handle}: ${existing ? 'JÁ EXISTE (id ' + existing.id.split('/').pop() + ') → atualizar body' : 'será CRIADA'}`);

  if (!args.apply) {
    console.log('\n[DRY-RUN] Nada foi escrito. Rode com --apply para aplicar.');
    console.log(`  - ${existing ? 'PUT' : 'POST'} page "${args.title}" (/pages/${args.handle}), body ${body.length} chars`);
    console.log(`  - ${args.menu ? 'adicionar' : 'NÃO mexer'} no menu principal`);
    console.log(`  - ${args.footer ? 'adicionar' : 'NÃO mexer'} no footer`);
    return;
  }

  // Cria ou atualiza a página (REST — body_html preserva <script>)
  let pageId, pageGid;
  if (existing) {
    const numId = existing.id.split('/').pop();
    const r = await shReq(shop, token, 'PUT', `/admin/api/${API}/pages/${numId}.json`, { page: { id: Number(numId), body_html: body, published: true } });
    if (r.status >= 400) { console.error('Falha ao atualizar página:', JSON.stringify(r.body)); process.exit(1); }
    pageId = r.body.page.id; pageGid = `gid://shopify/Page/${pageId}`;
    console.log(`✓ Página atualizada (id ${pageId})`);
  } else {
    const r = await shReq(shop, token, 'POST', `/admin/api/${API}/pages.json`, { page: { title: args.title, handle: args.handle, body_html: body, published: true } });
    if (r.status >= 400) { console.error('Falha ao criar página:', JSON.stringify(r.body)); process.exit(1); }
    pageId = r.body.page.id; pageGid = `gid://shopify/Page/${pageId}`;
    console.log(`✓ Página criada (id ${pageId}, /pages/${r.body.page.handle})`);
  }

  // Menu + footer
  if (args.menu || args.footer) {
    const menus = await getMenus(shop, token);
    if (args.menu) {
      const main = menus.find(m => m.handle === 'main-menu') || menus.find(m => /main|principal/i.test(m.handle));
      if (!main) console.log('⚠ Menu principal (main-menu) não encontrado — pulei.');
      else { const res = await addToMenu(shop, token, main, pageGid, args.title, true); console.log(`• Menu principal (${main.handle}): ${res.reason}`); }
    }
    if (args.footer) {
      const footer = menus.find(m => m.handle === 'footer') || menus.find(m => /footer|rodap/i.test(m.handle));
      if (!footer) console.log('⚠ Menu footer não encontrado — pulei.');
      else { const res = await addToMenu(shop, token, footer, pageGid, args.title, true); console.log(`• Footer (${footer.handle}): ${res.reason}`); }
    }
  }

  console.log(`\n✓ Pronto. Verifique em https://${shop.replace('.myshopify.com','')} /pages/${args.handle} (use o domínio público da loja).`);
  console.log('  Teste: cole um código de rastreio → deve abrir o widget 17TRACK + link. Número de pedido → mensagem pedindo o código.');
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
