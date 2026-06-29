#!/usr/bin/env node
/**
 * empire-status — raio-X completo da Lever Group em 1 doc.
 *
 * Puxa em paralelo:
 *   - Clientes (agency_clients): tipo, fee, status, GMV 30d, AOV
 *   - Top 5 + Bottom 3 por GMV (USD↔BRL aware)
 *   - Health score Meta (ads-health-daily input)
 *   - Edge functions count
 *   - DW tables + counts
 *   - Skills disponíveis no repo
 *   - PRs abertos via gh CLI
 *
 * Output: Lever QI/00-operating-brain/empire-status.md (auto-overwrite).
 *
 * Owner: João Victor (organizacional). Roda 1x/semana mín, idealmente diário 9h.
 *
 * Uso: node lever/scripts/lever-mcp/empire-status.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVER_ROOT = resolve(__dirname, "../..");
const LEVER_QI = resolve(LEVER_ROOT, "../../Lever QI/00-operating-brain");

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
const SB_H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

const now = new Date();
const today = now.toISOString().slice(0, 10);

// USD→BRL realtime
let USD_BRL = 5.05;
try {
  const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
  USD_BRL = parseFloat((await r.json()).USDBRL.bid);
} catch {}

console.log(`\n🗺️  Empire Status — ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
console.log(`   USD→BRL: ${USD_BRL.toFixed(4)}\n`);

// ─── Section 1: Clientes ──────────────────────────────────────────────────
console.log("→ Section 1: Clientes...");
const clientsAll = await fetch(`${SB_URL}/rest/v1/agency_clients?select=id,name,shopify_domain,client_type,fee_fixed,commission_rate,is_internal,is_archived,shopify_status&order=fee_fixed.desc.nullslast`, { headers: SB_H }).then((r) => r.json());

const fixed = clientsAll.filter((c) => c.client_type === "fixo" && !c.is_archived && c.shopify_status === "connected");
const avulsos = clientsAll.filter((c) => c.client_type === "avulso" && !c.is_archived && c.shopify_status === "connected");
const archived = clientsAll.filter((c) => c.is_archived);
const internal = clientsAll.filter((c) => c.is_internal && !c.is_archived);
const feeMonthlyTotal = fixed.reduce((a, c) => a + (c.fee_fixed || 0), 0);

console.log(`   ${clientsAll.length} total · ${fixed.length} fixos · ${avulsos.length} avulsos · ${archived.length} arquivados · ${internal.length} internos`);

// ─── Section 2: Reusar análise do dia se existe ─────────────────────────
console.log("→ Section 2: GMV last 30d...");
const analysisPath = resolve(__dirname, `analysis-${today}.json`);
let analysis = null;
if (existsSync(analysisPath)) {
  analysis = JSON.parse(readFileSync(analysisPath, "utf8"));
  console.log(`   Reusando analysis-${today}.json (${analysis.clients.length} clientes)`);
} else {
  // Tentar última análise disponível
  const dir = readdirSync(__dirname).filter((f) => f.startsWith("analysis-") && f.endsWith(".json")).sort().reverse();
  if (dir[0]) {
    analysis = JSON.parse(readFileSync(resolve(__dirname, dir[0]), "utf8"));
    console.log(`   Reusando ${dir[0]} (não temos hoje ainda)`);
  } else {
    console.log("   Sem análise prévia — rodar portfolio-analysis primeiro pra dados completos");
  }
}

const gmvData = analysis ? analysis.clients.filter((c) => !c.error && c.sales_brl_30d > 0) : [];
const gmvTotal = gmvData.reduce((a, c) => a + (c.sales_brl_30d || 0), 0);
const ordersTotal = gmvData.reduce((a, c) => a + (c.orders_30d || 0), 0);
const aovAvg = ordersTotal > 0 ? gmvTotal / ordersTotal : 0;

const top = [...gmvData].sort((a, b) => b.sales_brl_30d - a.sales_brl_30d);
const top5 = top.slice(0, 5);
const bot3 = top.slice(-3);
const trending = [...gmvData].filter((c) => c.trend_7d_vs_prev !== null).sort((a, b) => b.trend_7d_vs_prev - a.trend_7d_vs_prev);

// ─── Section 3: Ads health (último report) ──────────────────────────────
console.log("→ Section 3: Ads health...");
const adsHealthDir = resolve(LEVER_QI, "../04-data-rituals/ads-health");
let adsHealth = null;
if (existsSync(adsHealthDir)) {
  const dir = readdirSync(adsHealthDir).filter((f) => f.endsWith(".json")).sort().reverse();
  if (dir[0]) {
    adsHealth = JSON.parse(readFileSync(resolve(adsHealthDir, dir[0]), "utf8"));
    console.log(`   ${adsHealth.alerts.red.length} red · ${adsHealth.alerts.yellow.length} yellow · ${adsHealth.alerts.green.length} green (${dir[0]})`);
  }
}

// ─── Section 4: Edge functions count ─────────────────────────────────────
console.log("→ Section 4: Edge functions...");
const edgeFnDir = resolve(LEVER_ROOT, "supabase/functions");
let edgeFns = [];
try {
  edgeFns = readdirSync(edgeFnDir).filter((f) => {
    try {
      return statSync(resolve(edgeFnDir, f)).isDirectory() && !f.startsWith("_");
    } catch { return false; }
  });
  console.log(`   ${edgeFns.length} edge functions`);
} catch {}

// ─── Section 5: Skills ───────────────────────────────────────────────────
console.log("→ Section 5: Skills...");
const skillsDir = resolve(LEVER_ROOT, ".claude/skills");
let skills = [];
try {
  skills = readdirSync(skillsDir).filter((f) => {
    try {
      return statSync(resolve(skillsDir, f)).isDirectory() && existsSync(resolve(skillsDir, f, "SKILL.md"));
    } catch { return false; }
  });
  console.log(`   ${skills.length} skills`);
} catch {}

// ─── Section 6: PRs abertos via gh ───────────────────────────────────────
console.log("→ Section 6: PRs abertos...");
let prs = [];
try {
  const out = execSync("gh pr list --state open --json number,title,author,createdAt,additions,deletions,changedFiles --limit 20", {
    cwd: LEVER_ROOT,
    encoding: "utf8",
  });
  prs = JSON.parse(out);
  console.log(`   ${prs.length} PRs abertos`);
} catch (e) {
  console.log(`   Falhou ${e.message.slice(0, 60)}`);
}

// ─── Section 7: Tabelas + counts Supabase ────────────────────────────────
console.log("→ Section 7: Tabelas Supabase...");
const tableCounts = {};
const tablesToCheck = ["agency_clients", "dw_meta_accounts", "dw_meta_insights_daily", "client_tasks", "team_members", "fb_connections", "client_quality_runs"];
for (const t of tablesToCheck) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${t}?select=*&limit=0`, {
      headers: { ...SB_H, Prefer: "count=exact" },
    });
    const range = r.headers.get("content-range");
    tableCounts[t] = range ? parseInt(range.split("/")[1]) : "?";
  } catch {
    tableCounts[t] = "err";
  }
}
console.log("   ", Object.entries(tableCounts).map(([k, v]) => `${k}=${v}`).join(" · "));

// ─── Render markdown ──────────────────────────────────────────────────────
console.log("\n→ Render Markdown...");

function fmtBRL(v) { return `R$ ${(v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`; }

let md = `---
type: dashboard
domain: operating-brain
subject: empire-status
last-updated: ${now.toISOString()}
status: auto-generated
owner: joao-victor
usd_brl_rate: ${USD_BRL.toFixed(4)}
---

> Parent MOC: [[MOC-operating-brain]] · Auto-gerado por \`lever/scripts/lever-mcp/empire-status.mjs\`

# 🗺️  Empire Map — Lever Group

**Snapshot:** ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
**USD→BRL:** ${USD_BRL.toFixed(4)} (live)

Re-rode quando quiser: \`node lever/scripts/lever-mcp/empire-status.mjs\`

---

## 📊 Topline

| Métrica | Valor |
|---|---|
| GMV cross-cliente 30d | **${fmtBRL(gmvTotal)}** ${gmvData.length ? `(${gmvData.length} lojas)` : "(rodar portfolio-analysis primeiro)"} |
| Pedidos cross-cliente 30d | ${ordersTotal.toLocaleString("pt-BR")} |
| AOV médio (BRL eq) | ${fmtBRL(aovAvg)} |
| **Fee fixo Lever / mês (MRR)** | **${fmtBRL(feeMonthlyTotal)}** |
| Fee anualizado (ARR) | ${fmtBRL(feeMonthlyTotal * 12)} |
| Ratio fee / GMV | ${gmvTotal > 0 ? ((feeMonthlyTotal / gmvTotal) * 100).toFixed(2) + "%" : "—"} |

---

## 👥 Clientes (${clientsAll.length} total)

- **${fixed.length}** fixos ativos (paying recorrente)
- **${avulsos.length}** avulsos ativos (projeto pontual)
- **${internal.length}** internos (Lever próprio + Kron)
- **${archived.length}** arquivados (histórico)

### Top 5 por GMV 30d
${top5.length === 0 ? "_Sem dado — rodar `portfolio-analysis`_" : top5.map((c, i) => `${i + 1}. **${c.name}** — ${fmtBRL(c.sales_brl_30d)} · ${c.orders_30d} pedidos · AOV ${c.currency} ${c.aov_native?.toFixed(2)} · trend ${c.trend_7d_vs_prev !== null ? (c.trend_7d_vs_prev > 0 ? "+" : "") + c.trend_7d_vs_prev + "%" : "n/a"}`).join("\n")}

### Bottom 3 por GMV 30d
${bot3.length === 0 ? "_Sem dado_" : bot3.map((c) => `- ${c.name} — ${fmtBRL(c.sales_brl_30d)} · ${c.orders_30d} pedidos`).join("\n")}

### Trend winners (7d vs 7d anterior)
${trending.slice(0, 5).map((c) => `- **${c.name}** ${c.trend_7d_vs_prev > 0 ? "+" : ""}${c.trend_7d_vs_prev}%`).join("\n")}

### Trend losers
${trending.slice(-3).map((c) => `- ${c.name} ${c.trend_7d_vs_prev > 0 ? "+" : ""}${c.trend_7d_vs_prev}%`).join("\n")}

---

## 📺 Ads Health (último relatório)

${adsHealth ? `Snapshot: ${adsHealth.date}

- 🔴 **${adsHealth.alerts.red.length} críticos** (ação hoje)
- 🟡 ${adsHealth.alerts.yellow.length} avisos
- 🟢 ${adsHealth.alerts.green.length} saudáveis

${adsHealth.alerts.red.length > 0 ? "**Alertas críticos:**\n" + adsHealth.alerts.red.map((a) => `- ${a}`).join("\n") : ""}` : "_Sem dado — rodar `ads-health-daily` primeiro_"}

Detalhe completo: [[../04-data-rituals/ads-health/ads-health-${today}|ads-health hoje]]

---

## 🔧 Infraestrutura

### Supabase Lever System
- **Tabelas-chave contagem (live):**
${Object.entries(tableCounts).map(([t, c]) => `  - \`${t}\`: ${c?.toLocaleString?.("pt-BR") ?? c} rows`).join("\n")}
- **Edge functions:** ${edgeFns.length}
${edgeFns.length > 0 ? "  - " + edgeFns.slice(0, 10).join(", ") + (edgeFns.length > 10 ? `, +${edgeFns.length - 10} mais` : "") : ""}

### Vercel
- 20 projetos mapeados (ver [[vercel-projetos-real-2026-05-19]])
- Achados: 3 hostam clientes archived (custo morto) · cluster Flexicred sem cadastro · 5 infoprodutos legados

### Skills repo (\`.claude/skills/\`)
${skills.length === 0 ? "_Sem skills detectadas_" : skills.length + " skills disponíveis:\n  - " + skills.join(", ")}

---

## 🔀 GitHub PRs abertos (${prs.length})

${prs.length === 0 ? "_Tudo merged ou sem PRs abertos_" : prs.map((p) => `- **#${p.number}** — ${p.title} _(${p.author?.login}, ${new Date(p.createdAt).toLocaleDateString("pt-BR")}, ${p.changedFiles} files +${p.additions}/-${p.deletions})_`).join("\n")}

---

## 📚 Conhecimento estratégico ativo (atalhos)

- [[clientes-taxonomia-real]] — taxonomia oficial fixo/avulso
- [[vercel-projetos-real-2026-05-19]] — mapa 20 projetos
- [[setor-marketing/00-MOC]] — diagnóstico 5 camadas
- [[lever-system-mcp/scope]] — MCP definitivo (Sprint 1+ pendente)
- [[skills-workflow-culture]] — cultura skills-first
- [[ceo-vision-500k-mes]] — vision + framework MRR ARR

---

## ⚡ Ações sugeridas (auto-detectadas)

${(() => {
  const actions = [];
  if (adsHealth?.alerts?.red?.length > 0) actions.push(`- 🔴 **${adsHealth.alerts.red.length} alertas Meta críticos** — investigar conforme \`ads-health-${today}.md\``);
  const zerados = analysis?.clients?.filter((c) => !c.error && c.orders_30d === 0 && c.fee_fixed > 0)?.length ?? 0;
  if (zerados > 0) actions.push(`- 🟡 **${zerados} clientes fixos com 0 pedidos 30d** — triagem urgente via \`client-triage\``);
  const losers = trending.filter((c) => c.trend_7d_vs_prev !== null && c.trend_7d_vs_prev < -30);
  if (losers.length > 0) actions.push(`- 🟡 **${losers.length} clientes trending -30%+** — drill-down via \`client-snapshot\``);
  if (prs.length > 5) actions.push(`- 🟡 **${prs.length} PRs abertos** — revisar e mergear (squad bloqueado)`);
  if (actions.length === 0) actions.push("- 🟢 Sem alerta automático. Manter cadência normal.");
  return actions.join("\n");
})()}

---

## 🔄 Frequência de atualização

- **João Victor (COO)**: rodar **1x/dia 9h BRT** (idealmente cron automático futuro)
- **Squad consulta**: antes de reunião semana, antes de reunião cliente, ad-hoc
- **Dependências**: \`portfolio-analysis\` deve rodar antes pra GMV ser do dia; \`ads-health-daily\` deve rodar pra alertas Meta serem do dia

## Histórico de empire snapshots

Cada execução **sobrescreve** este doc. Pra histórico, copiar pra \`empire-status-YYYY-MM-DD.md\` antes (manual ou cron).
`;

writeFileSync(resolve(LEVER_QI, "empire-status.md"), md);
console.log(`\n✓ Empire map salvo: Lever QI/00-operating-brain/empire-status.md`);
console.log(`\n📊 Resumo executivo:`);
console.log(`   GMV 30d: ${fmtBRL(gmvTotal)} · Pedidos: ${ordersTotal} · AOV: ${fmtBRL(aovAvg)}`);
console.log(`   MRR Lever (fee fixo): ${fmtBRL(feeMonthlyTotal)}/mês = ${fmtBRL(feeMonthlyTotal * 12)}/ano`);
console.log(`   Clientes: ${fixed.length} fixos · ${avulsos.length} avulsos · ${archived.length} arq`);
console.log(`   Tech: ${edgeFns.length} edge fns · ${skills.length} skills · ${prs.length} PRs abertos`);
if (adsHealth) console.log(`   Ads: 🔴 ${adsHealth.alerts.red.length} · 🟡 ${adsHealth.alerts.yellow.length} · 🟢 ${adsHealth.alerts.green.length}`);
console.log();
