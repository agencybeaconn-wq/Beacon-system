#!/usr/bin/env node
// Run with: node --env-file=../../.env today-status.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.LEVERSYSTEM_SUPABASE_URL,
  process.env.LEVERSYSTEM_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Janela HOJE BRT (UTC-3)
const now = new Date();
const todayBRT = new Date(now);
todayBRT.setUTCHours(3, 0, 0, 0); // BRT 00:00 == UTC 03:00
if (now < todayBRT) todayBRT.setUTCDate(todayBRT.getUTCDate() - 1);
const since = todayBRT.toISOString();

// Janela ONTEM BRT (pra comparação)
const yesterdayBRT = new Date(todayBRT);
yesterdayBRT.setUTCDate(yesterdayBRT.getUTCDate() - 1);
const yesterdaySince = yesterdayBRT.toISOString();

console.log(`📅 HOJE BRT: ${since.slice(0,10)} (${since} → ${now.toISOString()})\n`);

// Check DW freshness
const { data: latest } = await supabase
  .from('dw_orders')
  .select('ingested_at, created_at')
  .order('ingested_at', { ascending: false })
  .limit(1);
const latestIngest = latest?.[0]?.ingested_at;
const latestOrder = latest?.[0]?.created_at;
console.log(`🔄 DW última ingestão: ${latestIngest}`);
console.log(`📦 Pedido mais recente: ${latestOrder}\n`);

// 1. Pedidos HOJE
const { data: ordersToday, error } = await supabase
  .from('dw_orders')
  .select('client_id, total_price, currency, financial_status, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: false });

if (error) { console.error('Erro:', error.message); process.exit(1); }

// 2. Pedidos ONTEM (pra comparar)
const { data: ordersYesterday } = await supabase
  .from('dw_orders')
  .select('client_id, total_price, currency, financial_status')
  .gte('created_at', yesterdaySince)
  .lt('created_at', since);

// Filtrar paid + cancelados fora
const paidToday = (ordersToday || []).filter(o => o.financial_status === 'paid');
const paidYesterday = (ordersYesterday || []).filter(o => o.financial_status === 'paid');

console.log(`📦 HOJE: ${ordersToday.length} pedidos brutos (${paidToday.length} paid)`);
console.log(`📦 ONTEM: ${ordersYesterday?.length || 0} pedidos brutos (${paidYesterday.length} paid)\n`);

// 3. Agrupa por client_id + moeda
function group(list) {
  const m = {};
  for (const o of list) {
    const key = o.client_id;
    if (!m[key]) m[key] = { count: 0, revenue: 0, currency: o.currency };
    m[key].count += 1;
    m[key].revenue += Number(o.total_price || 0);
  }
  return m;
}
const today = group(paidToday);
const yesterday = group(paidYesterday);

// 4. Nome dos clientes
const clientIds = Array.from(new Set([...Object.keys(today), ...Object.keys(yesterday)]));
const { data: clients } = await supabase
  .from('agency_clients')
  .select('id, name, client_type, status')
  .in('id', clientIds);
const nameById = Object.fromEntries((clients || []).map(c => [c.id, c]));

// 5. Render
const sorted = Object.entries(today).sort(([, a], [, b]) => b.revenue - a.revenue);
let totalBRL = 0, totalBR = 0, sellingBR = 0;

console.log('═══ HOJE — RANKING POR FATURAMENTO ═══\n');
console.log('  Valor          Pedidos  Tipo      Cliente');
console.log('  ─────────────────────────────────────────────');
for (const [clientId, m] of sorted) {
  const c = nameById[clientId];
  const name = c?.name || `(unknown ${clientId.slice(0,8)})`;
  const tier = c?.client_type === 'fixo' ? '⭐fixo  ' : (c?.client_type || '?       ').padEnd(8);
  const isBRL = m.currency === 'BRL';
  if (isBRL) { totalBRL += m.revenue; totalBR += m.count; sellingBR += 1; }
  const symbol = isBRL ? 'R$' : m.currency === 'USD' ? '$ ' : m.currency;
  const value = `${symbol} ${m.revenue.toFixed(2)}`;
  console.log(`  ${value.padStart(14)}  ${m.count.toString().padStart(3)}p     ${tier}  ${name}`);
}

console.log('\n═══ TOTAIS BRL HOJE ═══');
console.log(`  💰 R$ ${totalBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
console.log(`  📦 ${totalBR} pedidos`);
console.log(`  🏪 ${sellingBR} clientes BR vendendo hoje`);
console.log(`  💵 AOV: R$ ${totalBR ? (totalBRL/totalBR).toFixed(2) : '—'}`);

// Comparação com ontem
let totalBRLYest = 0, totalBRYest = 0;
for (const [, m] of Object.entries(yesterday)) {
  if (m.currency === 'BRL') { totalBRLYest += m.revenue; totalBRYest += m.count; }
}
console.log('\n═══ vs ONTEM ═══');
console.log(`  Ontem BRL: R$ ${totalBRLYest.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalBRYest} pedidos)`);
const delta = totalBRLYest ? ((totalBRL / totalBRLYest - 1) * 100).toFixed(1) : 'n/a';
console.log(`  Δ hoje vs ontem: ${delta}%`);

// Top 3
console.log('\n═══ TOP 3 BRL HOJE ═══');
const top3 = sorted.filter(([id]) => today[id].currency === 'BRL').slice(0, 3);
for (const [id, m] of top3) {
  const name = nameById[id]?.name || id.slice(0,8);
  const pct = totalBRL ? ((m.revenue / totalBRL) * 100).toFixed(1) : '0';
  console.log(`  ${pct.padStart(5)}%  R$ ${m.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).padStart(10)}  ${name}`);
}

// USD (Brasileiríssimo etc)
const usd = sorted.filter(([id]) => today[id].currency === 'USD');
if (usd.length) {
  console.log('\n═══ USD HOJE (Brasileiríssimo etc) ═══');
  let usdTotal = 0;
  for (const [id, m] of usd) {
    usdTotal += m.revenue;
    console.log(`  $ ${m.revenue.toFixed(2)}  ${m.count}p  ${nameById[id]?.name || id.slice(0,8)}`);
  }
  console.log(`  Total USD: $ ${usdTotal.toFixed(2)} ≈ R$ ${(usdTotal * 5.0542).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
}
