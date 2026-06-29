// mcp-shopify-proxy — proxy seguro pra Shopify Admin API via Lever System MCP.
//
// Dual auth:
//   1) Authorization: Bearer <Supabase user JWT>           (web/portal use)
//   2) X-Lever-MCP-Secret: <secret> + X-Lever-User-Email   (MCP server S2S)
//
// Actions:
//   POST { action: 'revenue', client_id, period }
//   POST { action: 'shop_info', client_id }
//   POST { action: 'recent_orders', client_id, limit? }
//
// verify_jwt is disabled at the platform level because this function
// implements its own authentication (dual-mode above).

import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SHOPIFY_API_VERSION = '2024-10';

// ── Auth helpers ────────────────────────────────────────────────────────────

let _cachedInternalSecret: string | null = null;
async function loadInternalSecret(): Promise<string> {
  if (_cachedInternalSecret) return _cachedInternalSecret;
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin.rpc('get_lever_mcp_internal_secret');
  if (error) throw new Error(`secret fetch: ${error.message}`);
  if (!data) throw new Error('lever_mcp_internal_secret not in Vault');
  _cachedInternalSecret = data as string;
  return _cachedInternalSecret;
}

async function isEmailAllowed(email: string): Promise<boolean> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin.rpc('mcp_oauth_is_allowed', { p_email: email.toLowerCase() });
  if (error) throw new Error(`allowlist check: ${error.message}`);
  return !!data;
}

type Identity = { email: string; jwt: string | null };

async function authenticate(req: Request): Promise<Identity> {
  const mcpSecret = req.headers.get('X-Lever-MCP-Secret');
  const mcpEmail = req.headers.get('X-Lever-User-Email');

  if (mcpSecret && mcpEmail) {
    const expected = await loadInternalSecret();
    if (mcpSecret.length !== expected.length || mcpSecret !== expected) {
      throw Object.assign(new Error('Invalid X-Lever-MCP-Secret'), { status: 401 });
    }
    if (!(await isEmailAllowed(mcpEmail))) {
      throw Object.assign(new Error(`Email ${mcpEmail} not in MCP allowlist`), { status: 403 });
    }
    return { email: mcpEmail.toLowerCase(), jwt: null };
  }

  const auth = req.headers.get('Authorization');
  const jwt = auth?.replace(/^Bearer\s+/i, '') ?? null;
  if (!jwt) throw Object.assign(new Error('Missing auth: provide Authorization Bearer JWT OR X-Lever-MCP-Secret + X-Lever-User-Email'), { status: 401 });

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: u, error: uErr } = await userClient.auth.getUser(jwt);
  if (uErr || !u.user?.email) throw Object.assign(new Error('Invalid JWT'), { status: 401 });
  return { email: u.user.email.toLowerCase(), jwt };
}

// ── Visibility (replaces user-RLS check, works for both auth modes) ─────────

async function getClientForEmail(email: string, clientId: string) {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: tm, error: tmErr } = await admin
    .from('team_members')
    .select('user_type, linked_client_id')
    .ilike('email', email)
    .maybeSingle();
  if (tmErr) throw new Error(`team_members lookup: ${tmErr.message}`);
  if (!tm) throw Object.assign(new Error(`Email ${email} not in team_members`), { status: 403 });

  const { data: client, error: cErr } = await admin
    .from('agency_clients')
    .select('id, name, shopify_domain, shopify_access_token, is_internal, is_archived')
    .eq('id', clientId)
    .single();
  if (cErr) throw new Error(`client fetch: ${cErr.message}`);
  if (client.is_internal || client.is_archived) {
    throw Object.assign(new Error('Client not visible (internal or archived)'), { status: 403 });
  }
  if (tm.user_type !== 'agency' && tm.linked_client_id !== clientId) {
    throw Object.assign(new Error('Client not visible to this user'), { status: 403 });
  }
  if (!client.shopify_access_token) {
    throw new Error(`Cliente ${client.name} sem shopify_access_token salvo`);
  }
  return client;
}

// ── Period parsing ──────────────────────────────────────────────────────────

function parsePeriod(p: string): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const day = 86400_000;
  switch ((p || '30d').toLowerCase()) {
    case 'today': return { from: today, to: today };
    case '7d': return { from: new Date(now.getTime() - 7 * day).toISOString().slice(0, 10), to: today };
    case '30d': return { from: new Date(now.getTime() - 30 * day).toISOString().slice(0, 10), to: today };
    case '90d': return { from: new Date(now.getTime() - 90 * day).toISOString().slice(0, 10), to: today };
    case 'mtd': return { from: `${now.toISOString().slice(0, 7)}-01`, to: today };
    case 'ytd': return { from: `${now.getUTCFullYear()}-01-01`, to: today };
    default: {
      const m = p.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
      if (m) return { from: m[1], to: m[2] };
      throw new Error(`Período inválido: "${p}"`);
    }
  }
}

async function pullOrders(domain: string, token: string, from: string, to: string) {
  let cursor: string | null = null;
  let totalSales = 0;
  let count = 0;
  let currency = 'BRL';
  const byDay: Record<string, number> = {};

  do {
    const url: string = cursor
      ?? `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&financial_status=paid,partially_paid&created_at_min=${from}T00:00:00-03:00&created_at_max=${to}T23:59:59-03:00&limit=250&fields=total_price,currency,created_at`;
    const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': token } });
    if (!r.ok) throw new Error(`Shopify ${r.status}: ${await r.text()}`);
    const data = await r.json();
    for (const o of data.orders || []) {
      const v = parseFloat(o.total_price || '0');
      totalSales += v;
      count++;
      currency = o.currency || currency;
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + v;
    }
    const link = r.headers.get('link') || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    cursor = m ? m[1] : null;
  } while (cursor);

  return { totalSales: Number(totalSales.toFixed(2)), count, currency, byDay };
}

// ── Action handlers ─────────────────────────────────────────────────────────

async function handleRevenue(email: string, body: any) {
  const { client_id, period = '30d' } = body;
  if (!client_id) throw Object.assign(new Error('client_id obrigatório'), { status: 400 });
  const client = await getClientForEmail(email, client_id);
  const { from, to } = parsePeriod(period);
  const shopR = await fetch(`https://${client.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: { 'X-Shopify-Access-Token': client.shopify_access_token },
  });
  const shop = (await shopR.json()).shop;
  const orders = await pullOrders(client.shopify_domain, client.shopify_access_token, from, to);
  const days = Object.keys(orders.byDay).length;
  return {
    client: client.name,
    domain: client.shopify_domain,
    currency: shop.currency,
    country: shop.country_code,
    period: `${from} → ${to}`,
    totalSales: orders.totalSales,
    orders: orders.count,
    aov: orders.count > 0 ? Number((orders.totalSales / orders.count).toFixed(2)) : 0,
    by_day: orders.byDay,
    daily_avg: days > 0 ? Number((orders.totalSales / days).toFixed(2)) : 0,
  };
}

async function handleShopInfo(email: string, body: any) {
  const { client_id } = body;
  if (!client_id) throw Object.assign(new Error('client_id obrigatório'), { status: 400 });
  const client = await getClientForEmail(email, client_id);
  const r = await fetch(`https://${client.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: { 'X-Shopify-Access-Token': client.shopify_access_token },
  });
  if (!r.ok) throw new Error(`Shopify ${r.status}: ${await r.text()}`);
  const shop = (await r.json()).shop;
  return {
    client: client.name,
    name: shop.name,
    domain: shop.domain,
    myshopify_domain: shop.myshopify_domain,
    currency: shop.currency,
    country: shop.country_code,
    timezone: shop.iana_timezone,
    plan: shop.plan_name,
    created_at: shop.created_at,
  };
}

async function handleRecentOrders(email: string, body: any) {
  const { client_id, limit = 10 } = body;
  if (!client_id) throw Object.assign(new Error('client_id obrigatório'), { status: 400 });
  const client = await getClientForEmail(email, client_id);
  const r = await fetch(
    `https://${client.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=${Math.min(limit, 50)}&fields=name,total_price,currency,created_at,financial_status,shipping_address&order=created_at+desc`,
    { headers: { 'X-Shopify-Access-Token': client.shopify_access_token } },
  );
  if (!r.ok) throw new Error(`Shopify ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return {
    client: client.name,
    domain: client.shopify_domain,
    orders: (data.orders || []).map((o: any) => ({
      name: o.name,
      price: `${o.currency} ${o.total_price}`,
      status: o.financial_status,
      created_at: o.created_at,
      country: o.shipping_address?.country_code || null,
      city: o.shipping_address?.city || null,
    })),
  };
}

Deno.serve(instrument("mcp-shopify-proxy", async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const identity = await authenticate(req);
    const body = await req.json();
    const action = body.action;

    let result: any;
    switch (action) {
      case 'revenue': result = await handleRevenue(identity.email, body); break;
      case 'shop_info': result = await handleShopInfo(identity.email, body); break;
      case 'recent_orders': result = await handleRecentOrders(identity.email, body); break;
      default: throw Object.assign(new Error(`Action desconhecida: "${action}". Use revenue, shop_info, recent_orders.`), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, data: result, actor: identity.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const status = err.status ?? 500;
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));
