// Importa pages, policies e menus do extras.json pro cliente Shopify.
// Uso: node import-extras-from-json.mjs <cliente> [--apply] [--json=path]

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreds, shopifyGraphQL, delay } from '../../lib/shopify-api.mjs';
import { fetchClient } from '../../lib/supabase-rest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const clientArg = args.find(a => !a.startsWith('--')) || 'MontRoyal';
const jsonPath = (args.find(a => a.startsWith('--json=')) || '--json=clients/lucky-fours/extras.json').slice(7);

async function fetchPages(shop, token) {
  const map = {};
  let cursor = null;
  while (true) {
    const q = `query($c: String) {
      pages(first: 250, after: $c) {
        pageInfo { hasNextPage endCursor }
        edges { node { id handle title } }
      }
    }`;
    const r = await shopifyGraphQL(shop, token, q, { c: cursor });
    if (r.errors) throw new Error('pages: ' + JSON.stringify(r.errors));
    for (const e of r.data.pages.edges) map[e.node.handle] = e.node.id;
    if (!r.data.pages.pageInfo.hasNextPage) break;
    cursor = r.data.pages.pageInfo.endCursor;
    await delay(300);
  }
  return map;
}

async function pageCreate(shop, token, page) {
  const q = `mutation($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page { id handle title }
      userErrors { field message code }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, q, {
    page: {
      handle: page.handle,
      title: page.title,
      body: page.body_html || '',
      isPublished: page.published !== false,
    },
  });
  const errs = r.data?.pageCreate?.userErrors || [];
  if (errs.length) throw new Error(errs.map(e => `${e.field?.join('.')}: ${e.message}`).join('; '));
  return r.data.pageCreate.page;
}

async function fetchShopPolicies(shop, token) {
  const q = `query { shop { shopPolicies { id type body } } }`;
  const r = await shopifyGraphQL(shop, token, q);
  return r.data?.shop?.shopPolicies || [];
}

async function shopPolicyUpdate(shop, token, type, body) {
  const q = `mutation($input: ShopPolicyInput!) {
    shopPolicyUpdate(shopPolicy: $input) {
      shopPolicy { id type }
      userErrors { field message code }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, q, { input: { type, body } });
  const errs = r.data?.shopPolicyUpdate?.userErrors || [];
  if (errs.length) throw new Error(errs.map(e => e.message).join('; '));
  return r.data.shopPolicyUpdate.shopPolicy;
}

const POLICY_TYPE_MAP = {
  'privacy-policy': 'PRIVACY_POLICY',
  'refund-policy': 'REFUND_POLICY',
  'terms-of-service': 'TERMS_OF_SERVICE',
  'shipping-policy': 'SHIPPING_POLICY',
};

async function fetchMenus(shop, token) {
  const q = `query { menus(first: 50) { edges { node { id handle title } } } }`;
  const r = await shopifyGraphQL(shop, token, q);
  return (r.data?.menus?.edges || []).map(e => e.node);
}

function buildMenuItem(link, pagesById, collectionsByHandle, policiesByHandle) {
  // Resolve URL → resource ID quando possível
  const url = link.url;
  if (url === '/') {
    return { title: link.text, type: 'FRONTPAGE', url };
  }
  const collMatch = url.match(/^\/collections\/([^\/?]+)/);
  if (collMatch) {
    const handle = collMatch[1];
    const id = collectionsByHandle[handle];
    if (id) return { title: link.text, type: 'COLLECTION', resourceId: id };
    // fallback URL livre
    return { title: link.text, type: 'HTTP', url };
  }
  const pageMatch = url.match(/^\/pages\/([^\/?]+)/);
  if (pageMatch) {
    const handle = pageMatch[1];
    const id = pagesById[handle];
    if (id) return { title: link.text, type: 'PAGE', resourceId: id };
    return { title: link.text, type: 'HTTP', url };
  }
  const policyMatch = url.match(/^\/policies\/([^\/?]+)/);
  if (policyMatch) {
    const handle = policyMatch[1];
    const id = policiesByHandle[handle];
    if (id) return { title: link.text, type: 'SHOP_POLICY', resourceId: id };
    return { title: link.text, type: 'HTTP', url };
  }
  return { title: link.text, type: 'HTTP', url };
}

async function fetchCollectionsByHandle(shop, token) {
  const map = {};
  let cursor = null;
  while (true) {
    const q = `query($c: String) {
      collections(first: 250, after: $c) {
        pageInfo { hasNextPage endCursor }
        edges { node { id handle } }
      }
    }`;
    const r = await shopifyGraphQL(shop, token, q, { c: cursor });
    for (const e of r.data.collections.edges) map[e.node.handle] = e.node.id;
    if (!r.data.collections.pageInfo.hasNextPage) break;
    cursor = r.data.collections.pageInfo.endCursor;
    await delay(300);
  }
  return map;
}

async function menuUpsert(shop, token, handle, title, items, existingMenus) {
  const itemsInput = items.map(it => ({
    title: it.title,
    type: it.type,
    ...(it.resourceId ? { resourceId: it.resourceId } : {}),
    ...(it.url ? { url: it.url } : {}),
  }));
  const existing = existingMenus.find(m => m.handle === handle);

  if (existing) {
    const q = `mutation($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
      menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
        menu { id handle }
        userErrors { field message }
      }
    }`;
    const r = await shopifyGraphQL(shop, token, q, { id: existing.id, title, handle, items: itemsInput });
    const errs = r.data?.menuUpdate?.userErrors || [];
    if (errs.length) throw new Error('menuUpdate: ' + errs.map(e => `${e.field?.join('.')}: ${e.message}`).join('; '));
    return { action: 'update', menu: r.data.menuUpdate.menu };
  } else {
    const q = `mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
      menuCreate(title: $title, handle: $handle, items: $items) {
        menu { id handle }
        userErrors { field message }
      }
    }`;
    const r = await shopifyGraphQL(shop, token, q, { title, handle, items: itemsInput });
    const errs = r.data?.menuCreate?.userErrors || [];
    if (errs.length) throw new Error('menuCreate: ' + errs.map(e => `${e.field?.join('.')}: ${e.message}`).join('; '));
    return { action: 'create', menu: r.data.menuCreate.menu };
  }
}

async function main() {
  console.log(`\n=== import-extras ${apply ? '[APPLY]' : '[DRY-RUN]'} (cliente: ${clientArg}) ===\n`);

  const client = await fetchClient(clientArg);
  if (!client) throw new Error(`Cliente não encontrado: ${clientArg}`);
  const creds = await getCreds(client.id);
  console.log(`✓ Cliente: ${creds.name} (${creds.shop})`);

  const fullPath = path.isAbsolute(jsonPath) ? jsonPath : path.join(REPO_ROOT, jsonPath);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  console.log(`✓ Dados: ${data.pages.length} pages, ${data.policies.length} policies, header=${data.menus.header.length}, footer=${data.menus.footer.length}`);

  // 1) Pages
  console.log(`\n→ Pages existentes...`);
  const existingPages = await fetchPages(creds.shop, creds.token);
  console.log(`  ${Object.keys(existingPages).length} já existem (${Object.keys(existingPages).join(', ') || 'nenhuma'})`);

  const toCreatePages = data.pages.filter(p => !existingPages[p.handle]);
  console.log(`  pages a criar: ${toCreatePages.length} (${toCreatePages.map(p => p.handle).join(', ')})`);

  if (apply) {
    for (const p of toCreatePages) {
      try {
        const created = await pageCreate(creds.shop, creds.token, p);
        existingPages[p.handle] = created.id;
        console.log(`  + ${p.handle} → ${created.id}`);
        await delay(400);
      } catch (e) {
        console.error(`  ✗ ${p.handle}: ${e.message}`);
      }
    }
  }

  // 2) Policies
  console.log(`\n→ Policies...`);
  const existingPolicies = await fetchShopPolicies(creds.shop, creds.token);
  const policiesByHandle = {};
  for (const p of existingPolicies) {
    // type: PRIVACY_POLICY → handle: privacy-policy
    const handle = Object.entries(POLICY_TYPE_MAP).find(([h, t]) => t === p.type)?.[0];
    if (handle) policiesByHandle[handle] = p.id;
  }
  console.log(`  ${existingPolicies.length} policies existentes`);

  const toUpdatePolicies = data.policies.filter(p => POLICY_TYPE_MAP[p.handle]);
  console.log(`  policies a atualizar: ${toUpdatePolicies.length}`);

  if (apply) {
    for (const p of toUpdatePolicies) {
      const type = POLICY_TYPE_MAP[p.handle];
      try {
        await shopPolicyUpdate(creds.shop, creds.token, type, p.body_html);
        console.log(`  + ${p.handle} (${type})`);
        await delay(500);
      } catch (e) {
        console.error(`  ✗ ${p.handle}: ${e.message}`);
      }
    }
    // Re-fetch pra pegar IDs atualizados
    const refreshed = await fetchShopPolicies(creds.shop, creds.token);
    for (const p of refreshed) {
      const handle = Object.entries(POLICY_TYPE_MAP).find(([h, t]) => t === p.type)?.[0];
      if (handle) policiesByHandle[handle] = p.id;
    }
  }

  // 3) Menus
  console.log(`\n→ Menus...`);
  const collectionsByHandle = await fetchCollectionsByHandle(creds.shop, creds.token);
  const existingMenus = await fetchMenus(creds.shop, creds.token);
  console.log(`  ${existingMenus.length} menus existentes (${existingMenus.map(m => m.handle).join(', ') || 'nenhum'})`);

  const headerItems = data.menus.header.map(l => buildMenuItem(l, existingPages, collectionsByHandle, policiesByHandle));
  const footerItems = data.menus.footer.map(l => buildMenuItem(l, existingPages, collectionsByHandle, policiesByHandle));

  console.log(`\n  Header (${headerItems.length} itens):`);
  headerItems.forEach(it => console.log(`    - ${it.title} [${it.type}]${it.url ? ' ' + it.url : ''}`));
  console.log(`\n  Footer (${footerItems.length} itens):`);
  footerItems.forEach(it => console.log(`    - ${it.title} [${it.type}]${it.url ? ' ' + it.url : ''}`));

  if (apply) {
    try {
      const r = await menuUpsert(creds.shop, creds.token, 'main-menu', 'Main menu', headerItems, existingMenus);
      console.log(`\n  ${r.action === 'create' ? '+' : '✎'} main-menu → ${r.menu.id}`);
    } catch (e) {
      console.error(`\n  ✗ main-menu: ${e.message}`);
    }
    await delay(500);
    try {
      const r = await menuUpsert(creds.shop, creds.token, 'footer', 'Footer menu', footerItems, existingMenus);
      console.log(`  ${r.action === 'create' ? '+' : '✎'} footer → ${r.menu.id}`);
    } catch (e) {
      console.error(`  ✗ footer: ${e.message}`);
    }
  } else {
    console.log(`\n[DRY-RUN] Rode com --apply pra aplicar.`);
  }

  console.log(`\n✓ Concluído.`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
