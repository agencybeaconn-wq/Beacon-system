// Edge function: create-quick-campaign
// Cria Campaign + AdSets + Ads em lote (estrutura tipo "1-3-1") na Meta API.
// Inclui fallback de token, busca automatica de pixel + page, geo formatter.
// Adoptado do Leverads.AI 2026-05-19.
// @ts-nocheck
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(instrument("create-quick-campaign", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { db: { schema: 'ads' }, global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { db: { schema: 'ads' } }
    );

    const {
      accountId, apiAccountId: inputApiAccountId, name, destinationUrl,
      pageId: providedPageId, budget, targeting, objective, structure,
      accessToken: providedToken, metaAccessToken, creativeHashes,
      page_id, instagram_actor_id, link_url, call_to_action
    } = await req.json();

    const targetAccountId = accountId || inputApiAccountId;
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const userToken = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(userToken);
      userId = user?.id;
    }

    const finalDestinationUrl = destinationUrl || "https://lever.dev";

    if (!targetAccountId || !name) {
      return new Response(JSON.stringify({
        success: false, error: "Dados incompletos: accountId e name sao obrigatorios.", error_code: "MISSING_REQUIRED_FIELDS"
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let accessToken = metaAccessToken || providedToken;
    let apiAccountId = targetAccountId;

    if (!accessToken) {
      const { data: account } = await supabaseAdmin.from("ad_accounts").select("access_token, id").eq("id", targetAccountId).single();
      if (account?.access_token) {
        accessToken = account.access_token;
        apiAccountId = account.id;
      } else if (userId) {
        const { data: connection } = await supabaseAdmin.from('connections').select('access_token').eq('user_id', userId).eq('provider', 'facebook').limit(1).single();
        if (connection?.access_token) accessToken = connection.access_token;
        else {
          const { data: metaToken } = await supabaseAdmin.from('meta_tokens').select('access_token').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).single();
          if (metaToken?.access_token) accessToken = metaToken.access_token;
        }
      }
    }

    if (!accessToken) {
      return new Response(JSON.stringify({
        success: false, error: "Token nao encontrado. Reconecte sua conta Facebook.", error_code: "TOKEN_NOT_FOUND"
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!apiAccountId.startsWith('act_')) apiAccountId = `act_${apiAccountId}`;

    const timestamp = new Date().toLocaleString('pt-BR');
    const objectiveMap = {
      "SALES": "OUTCOME_SALES", "LEADS": "OUTCOME_LEADS",
      "TRAFFIC": "OUTCOME_TRAFFIC", "ENGAGEMENT": "OUTCOME_ENGAGEMENT", "AWARENESS": "OUTCOME_AWARENESS"
    };
    const metaObjective = objective ? (objectiveMap[objective] || "OUTCOME_TRAFFIC") : "OUTCOME_TRAFFIC";

    const campaignPayload = {
      name: `${name} [${timestamp}]`, objective: metaObjective, status: "PAUSED",
      special_ad_categories: ["NONE"], buying_type: "AUCTION", is_adset_budget_sharing_enabled: false
    };

    const campaignResponse = await fetch(`https://graph.facebook.com/v20.0/${apiAccountId}/campaigns?access_token=${accessToken}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campaignPayload)
    });
    const campaignResult = await campaignResponse.json();
    if (campaignResult.error) {
      return new Response(JSON.stringify({ error: `Erro na campanha: ${campaignResult.error.message}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const campaignId = campaignResult.id;

    const structurePattern = structure || "1-1-1";
    const [, numAdSets, numAdsPerSet] = structurePattern.split("-").map(Number);
    const budgetPerAdSet = budget ? Math.round(budget * 100 / numAdSets) : Math.round(1000 / numAdSets);

    let pageId = providedPageId;
    if (!pageId) {
      const pagesResponse1 = await fetch(`https://graph.facebook.com/v20.0/${apiAccountId}?fields=promote_pages&access_token=${accessToken}`);
      const pagesData1 = await pagesResponse1.json();
      if (pagesData1.promote_pages?.data?.length > 0) pageId = pagesData1.promote_pages.data[0].id;
      if (!pageId) {
        const pagesResponse2 = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${accessToken}`);
        const pagesData2 = await pagesResponse2.json();
        if (pagesData2?.data?.length > 0) pageId = pagesData2.data[0].id;
      }
      if (!pageId) {
        return new Response(JSON.stringify({
          error: "Nenhuma pagina vinculada a conta. Vincule uma no Gerenciador ou forneca Page ID manualmente.",
          campaign_id: campaignId
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    function formatGeoLocation(inputGeo) {
      if (!inputGeo || (Array.isArray(inputGeo) && inputGeo.length === 0)) return null;
      if (inputGeo.cities || inputGeo.regions || inputGeo.countries) return inputGeo;
      if (Array.isArray(inputGeo)) {
        const cities = [], regions = [], countries = [];
        inputGeo.forEach((item) => {
          const key = typeof item === 'object' ? (item.key || item.id) : item;
          const type = typeof item === 'object' ? item.type : null;
          if (type === 'city') cities.push({ key: String(key), radius: 40, distance_unit: 'kilometer' });
          else if (type === 'region') regions.push({ key: String(key) });
          else if (type === 'country') countries.push(typeof item === 'object' ? (item.country_code || item.key) : item);
          else cities.push({ key: String(key), radius: 40, distance_unit: 'kilometer' });
        });
        const result: any = {};
        if (cities.length) result.cities = cities;
        if (regions.length) result.regions = regions;
        if (countries.length) result.countries = countries;
        if (Object.keys(result).length === 0) return { countries: ['BR'] };
        return result;
      }
      const key = typeof inputGeo === 'object' ? (inputGeo.key || inputGeo.id) : inputGeo;
      if (key) return { cities: [{ key: String(key), radius: 40, distance_unit: 'kilometer' }] };
      return { countries: ['BR'] };
    }

    async function getAccountPixel(actId, token) {
      try {
        const response = await fetch(`https://graph.facebook.com/v20.0/${actId}/adspixels?fields=id,name&access_token=${token}`);
        const data = await response.json();
        return data.data?.length > 0 ? data.data[0].id : null;
      } catch (e) { return null; }
    }

    const pixelId = await getAccountPixel(apiAccountId, accessToken);

    const optimizationGoalMap = {
      "OUTCOME_SALES": "OFFSITE_CONVERSIONS", "OUTCOME_LEADS": "LEAD_GENERATION",
      "OUTCOME_TRAFFIC": "LINK_CLICKS", "OUTCOME_ENGAGEMENT": "POST_ENGAGEMENT", "OUTCOME_AWARENESS": "REACH"
    };
    let targetGoal = optimizationGoalMap[metaObjective] || "OFFSITE_CONVERSIONS";
    const optimizationConfig: any = {
      billing_event: "IMPRESSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      destination_type: "WEBSITE",
      attribution_spec: [{ event_type: 'VIEW_THROUGH', window_days: 1 }, { event_type: 'CLICK_THROUGH', window_days: 1 }]
    };

    if (targetGoal === "OFFSITE_CONVERSIONS" || metaObjective === "OUTCOME_SALES") {
      if (pixelId) {
        optimizationConfig.optimization_goal = "OFFSITE_CONVERSIONS";
        optimizationConfig.promoted_object = { pixel_id: pixelId, custom_event_type: "PURCHASE" };
      } else {
        optimizationConfig.optimization_goal = "LINK_CLICKS";
        optimizationConfig.billing_event = "IMPRESSIONS";
      }
    } else {
      optimizationConfig.optimization_goal = targetGoal;
    }

    const DEFAULT_TARGETING = {
      targeting_automation: { advantage_audience: 1 },
      geo_locations: { countries: ['BR'] },
      age_min: 18, age_max: 65
    };

    const createdAdSets = [], createdAds = [], adSetDetails = [];

    for (let adSetIndex = 1; adSetIndex <= numAdSets; adSetIndex++) {
      const adSetPayload = {
        name: `Conjunto ${adSetIndex} - ${name}`,
        campaign_id: campaignId, status: "PAUSED",
        ...optimizationConfig,
        daily_budget: budgetPerAdSet,
        targeting: {
          ...DEFAULT_TARGETING, ...targeting,
          age_max: 65,
          geo_locations: formatGeoLocation(targeting?.geo_locations) || DEFAULT_TARGETING.geo_locations,
          targeting_automation: { advantage_audience: 1 }
        }
      };

      const adSetResponse = await fetch(`https://graph.facebook.com/v20.0/${apiAccountId}/adsets?access_token=${accessToken}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adSetPayload)
      });
      const adSetResult = await adSetResponse.json();
      if (adSetResult.error) {
        return new Response(JSON.stringify({
          success: false, error: `Campanha criada, mas erro no conjunto ${adSetIndex}: ${adSetResult.error.message}`,
          campaign_id: campaignId, created_ad_sets: createdAdSets, error_details: adSetResult.error
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adSetId = adSetResult.id;
      createdAdSets.push(adSetId);
      adSetDetails.push({ id: adSetId, name: adSetPayload.name });

      for (let adIndex = 1; adIndex <= numAdsPerSet; adIndex++) {
        const currentCreativeIndex = (adIndex - 1) % (creativeHashes?.length || 1);
        const currentCreativeHash = creativeHashes ? creativeHashes[currentCreativeIndex] : null;

        const linkDataBase = currentCreativeHash
          ? { image_hash: currentCreativeHash, link: link_url || finalDestinationUrl, message: 'Clique e confira!', call_to_action: { type: call_to_action || "SHOP_NOW" } }
          : { link: link_url || finalDestinationUrl, message: `Clique e confira! (${adIndex}/${numAdsPerSet})`, call_to_action: { type: call_to_action || "SHOP_NOW" } };

        const adPayload = {
          name: `Anuncio ${adIndex} - Conjunto ${adSetIndex} - ${name}`,
          adset_id: adSetId, status: "PAUSED",
          creative: { object_story_spec: { page_id: page_id || providedPageId || pageId, instagram_actor_id, link_data: linkDataBase } }
        };

        const adResponse = await fetch(`https://graph.facebook.com/v20.0/${apiAccountId}/ads?access_token=${accessToken}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adPayload)
        });
        const adResult = await adResponse.json();
        if (adResult.error) {
          return new Response(JSON.stringify({
            success: false, error: `Erro no anuncio ${adIndex}: ${adResult.error.message}`,
            campaign_id: campaignId, created_ad_sets: createdAdSets, created_ads: createdAds, error_details: adResult.error
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        createdAds.push(adResult.id);
      }
    }

    await supabaseAdmin.from('campaigns').upsert({
      id: campaignId, account_id: apiAccountId.replace('act_', ''),
      name: campaignPayload.name, status: 'PAUSED', objective: metaObjective,
      start_time: new Date().toISOString(), platform: 'Meta Ads',
      created_at: new Date().toISOString(), last_updated_at: new Date().toISOString()
    });

    for (const adSetDetail of adSetDetails) {
      await supabaseAdmin.from('adsets').upsert({
        id: adSetDetail.id, account_id: apiAccountId.replace('act_', ''),
        campaign_id: campaignId, name: adSetDetail.name, status: 'PAUSED',
        daily_budget: budgetPerAdSet / 100,
        created_at: new Date().toISOString(), last_updated_at: new Date().toISOString()
      });
    }

    return new Response(JSON.stringify({
      success: true, campaign_id: campaignId, adset_ids: createdAdSets, ad_ids: createdAds,
      structure: structurePattern,
      summary: { campaigns: 1, ad_sets: createdAdSets.length, ads: createdAds.length },
      message: `Campanha criada! Estrutura: ${structurePattern}`
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false, error: error.message || "Erro desconhecido", error_code: "INTERNAL_ERROR", stack: error.stack
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}));
