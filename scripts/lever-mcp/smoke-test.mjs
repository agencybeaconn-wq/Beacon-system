#!/usr/bin/env node
/**
 * Smoke test — chama as 5 tools do MCP via JSON-RPC stdio sem precisar de cliente MCP.
 * Spawna o server, manda requests, valida responses.
 */
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(__dirname, "index.mjs");

const child = spawn("node", [SERVER], { stdio: ["pipe", "pipe", "pipe"] });
let buf = "";
const pending = new Map();
let id = 0;

child.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  for (;;) {
    const i = buf.indexOf("\n");
    if (i < 0) break;
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

child.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

function rpc(method, params) {
  id++;
  const req = { jsonrpc: "2.0", id, method, params };
  return new Promise((res) => {
    pending.set(id, res);
    child.stdin.write(JSON.stringify(req) + "\n");
  });
}

async function callTool(name, args) {
  return rpc("tools/call", { name, arguments: args });
}

async function run() {
  // 0. Init
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.1" },
  });
  await new Promise((r) => setTimeout(r, 200));

  // 1. list tools
  const tools = await rpc("tools/list");
  console.log(`\n✅ TOOL LIST: ${tools.result.tools.length} tools\n`);
  tools.result.tools.forEach((t) => console.log(`   - ${t.name}`));

  // 2. list_clients filter=fixed
  console.log("\n─── lever_list_clients (fixed) ───");
  const r1 = await callTool("lever_list_clients", { filter: "fixed" });
  const c1 = JSON.parse(r1.result.content[0].text);
  console.log(`   ${c1.count} clientes fixos`);
  console.log(`   Top 3:`, c1.clients.slice(0, 3).map((c) => `${c.name} (${c.fee_fixed})`).join(" · "));

  // 3. shopify_revenue Coringão 30d (via shopify_domain, evita encoding)
  console.log("\n─── lever_shopify_revenue Coringão 30d ───");
  const r2 = await callTool("lever_shopify_revenue", { client: "nbdxec-gx.myshopify.com", period: "30d" });
  if (r2.result.isError) {
    console.log(`   ❌ ${r2.result.content[0].text}`);
  } else {
    const c2 = JSON.parse(r2.result.content[0].text);
    console.log(`   ${c2.client} · ${c2.period}`);
    console.log(`   ${c2.currency} ${c2.totalSales} · ${c2.orders} pedidos · AOV ${c2.aov}`);
  }

  // 4. cross_view dw_v_meta_vs_shopify_daily
  console.log("\n─── lever_cross_view dw_v_meta_vs_shopify_daily ───");
  const r3 = await callTool("lever_cross_view", { view: "dw_v_meta_vs_shopify_daily" });
  if (r3.result.isError) {
    console.log(`   ❌ ${r3.result.content[0].text}`);
  } else {
    const c3 = JSON.parse(r3.result.content[0].text);
    console.log(`   View ${c3.view} retornou ${c3.rows.length} rows`);
    if (c3.rows[0]) console.log(`   Sample:`, JSON.stringify(c3.rows[0]).slice(0, 200));
  }

  // 5. client_kpis Coringão
  console.log("\n─── lever_client_kpis Coringão 30d ───");
  const r4 = await callTool("lever_client_kpis", { client: "nbdxec-gx.myshopify.com", period: "30d" });
  if (r4.result.isError) {
    console.log(`   ❌ ${r4.result.content[0].text}`);
  } else {
    const c4 = JSON.parse(r4.result.content[0].text);
    console.log(`   ${c4.client} · ${c4.period}`);
    console.log(`   Shopify: R$ ${c4.shopify?.totalSales} (${c4.shopify?.orders} ord)`);
    console.log(`   Meta spend: ${c4.meta?.spend !== undefined ? "R$ " + c4.meta.spend : c4.meta?.error}`);
    console.log(`   ROAS real: ${c4.real_roas ?? "?"}`);
  }

  child.kill();
  console.log("\n✅ Smoke test concluído\n");
}

run().catch((e) => {
  console.error("FATAL:", e);
  child.kill();
  process.exit(1);
});
