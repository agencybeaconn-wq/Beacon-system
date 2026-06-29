#!/usr/bin/env node
/**
 * client-snapshot — KPIs Shopify de 1 cliente em tempo real.
 * Uso: node client-snapshot.mjs <client> [--period 30d|7d|today|mtd|YYYY-MM-DD:YYYY-MM-DD] [--geo]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVER_ROOT = resolve(__dirname, "../..");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Uso: client-snapshot <cliente> [--period 30d|7d|today|mtd|YYYY-MM-DD:YYYY-MM-DD] [--geo]");
  process.exit(1);
}
const clientArg = args[0];
const periodArg = args.includes("--period") ? args[args.indexOf("--period") + 1] : "30d";
const wantGeo = args.includes("--geo");

const env = {};
for (const f of [".env", ".env.local"]) {
  try {
    const c = readFileSync(resolve(LEVER_ROOT, f), "utf8").replace(/\r/g, "");
    for (const l of c.split("\n")) {
      const i = l.indexOf("=");
      if (i < 1 || !/^[A-Z_][A-Z0-9_]*$/.test(l.slice(0, i))) continue;
      env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SB_HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

async function findClient(idOrName) {
  const v = encodeURIComponent(idOrName);
  const fs = [`id=eq.${v}`, `shopify_domain=eq.${v}`, `name=ilike.*${v}*`];
  for (const f of fs) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/agency_clients?select=name,shopify_domain,shopify_access_token&${f}`, { headers: SB_HEADERS });
      if (!r.ok) continue;
      const rows = await r.json();
      if (rows.length === 1) return rows[0];
      if (rows.length > 1) {
        const exact = rows.find((c) => c.name?.toLowerCase() === idOrName.toLowerCase());
        if (exact) return exact;
      }
    } catch {}
  }
  throw new Error(`Cliente "${idOrName}" não encontrado.`);
}

function parsePeriod(p) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (p.toLowerCase()) {
    case "today": return { from: today, to: today, label: "Hoje" };
    case "7d": return { from: new Date(now - 7 * 86400_000).toISOString().slice(0, 10), to: today, label: "Últimos 7 dias" };
    case "30d": return { from: new Date(now - 30 * 86400_000).toISOString().slice(0, 10), to: today, label: "Últimos 30 dias" };
    case "90d": return { from: new Date(now - 90 * 86400_000).toISOString().slice(0, 10), to: today, label: "Últimos 90 dias" };
    case "mtd": return { from: `${now.toISOString().slice(0, 7)}-01`, to: today, label: "Mês até hoje" };
    case "ytd": return { from: `${now.getUTCFullYear()}-01-01`, to: today, label: "Ano até hoje" };
    default:
      const m = p.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
      if (m) return { from: m[1], to: m[2], label: `${m[1]} → ${m[2]}` };
      throw new Error(`Período inválido: "${p}"`);
  }
}

async function getFx() {
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    return parseFloat((await r.json()).USDBRL.bid);
  } catch {
    return 5.05;
  }
}

async function pullShop(c) {
  const r = await fetch(`https://${c.shopify_domain}/admin/api/2024-10/shop.json`, {
    headers: { "X-Shopify-Access-Token": c.shopify_access_token },
  });
  return (await r.json()).shop;
}

async function pullOrders(c, from, to) {
  let cursor = null, sales = 0, count = 0, currencies = new Set();
  const byCountry = {}, byDay = {};
  do {
    const url = cursor ?? `https://${c.shopify_domain}/admin/api/2024-10/orders.json?status=any&financial_status=paid,partially_paid&created_at_min=${from}T00:00:00-03:00&created_at_max=${to}T23:59:59-03:00&limit=250&fields=total_price,currency,created_at,shipping_address`;
    const resp = await fetch(url, { headers: { "X-Shopify-Access-Token": c.shopify_access_token } });
    if (!resp.ok) throw new Error(`Shopify ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    for (const o of data.orders || []) {
      const v = parseFloat(o.total_price || 0);
      sales += v;
      count++;
      currencies.add(o.currency);
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + v;
      const co = o.shipping_address?.country_code || "UNKNOWN";
      if (!byCountry[co]) byCountry[co] = { orders: 0, sales: 0 };
      byCountry[co].orders++;
      byCountry[co].sales += v;
    }
    cursor = (resp.headers.get("link") || "").match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  } while (cursor);
  return { sales, count, currencies: [...currencies], byCountry, byDay };
}

const c = await findClient(clientArg);
if (!c.shopify_access_token) {
  console.error(`Cliente ${c.name} sem shopify_access_token.`);
  process.exit(2);
}

const { from, to, label } = parsePeriod(periodArg);
const [shop, fx] = await Promise.all([pullShop(c), getFx()]);

console.log(`\n▌ ${c.name}  (${c.shopify_domain})`);
console.log(`  Loja: ${shop.country_code} · Moeda: ${shop.currency} · Plan: ${shop.plan_name}`);
console.log(`  Pulled at: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n`);

// Multi-period sempre — independente do periodArg, mostra today/7d/MTD/30d como context
const periods = ["today", "7d", "mtd", "30d"];
const results = await Promise.all(periods.map(async (p) => {
  const { from, to } = parsePeriod(p);
  const r = await pullOrders(c, from, to);
  return { period: p, ...r };
}));

const sym = shop.currency === "USD" ? "US$" : shop.currency === "BRL" ? "R$" : shop.currency;
for (const r of results) {
  const brlEq = shop.currency === "USD" ? ` ≈ R$ ${(r.sales * fx).toFixed(2)}` : "";
  const aov = r.count > 0 ? r.sales / r.count : 0;
  console.log(`  ${r.period.toUpperCase().padEnd(7)} ${sym} ${r.sales.toFixed(2).padStart(11)}${brlEq.padEnd(20)} · ${r.count} pedidos · AOV ${sym} ${aov.toFixed(2)}`);
}

// Geo se solicitado
if (wantGeo) {
  const r30d = results.find((x) => x.period === "30d");
  const sorted = Object.entries(r30d.byCountry).sort((a, b) => b[1].sales - a[1].sales).slice(0, 5);
  console.log(`\n  Top 5 países (30d):`);
  for (const [co, d] of sorted) {
    const pct = (d.orders / r30d.count * 100).toFixed(1);
    console.log(`    ${co}: ${d.orders} ord (${pct}%) · ${sym} ${d.sales.toFixed(2)}`);
  }
}

// Daily 7d breakdown
const r7d = results.find((x) => x.period === "7d");
const days = Object.keys(r7d.byDay).sort();
if (days.length > 0) {
  console.log(`\n  Daily 7d:`);
  const max = Math.max(...Object.values(r7d.byDay));
  for (const d of days) {
    const v = r7d.byDay[d];
    const bar = "█".repeat(Math.max(1, Math.round((v / max) * 30)));
    console.log(`    ${d}: ${sym} ${v.toFixed(2).padStart(10)} ${bar}`);
  }
}
console.log();
