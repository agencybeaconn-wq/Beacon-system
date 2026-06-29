// clarity — consulta Clarity insights via edge function clarity-proxy.
// Uso: node clarity.mjs <cliente> [--days=N] [--dimension=X[,Y[,Z]]] [--metric=Traffic|...] [--force] [--usage]

import 'dotenv/config';
import { fetchClient } from '../../lib/supabase-rest.mjs';

const args = process.argv.slice(2);
const clientArg = args.find(a => !a.startsWith('--'));
const opts = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=') || true];
}));

if (!clientArg) {
  console.error('Uso: node clarity.mjs <cliente> [--days=1|2|3] [--dimension=Browser,Device,...] [--metric=Traffic|ScrollDepth|...] [--force] [--usage]');
  process.exit(1);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function callProxy(body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/clarity-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE || ANON}`,
      'apikey': ANON || SERVICE,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({ raw: 'no json' }));
  return { status: r.status, data };
}

function fmtNum(n) {
  const x = parseFloat(n);
  if (isNaN(x)) return n;
  if (x >= 1000) return x.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return String(x);
}

function renderInsights(payload, metricFilter) {
  if (!Array.isArray(payload)) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  for (const item of payload) {
    if (metricFilter && !item.metricName?.toLowerCase().includes(metricFilter.toLowerCase())) continue;
    console.log(`\n=== ${item.metricName} ===`);
    if (Array.isArray(item.information)) {
      // primeiras 8 linhas
      for (const row of item.information.slice(0, 8)) {
        const line = Object.entries(row)
          .map(([k, v]) => `${k}=${fmtNum(v)}`)
          .join(' | ');
        console.log(`  ${line}`);
      }
      if (item.information.length > 8) console.log(`  ...+${item.information.length - 8} linhas`);
    }
  }
}

async function main() {
  const client = await fetchClient(clientArg);
  if (!client) { console.error(`Cliente não encontrado: ${clientArg}`); process.exit(1); }

  // --usage
  if (opts.usage) {
    const r = await callProxy({ action: 'usage', clientId: client.id });
    console.log(`Clarity API usage hoje: ${r.data.used}/${r.data.limit} (${r.data.remaining} restantes)`);
    return;
  }

  const numOfDays = parseInt(opts.days) || 1;
  const dims = (opts.dimension || '').split(',').map(s => s.trim()).filter(Boolean);
  const body = {
    action: 'insights',
    clientId: client.id,
    numOfDays,
    dimension1: dims[0] || null,
    dimension2: dims[1] || null,
    dimension3: dims[2] || null,
    force: !!opts.force,
  };

  console.log(`\n=== Clarity insights — ${client.name} (${numOfDays}d${dims.length ? `, dims=[${dims.join(',')}]` : ''}) ===`);

  const r = await callProxy(body);
  if (r.status >= 400) {
    console.error(`✗ Erro ${r.status}: ${r.data.error || JSON.stringify(r.data)}`);
    process.exit(1);
  }

  if (r.data.fromCache) {
    const stale = r.data.stale ? ' (STALE — quota esgotada hoje)' : '';
    console.log(`📦 Cache hit${stale} — fetched ${new Date(r.data.fetchedAt).toLocaleString('pt-BR')}${r.data.expiresAt ? ` | expira ${new Date(r.data.expiresAt).toLocaleString('pt-BR')}` : ''}`);
  } else {
    console.log(`🌐 Fresh fetch — ${new Date(r.data.fetchedAt).toLocaleString('pt-BR')}`);
  }

  renderInsights(r.data.data, opts.metric);

  // mostra usage no fim
  const usage = await callProxy({ action: 'usage', clientId: client.id });
  console.log(`\n[quota: ${usage.data.used}/${usage.data.limit} hoje]`);
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });

