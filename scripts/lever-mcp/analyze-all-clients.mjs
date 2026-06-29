#!/usr/bin/env node
/**
 * analyze-all-clients — análise consolidada de todos clientes fixos da Lever.
 * Pull em paralelo: shop info, 30d revenue, daily 7d, AOV, geo breakdown (se EN).
 * Output: JSON em ./analysis-<date>.json + relatório markdown.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVER_ROOT = resolve(__dirname, "../..");
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

// FX
let USD_BRL = 5.05;
try {
  const fxR = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
  USD_BRL = parseFloat((await fxR.json()).USDBRL.bid);
} catch {}

console.log(`USD→BRL: ${USD_BRL.toFixed(4)}\n`);

// Pull todos clientes fixos ativos + Kron interna
const r = await fetch(
  `${SB_URL}/rest/v1/agency_clients?select=id,name,shopify_domain,shopify_access_token,client_type,fee_fixed,commission_rate,calculation_base,is_internal&is_archived=eq.false&shopify_status=in.(connected,pending)&or=(client_type.eq.fixo,is_internal.eq.true)&order=fee_fixed.desc.nullslast`,
  { headers: SB_HEADERS },
);
const clients = await r.json();
console.log(`▌ Total de clientes a analisar: ${clients.length}\n`);

const now = new Date();
const today = now.toISOString().slice(0, 10);
const thirty = new Date(now - 30 * 86400_000).toISOString().slice(0, 10);
const seven = new Date(now - 7 * 86400_000).toISOString().slice(0, 10);

async function analyzeClient(c) {
  const out = {
    id: c.id,
    name: c.name,
    domain: c.shopify_domain,
    fee_fixed: c.fee_fixed,
    commission_rate: c.commission_rate,
    is_internal: c.is_internal,
    pulled_at: new Date().toISOString(),
  };
  if (!c.shopify_access_token) {
    out.error = "sem token";
    return out;
  }
  try {
    // Shop info
    const shopR = await fetch(
      `https://${c.shopify_domain}/admin/api/2024-10/shop.json`,
      { headers: { "X-Shopify-Access-Token": c.shopify_access_token } },
    );
    if (!shopR.ok) {
      out.error = `shop info ${shopR.status}`;
      return out;
    }
    const shop = (await shopR.json()).shop;
    out.currency = shop.currency;
    out.country = shop.country_code;
    out.shop_name = shop.name;
    out.plan = shop.plan_name;
    out.shop_created_at = shop.created_at;

    // 30d orders
    let cursor = null;
    let salesNative = 0;
    let count = 0;
    const byDay = {};
    const byCountry = {};
    let pages = 0;
    do {
      const url = cursor
        ?? `https://${c.shopify_domain}/admin/api/2024-10/orders.json?status=any&financial_status=paid,partially_paid&created_at_min=${thirty}T00:00:00-03:00&limit=250&fields=total_price,currency,created_at,shipping_address`;
      const resp = await fetch(url, {
        headers: { "X-Shopify-Access-Token": c.shopify_access_token },
      });
      if (!resp.ok) break;
      const data = await resp.json();
      pages++;
      for (const o of data.orders || []) {
        const v = parseFloat(o.total_price || 0);
        salesNative += v;
        count++;
        const d = new Date(o.created_at).toISOString().slice(0, 10);
        byDay[d] = (byDay[d] || 0) + v;
        const co = o.shipping_address?.country_code || "UNKNOWN";
        if (!byCountry[co]) byCountry[co] = { orders: 0, sales: 0 };
        byCountry[co].orders++;
        byCountry[co].sales += v;
      }
      cursor = (resp.headers.get("link") || "").match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
      if (pages > 20) break; // safety
    } while (cursor);

    out.orders_30d = count;
    out.sales_native_30d = Number(salesNative.toFixed(2));
    out.aov_native = count > 0 ? Number((salesNative / count).toFixed(2)) : 0;
    out.sales_brl_30d = shop.currency === "USD" ? Number((salesNative * USD_BRL).toFixed(2)) : salesNative;

    // Last 7d daily + 7d total
    let sales7d = 0;
    let count7d = 0;
    const last7Days = Object.entries(byDay)
      .filter(([d]) => d >= seven)
      .sort();
    for (const [, v] of last7Days) sales7d += v;
    count7d = Object.entries(byDay).filter(([d]) => d >= seven).reduce((acc, [d]) => {
      // Need to count orders per day, skip for now
      return acc;
    }, 0);
    out.sales_native_7d = Number(sales7d.toFixed(2));
    out.sales_brl_7d = shop.currency === "USD" ? Number((sales7d * USD_BRL).toFixed(2)) : sales7d;
    out.daily_avg_7d = Number((sales7d / 7).toFixed(2));
    out.last_7_days = Object.fromEntries(last7Days.map(([d, v]) => [d, Number(v.toFixed(2))]));

    // Today
    out.sales_today = Number((byDay[today] || 0).toFixed(2));

    // Trend: 7d vs prev 7d (days 14-7 ago)
    const prev7Start = new Date(now - 14 * 86400_000).toISOString().slice(0, 10);
    let prev7Sales = 0;
    for (const [d, v] of Object.entries(byDay)) {
      if (d >= prev7Start && d < seven) prev7Sales += v;
    }
    out.sales_native_prev_7d = Number(prev7Sales.toFixed(2));
    out.trend_7d_vs_prev = prev7Sales > 0 ? Number(((sales7d / prev7Sales - 1) * 100).toFixed(1)) : null;

    // Geo top 5
    out.geo_top = Object.entries(byCountry)
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 5)
      .map(([co, d]) => ({ country: co, orders: d.orders, sales: Number(d.sales.toFixed(2)), pct: Number((d.orders / count * 100).toFixed(1)) }));
    out.geo_countries_count = Object.keys(byCountry).length;

    // Lever commission estimado (simplificado: % sobre faturamento total se calculation_base ≠ spend)
    if (c.commission_rate && c.calculation_base !== "spend") {
      out.lever_commission_est_30d = Number((out.sales_brl_30d * c.commission_rate / 100).toFixed(2));
    }
    out.lever_fee_monthly = c.fee_fixed || 0;
  } catch (err) {
    out.error = err.message;
  }
  return out;
}

console.log("Analisando em paralelo (concurrency 6)...\n");
const results = [];
const concurrency = 6;
for (let i = 0; i < clients.length; i += concurrency) {
  const batch = clients.slice(i, i + concurrency);
  const batchResults = await Promise.all(batch.map(analyzeClient));
  results.push(...batchResults);
  for (const r of batchResults) {
    const status = r.error ? `✗ ${r.error}` : `✓ ${r.shop_name} (${r.currency}/${r.country}) · ${r.orders_30d} ord 30d · trend ${r.trend_7d_vs_prev > 0 ? "+" : ""}${r.trend_7d_vs_prev}%`;
    console.log(`  ${r.name.padEnd(28)} ${status}`);
  }
}

// Salvar JSON
const out = {
  analyzed_at: new Date().toISOString(),
  usd_brl_rate: USD_BRL,
  period: { from: thirty, to: today },
  clients: results,
};
const outPath = resolve(__dirname, `analysis-${today}.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\n✓ JSON salvo em ${outPath}`);

// Resumo no console
const ok = results.filter((r) => !r.error);
const totalBRL30d = ok.reduce((a, r) => a + (r.sales_brl_30d || 0), 0);
const totalOrders30d = ok.reduce((a, r) => a + (r.orders_30d || 0), 0);
const totalFee = ok.reduce((a, r) => a + (r.lever_fee_monthly || 0), 0);

console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`RESUMO CONSOLIDADO · ${ok.length} clientes analisados`);
console.log(`═══════════════════════════════════════════════════════════════════════`);
console.log(`GMV cross-cliente 30d:   R$ ${totalBRL30d.toFixed(2).padStart(15)}`);
console.log(`Pedidos cross-cliente:   ${String(totalOrders30d).padStart(15)}`);
console.log(`Fee fixo mensal Lever:   R$ ${totalFee.toFixed(2).padStart(15)}`);
console.log(`AOV médio (BRL eq):      R$ ${(totalBRL30d / totalOrders30d).toFixed(2).padStart(15)}`);
console.log(`\n  Top 5 por GMV 30d:`);
const sorted = [...ok].sort((a, b) => b.sales_brl_30d - a.sales_brl_30d);
for (const r of sorted.slice(0, 5)) {
  console.log(`    ${r.name.padEnd(28)} R$ ${r.sales_brl_30d.toFixed(2).padStart(12)} · ${r.orders_30d} ord · AOV ${r.currency} ${r.aov_native}`);
}
console.log(`\n  Bottom 3 por GMV 30d:`);
for (const r of sorted.slice(-3)) {
  console.log(`    ${r.name.padEnd(28)} R$ ${r.sales_brl_30d.toFixed(2).padStart(12)} · ${r.orders_30d} ord`);
}
console.log(`\n  Tendência 7d vs prev 7d (sinal vital):`);
const trending = [...ok].filter((r) => r.trend_7d_vs_prev !== null).sort((a, b) => b.trend_7d_vs_prev - a.trend_7d_vs_prev);
for (const r of trending.slice(0, 5)) {
  console.log(`    ${r.name.padEnd(28)} ${r.trend_7d_vs_prev > 0 ? "+" : ""}${r.trend_7d_vs_prev}%`);
}
console.log(`    ─── piores ───`);
for (const r of trending.slice(-3)) {
  console.log(`    ${r.name.padEnd(28)} ${r.trend_7d_vs_prev > 0 ? "+" : ""}${r.trend_7d_vs_prev}%`);
}
