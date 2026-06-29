// Edge function: report-metrics
// Endpoint leve pra gerar relatorio de uma conta de anuncios em um periodo.
// Vai DIRETO na Meta Graph API (level=account, 1 request) -- nao usa o banco.
// Adoptado do app Leverads.AI 2026-05-19.
// @ts-nocheck

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const META_API_VERSION = 'v24.0';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function countFirstAvailable(actions, preferredTypes) {
  if (!Array.isArray(actions)) return 0;
  for (const type of preferredTypes) {
    const found = actions.find((a) => a.action_type === type);
    if (found) return parseFloat(found.value || '0');
  }
  return 0;
}

import { instrument } from "../_shared/logger.ts";
Deno.serve(instrument("report-metrics", async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    let { accountId, accessToken, since, until } = body || {};

    if (!accountId || !accessToken || !since || !until) {
      return jsonResponse({ error: 'Faltando accountId, accessToken, since ou until' }, 400);
    }
    if (!accountId.startsWith('act_')) accountId = `act_${accountId}`;

    const fields = ['spend', 'clicks', 'impressions', 'actions', 'action_values', 'purchase_roas'].join(',');

    const url = `https://graph.facebook.com/${META_API_VERSION}/${accountId}/insights?level=account&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!res.ok || json.error) {
      console.error('Meta API error:', json.error || res.status);
      return jsonResponse({ error: json.error?.message || `Meta API ${res.status}` }, 502);
    }

    const rows = json.data || [];
    if (rows.length === 0) {
      return jsonResponse({
        spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0,
        cpa: 0, ticket: 0, roas: 0, convRate: 0
      });
    }

    let spend = 0, clicks = 0, impressions = 0, purchases = 0, revenue = 0, landingPageViews = 0;

    for (const row of rows) {
      spend += parseFloat(row.spend || '0');
      clicks += parseInt(row.clicks || '0');
      impressions += parseInt(row.impressions || '0');
      purchases += countFirstAvailable(row.actions, ['omni_purchase', 'purchase']);
      landingPageViews += countFirstAvailable(row.actions, ['landing_page_view']);
      if (Array.isArray(row.action_values)) {
        const purchaseValue = row.action_values.find((v) => v.action_type === 'omni_purchase')
          || row.action_values.find((v) => v.action_type === 'purchase');
        if (purchaseValue) revenue += parseFloat(purchaseValue.value || '0');
      }
    }

    const cpa = purchases > 0 ? spend / purchases : 0;
    const ticket = purchases > 0 ? revenue / purchases : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const convRate = landingPageViews > 0 ? (purchases / landingPageViews) * 100 : 0;

    return jsonResponse({
      spend, revenue, purchases, clicks, impressions, landingPageViews,
      cpa, ticket, roas, convRate
    });
  } catch (err) {
    console.error('report-metrics error:', err);
    return jsonResponse({ error: err?.message || 'Erro interno' }, 500);
  }
}));
