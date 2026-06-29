// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// @ts-ignore
Deno.serve(instrument("get-shared-dashboard", async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const url = new URL(req.url);
    const shareToken = url.searchParams.get('token');
    const fromDate = url.searchParams.get('from') // YYYY-MM-DD
    ;
    const toDate = url.searchParams.get('to') // YYYY-MM-DD
    ;
    if (!shareToken) {
      return new Response(JSON.stringify({
        error: 'Token de compartilhamento é obrigatório'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // Use anon key for public access, service key for data fetching
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: 'ads'
      }
    });
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    // 1. Validate share_token and get dashboard config (use service role to bypass RLS)
    const { data: dashboard, error: dashError } = await supabaseService.from('shared_dashboards').select('*').eq('share_token', shareToken).eq('is_active', true).maybeSingle();
    if (dashError || !dashboard) {
      console.error('❌ [SHARED] Dashboard não encontrado ou inativo:', dashError?.message);
      return new Response(JSON.stringify({
        error: 'Dashboard não encontrado ou expirado'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check expiration if set
    if (dashboard.expires_at && new Date(dashboard.expires_at) < new Date()) {
      return new Response(JSON.stringify({
        error: 'Dashboard expirado'
      }), {
        status: 410,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const adAccountId = dashboard.ad_account_id;
    console.log(`🔍 [SHARED] Buscando dados para conta: ${adAccountId}`);
    // 2. Calculate date bounds (default: last 7 days)
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 6);
    const startDate = fromDate || defaultFrom.toISOString().split('T')[0];
    const endDate = toDate || today.toISOString().split('T')[0];
    console.log(`📅 [SHARED] Período: ${startDate} → ${endDate}`);
    // 3. Fetch campaigns for this account (using service role to bypass RLS)
    const { data: campaigns, error: campError } = await supabaseService.from('campaigns').select('id, name, objective').eq('account_id', adAccountId);
    if (campError) {
      console.error('❌ [SHARED] Erro ao buscar campanhas:', campError.message);
    }
    const campaignIds = campaigns?.map((c)=>c.id) || [];
    const campaignNamesMap = campaigns?.reduce((acc, c)=>{
      acc[c.id] = c.name || 'Campanha';
      return acc;
    }, {}) || {};
    // 4. Fetch insights for date range
    let insights = [];
    if (campaignIds.length > 0) {
      const { data: insightsData, error: insError } = await supabaseService.from('insights').select('entity_id, entity_type, date, spend, conversions, roas, impressions, clicks, revenue').eq('entity_type', 'CAMPAIGN').in('entity_id', campaignIds).gte('date', startDate).lte('date', endDate);
      if (insError) {
        console.error('❌ [SHARED] Erro ao buscar insights:', insError.message);
      }
      insights = insightsData || [];
    }
    console.log(`📊 [SHARED] Encontrados ${insights.length} insights`);
    // 5. Calculate aggregated metrics
    const totals = insights.reduce((acc, row)=>{
      const spend = typeof row.spend === 'string' ? parseFloat(row.spend) : row.spend || 0;
      const conversions = row.conversions || 0;
      const roas = row.roas || 0;
      const revenue = row.revenue || (roas > 0 ? roas * spend : 0);
      const impressions = row.impressions || 0;
      const clicks = row.clicks || 0;
      acc.spend += isNaN(spend) ? 0 : spend;
      acc.conversions += conversions;
      acc.revenue += revenue;
      acc.impressions += impressions;
      acc.clicks += clicks;
      return acc;
    }, {
      spend: 0,
      conversions: 0,
      revenue: 0,
      impressions: 0,
      clicks: 0
    });
    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    // 6. Build daily evolution for charts
    const dailyMap = insights.reduce((acc, row)=>{
      const date = row.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          spend: 0,
          revenue: 0
        };
      }
      const spend = typeof row.spend === 'string' ? parseFloat(row.spend) : row.spend || 0;
      const rowRoas = row.roas || 0;
      const revenue = row.revenue || (rowRoas > 0 ? rowRoas * spend : 0);
      acc[date].spend += spend;
      acc[date].revenue += revenue;
      return acc;
    }, {});
    const dailyEvolution = Object.values(dailyMap).sort((a, b)=>a.date.localeCompare(b.date)).map((day)=>{
      const [year, month, dayNum] = day.date.split('-');
      return {
        date: `${dayNum}/${month}`,
        fullDate: day.date,
        spend: day.spend,
        revenue: day.revenue,
        profit: day.revenue - day.spend,
        roas: day.spend > 0 ? day.revenue / day.spend : 0
      };
    });
    // 7. Build top campaigns
    const campaignMetricsMap = insights.reduce((acc, row)=>{
      const campaignId = row.entity_id;
      if (!acc[campaignId]) {
        acc[campaignId] = {
          id: campaignId,
          name: campaignNamesMap[campaignId] || 'Campanha',
          spend: 0,
          revenue: 0,
          conversions: 0
        };
      }
      const spend = typeof row.spend === 'string' ? parseFloat(row.spend) : row.spend || 0;
      const conversions = row.conversions || 0;
      const rowRoas = row.roas || 0;
      const revenue = row.revenue || (rowRoas > 0 ? rowRoas * spend : 0);
      acc[campaignId].spend += spend;
      acc[campaignId].revenue += revenue;
      acc[campaignId].conversions += conversions;
      return acc;
    }, {});
    const topCampaigns = Object.values(campaignMetricsMap).map((camp)=>({
        ...camp,
        roas: camp.spend > 0 ? camp.revenue / camp.spend : 0
      })).sort((a, b)=>b.roas - a.roas).slice(0, 5);
    // 8. Fetch top ads with creatives - SIMPLIFIED: Directly query ads by campaign_id
    let topAds = [];
    if (campaignIds.length > 0) {
      // Fetch ads directly by campaign_id (matching useAnalyticsData.ts approach)
      const { data: ads, error: adsError } = await supabaseService.from('ads').select('id, name, creative, creative_thumbnail_url, status').in('campaign_id', campaignIds);
      if (adsError) {
        console.error('❌ [SHARED] Error fetching ads:', adsError.message);
      }
      console.log(`📊 [SHARED] Found ${ads?.length || 0} ads for campaigns`);
      if (ads && ads.length > 0) {
        const adIds = ads.map((a)=>a.id);
        const adNames = ads.reduce((acc, a)=>{
          acc[a.id] = a.name || 'Anúncio';
          return acc;
        }, {});
        // Get creative thumbnails
        const adCreatives = ads.reduce((acc, a)=>{
          let imageUrl = null;
          if (a.creative_thumbnail_url) {
            imageUrl = a.creative_thumbnail_url;
          } else if (a.creative) {
            const c = a.creative;
            imageUrl = c.image_url || c.thumbnail_url || c.picture || c.source_url || c.url || c.video_thumbnail_url || null;
          }
          acc[a.id] = imageUrl;
          return acc;
        }, {});
        // Fetch insights for these ads
        const { data: adInsights, error: adInsError } = await supabaseService.from('insights').select('entity_id, spend, roas, conversions, revenue, clicks, impressions').eq('entity_type', 'AD').in('entity_id', adIds).gte('date', startDate).lte('date', endDate);
        if (adInsError) {
          console.error('❌ [SHARED] Error fetching ad insights:', adInsError.message);
        } else {
          console.log(`📊 [SHARED] Found ${adInsights?.length || 0} insight records for ads`);
        }
        if (adInsights && adInsights.length > 0) {
          // Aggregate by ad ID (since insights are daily)
          const adStats = adInsights.reduce((acc, row)=>{
            const adId = row.entity_id;
            if (!acc[adId]) acc[adId] = {
              id: adId,
              spend: 0,
              revenue: 0,
              conversions: 0
            };
            const spend = typeof row.spend === 'string' ? parseFloat(row.spend) : row.spend || 0;
            const rowRoas = row.roas || 0;
            const revenue = row.revenue || (rowRoas > 0 ? rowRoas * spend : 0);
            acc[adId].spend += isNaN(spend) ? 0 : spend;
            acc[adId].revenue += revenue;
            acc[adId].conversions += row.conversions || 0;
            return acc;
          }, {});
          topAds = Object.values(adStats).map((stat)=>({
              id: stat.id,
              name: adNames[stat.id] || 'Anúncio',
              spend: stat.spend,
              revenue: stat.revenue,
              conversions: stat.conversions,
              roas: stat.spend > 0 ? stat.revenue / stat.spend : 0,
              cpa: stat.conversions > 0 ? stat.spend / stat.conversions : 0,
              imageUrl: adCreatives[stat.id] || null
            })).sort((a, b)=>{
            // Priority: Revenue > Conversions > Spend (matching useAnalyticsData)
            if (Math.abs(b.revenue - a.revenue) > 1) return b.revenue - a.revenue;
            if (b.conversions !== a.conversions) return b.conversions - a.conversions;
            return b.spend - a.spend;
          }).slice(0, 10);
          console.log(`🏆 [SHARED] Top ${topAds.length} performing ads identified`);
        }
      }
    }
    // 9. Build response
    const responseData = {
      whiteLabel: {
        agencyName: dashboard.agency_name,
        agencyLogo: dashboard.agency_logo,
        primaryColor: dashboard.primary_color || '#0066FF'
      },
      clientCosts: dashboard.client_costs || {
        supplier_cost_mode: 'per_sale',
        supplier_cost_value: 0,
        gateway_fee_percent: 0
      },
      metrics: {
        spend: totals.spend,
        revenue: totals.revenue,
        conversions: totals.conversions,
        roas,
        impressions: totals.impressions,
        clicks: totals.clicks,
        cpc,
        ctr,
        cpa
      },
      chartsData: {
        dailyEvolution
      },
      topCampaigns,
      topAds
    };
    console.log(`✅ [SHARED] Dados preparados com sucesso`);
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache por 5 minutos
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ [SHARED] Erro fatal:', errorMessage);
    return new Response(JSON.stringify({
      error: 'Erro interno do servidor'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
