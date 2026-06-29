// Edge function: get-campaign-history
// Historico diario agregado de uma campanha (spend, conversions, ROAS, CPA).
// Le ads.insights. Adoptado do Leverads.AI 2026-05-19.
// TODO: ROAS atualmente usa fallback (conversions*50) quando nao tem action_values. Fixar usando o campo roas da tabela quando disponivel.
// @ts-ignore: Deno types
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(instrument("get-campaign-history", async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // @ts-ignore: Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno global
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'ads' } });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(userToken);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { accountId, campaignId, days = 30, entityType = 'CAMPAIGN', startDate: reqStartDate, endDate: reqEndDate } = body;

    if (!accountId) {
      return new Response(JSON.stringify({ error: 'accountId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let startDateStr: string, endDateStr: string;
    if (reqStartDate && reqEndDate) {
      startDateStr = reqStartDate;
      endDateStr = reqEndDate;
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDateStr = startDate.toISOString().split('T')[0];
      endDateStr = endDate.toISOString().split('T')[0];
    }

    let query = supabaseAdmin
      .from('insights')
      .select('date, spend, impressions, clicks, conversions, roas, cpa')
      .eq('entity_type', entityType)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    if (campaignId) {
      query = query.eq('entity_id', campaignId);
    } else {
      const { data: campaigns } = await supabaseAdmin.from('campaigns').select('id').eq('account_id', accountId);
      if (campaigns && campaigns.length > 0) {
        query = query.in('entity_id', campaigns.map((c: any) => c.id));
      } else {
        return new Response(JSON.stringify({
          success: true, data: [],
          summary: { days, total_spend: 0, total_conversions: 0, average_roas: 0, average_cpa: 0 }
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { data: insightsData, error: insightsError } = await query;
    if (insightsError) {
      return new Response(JSON.stringify({ error: insightsError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const dailyData: Record<string, any> = {};
    (insightsData || []).forEach((insight: any) => {
      const date = insight.date;
      const spend = typeof insight.spend === 'string'
        ? parseFloat(insight.spend.replace('R$', '').replace('.', '').replace(',', '.')) || 0
        : parseFloat(insight.spend) || 0;

      if (!dailyData[date]) {
        dailyData[date] = { date, spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: null, cpa: null, cpc: null, cpm: null, ctr: null };
      }
      dailyData[date].spend += spend;
      dailyData[date].impressions += parseInt(insight.impressions) || 0;
      dailyData[date].clicks += parseInt(insight.clicks) || 0;
      dailyData[date].conversions += parseInt(insight.conversions) || 0;
    });

    const aggregatedDays = Object.values(dailyData).map((day: any) => ({
      ...day,
      cpc: day.clicks > 0 ? day.spend / day.clicks : null,
      cpm: day.impressions > 0 ? (day.spend / day.impressions) * 1000 : null,
      ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : null,
      cpa: day.conversions > 0 ? day.spend / day.conversions : null,
      roas: day.conversions > 0 && day.spend > 0 ? (day.conversions * 50) / day.spend : null
    }));

    const totalSpend = aggregatedDays.reduce((s, d) => s + d.spend, 0);
    const totalConversions = aggregatedDays.reduce((s, d) => s + d.conversions, 0);
    const totalImpressions = aggregatedDays.reduce((s, d) => s + d.impressions, 0);
    const totalClicks = aggregatedDays.reduce((s, d) => s + d.clicks, 0);

    return new Response(JSON.stringify({
      success: true, data: aggregatedDays,
      summary: {
        days,
        total_spend: totalSpend, total_impressions: totalImpressions,
        total_clicks: totalClicks, total_conversions: totalConversions,
        average_roas: totalConversions > 0 && totalSpend > 0 ? (totalConversions * 50) / totalSpend : null,
        average_cpa: totalConversions > 0 ? totalSpend / totalConversions : null,
        average_cpc: totalClicks > 0 ? totalSpend / totalClicks : null,
        average_cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
        average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}));
