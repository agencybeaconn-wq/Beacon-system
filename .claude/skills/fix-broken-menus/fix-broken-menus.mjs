#!/usr/bin/env node
// fix-broken-menus — remove menu items que apontam pra collections/pages/products inexistentes
// (e opcionalmente também items que apontam pra collections existentes mas vazias).
//
// Uso:
//   node fix-broken-menus.mjs <clientIdOrName>                        # DRY-RUN
//   node fix-broken-menus.mjs <clientIdOrName> --apply                # aplica (strategy=remove)
//   node fix-broken-menus.mjs <clientIdOrName> --apply --strategy=frontpage
//   node fix-broken-menus.mjs <clientIdOrName> --apply --include-empty # também remove items pra coleção vazia

import { shopifyGraphQL } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';

function parseArgs() {
  const args = { _: [], apply: false, strategy: 'remove', includeEmpty: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--include-empty') args.includeEmpty = true;
    else if (a.startsWith('--strategy=')) args.strategy = a.slice(11);
    else args._.push(a);
  }
  if (!['remove', 'frontpage'].includes(args.strategy)) {
    console.error(`--strategy= deve ser remove|frontpage`);
    process.exit(1);
  }
  return args;
}

const MENUS_QUERY = `query {
  menus(first: 20) {
    edges {
      node {
        id
        title
        handle
        items {
          id
          title
          type
          url
          resourceId
          items {
            id
            title
            type
            url
            resourceId
            items {
              id
              title
              type
              url
              resourceId
            }
          }
        }
      }
    }
  }
}`;

const COLLECTION_CHECK_QUERY = `query($handle: String!) {
  collectionByHandle(handle: $handle) { id productsCount { count } }
}`;

const PRODUCT_CHECK_QUERY = `query($handle: String!) {
  productByHandle(handle: $handle) { id }
}`;

const PAGE_CHECK_QUERY = `query($q: String!) {
  pages(first: 1, query: $q) { edges { node { id } } }
}`;

const MENU_UPDATE_MUT = `mutation menuUpdate($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
  menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
    menu { id title handle }
    userErrors { field message }
  }
}`;

const cache = new Map();
// Retorna { exists: boolean, empty?: boolean } — empty só é relevante pra collection.
async function entityState(shop, token, kind, handle) {
  const cacheKey = `${kind}:${handle}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    let out = { exists: false, empty: false };
    if (kind === 'collection') {
      const r = await shopifyGraphQL(shop, token, COLLECTION_CHECK_QUERY, { handle });
      const c = r.data?.collectionByHandle;
      out = { exists: !!c, empty: c ? (c.productsCount?.count || 0) === 0 : false };
    } else if (kind === 'product') {
      const r = await shopifyGraphQL(shop, token, PRODUCT_CHECK_QUERY, { handle });
      out.exists = !!r.data?.productByHandle;
    } else if (kind === 'page') {
      const r = await shopifyGraphQL(shop, token, PAGE_CHECK_QUERY, { q: `handle:${handle}` });
      out.exists = !!r.data?.pages?.edges?.[0];
    }
    cache.set(cacheKey, out);
    return out;
  } catch (e) {
    console.warn(`    (erro checando ${kind}:${handle} — ${e.message.slice(0, 100)})`);
    return { exists: true, empty: false }; // assume valid em caso de erro
  }
}

/**
 * Classifica um URL em kind + handle.
 * Retorna { kind, handle } ou null se não é relativo da loja (external/frontpage).
 */
function classifyUrl(url) {
  if (!url) return null;
  if (url === '/' || url === '/index') return { kind: 'frontpage' };
  if (/^https?:\/\//.test(url)) return { kind: 'external' };
  const m = url.match(/^\/(collections|products|pages)\/([^/?#]+)/);
  if (!m) return { kind: 'unknown', raw: url };
  return { kind: m[1].replace(/s$/, ''), handle: m[2] };
}

async function validateItem(shop, token, item, includeEmpty) {
  // Type de menu pode ser: FRONTPAGE, HTTP, COLLECTION, PAGE, SHOP_POLICY, SEARCH, PRODUCT, ARTICLE, BLOG
  if (item.type === 'FRONTPAGE' || item.type === 'SHOP_POLICY' || item.type === 'SEARCH') return { ok: true };
  if (item.type === 'HTTP' && /^https?:\/\//.test(item.url || '')) return { ok: true }; // external
  const classified = classifyUrl(item.url || '');
  if (!classified) return { ok: true };
  if (classified.kind === 'frontpage' || classified.kind === 'external') return { ok: true };
  if (['collection', 'product', 'page'].includes(classified.kind)) {
    const state = await entityState(shop, token, classified.kind, classified.handle);
    if (!state.exists) return { ok: false, reason: 'inexistente' };
    if (includeEmpty && classified.kind === 'collection' && state.empty) return { ok: false, reason: 'vazia' };
    return { ok: true };
  }
  return { ok: true }; // desconhecido → deixa passar
}

async function walkAndValidate(shop, token, items, brokenList, includeEmpty, parentPath = '') {
  const validItems = [];
  for (const item of items) {
    const v = await validateItem(shop, token, item, includeEmpty);
    const path = parentPath ? `${parentPath} → ${item.title}` : item.title;
    if (!v.ok) {
      brokenList.push({ path, title: item.title, type: item.type, url: item.url, reason: v.reason });
      continue;
    }
    let childValidated = [];
    if (item.items?.length) {
      childValidated = await walkAndValidate(shop, token, item.items, brokenList, includeEmpty, path);
    }
    validItems.push({
      title: item.title,
      type: item.type,
      url: item.url,
      resourceId: item.resourceId || null,
      items: childValidated,
    });
  }
  return validItems;
}

function toMenuItemInput(items) {
  return items.map(i => ({
    title: i.title,
    type: i.type,
    url: i.url || '',
    ...(i.resourceId ? { resourceId: i.resourceId } : {}),
    items: i.items ? toMenuItemInput(i.items) : [],
  }));
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node fix-broken-menus.mjs <clientIdOrName> [--apply] [--strategy=remove|frontpage]');
    process.exit(1);
  }

  console.log(`\n=== fix-broken-menus ${args.apply ? '[APPLY]' : '[DRY-RUN]'} (strategy=${args.strategy}) ===`);

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  // FETCH menus
  console.log(`\nBuscando menus...`);
  const menusRes = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, MENUS_QUERY);
  const menus = (menusRes.data?.menus?.edges || []).map(e => e.node);
  console.log(`  ${menus.length} menus encontrados`);

  // VALIDATE cada menu
  const menuReports = [];
  for (const menu of menus) {
    const broken = [];
    const validatedItems = await walkAndValidate(
      client.shopify_domain, client.shopify_access_token,
      menu.items || [], broken, args.includeEmpty, menu.title
    );
    menuReports.push({ menu, validatedItems, broken });
  }

  // PREVIEW
  console.log(`\n=== PREVIEW ===`);
  const totalBroken = menuReports.reduce((s, r) => s + r.broken.length, 0);
  console.log(`Total de items quebrados: ${totalBroken}`);
  for (const r of menuReports) {
    if (r.broken.length === 0) continue;
    console.log(`\n  Menu "${r.menu.title}" (${r.menu.handle}) — ${r.broken.length} quebrados:`);
    for (const b of r.broken.slice(0, 10)) {
      console.log(`    ✗ ${b.path} [${b.reason || 'broken'}]`);
      console.log(`       type=${b.type} url=${b.url}`);
    }
    if (r.broken.length > 10) console.log(`    ...+${r.broken.length - 10}`);
  }

  if (totalBroken === 0) {
    console.log(`\n✓ Nenhum menu item quebrado. Nada a fazer.`);
    return;
  }

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra corrigir (strategy=${args.strategy}).`);
    return;
  }

  // EXECUTE — reescreve cada menu afetado
  console.log(`\n=== EXECUTANDO (strategy=${args.strategy}) ===`);
  let ok = 0, fail = 0;
  const errors = [];
  for (const r of menuReports) {
    if (r.broken.length === 0) continue;
    try {
      // Strategy remove = já tá feito no validatedItems (items inválidos foram skipados)
      // Strategy frontpage = precisaria re-inserir. Por ora só suporto remove.
      if (args.strategy === 'frontpage') {
        console.warn(`  ⚠ strategy=frontpage ainda não implementado — usando remove pra ${r.menu.handle}`);
      }
      const items = toMenuItemInput(r.validatedItems);
      const mr = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, MENU_UPDATE_MUT, {
        id: r.menu.id,
        title: r.menu.title,
        handle: r.menu.handle,
        items,
      });
      const uerr = mr.data?.menuUpdate?.userErrors || [];
      if (uerr.length) {
        fail++;
        errors.push({ menu: r.menu.handle, errs: uerr });
        console.log(`  ✗ ${r.menu.handle}: ${JSON.stringify(uerr).slice(0, 200)}`);
      } else {
        ok++;
        console.log(`  ✓ ${r.menu.handle}: ${r.broken.length} items removidos`);
      }
    } catch (e) {
      fail++;
      errors.push({ menu: r.menu.handle, error: e.message });
      console.log(`  ✗ ${r.menu.handle}: ${e.message}`);
    }
  }

  console.log(`\nResultado: ${ok} menus corrigidos, ${fail} falhas`);

  await appendExecutionLog({
    skill: 'fix-broken-menus',
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    strategy: args.strategy,
    broken_total: totalBroken,
    menus_fixed: ok,
    menus_failed: fail,
    dry_run: false,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });
