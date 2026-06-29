// mcp-meta-proxy — Meta Ads proxy via Lever System MCP.
//
// Dual auth (same as mcp-shopify-proxy):
//   1) Authorization: Bearer <Supabase user JWT>
//   2) X-Lever-MCP-Secret + X-Lever-User-Email   (MCP server S2S)
//
// Actions:
//   POST { action: 'campaigns', client_id, date_preset?, status? }
//     → active campaigns for a Lever client (uses first selected ad account).
//       date_preset: today | yesterday | last_3d | last_7d | last_14d | last_30d | this_month | last_month
//
// verify_jwt disabled at platform level; we implement our own auth.

import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const META_API_VERSION = 'v24.0';

// ── Shared auth (mirrors mcp-shopify-proxy) ─────────────────────────────────

let _cachedInternalSecret: string | null = null;
async function loadInternalSecret(): Promise<string> {
  if (_cachedInternalSecret) return _cachedInternalSecret;
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin.rpc('get_lever_mcp_internal_secret');
  if (error) throw new Error(`secret fetch: ${error.message}`);
  if (!data) throw new Error('lever_mcp_internal_secret not in Vault');
  _cachedInternalSecret = data as string;
  return _cachedInternalSecret;
}

async function isEmailAllowed(email: string): Promise<boolean> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin.rpc('mcp_oauth_is_allowed', { p_email: email.toLowerCase() });
  if (error) throw new Error(`allowlist check: ${error.message}`);
  return !!data;
}

type Identity = { email: string };

async function authenticate(req: Request): Promise<Identity> {
  const mcpSecret = req.headers.get('X-Lever-MCP-Secret');
  const mcpEmail = req.headers.get('X-Lever-User-Email');

  if (mcpSecret && mcpEmail) {
    const expected = await loadInternalSecret();
    if (mcpSecret.length !== expected.length || mcpSecret !== expected) {
      throw Object.assign(new Error('Invalid X-Lever-MCP-Secret'), { status: 401 });
    }
    if (!(await isEmailAllowed(mcpEmail))) {
      throw Object.assign(new Error(`Email ${mcpEmail} not in MCP allowlist`), { status: 403 });
    }
    return { email: mcpEmail.toLowerCase() };
  }

  const auth = req.headers.get('Authorization');
  const jwt = auth?.replace(/^Bearer\s+/i, '') ?? null;
  if (!jwt) throw Object.assign(new Error('Missing auth'), { status: 401 });

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: u, error: uErr } = await userClient.auth.getUser(jwt);
  if (uErr || !u.user?.email) throw Object.assign(new Error('Invalid JWT'), { status: 401 });
  return { email: u.user.email.toLowerCase() };
}

// ── Visibility + Meta connection lookup ─────────────────────────────────────

async function getClientWithMeta(email: string, clientId: string) {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: tm, error: tmErr } = await admin
    .from('team_members')
    .select('user_type, linked_client_id')
    .ilike('email', email)
    .maybeSingle();
  if (tmErr) throw new Error(`team_members: ${tmErr.message}`);
  if (!tm) throw Object.assign(new Error(`Email ${email} not in team_members`), { status: 403 });

  const { data: client, error: cErr } = await admin
    .from('agency_clients')
    .select('id, name, selected_ad_accounts, workspace_id, is_internal, is_archived')
    .eq('id', clientId)
    .single();
  if (cErr) throw new Error(`client fetch: ${cErr.message}`);
  if (client.is_internal || client.is_archived) {
    throw Object.assign(new Error('Client not visible'), { status: 403 });
  }
  if (tm.user_type !== 'agency' && tm.linked_client_id !== clientId) {
    throw Object.assign(new Error('Client not visible to this user'), { status: 403 });
  }

  const adAccounts: string[] = Array.isArray(client.selected_ad_accounts)
    ? client.selected_ad_accounts.map((a: any) => (typeof a === 'string' ? a : a?.id ?? a?.account_id)).filter(Boolean)
    : [];
  if (adAccounts.length === 0) {
    throw Object.assign(new Error(`Client ${client.name} has no selected_ad_accounts`), { status: 400 });
  }

  // workspace_id is required to find the right fb_connection
  if (!client.workspace_id) {
    throw Object.assign(new Error(`Client ${client.name} has no workspace_id`), { status: 400 });
  }

  // Find the patriarch fb_connection for the workspace
  const { data: fb, error: fbErr } = await admin
    .from('fb_connections')
    .select('id, access_token_encrypted')
    .eq('workspace_id', client.workspace_id)
    .eq('is_patriarch', true)
    .maybeSingle();
  if (fbErr) throw new Error(`fb_connection: ${fbErr.message}`);
  if (!fb?.access_token_encrypted) {
    throw Object.assign(new Error(`No Meta connection for workspace ${client.workspace_id}`), { status: 400 });
  }

  // Decrypt
  const encryptionKey = Deno.env.get('FB_TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  const { data: token, error: dErr } = await admin.rpc('decrypt_fb_token', {
    encrypted_token: fb.access_token_encrypted,
    encryption_key: encryptionKey,
  });
  if (dErr || !token) throw new Error(`decrypt failed: ${dErr?.message ?? 'no token'}`);

  return { client, adAccounts, accessToken: token as string };
}

// ── Action: anomalies (RISK / OPPORTUNITY / CREATIVE — last day vs prev 3d avg) ──

async function handleAnomalies(email: string, body: any) {
  const { client_id } = body;
  if (!client_id) throw Object.assign(new Error('client_id obrigatório'), { status: 400 });
  const { client, adAccounts } = await getClientWithMeta(email, client_id);
  const accountId = adAccounts[0].replace(/^act_/, '');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'ads' } },
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

  const { data: campaigns } = await admin
    .from('campaigns').select('id, name, status').eq('account_id', accountId).in('status', ['ACTIVE', 'PAUSED']);

  if (!campaigns || campaigns.length === 0) {
    return { client: client.name, ad_account: `act_${accountId}`, anomalies: [], summary: { total: 0, risks: 0, opportunities: 0, critical: 0 } };
  }

  const campaignIds = campaigns.map((c: any) => c.id);
  const { data: insightsData } = await admin
    .from('insights').select('*')
    .in('entity_id', campaignIds).eq('entity_type', 'CAMPAIGN')
    .gte('date', threeDaysAgoStr).lte('date', todayStr);

  const byCampaign: Record<string, { today: any[]; prev: any[] }> = {};
  (insightsData || []).forEach((ins: any) => {
    const id = ins.entity_id;
    if (!byCampaign[id]) byCampaign[id] = { today: [], prev: [] };
    if (ins.date === todayStr) byCampaign[id].today.push(ins);
    else byCampaign[id].prev.push(ins);
  });

  const sum = (list: any[]) => list.reduce((acc, i) => ({
    spend: acc.spend + (typeof i.spend === 'string' ? parseFloat(i.spend.replace('R$', '').replace('.', '').replace(',', '.')) : parseFloat(i.spend) || 0),
    conversions: acc.conversions + (parseInt(i.conversions) || 0),
    clicks: acc.clicks + (parseInt(i.clicks) || 0),
  }), { spend: 0, conversions: 0, clicks: 0 });

  const anomalies: any[] = [];
  const threshold = 20;

  for (const cId of Object.keys(byCampaign)) {
    const camp = campaigns.find((c: any) => c.id === cId);
    if (!camp) continue;
    const t = sum(byCampaign[cId].today);
    const p = sum(byCampaign[cId].prev);
    const avgP = { spend: p.spend / 3, conversions: p.conversions / 3, clicks: p.clicks / 3 };

    const tCPA = t.conversions > 0 ? t.spend / t.conversions : null;
    const aCPA = avgP.conversions > 0 ? avgP.spend / avgP.conversions : null;
    const tROAS = t.conversions > 0 && t.spend > 0 ? (t.conversions * 50) / t.spend : null;
    const aROAS = avgP.conversions > 0 && avgP.spend > 0 ? (avgP.conversions * 50) / avgP.spend : null;

    if (tCPA && aCPA && tCPA > aCPA) {
      const cp = ((tCPA - aCPA) / aCPA) * 100;
      if (cp >= threshold) anomalies.push({
        type: 'RISK', severity: cp >= 50 ? 'CRITICAL' : cp >= 30 ? 'HIGH' : 'MEDIUM',
        message: `CPA +${cp.toFixed(1)}% em "${camp.name}"`,
        campaign_id: cId, campaign_name: camp.name,
        metric: 'CPA', current: tCPA, baseline: aCPA, change_pct: cp,
      });
    }
    if (tROAS && aROAS && tROAS < aROAS) {
      const cp = ((aROAS - tROAS) / aROAS) * 100;
      if (cp >= threshold) anomalies.push({
        type: 'RISK', severity: cp >= 50 ? 'CRITICAL' : cp >= 30 ? 'HIGH' : 'MEDIUM',
        message: `ROAS -${cp.toFixed(1)}% em "${camp.name}"`,
        campaign_id: cId, campaign_name: camp.name,
        metric: 'ROAS', current: tROAS, baseline: aROAS, change_pct: -cp,
      });
    }
    if (tROAS && aROAS && tROAS > aROAS) {
      const cp = ((tROAS - aROAS) / aROAS) * 100;
      if (cp >= threshold) anomalies.push({
        type: 'OPPORTUNITY', severity: cp >= 50 ? 'HIGH' : 'MEDIUM',
        message: `ROAS +${cp.toFixed(1)}% em "${camp.name}"`,
        campaign_id: cId, campaign_name: camp.name,
        metric: 'ROAS', current: tROAS, baseline: aROAS, change_pct: cp,
      });
    }
  }

  anomalies.sort((a, b) => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as any)[b.severity] - ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as any)[a.severity]);

  return {
    client: client.name,
    ad_account: `act_${accountId}`,
    anomalies,
    summary: {
      total: anomalies.length,
      risks: anomalies.filter(a => a.type === 'RISK').length,
      opportunities: anomalies.filter(a => a.type === 'OPPORTUNITY').length,
      critical: anomalies.filter(a => a.severity === 'CRITICAL').length,
    },
  };
}

// ── Action: campaign_history (daily insights for N days) ────────────────────

async function handleCampaignHistory(email: string, body: any) {
  const { client_id, campaign_id, days = 30 } = body;
  if (!client_id) throw Object.assign(new Error('client_id obrigatório'), { status: 400 });
  const { client, adAccounts } = await getClientWithMeta(email, client_id);
  const accountId = adAccounts[0].replace(/^act_/, '');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { db: { schema: 'ads' } },
  );

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  let q = admin.from('insights')
    .select('date, spend, impressions, clicks, conversions, entity_id')
    .eq('entity_type', 'CAMPAIGN')
    .gte('date', startStr).lte('date', endStr)
    .order('date', { ascending: true });

  if (campaign_id) {
    q = q.eq('entity_id', campaign_id);
  } else {
    const { data: camps } = await admin.from('campaigns').select('id').eq('account_id', accountId);
    if (!camps || camps.length === 0) return { client: client.name, days: [], summary: { total_spend: 0, total_conversions: 0 } };
    q = q.in('entity_id', camps.map((c: any) => c.id));
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const byDate: Record<string, any> = {};
  for (const i of (data || [])) {
    const d = i.date;
    if (!byDate[d]) byDate[d] = { date: d, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    const sp = typeof i.spend === 'string' ? parseFloat(String(i.spend).replace('R$', '').replace('.', '').replace(',', '.')) : parseFloat(i.spend) || 0;
    byDate[d].spend += sp;
    byDate[d].impressions += parseInt(i.impressions) || 0;
    byDate[d].clicks += parseInt(i.clicks) || 0;
    byDate[d].conversions += parseInt(i.conversions) || 0;
  }

  const days_arr = Object.values(byDate).map((d: any) => ({
    ...d,
    ctr: d.impressions > 0 ? Number(((d.clicks / d.impressions) * 100).toFixed(2)) : null,
    cpc: d.clicks > 0 ? Number((d.spend / d.clicks).toFixed(2)) : null,
    cpa: d.conversions > 0 ? Number((d.spend / d.conversions).toFixed(2)) : null,
    roas_est: d.spend > 0 && d.conversions > 0 ? Number(((d.conversions * 50) / d.spend).toFixed(2)) : null,
  }));

  const tot_spend = days_arr.reduce((s: number, d: any) => s + d.spend, 0);
  const tot_conv = days_arr.reduce((s: number, d: any) => s + d.conversions, 0);

  return {
    client: client.name,
    campaign_id: campaign_id ?? null,
    period: `${startStr} → ${endStr}`,
    days: days_arr,
    summary: {
      days_with_data: days_arr.length,
      total_spend: Number(tot_spend.toFixed(2)),
      total_conversions: tot_conv,
      avg_cpa: tot_conv > 0 ? Number((tot_spend / tot_conv).toFixed(2)) : null,
      avg_roas_est: tot_spend > 0 && tot_conv > 0 ? Number(((tot_conv * 50) / tot_spend).toFixed(2)) : null,
    },
  };
}

// ── Action: campaigns ───────────────────────────────────────────────────────

async function handleCampaigns(email: string, body: any) {
  const { client_id, date_preset = 'last_7d', status } = body;
  if (!client_id) throw Object.assign(new Error('client_id obrigatório'), { status: 400 });

  const { client, adAccounts, accessToken } = await getClientWithMeta(email, client_id);
  const accountId = adAccounts[0].replace(/^act_/, '');

  // Pull campaigns with insights inline
  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'objective',
    'daily_budget',
    'lifetime_budget',
    `insights.date_preset(${date_preset}){spend,impressions,clicks,ctr,cpc,actions,action_values,reach,frequency}`,
  ].join(',');

  const params = new URLSearchParams({
    access_token: accessToken,
    fields,
    limit: '100',
  });
  if (status) {
    params.set('filtering', JSON.stringify([{ field: 'effective_status', operator: 'IN', value: status.split(',') }]));
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/act_${accountId}/campaigns?${params}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.error) throw new Error(`Meta API: ${data.error.message}`);

  const campaigns = (data.data || []).map((c: any) => {
    const ins = c.insights?.data?.[0] ?? {};
    const purchases = (ins.actions || []).find((a: any) => a.action_type === 'purchase')?.value;
    const purchaseValue = (ins.action_values || []).find((a: any) => a.action_type === 'purchase')?.value;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      effective_status: c.effective_status,
      objective: c.objective,
      daily_budget_cents: c.daily_budget ? parseInt(c.daily_budget) : null,
      lifetime_budget_cents: c.lifetime_budget ? parseInt(c.lifetime_budget) : null,
      spend: ins.spend ? parseFloat(ins.spend) : 0,
      impressions: ins.impressions ? parseInt(ins.impressions) : 0,
      clicks: ins.clicks ? parseInt(ins.clicks) : 0,
      ctr: ins.ctr ? parseFloat(ins.ctr) : 0,
      cpc: ins.cpc ? parseFloat(ins.cpc) : 0,
      reach: ins.reach ? parseInt(ins.reach) : 0,
      frequency: ins.frequency ? parseFloat(ins.frequency) : 0,
      purchases: purchases ? parseInt(purchases) : 0,
      revenue: purchaseValue ? parseFloat(purchaseValue) : 0,
      roas: ins.spend && purchaseValue ? Number((parseFloat(purchaseValue) / parseFloat(ins.spend)).toFixed(2)) : null,
    };
  });

  return {
    client: client.name,
    ad_account: `act_${accountId}`,
    date_preset,
    campaigns,
    totals: {
      spend: Number(campaigns.reduce((s: number, c: any) => s + c.spend, 0).toFixed(2)),
      revenue: Number(campaigns.reduce((s: number, c: any) => s + c.revenue, 0).toFixed(2)),
      purchases: campaigns.reduce((s: number, c: any) => s + c.purchases, 0),
    },
  };
}

Deno.serve(instrument("mcp-meta-proxy", async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const identity = await authenticate(req);
    const body = await req.json();
    const action = body.action;

    let result: any;
    switch (action) {
      case 'campaigns': result = await handleCampaigns(identity.email, body); break;
      case 'anomalies': result = await handleAnomalies(identity.email, body); break;
      case 'campaign_history': result = await handleCampaignHistory(identity.email, body); break;
      default: throw Object.assign(new Error(`Action desconhecida: "${action}". Use campaigns, anomalies, campaign_history.`), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, data: result, actor: identity.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const status = err.status ?? 500;
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));
