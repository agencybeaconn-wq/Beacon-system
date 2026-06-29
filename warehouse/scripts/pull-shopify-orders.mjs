// pull-shopify-orders.mjs
// Conector: Shopify Admin API → warehouse.fact_order + fact_order_item + dim_customer
//
// Uso:
//   node pull-shopify-orders.mjs --store="Mantos do PH" --since=2026-04-01 --dry-run
//   node pull-shopify-orders.mjs --store="Mantos do PH" --since=2026-04-01           (escreve no galpão)
//   node pull-shopify-orders.mjs --all-tier-s --since=2026-04-01
//
// Lê credenciais shopify_access_token direto de public.agency_clients via service_role.
// Hash de email = SHA-256(lowercased+trimmed) — pseudonimização cross-loja.

import crypto from 'crypto';
import fs from 'fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.length ? rest.join('=') : true];
}));

const env = Object.fromEntries(
  fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf-8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = 'https://pxhmzpwvxvlwngjbjkrg.supabase.co';
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_JWT;
const SHOPIFY_API_VERSION = '2026-04';

const DRY_RUN = args['dry-run'] === true;
const STORE_NAME = args.store;
const SINCE = args.since || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const ALL_TIER_S = args['all-tier-s'] === true;

const hashEmail = (email) => email
  ? crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
  : null;

const sbHeaders = (profile = 'warehouse') => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': profile,
  'Content-Profile': profile,
});

async function sbGet(path, profile) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(profile) });
  if (!r.ok) throw new Error(`SB GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbUpsert(table, rows, onConflict) {
  if (DRY_RUN || rows.length === 0) return { dryRun: DRY_RUN, count: rows.length };
  const BATCH = 200;
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...sbHeaders('warehouse'), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) throw new Error(`SB UPSERT ${table} batch ${i}: ${r.status} ${await r.text()}`);
  }
  return { count: rows.length };
}

async function getStoreContext(brandName) {
  const stores = await sbGet(
    `dim_store?brand_name=eq.${encodeURIComponent(brandName)}&select=*`
  );
  if (!stores.length) throw new Error(`Loja "${brandName}" não em dim_store`);
  const store = stores[0];
  const clients = await sbGet(
    `agency_clients?id=eq.${store.agency_client_id}&select=shopify_domain,shopify_access_token`,
    'public'
  );
  if (!clients.length || !clients[0].shopify_access_token) {
    throw new Error(`Sem shopify_access_token pra ${brandName}`);
  }
  return { store, shopify_domain: clients[0].shopify_domain, token: clients[0].shopify_access_token };
}

async function fetchShopifyOrders(ctx, sinceDate) {
  const base = `https://${ctx.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json`;
  const q = new URLSearchParams({
    status: 'any',
    created_at_min: `${sinceDate}T00:00:00Z`,
    limit: '250',
    fields: 'id,name,email,created_at,total_price,currency,financial_status,fulfillment_status,note_attributes,referring_site,landing_site,customer,line_items,billing_address,shipping_address,source_name'
  });
  let url = `${base}?${q.toString()}`;
  const all = [];
  while (url) {
    const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': ctx.token } });
    if (!r.ok) throw new Error(`Shopify ${ctx.shopify_domain}: ${r.status} ${await r.text()}`);
    const data = await r.json();
    all.push(...(data.orders || []));
    const link = r.headers.get('link') || '';
    const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
    if (url) await new Promise(s => setTimeout(s, 600));  // rate-limit polite
  }
  return all;
}

function parseUtmFromOrder(order) {
  const na = order.note_attributes || [];
  const get = (k) => (na.find(a => a.name === k) || {}).value || null;
  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
  };
}

function classifyAttribution(order) {
  const utm = parseUtmFromOrder(order);
  if (utm.utm_source) {
    const s = utm.utm_source.toLowerCase();
    if (s.includes('facebook') || s.includes('meta') || s.includes('ig') || s.includes('instagram')) return 'meta';
    if (s.includes('google')) return 'google';
    if (s.includes('klaviyo') || s.includes('email')) return 'klaviyo';
    if (s.includes('tiktok')) return 'tiktok';
    if (/^\d{10,}$/.test(s)) return 'meta';  // fbclid puro vaza como utm_source
    return s;
  }
  if (order.referring_site && order.referring_site.includes('google')) return 'google';
  if (order.referring_site && (order.referring_site.includes('facebook') || order.referring_site.includes('instagram'))) return 'meta';
  if (order.source_name === 'web') return 'direct';
  return order.source_name || 'unknown';
}

function ageBucket(birthDate) { return null; /* Shopify não traz idade — virá via Meta enrichment depois */ }

function mapOrder(order, ctx) {
  const utm = parseUtmFromOrder(order);
  const email = order.email || order.customer?.email;
  const email_hash = hashEmail(email);
  const ba = order.billing_address || order.shipping_address || {};
  return {
    order: {
      store_id: ctx.store.store_id,
      source_order_id: String(order.id),
      source_platform: 'shopify',
      email_hash,
      ordered_at: order.created_at,
      total_amount: Number(order.total_price),
      total_amount_brl: Number(order.total_price),  // câmbio aplica depois (Mantos PH já é BRL)
      currency: order.currency,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      ...utm,
      attribution_source: classifyAttribution(order),
      is_first_order: order.customer?.orders_count === 1,
      raw_payload: order,
      customer_geo: { country: ba.country_code, city: ba.city },
    },
    items: (order.line_items || []).map(li => ({
      store_id: ctx.store.store_id,
      sku: li.sku,
      product_id: String(li.product_id),
      product_title: li.title,
      variant_id: String(li.variant_id),
      variant_title: li.variant_title,
      quantity: li.quantity,
      unit_price: Number(li.price),
      line_total: Number(li.price) * li.quantity,
      line_total_brl: Number(li.price) * li.quantity,
      vendor: li.vendor,
      product_type: li.product_type,
      ordered_at: order.created_at,
    })),
  };
}

async function upsertCustomers(orderMaps) {
  const byHash = new Map();
  for (const { order } of orderMaps) {
    if (!order.email_hash) continue;
    const e = byHash.get(order.email_hash) || {
      email_hash: order.email_hash,
      first_seen_at: order.ordered_at,
      last_seen_at: order.ordered_at,
      geo_country: order.customer_geo?.country,
      geo_city: order.customer_geo?.city,
    };
    if (order.ordered_at < e.first_seen_at) e.first_seen_at = order.ordered_at;
    if (order.ordered_at > e.last_seen_at) e.last_seen_at = order.ordered_at;
    byHash.set(order.email_hash, e);
  }
  const rows = [...byHash.values()];
  await sbUpsert('dim_customer', rows, 'email_hash');
  return rows.length;
}

async function getCustomerIds(emailHashes) {
  if (DRY_RUN || emailHashes.length === 0) return new Map();
  const map = new Map();
  const BATCH = 50;
  for (let i = 0; i < emailHashes.length; i += BATCH) {
    const chunk = emailHashes.slice(i, i + BATCH);
    const list = chunk.map(h => `"${h}"`).join(',');
    const data = await sbGet(`dim_customer?email_hash=in.(${list})&select=customer_id,email_hash`);
    data.forEach(r => map.set(r.email_hash, r.customer_id));
  }
  return map;
}

async function getOrderPks(storeId, sourceOrderIds) {
  if (DRY_RUN || sourceOrderIds.length === 0) return new Map();
  const map = new Map();
  const BATCH = 50;
  for (let i = 0; i < sourceOrderIds.length; i += BATCH) {
    const chunk = sourceOrderIds.slice(i, i + BATCH);
    const list = chunk.map(s => `"${s}"`).join(',');
    const data = await sbGet(`fact_order?store_id=eq.${storeId}&source_order_id=in.(${list})&select=order_pk,source_order_id`);
    data.forEach(r => map.set(r.source_order_id, r.order_pk));
  }
  return map;
}

async function runStore(brandName) {
  console.log(`\n━━━ ${brandName} ━━━`);
  const ctx = await getStoreContext(brandName);
  console.log(`Shopify: ${ctx.shopify_domain} | desde ${SINCE} | dry-run=${DRY_RUN}`);
  const orders = await fetchShopifyOrders(ctx, SINCE);
  console.log(`Pedidos da Shopify: ${orders.length}`);
  if (orders.length === 0) return;

  const mapped = orders.map(o => mapOrder(o, ctx));

  if (DRY_RUN) {
    console.log('\n--- AMOSTRA (3 primeiros) ---');
    mapped.slice(0, 3).forEach(({ order, items }) => {
      console.log(`#${order.source_order_id} | ${order.ordered_at.slice(0,10)} | ${order.total_amount} ${order.currency} | ${order.attribution_source} | ${items.length} items`);
      items.slice(0, 2).forEach(i => console.log(`   └ ${i.product_title} (${i.quantity}× ${i.unit_price})`));
    });
    console.log('\nDRY-RUN — nada escrito no galpão. Re-rode sem --dry-run pra persistir.');
    return;
  }

  await upsertCustomers(mapped);
  console.log(`✓ dim_customer atualizado`);
  const hashes = [...new Set(mapped.map(m => m.order.email_hash).filter(Boolean))];
  const customerIdByHash = await getCustomerIds(hashes);

  const orderRows = mapped.map(({ order }) => ({
    store_id: order.store_id,
    source_order_id: order.source_order_id,
    source_platform: order.source_platform,
    customer_id: customerIdByHash.get(order.email_hash) || null,
    ordered_at: order.ordered_at,
    total_amount: order.total_amount,
    total_amount_brl: order.total_amount_brl,
    currency: order.currency,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    utm_source: order.utm_source,
    utm_medium: order.utm_medium,
    utm_campaign: order.utm_campaign,
    attribution_source: order.attribution_source,
    is_first_order: order.is_first_order,
    raw_payload: order.raw_payload,
  }));
  await sbUpsert('fact_order', orderRows, 'store_id,source_order_id');
  console.log(`✓ fact_order: ${orderRows.length} pedidos`);

  // pegar order_pks recém-criados pra ligar order_items
  const pkBySource = await getOrderPks(ctx.store.store_id, mapped.map(m => m.order.source_order_id));

  const itemRows = mapped.flatMap(({ order, items }) => {
    const pk = pkBySource.get(order.source_order_id);
    return items.map(i => ({ order_pk: pk, ...i }));
  }).filter(r => r.order_pk);

  // delete-then-insert: items são children de fact_order, replace é seguro
  const pks = [...new Set(itemRows.map(r => r.order_pk))];
  const DELBATCH = 50;
  for (let i = 0; i < pks.length; i += DELBATCH) {
    const chunk = pks.slice(i, i + DELBATCH);
    const list = chunk.map(p => `"${p}"`).join(',');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/fact_order_item?order_pk=in.(${list})`, {
      method: 'DELETE',
      headers: sbHeaders('warehouse'),
    });
    if (!r.ok) throw new Error(`DELETE items: ${r.status} ${await r.text()}`);
  }
  const INSBATCH = 200;
  for (let i = 0; i < itemRows.length; i += INSBATCH) {
    const chunk = itemRows.slice(i, i + INSBATCH);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/fact_order_item`, {
      method: 'POST',
      headers: { ...sbHeaders('warehouse'), Prefer: 'return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) throw new Error(`INSERT items batch ${i}: ${r.status} ${await r.text()}`);
  }
  console.log(`✓ fact_order_item: ${itemRows.length} linhas`);
}

const TIER_S_STORES = ['Mantos do PH', 'Coringão Shop', 'Diario Stores', 'MontRoyal'];

(async () => {
  if (ALL_TIER_S) {
    for (const s of TIER_S_STORES) {
      try { await runStore(s); } catch (e) { console.error(`✗ ${s}:`, e.message); }
    }
  } else if (STORE_NAME) {
    await runStore(STORE_NAME);
  } else {
    console.log('Uso: --store="Nome" OU --all-tier-s. Add --dry-run pra simular.');
    process.exit(1);
  }
})();
