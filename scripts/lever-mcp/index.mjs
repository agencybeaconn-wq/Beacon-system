#!/usr/bin/env node
/**
 * Lever System MCP — MVP v0.2
 *
 * Stdio MCP server expondo 5 tools sobre Supabase Lever.
 *
 * Auth (em ordem de preferência):
 *   1. LEVER_USER_JWT (env var) — JWT user-level, RLS aplicada server-side.
 *      Modo recomendado pra colaboradores (Wesley/Campanhã/Pedro). Cada um tem
 *      seu próprio JWT — sem distribuir admin keys.
 *   2. LEVER_REFRESH_TOKEN (env var) — refresh token Supabase Auth. MCP renova
 *      access_token automaticamente. Persistente, ~30d.
 *   3. SUPABASE_SERVICE_ROLE_KEY — admin fallback (dev mode, João/owner).
 *      ÚLTIMO recurso. Bypassa RLS — só pra owner/architect.
 *
 * Gerar JWT/refresh_token: rodar `node scripts/lever-mcp/login.mjs`.
 *
 * Tools (v0.2):
 *   1. lever_list_clients         — clientes visíveis ao user (via v_agency_clients_visible)
 *   2. lever_shopify_revenue      — faturamento Shopify (precisa permissão pra ler token)
 *   3. lever_meta_spend           — spend Meta (DW)
 *   4. lever_cross_view           — query views DW
 *   5. lever_client_kpis          — KPIs consolidados
 *
 * Pendente:
 *   - Edge function `mcp-shopify-proxy` pra evitar leak de token shopify (v0.3)
 *   - Audit log mcp_calls (v0.3)
 *   - Sprint 2 tools de write
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Bootstrap: read .env do lever/ ────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVER_ROOT = resolve(__dirname, "../..");
const env = {};
for (const f of [".env", ".env.local"]) {
  try {
    const c = readFileSync(resolve(LEVER_ROOT, f), "utf8").replace(/\r/g, "");
    for (const line of c.split("\n")) {
      const i = line.indexOf("=");
      if (i < 1 || !/^[A-Z_][A-Z0-9_]*$/.test(line.slice(0, i))) continue;
      env[line.slice(0, i)] = line.slice(i + 1).replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const SB_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SB_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SB_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// Auth: process.env > .env file (process.env tem prioridade pra perm-set por colaborador)
const USER_JWT = process.env.LEVER_USER_JWT || env.LEVER_USER_JWT;
const REFRESH_TOKEN = process.env.LEVER_REFRESH_TOKEN || env.LEVER_REFRESH_TOKEN;

// Credentials persistidas (login.mjs salva aqui)
import { existsSync } from "node:fs";
import { homedir } from "node:os";
const CREDS_PATH = resolve(homedir(), ".lever-mcp", "credentials.json");
let persistedAuth = null;
if (!USER_JWT && !REFRESH_TOKEN && existsSync(CREDS_PATH)) {
  try {
    persistedAuth = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
  } catch {}
}

// Determinar modo de auth
let authMode, authToken, authApikey, authUserId, authEmail;
if (USER_JWT) {
  authMode = "jwt";
  authToken = USER_JWT;
  authApikey = SB_ANON_KEY;
} else if (REFRESH_TOKEN || persistedAuth?.refresh_token) {
  authMode = "refresh";
  // access_token expira em 1h, será renovado on-demand
  authToken = persistedAuth?.access_token;
  authApikey = SB_ANON_KEY;
} else if (SB_SERVICE_KEY) {
  authMode = "service_role";
  authToken = SB_SERVICE_KEY;
  authApikey = SB_SERVICE_KEY;
  console.error("[lever-mcp] ⚠ Modo SERVICE_ROLE (admin). Recomendado só pra owner/dev. Colaboradores devem usar LEVER_USER_JWT.");
} else {
  console.error("[lever-mcp] FATAL: nenhum método de auth disponível.\n" +
    "Opções:\n" +
    "  1. LEVER_USER_JWT no env (gerar via `node login.mjs`)\n" +
    "  2. LEVER_REFRESH_TOKEN no env\n" +
    "  3. Rodar login: `node " + resolve(__dirname, "login.mjs") + "`\n" +
    "  4. (admin only) SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

if (!SB_URL) {
  console.error("[lever-mcp] FATAL: VITE_SUPABASE_URL/SUPABASE_URL ausente em .env");
  process.exit(1);
}
if (!SB_ANON_KEY && authMode !== "service_role") {
  console.error("[lever-mcp] FATAL: VITE_SUPABASE_ANON_KEY/PUBLISHABLE_KEY ausente em .env (necessário pra JWT mode)");
  process.exit(1);
}

// Token refresh helper (apenas refresh mode)
async function refreshAccessToken() {
  const rt = REFRESH_TOKEN || persistedAuth?.refresh_token;
  if (!rt) throw new Error("Sem refresh_token disponível");
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SB_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!r.ok) throw new Error(`Refresh falhou: ${r.status} ${await r.text()}`);
  const data = await r.json();
  authToken = data.access_token;
  persistedAuth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: data.user,
  };
  // Persistir
  try {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(dirname(CREDS_PATH), { recursive: true });
    writeFileSync(CREDS_PATH, JSON.stringify(persistedAuth, null, 2));
  } catch {}
  return authToken;
}

// Se refresh mode e access expirado, refresh
if (authMode === "refresh" && (!authToken || (persistedAuth?.expires_at && Date.now() > persistedAuth.expires_at - 60_000))) {
  try {
    await refreshAccessToken();
  } catch (e) {
    console.error(`[lever-mcp] FATAL refresh: ${e.message}`);
    process.exit(1);
  }
}

const SB_HEADERS = { apikey: authApikey, Authorization: `Bearer ${authToken}` };

console.error(`[lever-mcp] auth mode: ${authMode}${persistedAuth?.user?.email ? ` · user: ${persistedAuth.user.email}` : ""}`);

// ─── Helpers ────────────────────────────────────────────────────────────────
async function sb(table, query) {
  const url = `${SB_URL}/rest/v1/${table}${query ? "?" + query : ""}`;
  const r = await fetch(url, { headers: SB_HEADERS });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function shopify(shopDomain, accessToken, path) {
  const r = await fetch(`https://${shopDomain}/admin/api/2024-10${path}`, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });
  if (!r.ok) throw new Error(`Shopify ${r.status} on ${shopDomain}: ${await r.text()}`);
  const next = (r.headers.get("link") || "").match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  return { data: await r.json(), next };
}

async function getClientByIdentifier(idOrName) {
  // Aceita UUID, name parcial, ou shopify_domain
  const v = encodeURIComponent(idOrName);
  const filters = [
    `id=eq.${v}`,
    `shopify_domain=eq.${v}`,
    `name=ilike.*${v}*`,
  ];
  for (const f of filters) {
    try {
      const rows = await sb("agency_clients", `select=id,name,shopify_domain,shopify_access_token,client_type,fee_fixed,commission_rate,is_archived&${f}`);
      if (rows.length === 1) return rows[0];
      if (rows.length > 1) {
        const exact = rows.find((c) => c.name?.toLowerCase() === idOrName.toLowerCase());
        if (exact) return exact;
      }
    } catch {}
  }
  throw new Error(`Cliente não encontrado: "${idOrName}". Tente nome exato, UUID, ou shopify_domain.`);
}

function periodToDates(period) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch ((period || "30d").toLowerCase()) {
    case "today": return { from: today, to: today };
    case "7d": return { from: new Date(now - 7 * 86400_000).toISOString().slice(0, 10), to: today };
    case "30d": return { from: new Date(now - 30 * 86400_000).toISOString().slice(0, 10), to: today };
    case "90d": return { from: new Date(now - 90 * 86400_000).toISOString().slice(0, 10), to: today };
    case "mtd": return { from: `${now.toISOString().slice(0, 7)}-01`, to: today };
    case "ytd": return { from: `${now.getUTCFullYear()}-01-01`, to: today };
    default:
      // Custom: "YYYY-MM-DD:YYYY-MM-DD"
      const m = period.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
      if (m) return { from: m[1], to: m[2] };
      throw new Error(`Período inválido: "${period}". Use: today, 7d, 30d, 90d, mtd, ytd, ou YYYY-MM-DD:YYYY-MM-DD`);
  }
}

// ─── Tools ──────────────────────────────────────────────────────────────────

async function leverListClients({ filter = "active" } = {}) {
  // Usa view RLS-safe quando JWT/refresh mode; table direta quando service_role
  const source = authMode === "service_role" ? "agency_clients" : "v_agency_clients_visible";
  let q = "select=id,name,shopify_domain,client_type,fee_fixed,commission_rate,calculation_base,is_internal,is_archived,shopify_status&order=fee_fixed.desc.nullslast,name.asc";

  if (filter === "active") q += "&is_archived=eq.false&shopify_status=eq.connected";
  else if (filter === "fixed") q += "&is_archived=eq.false&client_type=eq.fixo";
  else if (filter === "all") {}
  else if (filter === "archived") q += "&is_archived=eq.true";

  const rows = await sb(source, q);
  return {
    count: rows.length,
    filter,
    clients: rows.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.shopify_domain,
      type: c.client_type,
      fee_fixed: c.fee_fixed ? `R$ ${c.fee_fixed}` : null,
      commission: c.commission_rate ? `${c.commission_rate}% / ${c.calculation_base || "?"}` : null,
      internal: c.is_internal || false,
      archived: c.is_archived || false,
    })),
  };
}

async function leverShopifyRevenue({ client, period = "30d" }) {
  // JWT mode: usar edge function mcp-shopify-proxy (não expõe token client-side)
  if (authMode === "jwt" || authMode === "refresh") {
    const c = await getClientByIdentifier(client);
    const r = await fetch(`${SB_URL}/functions/v1/mcp-shopify-proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        apikey: SB_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "revenue", client_id: c.id, period }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`mcp-shopify-proxy ${r.status}: ${t}`);
    }
    const json = await r.json();
    if (json.error) throw new Error(json.error);
    return {
      ...json.data,
      _mode: "edge-function-proxy",
    };
  }

  // Service role mode: query Shopify direto (admin, dev mode)
  const c = await getClientByIdentifier(client);
  if (!c.shopify_access_token) throw new Error(`Cliente ${c.name} sem token Shopify salvo.`);
  const { from, to } = periodToDates(period);

  let cursor = null, totalSales = 0, count = 0, currency = "BRL", byDay = {};
  do {
    const url = cursor
      ? cursor
      : `${"/orders.json"}?status=any&financial_status=paid,partially_paid&created_at_min=${from}T00:00:00-03:00&created_at_max=${to}T23:59:59-03:00&limit=250&fields=total_price,currency,created_at`;
    const r = await fetch(cursor ?? `https://${c.shopify_domain}/admin/api/2024-10${url}`, {
      headers: { "X-Shopify-Access-Token": c.shopify_access_token },
    });
    if (!r.ok) throw new Error(`Shopify ${r.status}: ${await r.text()}`);
    const data = await r.json();
    for (const o of data.orders || []) {
      const v = parseFloat(o.total_price || "0");
      totalSales += v;
      count++;
      currency = o.currency || currency;
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + v;
    }
    cursor = (r.headers.get("link") || "").match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  } while (cursor);

  const days = Object.keys(byDay).sort();
  // Pull shop currency pra exibição segura cross-client (USD vs BRL)
  let shopCurrency = currency;
  let shopCountry = null;
  try {
    const shopR = await fetch(`https://${c.shopify_domain}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": c.shopify_access_token },
    });
    const shop = (await shopR.json()).shop;
    shopCurrency = shop.currency || currency;
    shopCountry = shop.country_code;
  } catch {}

  return {
    client: c.name,
    period: `${from} → ${to}`,
    totalSales: Number(totalSales.toFixed(2)),
    orders: count,
    currency: shopCurrency,
    country: shopCountry,
    aov: count > 0 ? Number((totalSales / count).toFixed(2)) : 0,
    daily_avg: days.length > 0 ? Number((totalSales / days.length).toFixed(2)) : 0,
    by_day: byDay,
  };
}

async function leverMetaSpend({ client, period = "30d" }) {
  const c = await getClientByIdentifier(client);
  const { from, to } = periodToDates(period);

  // Pega ad_account_ids do client. Source: agency_clients.selected_ad_accounts (JSON array)
  // Fallback: dw_meta_accounts.client_id
  const fullClient = await sb(
    "agency_clients",
    `select=selected_ad_accounts&id=eq.${encodeURIComponent(c.id)}`,
  );
  let ad_account_ids = fullClient[0]?.selected_ad_accounts || [];

  if (!ad_account_ids.length) {
    // Fallback: olhar dw_meta_accounts por client_id
    const dwAccs = await sb(
      "dw_meta_accounts",
      `select=account_id&client_id=eq.${encodeURIComponent(c.id)}`,
    ).catch(() => []);
    ad_account_ids = dwAccs.map((a) => a.account_id);
  }

  if (ad_account_ids.length === 0) {
    return { client: c.name, period: `${from} → ${to}`, error: "Sem ad_account_id mapeado em selected_ad_accounts nem dw_meta_accounts" };
  }

  const inFilter = ad_account_ids.map((a) => `"${a}"`).join(",");
  const rows = await sb(
    "dw_meta_insights_daily",
    `select=date,account_id,spend,impressions,clicks,purchases,revenue&account_id=in.(${inFilter})&date=gte.${from}&date=lte.${to}&order=date.asc`,
  );

  const agg = rows.reduce(
    (a, r) => {
      a.spend += parseFloat(r.spend || 0);
      a.impressions += parseInt(r.impressions || 0);
      a.clicks += parseInt(r.clicks || 0);
      a.purchases += parseInt(r.purchases || 0);
      a.revenue += parseFloat(r.revenue || 0);
      return a;
    },
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 },
  );

  return {
    client: c.name,
    period: `${from} → ${to}`,
    ad_accounts: ad_account_ids,
    spend: Number(agg.spend.toFixed(2)),
    impressions: agg.impressions,
    clicks: agg.clicks,
    purchases: agg.purchases,
    revenue_attributed: Number(agg.revenue.toFixed(2)),
    roas: agg.spend > 0 ? Number((agg.revenue / agg.spend).toFixed(2)) : 0,
    cpa: agg.purchases > 0 ? Number((agg.spend / agg.purchases).toFixed(2)) : 0,
    ctr: agg.impressions > 0 ? Number(((agg.clicks / agg.impressions) * 100).toFixed(2)) : 0,
    days: rows.length,
  };
}

async function leverCrossView({ view, filters = {} }) {
  const allowedViews = [
    "dw_v_meta_vs_shopify_daily",
    "dw_v_top_ads_30d",
    "dw_v_sku_velocity",
    "dw_v_geo_team_heatmap",
    "dw_v_customer_rfm",
    "dw_v_cross_store_customers",
    "v_agency_clients_visible",
  ];
  if (!allowedViews.includes(view)) {
    throw new Error(`View "${view}" não permitida. Use: ${allowedViews.join(", ")}`);
  }

  const parts = ["select=*", "limit=200"];
  for (const [k, v] of Object.entries(filters)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return { view, rows: await sb(view, parts.join("&")) };
}

async function leverClientKpis({ client, period = "30d" }) {
  const c = await getClientByIdentifier(client);
  const [revenue, spend] = await Promise.all([
    leverShopifyRevenue({ client: c.name, period }).catch((e) => ({ error: e.message })),
    leverMetaSpend({ client: c.name, period }).catch((e) => ({ error: e.message })),
  ]);

  const realRoas =
    revenue.totalSales && spend.spend
      ? Number((revenue.totalSales / spend.spend).toFixed(2))
      : null;

  return {
    client: c.name,
    domain: c.shopify_domain,
    period,
    shopify: revenue,
    meta: spend,
    real_roas: realRoas,
    note: realRoas !== null
      ? `ROAS real (Shopify gross / Meta spend) = ${realRoas}. ROAS Meta-attributed = ${spend.roas ?? "?"}.`
      : "Sem dado suficiente pra ROAS real.",
  };
}

// ─── MCP server ─────────────────────────────────────────────────────────────
const server = new Server(
  { name: "lever-system", version: "0.1.0-mvp" },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: "lever_list_clients",
    description: "Lista clientes Lever do Supabase. Default = ativos não-arquivados. Use filter=fixed pra só pagantes recorrentes, all pra todos, archived pra arquivados.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["active", "fixed", "all", "archived"], default: "active" },
      },
    },
  },
  {
    name: "lever_shopify_revenue",
    description: "Faturamento Shopify de um cliente em um período. Retorna total, AOV, contagem de pedidos, e quebra diária.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Nome, UUID ou shopify_domain do cliente" },
        period: { type: "string", description: "today, 7d, 30d, 90d, mtd, ytd, ou YYYY-MM-DD:YYYY-MM-DD", default: "30d" },
      },
      required: ["client"],
    },
  },
  {
    name: "lever_meta_spend",
    description: "Spend Meta de um cliente em um período (do DW dw_meta_insights_daily). Inclui CTR/CPA/ROAS Meta-attributed.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string" },
        period: { type: "string", default: "30d" },
      },
      required: ["client"],
    },
  },
  {
    name: "lever_cross_view",
    description: "Query views canônicas do DW. Views permitidas: dw_v_meta_vs_shopify_daily, dw_v_top_ads_30d, dw_v_sku_velocity, dw_v_geo_team_heatmap, dw_v_customer_rfm, dw_v_cross_store_customers, v_agency_clients_visible.",
    inputSchema: {
      type: "object",
      properties: {
        view: { type: "string" },
        filters: { type: "object", description: "Filtros PostgREST (ex: { 'date=gte.': '2026-05-01', 'client_id=eq.': 'uuid' })" },
      },
      required: ["view"],
    },
  },
  {
    name: "lever_client_kpis",
    description: "KPIs consolidados (Shopify + Meta) de um cliente em um período. Cruza fontes e calcula ROAS REAL vs Meta-attributed.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string" },
        period: { type: "string", default: "30d" },
      },
      required: ["client"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let result;
    switch (name) {
      case "lever_list_clients": result = await leverListClients(args || {}); break;
      case "lever_shopify_revenue": result = await leverShopifyRevenue(args || {}); break;
      case "lever_meta_spend": result = await leverMetaSpend(args || {}); break;
      case "lever_cross_view": result = await leverCrossView(args || {}); break;
      case "lever_client_kpis": result = await leverClientKpis(args || {}); break;
      default: throw new Error(`Tool desconhecida: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Erro: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[lever-mcp] connected · 5 tools · service-role auth · supabase:", SB_URL);
