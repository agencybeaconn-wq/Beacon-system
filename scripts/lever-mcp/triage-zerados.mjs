#!/usr/bin/env node
/**
 * Triage dos 6 clientes zerados: pré-launch, in-setup, dead, ou zombie pagante?
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

const ZERADOS = [
  "MontRoyal",
  "Mega mantos",
  "JGS Sports",
  "Puskas",
  "Setor Esportes",
  "Jhon Atacado",
];

async function triageClient(name) {
  const r = await fetch(
    `${SB_URL}/rest/v1/agency_clients?select=*&name=ilike.${encodeURIComponent(name)}*`,
    { headers: SB_HEADERS },
  );
  const rows = await r.json();
  const c = rows.find((x) => x.name === name) || rows[0];
  if (!c) return { name, error: "client não encontrado" };

  const out = {
    name: c.name,
    domain: c.shopify_domain,
    sb_created_at: c.created_at,
    sb_connected_at: c.shopify_connected_at,
    fee_fixed: c.fee_fixed,
    commission_rate: c.commission_rate,
    client_type: c.client_type,
    onboarding_type: c.onboarding_type,
    project_name: c.project_name,
    project_deadline: c.project_deadline,
    payment_due_day: c.payment_due_day,
    shopify_status: c.shopify_status,
  };

  if (!c.shopify_access_token) {
    out.error = "sem token";
    return out;
  }

  try {
    // Shop info
    const shopR = await fetch(`https://${c.shopify_domain}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": c.shopify_access_token },
    });
    const shop = (await shopR.json()).shop;
    out.shop_name = shop.name;
    out.shop_currency = shop.currency;
    out.shop_country = shop.country_code;
    out.shop_created_at = shop.created_at;
    out.shop_domain = shop.domain;
    out.shop_plan = shop.plan_name;
    out.shop_password_enabled = shop.password_enabled;

    // Products count
    const pcR = await fetch(`https://${c.shopify_domain}/admin/api/2024-10/products/count.json`, {
      headers: { "X-Shopify-Access-Token": c.shopify_access_token },
    });
    out.products_count = (await pcR.json()).count;

    // Orders count + último pedido (qualquer data)
    const ocR = await fetch(`https://${c.shopify_domain}/admin/api/2024-10/orders/count.json?status=any`, {
      headers: { "X-Shopify-Access-Token": c.shopify_access_token },
    });
    out.orders_total = (await ocR.json()).count;

    const lastR = await fetch(
      `https://${c.shopify_domain}/admin/api/2024-10/orders.json?status=any&limit=3&fields=name,total_price,currency,created_at,financial_status&order=created_at+desc`,
      { headers: { "X-Shopify-Access-Token": c.shopify_access_token } },
    );
    const lastData = await lastR.json();
    out.last_3_orders = (lastData.orders || []).map((o) => ({
      name: o.name,
      price: `${o.currency} ${o.total_price}`,
      status: o.financial_status,
      created_at: o.created_at,
      days_ago: Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400_000),
    }));
    out.last_order_days_ago = out.last_3_orders[0]?.days_ago ?? null;

    // Theme info
    const tR = await fetch(`https://${c.shopify_domain}/admin/api/2024-10/themes.json`, {
      headers: { "X-Shopify-Access-Token": c.shopify_access_token },
    });
    const themes = (await tR.json()).themes || [];
    const mainTheme = themes.find((t) => t.role === "main");
    out.main_theme = mainTheme ? { name: mainTheme.name, updated_at: mainTheme.updated_at } : null;

    // Classification
    const shopDays = Math.floor((Date.now() - new Date(shop.created_at).getTime()) / 86400_000);
    const sbDays = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400_000);

    if (out.products_count === 0) {
      out.classification = "PRE_LAUNCH";
      out.reason = "Zero produtos. Loja não populada.";
    } else if (out.orders_total === 0) {
      out.classification = "NEVER_SOLD";
      out.reason = `${out.products_count} produtos, mas nunca vendeu. Lançamento falho ou loja teste.`;
    } else if (out.last_order_days_ago !== null && out.last_order_days_ago < 60) {
      out.classification = "RECENT_SALES_BUT_30D_ZERO";
      out.reason = `Vendeu há ${out.last_order_days_ago} dias. Pausa recente. ${out.orders_total} pedidos histórico.`;
    } else if (out.last_order_days_ago !== null && out.last_order_days_ago >= 60) {
      out.classification = "DORMANT";
      out.reason = `Último pedido há ${out.last_order_days_ago} dias. Histórico ${out.orders_total} pedidos. Dormente longo.`;
    } else {
      out.classification = "UNCLEAR";
    }

    out.shop_age_days = shopDays;
    out.sb_age_days = sbDays;
  } catch (err) {
    out.error = err.message;
  }
  return out;
}

const results = [];
for (const name of ZERADOS) {
  process.stdout.write(`Analisando ${name}... `);
  const r = await triageClient(name);
  results.push(r);
  if (r.error) {
    console.log(`✗ ${r.error}`);
  } else {
    console.log(`✓ ${r.classification}`);
  }
}

console.log("\n═══════════════════════════════════════════════════════════════════════");
console.log("TRIAGE DOS 6 ZERADOS");
console.log("═══════════════════════════════════════════════════════════════════════\n");

for (const r of results) {
  console.log(`▌ ${r.name} (${r.domain})`);
  if (r.error) {
    console.log(`  ✗ ${r.error}\n`);
    continue;
  }
  console.log(`  Classificação:        ${r.classification}`);
  console.log(`  Razão:                ${r.reason}`);
  console.log(`  Shop:                 ${r.shop_name} · ${r.shop_currency}/${r.shop_country} · plan ${r.shop_plan}`);
  console.log(`  Domain real:          ${r.shop_domain}`);
  console.log(`  Loja criada há:       ${r.shop_age_days} dias (${r.shop_created_at?.slice(0,10)})`);
  console.log(`  Cadastrada Lever há:  ${r.sb_age_days} dias (${r.sb_created_at?.slice(0,10)})`);
  console.log(`  Produtos:             ${r.products_count}`);
  console.log(`  Pedidos histórico:    ${r.orders_total}`);
  console.log(`  Último pedido:        ${r.last_order_days_ago !== null ? `${r.last_order_days_ago} dias atrás` : "NUNCA"}`);
  if (r.last_3_orders?.length > 0) {
    console.log(`  Últimos 3:`);
    for (const o of r.last_3_orders) {
      console.log(`    ${o.name} · ${o.price} · ${o.status} · ${o.days_ago}d atrás`);
    }
  }
  console.log(`  Fee Lever:            R$ ${r.fee_fixed || 0}/mês + ${r.commission_rate || 0}%`);
  console.log(`  Onboarding type:      ${r.onboarding_type || "?"}`);
  console.log(`  Project name:         ${r.project_name || "—"}`);
  console.log(`  Tema:                 ${r.main_theme?.name || "?"} (atualizado ${r.main_theme?.updated_at?.slice(0,10) || "?"})`);
  console.log(`  Loja com senha?       ${r.shop_password_enabled ? "SIM (não público)" : "Não (pública)"}`);
  console.log("");
}

const outPath = resolve(__dirname, `triage-zerados-2026-05-19.json`);
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`JSON salvo: ${outPath}`);
