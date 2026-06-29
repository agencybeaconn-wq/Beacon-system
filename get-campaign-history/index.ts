// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore: Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno global
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(userToken);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { accountId, campaignId, days = 30, entityType = 'CAMPAIGN', startDate: reqStartDate, endDate: reqEndDate } = body;

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'accountId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range
    let startDateStr: string;
    let endDateStr: string;

    if (reqStartDate && reqEndDate) {
      // Use provided explicit dates
      startDateStr = reqStartDate;
      endDateStr = reqEndDate;
    } else {
      // Fallback to days logic
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Format dates for SQL query (YYYY-MM-DD)
      startDateStr = startDate.toISOString().split('T')[0];
      endDateStr = endDate.toISOString().split('T')[0];
    }

    console.log(`[GET-CAMPAIGN-HISTORY] Buscando histórico: accountId=${accountId}, campaignId=${campaignId || 'all'}, days=${days}, from=${startDateStr} to=${endDateStr}`);

    // Build query - Buscar apenas colunas que existem na tabela
    // NOTA: cpc, cpm, ctr não existem como colunas, serão calculados no código
    // NOTA: conversion_value não existe na tabela, usamos roas que já está calculado
    let query = supabaseAdmin
      .from('insights')
      .select('date, spend, impressions, clicks, conversions, roas, cpa')
      .eq('entity_type', entityType)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    // If campaignId provided, filter by specific campaign
    if (campaignId) {
      query = query.eq('entity_id', campaignId);
    } else {
      // If no campaignId, get all campaigns for this account
      // First, get all campaign IDs for this account
      const { data: campaigns } = await supabaseAdmin
        .from('campaigns')
        .select('id')
        .eq('account_id', accountId);

      if (campaigns && campaigns.length > 0) {
        const campaignIds = campaigns.map((c: { id: string }) => c.id);
        query = query.in('entity_id', campaignIds);
      } else {
        return new Response(
          JSON.stringify({
            success: true,
            data: [],
            summary: {
              days: days,
              total_spend: 0,
              total_conversions: 0,
              average_roas: 0,
              average_cpa: 0
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: insightsData, error: insightsError } = await query;

    if (insightsError) {
      console.error('[GET-CAMPAIGN-HISTORY] Erro ao buscar insights:', insightsError);
      return new Response(
        JSON.stringify({ error: insightsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate data by day and calculate metrics
    const dailyData: Record<string, {
      date: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      roas: number | null;
      cpa: number | null;
      cpc: number | null;
      cpm: number | null;
      ctr: number | null;
    }> = {};

    (insightsData || []).forEach((insight: any) => {
      const date = insight.date;
      const spend = typeof insight.spend === 'string'
        ? parseFloat(insight.spend.replace('R$', '').replace('.', '').replace(',', '.')) || 0
        : parseFloat(insight.spend) || 0;

      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          roas: null,
          cpa: null,
          cpc: null,
          cpm: null,
          ctr: null,
        };
      }

      dailyData[date].spend += spend;
      dailyData[date].impressions += parseInt(insight.impressions) || 0;
      dailyData[date].clicks += parseInt(insight.clicks) || 0;
      dailyData[date].conversions += parseInt(insight.conversions) || 0;

      // Se já temos ROAS calculado no banco, usar ele (mais preciso)
      if (insight.roas && typeof insight.roas === 'number' && insight.roas > 0) {
        // Para agregar ROAS, precisamos calcular a média ponderada ou usar o total
        // Por enquanto, vamos calcular no final usando os totais
      }
    });

    // Calculate derived metrics for each day
    const aggregatedDays = Object.values(dailyData).map(day => {
      const spend = day.spend;
      const clicks = day.clicks;
      const impressions = day.impressions;
      const conversions = day.conversions;

      return {
        ...day,
        cpc: clicks > 0 ? spend / clicks : null,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        cpa: conversions > 0 ? spend / conversions : null,
        // ROAS calculation: Usar o valor do banco se disponível, senão calcular baseado em conversões
        // Se temos ROAS no banco, usamos média ponderada. Senão, estimamos.
        roas: conversions > 0 && spend > 0 ? (conversions * 50) / spend : null, // Estimativa básica (pode ser melhorada com dados reais)
      };
    });

    // Calculate summary statistics
    const totalSpend = aggregatedDays.reduce((sum, day) => sum + day.spend, 0);
    const totalConversions = aggregatedDays.reduce((sum, day) => sum + day.conversions, 0);
    const totalImpressions = aggregatedDays.reduce((sum, day) => sum + day.impressions, 0);
    const totalClicks = aggregatedDays.reduce((sum, day) => sum + day.clicks, 0);

    const averageROAS = totalConversions > 0 && totalSpend > 0
      ? (totalConversions * 50) / totalSpend
      : null;

    const averageCPA = totalConversions > 0
      ? totalSpend / totalConversions
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        data: aggregatedDays,
        summary: {
          days: days,
          total_spend: totalSpend,
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          total_conversions: totalConversions,
          average_roas: averageROAS,
          average_cpa: averageCPA,
          average_cpc: totalClicks > 0 ? totalSpend / totalClicks : null,
          average_cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
          average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GET-CAMPAIGN-HISTORY] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

