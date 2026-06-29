// Edge function: scan-for-anomalies
// Detecta RISK/OPPORTUNITY/CREATIVE comparando hoje vs media 3 dias.
// Adoptado do Leverads.AI 2026-05-19.
// TODO: ROAS atualmente usa fallback (conversions*50). Fixar usando action_values quando disponivel.
// @ts-ignore: Deno types
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Anomaly {
  type: 'RISK' | 'OPPORTUNITY' | 'CREATIVE' | 'COMMENT' | 'TRACKING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  campaign_id?: string;
  campaign_name?: string;
  metric: string;
  current_value: number;
  average_value: number;
  change_percent: number;
}

serve(instrument("scan-for-anomalies", async (req) => {
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
    const { accountId } = body;
    if (!accountId) {
      return new Response(JSON.stringify({ error: 'accountId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, status')
      .eq('account_id', accountId)
      .in('status', ['ACTIVE', 'PAUSED']);

    const { data: ads, error: adsError } = await supabaseAdmin
      .from('ads')
      .select('id, name, status, campaign_id, creative_image_url')
      .eq('account_id', accountId)
      .eq('status', 'ACTIVE');

    if (campaignsError || adsError) {
      return new Response(JSON.stringify({ error: (campaignsError || adsError)?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ success: true, anomalies: [], message: 'Nenhuma campanha encontrada' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const campaignIds = campaigns.map((c: any) => c.id);
    const allEntityIds = [...campaignIds, ...(ads || []).map((a: any) => a.id)];
    const anomalies: Anomaly[] = [];

    const { data: insightsData, error: insightsError } = await supabaseAdmin
      .from('insights')
      .select('*')
      .in('entity_id', allEntityIds)
      .in('entity_type', ['CAMPAIGN', 'AD'])
      .gte('date', threeDaysAgoStr)
      .lte('date', todayStr)
      .order('date', { ascending: false });

    if (insightsError) {
      return new Response(JSON.stringify({ error: insightsError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const insightsByAd: Record<string, { today: any[], last3Days: any[] }> = {};
    const insightsByCampaign: Record<string, { today: any[], last3Days: any[] }> = {};

    (insightsData || []).forEach((insight: any) => {
      const id = insight.entity_id;
      const target = insight.entity_type === 'AD' ? insightsByAd : insightsByCampaign;
      if (!target[id]) target[id] = { today: [], last3Days: [] };
      if (insight.date === todayStr) target[id].today.push(insight);
      else target[id].last3Days.push(insight);
    });

    Object.keys(insightsByCampaign).forEach(campaignId => {
      const campaign = campaigns.find((c: any) => c.id === campaignId);
      if (!campaign) return;
      const { today, last3Days } = insightsByCampaign[campaignId];

      const sumMetrics = (list: any[]) => list.reduce((acc, insight) => ({
        spend: acc.spend + (typeof insight.spend === 'string' ? parseFloat(insight.spend.replace('R$', '').replace('.', '').replace(',', '.')) : parseFloat(insight.spend) || 0),
        impressions: acc.impressions + (parseInt(insight.impressions) || 0),
        clicks: acc.clicks + (parseInt(insight.clicks) || 0),
        conversions: acc.conversions + (parseInt(insight.conversions) || 0),
      }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

      const todayData = sumMetrics(today);
      const last3DaysData = sumMetrics(last3Days);

      const avgLast3Days = {
        spend: last3DaysData.spend / 3,
        conversions: last3DaysData.conversions / 3,
        clicks: last3DaysData.clicks / 3,
        impressions: last3DaysData.impressions / 3,
      };

      const todayROAS = todayData.conversions > 0 && todayData.spend > 0 ? (todayData.conversions * 50) / todayData.spend : null;
      const avgROAS = avgLast3Days.conversions > 0 && avgLast3Days.spend > 0 ? (avgLast3Days.conversions * 50) / avgLast3Days.spend : null;
      const todayCPA = todayData.conversions > 0 ? todayData.spend / todayData.conversions : null;
      const avgCPA = avgLast3Days.conversions > 0 ? avgLast3Days.spend / avgLast3Days.conversions : null;
      const threshold = 0.20;

      if (todayCPA && avgCPA && todayCPA > avgCPA) {
        const cp = ((todayCPA - avgCPA) / avgCPA) * 100;
        if (cp >= threshold * 100) {
          anomalies.push({
            type: 'RISK', severity: cp >= 50 ? 'CRITICAL' : cp >= 30 ? 'HIGH' : 'MEDIUM',
            message: `CPA aumentou ${cp.toFixed(1)}% na campanha "${campaign.name}"`,
            campaign_id: campaignId, campaign_name: campaign.name,
            metric: 'CPA', current_value: todayCPA, average_value: avgCPA, change_percent: cp
          });
        }
      }

      if (todayROAS && avgROAS && todayROAS < avgROAS) {
        const cp = ((avgROAS - todayROAS) / avgROAS) * 100;
        if (cp >= threshold * 100) {
          anomalies.push({
            type: 'RISK', severity: cp >= 50 ? 'CRITICAL' : cp >= 30 ? 'HIGH' : 'MEDIUM',
            message: `ROAS caiu ${cp.toFixed(1)}% na campanha "${campaign.name}"`,
            campaign_id: campaignId, campaign_name: campaign.name,
            metric: 'ROAS', current_value: todayROAS, average_value: avgROAS, change_percent: cp
          });
        }
      }

      if (todayData.conversions < avgLast3Days.conversions && todayData.conversions > 0) {
        const cp = ((avgLast3Days.conversions - todayData.conversions) / avgLast3Days.conversions) * 100;
        if (cp >= threshold * 100) {
          anomalies.push({
            type: 'RISK', severity: cp >= 50 ? 'HIGH' : 'MEDIUM',
            message: `Queda de conversoes na campanha "${campaign.name}"`,
            campaign_id: campaignId, campaign_name: campaign.name,
            metric: 'CONVERSIONS', current_value: todayData.conversions, average_value: avgLast3Days.conversions, change_percent: cp
          });
        }
      }

      if (todayROAS && avgROAS && todayROAS > avgROAS) {
        const cp = ((todayROAS - avgROAS) / avgROAS) * 100;
        if (cp >= threshold * 100) {
          anomalies.push({
            type: 'OPPORTUNITY', severity: cp >= 50 ? 'HIGH' : 'MEDIUM',
            message: `ROAS melhorou ${cp.toFixed(1)}% na campanha "${campaign.name}"`,
            campaign_id: campaignId, campaign_name: campaign.name,
            metric: 'ROAS', current_value: todayROAS, average_value: avgROAS, change_percent: cp
          });
        }
      }
    });

    Object.keys(insightsByAd).forEach(adId => {
      const ad = ads?.find((a: any) => a.id === adId);
      if (!ad) return;
      const { today, last3Days } = insightsByAd[adId];
      if (today.length === 0 && last3Days.length === 0) return;

      const sumMetrics = (list: any[]) => list.reduce((acc, item) => ({
        spend: acc.spend + (typeof item.spend === 'string' ? parseFloat(item.spend) : item.spend || 0),
        impressions: acc.impressions + (parseInt(item.impressions) || 0),
        clicks: acc.clicks + (parseInt(item.clicks) || 0),
        conversions: acc.conversions + (parseInt(item.conversions) || 0),
      }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

      const todayData = sumMetrics(today);
      const last3Data = sumMetrics(last3Days);
      const daysCount = Math.max(last3Days.length, 1);

      const avgLast3 = {
        spend: last3Data.spend / daysCount,
        ctr: last3Data.impressions > 0 ? (last3Data.clicks / last3Data.impressions) * 100 : 0,
        roas: last3Data.spend > 0 ? (last3Data.conversions * 50) / last3Data.spend : 0,
        cpa: last3Data.conversions > 0 ? last3Data.spend / last3Data.conversions : 0
      };

      const todayCTR = todayData.impressions > 0 ? (todayData.clicks / todayData.impressions) * 100 : 0;

      if ((todayData.spend > 10 || avgLast3.spend > 10) && avgLast3.ctr > 0.8) {
        if (todayCTR < 0.5 && todayCTR < avgLast3.ctr * 0.5) {
          anomalies.push({
            type: 'CREATIVE', severity: 'HIGH',
            message: `Fadiga Criativa: CTR caiu para ${todayCTR.toFixed(2)}% no anuncio "${ad.name}"`,
            campaign_id: ad.campaign_id, campaign_name: 'Anuncio Especifico',
            metric: 'CTR', current_value: todayCTR, average_value: avgLast3.ctr,
            change_percent: -((avgLast3.ctr - todayCTR) / avgLast3.ctr) * 100
          });
        }
      }

      if (todayData.spend > 10) {
        const estimatedROAS = todayData.spend > 0 ? (todayData.conversions * 50) / todayData.spend : 0;
        if (estimatedROAS > 3) {
          anomalies.push({
            type: 'OPPORTUNITY', severity: 'HIGH',
            message: `Criativo Campeao: "${ad.name}" com ROAS estimado de ${estimatedROAS.toFixed(1)}x`,
            campaign_id: ad.campaign_id, campaign_name: 'Anuncio Especifico',
            metric: 'ROAS', current_value: estimatedROAS, average_value: avgLast3.roas, change_percent: 100
          });
        }
      }
    });

    const severityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    anomalies.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

    return new Response(JSON.stringify({
      success: true, anomalies,
      summary: {
        total: anomalies.length,
        risks: anomalies.filter(a => a.type === 'RISK').length,
        opportunities: anomalies.filter(a => a.type === 'OPPORTUNITY').length,
        critical: anomalies.filter(a => a.severity === 'CRITICAL').length
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false, error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}));
