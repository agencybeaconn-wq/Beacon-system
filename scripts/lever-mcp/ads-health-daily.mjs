#!/usr/bin/env node
/**
 * ads-health-daily — verificação diária de saúde dos anúncios Meta dos clientes Lever.
 *
 * O que faz:
 *   1. Lê fb_connections (Meta access tokens) + agency_clients (clientes ativos com selected_ad_accounts)
 *   2. Pra cada ad_account: pull balance + spending limit + insights today + last 7d
 *   3. Detecta anomalias: zero spend, saldo crítico, status pausado, criativos cansados
 *   4. Gera relatório markdown em Lever QI/04-data-rituals/ads-health-YYYY-MM-DD.md
 *   5. Saída console com alertas vermelhos/amarelos
 *
 * Pendente v2: Google Ads, WhatsApp push, anomaly detection com baseline rolling.
 *
 * Uso:
 *   node lever/scripts/ads-health-daily.mjs                # roda completo, gera report
 *   node lever/scripts/ads-health-daily.mjs --client X     # 1 cliente específico
 *   node lever/scripts/ads-health-daily.mjs --dry          # não escreve arquivo, só console
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVER_ROOT = resolve(__dirname, "../..");
const LEVER_QI_ROOT = resolve(
  LEVER_ROOT,
  "../../Lever QI/04-data-rituals/ads-health",
);

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
const META_API = "https://graph.facebook.com/v22.0";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const onlyClient = args.includes("--client") ? args[args.indexOf("--client") + 1] : null;

// ─── Helpers ────────────────────────────────────────────────────────────────
async function sb(table, query = "") {
  const r = await fetch(`${SB_URL}/rest/v1/${table}${query ? "?" + query : ""}`, {
    headers: SB_HEADERS,
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function meta(path, token, params = {}) {
  const qp = new URLSearchParams({ access_token: token, ...params }).toString();
  const r = await fetch(`${META_API}${path}?${qp}`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Meta ${r.status} on ${path}: ${t.slice(0, 300)}`);
  }
  return r.json();
}

function brl(v, currency = "BRL") {
  // Meta retorna em "menor unidade" (centavos pra BRL/USD)
  const symbol = currency === "USD" ? "US$" : currency === "BRL" ? "R$" : currency;
  return `${symbol} ${(parseFloat(v || 0) / 100).toFixed(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Main ───────────────────────────────────────────────────────────────────
console.log(`\n🔍 Ads Health Daily — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n`);

// 1. Pull clientes ativos + selected_ad_accounts
const clientsQuery = onlyClient
  ? `select=id,name,shopify_domain,selected_ad_accounts&name=ilike.*${encodeURIComponent(onlyClient)}*&is_archived=eq.false`
  : `select=id,name,shopify_domain,selected_ad_accounts&is_archived=eq.false&shopify_status=in.(connected,pending)&or=(client_type.eq.fixo,is_internal.eq.true)`;

const clients = await sb("agency_clients", clientsQuery);
console.log(`▌ ${clients.length} clientes Lever a checar\n`);

// 2. Pull todos fb_connections ativos pra mapear quem tem qual token
const fbs = await sb("fb_connections", `select=id,access_token,name,status&status=eq.connected`);
console.log(`▌ ${fbs.length} fb_connections ativas\n`);

// 3. Mapear ad_account_id → fb_connection (token). Cada token tem N ad_accounts acessíveis.
//    Estratégia: pra cada token, pull /me/adaccounts uma vez, build mapa global account_id → token.
const accountToken = new Map(); // ad_account_id → access_token
const accountMeta = new Map();  // ad_account_id → { name, currency, balance, status, spend_cap, ... }

for (const fb of fbs) {
  try {
    const accs = await meta("/me/adaccounts", fb.access_token, {
      fields: "id,account_id,name,account_status,balance,spend_cap,currency,amount_spent,disable_reason,funding_source_details",
      limit: 50,
    });
    for (const a of accs.data || []) {
      if (!accountToken.has(a.account_id)) {
        accountToken.set(a.account_id, fb.access_token);
        accountMeta.set(a.account_id, a);
      }
    }
  } catch (e) {
    console.warn(`  ⚠ fb_connection ${fb.name} (${fb.id?.slice(0, 8)}): ${e.message.slice(0, 100)}`);
  }
}
console.log(`▌ ${accountToken.size} ad_accounts mapeados\n`);

// 4. Pra cada cliente, processar suas ad accounts
const report = [];
const alerts = { red: [], yellow: [], green: [] };

for (const c of clients) {
  const adIds = c.selected_ad_accounts || [];
  if (adIds.length === 0) continue;

  const clientReport = { client: c.name, domain: c.shopify_domain, accounts: [] };

  for (const adId of adIds) {
    const token = accountToken.get(adId);
    const accInfo = accountMeta.get(adId);
    if (!token || !accInfo) {
      clientReport.accounts.push({ ad_account_id: adId, error: "token/info não encontrado" });
      continue;
    }

    try {
      // Insights today
      const insightsToday = await meta(`/act_${adId}/insights`, token, {
        fields: "spend,impressions,clicks,actions,date_start,date_stop",
        date_preset: "today",
      });
      const today = insightsToday.data?.[0] || {};

      // Insights last 7d
      const insights7d = await meta(`/act_${adId}/insights`, token, {
        fields: "spend,impressions,clicks,actions",
        date_preset: "last_7d",
      });
      const week = insights7d.data?.[0] || {};

      // Campanhas ativas
      const camps = await meta(`/act_${adId}/campaigns`, token, {
        fields: "id,name,status,effective_status,daily_budget,lifetime_budget",
        limit: 50,
      });
      const activeCamps = (camps.data || []).filter((x) => x.effective_status === "ACTIVE");
      const pausedCamps = (camps.data || []).filter((x) => x.effective_status === "PAUSED");

      // Ads e idade dos criativos
      const ads = await meta(`/act_${adId}/ads`, token, {
        fields: "id,name,status,effective_status,created_time",
        limit: 50,
      });
      const activeAds = (ads.data || []).filter((x) => x.effective_status === "ACTIVE");
      const oldAds = activeAds.filter((x) => {
        const days = (Date.now() - new Date(x.created_time).getTime()) / 86400_000;
        return days > 14;
      });
      const newAds = activeAds.filter((x) => {
        const days = (Date.now() - new Date(x.created_time).getTime()) / 86400_000;
        return days <= 7;
      });

      // Classificação
      const accountReport = {
        ad_account_id: adId,
        ad_account_name: accInfo.name,
        currency: accInfo.currency,
        balance_native: parseFloat(accInfo.balance || 0) / 100,
        amount_spent_lifetime: parseFloat(accInfo.amount_spent || 0) / 100,
        funding_source: accInfo.funding_source_details?.display_string || accInfo.funding_source_details?.type || "?",
        disable_reason: accInfo.disable_reason ?? null,
        spend_today: parseFloat(today.spend || 0),
        spend_7d: parseFloat(week.spend || 0),
        spend_daily_avg_7d: parseFloat(week.spend || 0) / 7,
        impressions_today: parseInt(today.impressions || 0),
        clicks_today: parseInt(today.clicks || 0),
        ctr_today: today.impressions > 0 ? (today.clicks / today.impressions * 100).toFixed(2) + "%" : "—",
        campaigns_active: activeCamps.length,
        campaigns_paused: pausedCamps.length,
        ads_active: activeAds.length,
        ads_old_14d: oldAds.length,
        ads_new_7d: newAds.length,
        account_status: accInfo.account_status,
        flags: [],
      };

      // ALERTAS — Meta clientes Lever = PÓS-PAGO (cartão crédito).
      // Saldo baixo NÃO é alerta (memory: reference_meta_accounts_postpaid).
      // O que importa: status anormal + cartão funcionando + spend rolando.
      const dailyAvg = accountReport.spend_daily_avg_7d;

      if (accInfo.account_status === 2) {
        accountReport.flags.push(`🔴 DISABLED${accInfo.disable_reason ? ` (${accInfo.disable_reason})` : ""}`);
        alerts.red.push(`${c.name} / ${accInfo.name}: conta DESABILITADA${accInfo.disable_reason ? ` — reason ${accInfo.disable_reason}` : ""}. Provável cartão recusado ou política violada.`);
      } else if (accInfo.account_status === 3) {
        accountReport.flags.push("🔴 UNSETTLED (débito pendente)");
        alerts.red.push(`${c.name} / ${accInfo.name}: status UNSETTLED — Meta tem débito pendente. Verifica cartão.`);
      } else if (accInfo.account_status === 9) {
        accountReport.flags.push("🔴 IN_GRACE_PERIOD (cartão recém-falhou)");
        alerts.red.push(`${c.name} / ${accInfo.name}: GRACE PERIOD — cartão recém recusou. Tem alguns dias pra ajeitar antes de bloquear.`);
      } else if (accInfo.account_status === 7) {
        accountReport.flags.push("🟡 PENDING_RISK_REVIEW");
        alerts.yellow.push(`${c.name} / ${accInfo.name}: em risk review do Meta. Acompanhar.`);
      } else if (activeCamps.length === 0 && pausedCamps.length > 0) {
        accountReport.flags.push("🟡 ZERO CAMPANHAS ATIVAS (mas tem pausadas)");
        alerts.yellow.push(`${c.name} / ${accInfo.name}: ${pausedCamps.length} campanhas pausadas, 0 ativas. Operação intencionalmente parada ou esquecida?`);
      } else if (activeCamps.length === 0 && pausedCamps.length === 0) {
        accountReport.flags.push("⚪ CONTA SEM CAMPANHAS (provável pool/holding)");
        // Não alerta — conta vazia pode ser pool de saldo Lever ou conta de holding
      } else if (accountReport.spend_today === 0 && dailyAvg > 100) {
        accountReport.flags.push(`🔴 SPEND HOJE = 0 (vs avg ${dailyAvg.toFixed(2)}/dia 7d)`);
        alerts.red.push(`${c.name} / ${accInfo.name}: spend hoje ZERO mas avg 7d era ${dailyAvg.toFixed(2)}/dia. Algo quebrou (campanha pausada manual? cartão? bloqueio?).`);
      } else if (oldAds.length === activeAds.length && activeAds.length > 5) {
        accountReport.flags.push("🟡 TODOS CRIATIVOS >14d (fadiga)");
        alerts.yellow.push(`${c.name} / ${accInfo.name}: todos ${activeAds.length} ads ativos têm >14 dias. Trocar — fadiga garantida.`);
      } else if (newAds.length === 0 && activeAds.length > 8) {
        accountReport.flags.push("🟡 ZERO criativos novos últimos 7d");
        alerts.yellow.push(`${c.name} / ${accInfo.name}: nenhum criativo novo na semana com ${activeAds.length} ads ativos. Cadência fraca.`);
      } else {
        accountReport.flags.push("🟢 OK");
        alerts.green.push(`${c.name} / ${accInfo.name}`);
      }

      clientReport.accounts.push(accountReport);

      // Console summary
      const flagColor = accountReport.flags[0]?.charAt(0) || " ";
      console.log(
        `  ${flagColor} ${c.name.padEnd(28)} ${accInfo.name.slice(0, 30).padEnd(30)} ` +
          `spend hoje ${accountReport.spend_today.toFixed(2).padStart(8)} · ` +
          `7d ${accountReport.spend_7d.toFixed(2).padStart(9)} · ` +
          `camps ${activeCamps.length}A/${pausedCamps.length}P · ` +
          `ads ${activeAds.length} (${newAds.length} novos)`
      );
    } catch (e) {
      clientReport.accounts.push({ ad_account_id: adId, error: e.message.slice(0, 100) });
      console.log(`  ✗ ${c.name} / act_${adId}: ${e.message.slice(0, 80)}`);
    }
  }
  if (clientReport.accounts.length > 0) report.push(clientReport);
}

// 5. Resumo console
console.log("\n═══════════════════════════════════════════════════════════════════════");
console.log(`RESUMO`);
console.log("═══════════════════════════════════════════════════════════════════════");
console.log(`🔴 RED (${alerts.red.length} alertas críticos):`);
for (const a of alerts.red) console.log(`  ${a}`);
console.log(`\n🟡 YELLOW (${alerts.yellow.length} avisos):`);
for (const a of alerts.yellow) console.log(`  ${a}`);
console.log(`\n🟢 GREEN: ${alerts.green.length} contas OK\n`);

// 6. Output markdown
if (!dryRun) {
  mkdirSync(LEVER_QI_ROOT, { recursive: true });
  const date = today();
  const filename = `ads-health-${date}.md`;
  const outPath = resolve(LEVER_QI_ROOT, filename);

  let md = `---
type: data-ritual
domain: data-rituals
ritual: ads-health-daily
date: ${date}
pulled_at: ${new Date().toISOString()}
---

# Ads Health — ${date}

> Gerado automático por \`lever/scripts/ads-health-daily.mjs\`. Wesley + Campanhã consomem.

## Alertas críticos (🔴 ${alerts.red.length})

`;
  for (const a of alerts.red) md += `- ${a}\n`;
  md += `\n## Avisos (🟡 ${alerts.yellow.length})\n\n`;
  for (const a of alerts.yellow) md += `- ${a}\n`;
  md += `\n## Saudáveis (🟢 ${alerts.green.length})\n\n`;
  for (const a of alerts.green) md += `- ${a}\n`;

  md += `\n## Detalhamento por cliente\n\n`;
  for (const c of report) {
    md += `### ${c.client} (${c.domain})\n\n`;
    for (const a of c.accounts) {
      if (a.error) {
        md += `- ❌ \`${a.ad_account_id}\`: ${a.error}\n`;
        continue;
      }
      md += `- **${a.ad_account_name}** (${a.currency})\n`;
      md += `  - Status: ${a.flags.join(", ")}\n`;
      md += `  - Saldo: ${a.currency} ${a.balance_native.toFixed(2)} · Lifetime spent: ${a.amount_spent_lifetime.toFixed(2)}\n`;
      md += `  - Hoje: ${a.spend_today.toFixed(2)} spend · ${a.impressions_today} impr · ${a.clicks_today} cliques · CTR ${a.ctr_today}\n`;
      md += `  - 7d: ${a.spend_7d.toFixed(2)} spend · avg ${a.spend_daily_avg_7d.toFixed(2)}/dia\n`;
      md += `  - Campanhas: ${a.campaigns_active} ativas · ${a.campaigns_paused} pausadas\n`;
      md += `  - Ads: ${a.ads_active} ativos · ${a.ads_new_7d} novos (últimos 7d) · ${a.ads_old_14d} velhos (>14d)\n\n`;
    }
  }

  md += `\n## Ação esperada\n
- 🔴 RED: ação **hoje**. Wesley/Campanhã investiga, corrige.
- 🟡 YELLOW: ação **essa semana**. Criar tasks no kanban interno.
- 🟢 GREEN: ok, manter cadência normal.

## Conexões

- Skill: \`lever/.claude/skills/ads-health-daily/SKILL.md\`
- Script: \`lever/scripts/ads-health-daily.mjs\`
- Cliente list canônica: [[../00-operating-brain/clientes-taxonomia-real]]
`;
  writeFileSync(outPath, md);
  console.log(`✓ Relatório salvo: ${outPath}\n`);

  // JSON também
  const jsonPath = resolve(LEVER_QI_ROOT, `ads-health-${date}.json`);
  writeFileSync(jsonPath, JSON.stringify({ date, alerts, report }, null, 2));
  console.log(`✓ JSON: ${jsonPath}\n`);
}

if (alerts.red.length > 0) process.exitCode = 2;
