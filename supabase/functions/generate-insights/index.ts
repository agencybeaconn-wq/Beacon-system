// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const META_API_VERSION = "v24.0";
serve(instrument("generate-insights", async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    // @ts-ignore
    const encryptionKey = Deno.env.get("FB_TOKEN_ENCRYPTION_KEY") || "default-key-change-me";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");
    const body = await req.json();
    const { adAccountId, fbConnectionId } = body;
    if (!adAccountId) throw new Error("adAccountId is required");
    console.log(`📊 [generate-insights] Generating real-time insights for: ${adAccountId}`);
    // Get workspace
    const { data: workspace } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).single();
    let workspaceId = workspace?.id;
    if (!workspaceId) {
      const { data: membership } = await supabase.from("team_members").select("workspace_id").eq("user_id", user.id).eq("status", "active").single();
      workspaceId = membership?.workspace_id;
    }
    if (!workspaceId) throw new Error("Workspace not found");
    // Get fb_connection - use fbConnectionId if provided, otherwise fallback
    let fbConnection;
    if (fbConnectionId) {
      const { data } = await supabase.from("fb_connections").select("id, access_token_encrypted").eq("id", fbConnectionId).single();
      fbConnection = data;
    } else {
      // Fallback to is_patriarch for backwards compatibility
      const { data } = await supabase.from("fb_connections").select("id, access_token_encrypted").eq("workspace_id", workspaceId).eq("is_patriarch", true).single();
      fbConnection = data;
    }
    if (!fbConnection?.access_token_encrypted) {
      throw new Error("No Facebook connection found");
    }
    // Decrypt token
    const { data: decryptedToken, error: decryptError } = await supabase.rpc("decrypt_fb_token", {
      encrypted_token: fbConnection.access_token_encrypted,
      encryption_key: encryptionKey
    });
    if (decryptError || !decryptedToken) {
      throw new Error("Failed to decrypt token");
    }
    const accessToken = decryptedToken;
    // Get account settings for thresholds
    const { data: settings } = await supabase.from("account_settings").select("*").eq("ad_account_id", adAccountId).maybeSingle();
    // Default Defaults
    let targetROAS = 3.0;
    let riskROAS = 1.5;
    let targetCPA = 40.0;
    let riskCPA = 80.0;
    let targetCPL = 15.0;
    let riskCPL = 30.0;
    let targetCTR = settings?.target_ctr || 2.0;
    let riskCTR = settings?.risk_ctr || 0.8;
    let maxFreq = settings?.max_frequency || 4.0;
    let riskCPC = settings?.risk_cpc || 5.0;
    let riskCPM = settings?.risk_cpm || 50.0;
    // Parse Primary KPIs if available (New Schema)
    if (settings?.primary_kpis && Array.isArray(settings.primary_kpis) && settings.primary_kpis.length > 0) {
      settings.primary_kpis.forEach((kpi)=>{
        if (kpi.metric === 'ROAS') {
          targetROAS = parseFloat(kpi.target) || targetROAS;
          riskROAS = parseFloat(kpi.risk) || riskROAS;
        } else if (kpi.metric === 'CPA') {
          targetCPA = parseFloat(kpi.target) || targetCPA;
          riskCPA = parseFloat(kpi.risk) || riskCPA;
        } else if (kpi.metric === 'CPL') {
          targetCPL = parseFloat(kpi.target) || targetCPL;
          riskCPL = parseFloat(kpi.risk) || riskCPL;
        }
      });
    } else if (settings?.primary_kpi) {
      // Fallback to Old Schema
      if (settings.primary_kpi === 'ROAS') {
        targetROAS = settings.target_value || targetROAS;
        riskROAS = settings.risk_threshold || riskROAS;
      } else if (settings.primary_kpi === 'CPA') {
        targetCPA = settings.target_value || targetCPA;
        riskCPA = settings.risk_threshold || riskCPA;
      } else if (settings.primary_kpi === 'CPL') {
        targetCPL = settings.target_value || targetCPL;
        riskCPL = settings.risk_threshold || riskCPL;
      }
    }
    console.log(`⚙️ [generate-insights] Thresholds: ROAS (Target: ${targetROAS}, Risk: ${riskROAS}), CPA (Target: ${targetCPA}, Risk: ${riskCPA}), CTR Risk: ${riskCTR}`);
    // Date ranges
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const formatDate = (d)=>d.toISOString().split('T')[0];
    // Fetch campaigns with insights from Meta API
    const accountId = adAccountId.replace('act_', '');
    const insightsFields = 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,ctr,cpc,cpm,reach,frequency';
    // Get last 7 days data
    const campaignsUrl = `https://graph.facebook.com/${META_API_VERSION}/act_${accountId}/insights?` + `fields=${insightsFields}` + `&level=campaign` + `&date_preset=last_7d` + `&filtering=[{"field":"campaign.effective_status","operator":"IN","value":["ACTIVE"]}]` + `&access_token=${accessToken}`;
    console.log(`🌐 [generate-insights] Fetching campaign insights...`);
    const response = await fetch(campaignsUrl);
    const data = await response.json();
    if (data.error) {
      console.error("❌ [generate-insights] Meta API Error:", data.error);
      throw new Error(data.error.message);
    }
    const campaignInsights = data.data || [];
    console.log(`📊 [generate-insights] Got ${campaignInsights.length} campaigns with data`);
    const insights = [];
    // Process each campaign
    for (const campaign of campaignInsights){
      const spend = parseFloat(campaign.spend || 0);
      const clicks = parseInt(campaign.clicks || 0);
      const impressions = parseInt(campaign.impressions || 0);
      const reach = parseInt(campaign.reach || 0);
      const frequency = parseFloat(campaign.frequency || 0);
      const ctr = parseFloat(campaign.ctr || 0);
      const cpc = parseFloat(campaign.cpc || 0);
      const cpm = parseFloat(campaign.cpm || 0);
      // Extract conversions and purchase value from actions
      let conversions = 0;
      let leads = 0;
      let purchaseValue = 0;
      if (campaign.actions) {
        campaign.actions.forEach((action)=>{
          if (action.action_type === 'purchase' || action.action_type === 'omni_purchase' || action.action_type === 'onsite_conversion.purchase') {
            conversions += parseInt(action.value || 0);
          }
          if (action.action_type === 'lead' || action.action_type === 'complete_registration') {
            leads += parseInt(action.value || 0);
          }
        });
      }
      if (campaign.action_values) {
        campaign.action_values.forEach((value)=>{
          if (value.action_type === 'purchase' || value.action_type === 'omni_purchase' || value.action_type === 'onsite_conversion.purchase') {
            purchaseValue += parseFloat(value.value || 0);
          }
        });
      }
      // Calculate Metrics
      const roas = spend > 0 ? purchaseValue / spend : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;
      const cpl = leads > 0 ? spend / leads : 0;
      // Skip campaigns with no spend
      if (spend < 1) continue;
      // 1. ROAS Alerts (Only if ROAS is configured as a KPI or default)
      // We check if value exists to avoid alerts on zero purchase campaigns if ROAS isn't the main goal
      // But if ROAS risk is defined, we should check it.
      if (purchaseValue > 0) {
        if (roas >= targetROAS * 1.2) {
          insights.push({
            type: 'OPPORTUNITY',
            severity: 'HIGH',
            title: `🚀 ROAS Excelente: ${roas.toFixed(2)}x`,
            subtitle: campaign.campaign_name,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            metric: 'ROAS',
            current_value: roas,
            average_value: targetROAS,
            change_percent: (roas - targetROAS) / targetROAS * 100,
            automation_action: 'Escalar Orçamento +20%'
          });
        } else if (roas < riskROAS) {
          insights.push({
            type: 'RISK',
            severity: roas < riskROAS * 0.5 ? 'CRITICAL' : 'HIGH',
            title: `⚠️ ROAS Baixo: ${roas.toFixed(2)}x`,
            subtitle: campaign.campaign_name,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            metric: 'ROAS',
            current_value: roas,
            average_value: riskROAS,
            change_percent: (roas - riskROAS) / riskROAS * 100,
            automation_action: 'Pausar ou Revisar'
          });
        }
      }
      // 2. CPA Alerts
      if (conversions > 0) {
        if (cpa <= targetCPA * 0.8) {
          insights.push({
            type: 'OPPORTUNITY',
            severity: 'MEDIUM',
            title: `💰 CPA Ótimo: R$ ${cpa.toFixed(2)}`,
            subtitle: campaign.campaign_name,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            metric: 'CPA',
            current_value: cpa,
            average_value: targetCPA,
            change_percent: (targetCPA - cpa) / targetCPA * 100,
            automation_action: 'Escalar Campanha'
          });
        } else if (cpa > riskCPA) {
          insights.push({
            type: 'RISK',
            severity: 'HIGH',
            title: `⚠️ CPA Alto: R$ ${cpa.toFixed(2)}`,
            subtitle: campaign.campaign_name,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            metric: 'CPA',
            current_value: cpa,
            average_value: riskCPA,
            change_percent: (cpa - riskCPA) / riskCPA * 100,
            automation_action: 'Reduzir Orçamento'
          });
        }
      }
      // 3. CPL Alerts (If leads exist)
      if (leads > 0) {
        if (cpl > riskCPL) {
          insights.push({
            type: 'RISK',
            severity: 'MEDIUM',
            title: `⚠️ CPL Alto: R$ ${cpl.toFixed(2)}`,
            subtitle: campaign.campaign_name,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            metric: 'CPL',
            current_value: cpl,
            average_value: riskCPL,
            change_percent: (cpl - riskCPL) / riskCPL * 100,
            automation_action: 'Revisar Criativos e Oferta'
          });
        }
      }
      // 4. CTR Alerts (Using dynamic or default thresholds)
      if (ctr > 0) {
        if (ctr < riskCTR) {
          insights.push({
            type: 'CREATIVE',
            severity: 'MEDIUM',
            title: `📉 CTR Baixo e Crítico: ${ctr.toFixed(2)}%`,
            subtitle: campaign.campaign_name,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            metric: 'CTR',
            current_value: ctr,
            average_value: riskCTR,
            change_percent: (ctr - riskCTR) / riskCTR * 100,
            automation_action: 'Substituir Criativos'
          });
        } else if (ctr > targetCTR) {
          insights.push({
            type: 'OPPORTUNITY',
            severity: 'LOW',
            title: `🎯 CTR Alto (Alto Engajamento): ${ctr.toFixed(2)}%`,
            subtitle: campaign.campaign_name,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            metric: 'CTR',
            current_value: ctr,
            average_value: targetCTR,
            change_percent: (ctr - targetCTR) / targetCTR * 100,
            automation_action: 'Analisar Criativo Campeão'
          });
        }
      }
      // 5. Frequency Alert
      if (frequency > maxFreq) {
        insights.push({
          type: 'RISK',
          severity: frequency > maxFreq * 1.5 ? 'HIGH' : 'MEDIUM',
          title: `🔄 Frequência Alta: ${frequency.toFixed(1)}x`,
          subtitle: campaign.campaign_name,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          metric: 'FREQUENCY',
          current_value: frequency,
          average_value: maxFreq,
          change_percent: (frequency - maxFreq) / maxFreq * 100,
          automation_action: 'Rotacionar Criativos / Expandir Público'
        });
      }
      // 6. CPC Alert
      if (cpc > riskCPC) {
        insights.push({
          type: 'RISK',
          severity: 'LOW',
          title: `💸 CPC Elevado: R$ ${cpc.toFixed(2)}`,
          subtitle: campaign.campaign_name,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          metric: 'CPC',
          current_value: cpc,
          average_value: riskCPC,
          change_percent: (cpc - riskCPC) / riskCPC * 100,
          automation_action: 'Substituir Criativos'
        });
      }
      // 7. CPM Alert
      if (cpm > riskCPM) {
        insights.push({
          type: 'RISK',
          severity: 'LOW',
          title: `💸 CPM Alto: R$ ${cpm.toFixed(2)}`,
          subtitle: campaign.campaign_name,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          metric: 'CPM',
          current_value: cpm,
          average_value: riskCPM,
          change_percent: (cpm - riskCPM) / riskCPM * 100,
          automation_action: 'Verificar Leilão / Expandir Público'
        });
      }
      // 8. High Spend No Conversions
      if (spend > 50 && conversions === 0 && clicks > 10) {
        insights.push({
          type: 'RISK',
          severity: 'CRITICAL',
          title: `🔴 Gasto Alto Sem Conversões`,
          subtitle: `${campaign.campaign_name} - R$ ${spend.toFixed(2)} gastos`,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          metric: 'SPEND',
          current_value: spend,
          average_value: 0,
          change_percent: -100,
          automation_action: 'Pausar Imediatamente'
        });
      }
    }
    // ====================================
    // 9. TRACKING: Detect Ads Without UTM
    // ====================================
    console.log(`🔍 [generate-insights] Checking for ads without UTM...`);
    const adsUrl = `https://graph.facebook.com/${META_API_VERSION}/act_${accountId}/ads?` + `fields=id,name,status,campaign_id,campaign{name},adset_id,adset{name},url_tags,creative{url_tags}` + `&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]` + `&limit=100` + `&access_token=${accessToken}`;
    try {
      const adsResponse = await fetch(adsUrl);
      const adsData = await adsResponse.json();
      if (adsData.data && Array.isArray(adsData.data)) {
        let adsWithoutUTM = 0;
        for (const ad of adsData.data){
          const adUrlTags = ad.url_tags || '';
          const creativeUrlTags = ad.creative?.url_tags || '';
          // Check if either has utm_source
          const hasUTM = adUrlTags.includes('utm_') || creativeUrlTags.includes('utm_');
          if (!hasUTM) {
            adsWithoutUTM++;
            insights.push({
              type: 'TRACKING',
              severity: 'MEDIUM',
              title: `📊 Sem Rastreamento UTM`,
              subtitle: ad.name,
              campaign_id: ad.campaign_id,
              campaign_name: ad.campaign?.name || 'Campanha',
              adset_id: ad.adset_id,
              adset_name: ad.adset?.name || 'Conjunto',
              ad_id: ad.id,
              ad_name: ad.name,
              metric: 'UTM',
              current_value: 0,
              average_value: 1,
              change_percent: -100,
              automation_action: 'Adicionar UTM'
            });
          }
        }
        console.log(`📊 [generate-insights] Found ${adsWithoutUTM} ads without UTM tracking`);
      }
    } catch (utmError) {
      console.error(`⚠️ [generate-insights] Error checking UTM:`, utmError);
    // Don't fail the whole request, just skip UTM detection
    }
    // Sort by severity
    const severityOrder = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    };
    insights.sort((a, b)=>severityOrder[b.severity] - severityOrder[a.severity]);
    console.log(`✅ [generate-insights] Generated ${insights.length} insights`);
    return new Response(JSON.stringify({
      success: true,
      insights,
      campaigns_analyzed: campaignInsights.length,
      summary: {
        total: insights.length,
        risks: insights.filter((i)=>i.type === 'RISK').length,
        opportunities: insights.filter((i)=>i.type === 'OPPORTUNITY').length,
        creatives: insights.filter((i)=>i.type === 'CREATIVE').length,
        tracking: insights.filter((i)=>i.type === 'TRACKING').length
      }
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("❌ [generate-insights] Error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));
