// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { CircuitBreaker } from "../_shared/circuit-breaker.ts";
import { Shield } from "../_shared/shield.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const META_API_VERSION = "v24.0"; // Atualizado para v24.0 conforme documentação
// 🔧 HELPER: Check if a city/region key is valid (should be numeric)
function isValidGeoKey(key) {
  if (!key) return false;
  // Valid keys are numeric strings like "2552580" for São Paulo
  return /^\d+$/.test(String(key));
}
// 🔧 HELPER: Search for city/region key using Meta API
// GLOBAL: No country priority - returns results for user/AI to choose
async function searchGeoLocation(accessToken, query, type) {
  try {
    const searchUrl = `https://graph.facebook.com/${META_API_VERSION}/search?type=adgeolocation&q=${encodeURIComponent(query)}&location_types=["${type}"]&limit=10&access_token=${accessToken}`;
    console.log(`🔍 [GEO-FIX] Searching for ${type}: "${query}"`);
    const response = await fetch(searchUrl);
    const data = await response.json();
    if (data.error) {
      console.error(`❌ [GEO-FIX] Search error:`, data.error);
      return null;
    }
    if (data.data && data.data.length > 0) {
      // Log all results for debugging - helps identify which location was selected
      console.log(`🔍 [GEO-FIX] Found ${data.data.length} results for "${query}":`);
      data.data.forEach((r, i)=>{
        console.log(`   ${i + 1}. ${r.name} (${r.type}) - Key: ${r.key} - Country: ${r.country_code || r.country_name || 'N/A'}`);
      });
      // 🌍 GLOBAL: Return first result - AI should have already clarified with user
      // The key should already be validated from searchMetaGeo call in lads-brain
      const result = data.data[0];
      console.log(`✅ [GEO-FIX] Using first match: "${result.name}" (${result.country_code || result.country_name || 'Unknown'}) with key: ${result.key}`);
      return {
        key: result.key,
        name: result.name,
        country: result.country_code || result.country_name
      };
    }
    console.warn(`⚠️ [GEO-FIX] No results for ${type}: "${query}"`);
    return null;
  } catch (error) {
    console.error(`❌ [GEO-FIX] Search failed:`, error);
    return null;
  }
}
// 🔧 HELPER: Validate and fix geo_locations keys AND TYPES
// 🌍 GLOBAL: Verifies location types and routes to correct arrays
async function validateAndFixGeoLocations(geoLocations, accessToken) {
  if (!geoLocations) return geoLocations;
  // Collect all locations and re-route by actual type
  const validCities = [];
  const validRegions = [];
  const validCountries = [];
  // Helper to verify location type from Meta API
  const verifyLocationType = async (key)=>{
    try {
      // Use the key to search and get actual type
      const searchUrl = `https://graph.facebook.com/${META_API_VERSION}/search?type=adgeolocation&q=${encodeURIComponent(key)}&limit=5&access_token=${accessToken}`;
      const response = await fetch(searchUrl);
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        // Find exact match by key
        const match = data.data.find((loc)=>String(loc.key) === String(key));
        if (match) {
          console.log(`🔍 [GEO-VERIFY] Key ${key} is type: ${match.type}`);
          return match.type;
        }
      }
    } catch (e) {
      console.error(`❌ [GEO-VERIFY] Failed to verify key ${key}:`, e);
    }
    return null;
  };
  // Process cities - verify each one is actually a city
  if (geoLocations.cities && Array.isArray(geoLocations.cities)) {
    for (const city of geoLocations.cities){
      if (!isValidGeoKey(city.key)) {
        console.warn(`⚠️ [GEO-FIX] Invalid city key: "${city.key}", searching...`);
        const result = await searchGeoLocation(accessToken, city.name || city.key, 'city');
        if (result) {
          validCities.push({
            key: result.key,
            name: result.name,
            // 🔧 FIX: Meta requires minimum 17km or 10 miles for city radius
            radius: Math.max(city.radius || 40, city.distance_unit === 'mile' ? 10 : 17),
            distance_unit: city.distance_unit || 'kilometer'
          });
        }
      } else {
        // Verify this key is actually a city, not a region
        const actualType = await verifyLocationType(city.key);
        if (actualType === 'region') {
          console.log(`🔄 [GEO-FIX] Key ${city.key} is verified REGION, moving to regions array`);
          validRegions.push({
            key: city.key,
            name: city.name
          });
        } else if (actualType === 'country') {
          console.log(`🔄 [GEO-FIX] Key ${city.key} is verified COUNTRY, moving to countries array`);
          validCountries.push(city.key);
        } else {
          // If actualType is 'city' OR null (verification failed)
          // 🧠 HEURISTIC: short numeric keys (<= 4 digits) are almost ALWAYS regions/states (e.g. New York=3875, California=3847)
          // Cities are usually 6-7+ digits (e.g. NYC=2490299, SP=2552580)
          if (city.key.length <= 4 && /^\d+$/.test(city.key)) {
            console.warn(`⚠️ [GEO-FIX] Key ${city.key} is suspiciously short for a City. Treating as REGION/STATE to prevent errors.`);
            validRegions.push({
              key: city.key,
              name: city.name
            });
          } else {
            // It's likely a city
            validCities.push({
              key: city.key,
              name: city.name,
              // 🔧 FIX: Meta requires minimum 17km or 10 miles for city radius
              radius: Math.max(city.radius || 40, city.distance_unit === 'mile' ? 10 : 17),
              distance_unit: city.distance_unit || 'kilometer'
            });
          }
        }
      }
    }
  }
  // Process regions - verify each one is actually a region
  if (geoLocations.regions && Array.isArray(geoLocations.regions)) {
    for (const region of geoLocations.regions){
      if (!isValidGeoKey(region.key)) {
        console.warn(`⚠️ [GEO-FIX] Invalid region key: "${region.key}", searching...`);
        const result = await searchGeoLocation(accessToken, region.name || region.key, 'region');
        if (result) {
          validRegions.push({
            key: result.key,
            name: result.name
          });
        }
      } else {
        validRegions.push({
          key: region.key,
          name: region.name
        });
      }
    }
  }
  // Process countries
  if (geoLocations.countries && Array.isArray(geoLocations.countries)) {
    for (const country of geoLocations.countries){
      if (typeof country === 'string' && country.length === 2) {
        validCountries.push(country.toUpperCase());
      }
    }
  }
  // Build final geo_locations with correct arrays
  const result = {};
  if (validCities.length > 0) result.cities = validCities;
  if (validRegions.length > 0) result.regions = validRegions;
  if (validCountries.length > 0) result.countries = validCountries;
  // 🌍 GLOBAL: Final validation - warn if no geo targeting at all
  if (!result.countries && !result.cities && !result.regions) {
    console.error(`❌ [GEO-FIX] CRITICAL: geo_locations is empty after validation! Campaign may fail.`);
  } else {
    console.log(`✅ [GEO-FIX] Final geo_locations:`, JSON.stringify(result));
  }
  return result;
}
serve(instrument("create-meta-campaign", async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  // Generate a randomized User-Agent for this execution to prevent fingerprinting
  const shieldUserAgent = Shield.getRandomUserAgent();
  const shieldHeaders = {
    "User-Agent": shieldUserAgent,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY", {
      db: {
        schema: 'ads'
      }
    }) ?? "");
    // Receber dados do frontend
    const { accountId, name, objective, adsetName, optimizationGoal, billingEvent, bidAmount, targeting, status, structure, budget, pageId: providedPageId, page_id, instagram_actor_id, link_url, destinationUrl, call_to_action, creativeHashes, ad_copy, tracking, mode, campaign: nestedCampaign // Estrutura aninhada para modo hierárquico
     } = await req.json();
    if (!accountId || !name) {
      throw new Error("Dados incompletos: accountId e name são obrigatórios.");
    }
    // 1. Buscar token da conta (otimizado: query única com OR)
    const accountIdWithPrefix = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    const accountIdWithoutPrefix = accountId.replace(/^act_/, '');
    // 🚀 OPTIMIZED: Single query with OR instead of 3 sequential queries
    const { data: accounts, error: accountError } = await supabase.from("ad_accounts").select("access_token, id, connection_id").or(`id.eq.${accountId},id.eq.${accountIdWithPrefix},id.eq.${accountIdWithoutPrefix}`).limit(1);
    const account = accounts?.[0];
    if (!account) {
      console.error(`[CREATE] Conta não encontrada para IDs: ${accountId}, ${accountIdWithPrefix}, ${accountIdWithoutPrefix}`);
      throw new Error("Conta de anúncios não encontrada ou sem token.");
    }
    if (!account.access_token) {
      console.error(`[CREATE] Conta encontrada mas sem access_token:`, account.id);
      throw new Error("Conta de anúncios sem token de acesso. Reconecte sua conta Meta.");
    }
    console.log(`[CREATE] Conta encontrada: ${account.id}`);
    // 2. Formatar ID da conta (Garantir prefixo 'act_')
    let apiAccountId = account.id;
    if (!apiAccountId.startsWith('act_')) {
      apiAccountId = `act_${apiAccountId}`;
    }
    const accessToken = account.access_token;
    const finalDestinationUrl = link_url || destinationUrl || "https://green-capital-growth.lovable.app";
    const finalPageId = page_id || providedPageId;
    // 🔍 DEBUG: Log raw instagram_actor_id before validation
    console.log(`📸 [INSTAGRAM] Raw input:`, {
      instagram_actor_id,
      type: typeof instagram_actor_id,
      value_stringified: JSON.stringify(instagram_actor_id)
    });
    // 🔧 FIX: Convert to string, trim, and validate instagram_actor_id
    const rawIgId = instagram_actor_id ? String(instagram_actor_id).trim() : null;
    const validInstagramActorId = rawIgId && rawIgId !== "none" && rawIgId !== "null" && rawIgId !== "undefined" && rawIgId !== "" && /^\d+$/.test(rawIgId) ? rawIgId : null;
    console.log(`📸 [INSTAGRAM] Validated:`, {
      rawIgId,
      validInstagramActorId,
      will_be_used: !!validInstagramActorId
    });
    // 🔧 FIX: Verify Instagram is authorized for this Ad Account before using
    // If the configured Instagram is not authorized, use the FIRST authorized one automatically
    let verifiedInstagramActorId = null;
    let authorizedInstagrams = [];
    try {
      console.log(`📸 [INSTAGRAM] Buscando contas Instagram CONECTADAS para ${apiAccountId}...`);
      // 🔧 FIX: Use /connected_instagram_accounts instead of /instagram_accounts
      // The /connected_instagram_accounts endpoint returns accounts specifically authorized to run ads
      const igCheckUrl = `https://graph.facebook.com/${META_API_VERSION}/${apiAccountId}/connected_instagram_accounts?fields=id,username&access_token=${accessToken}`;
      const igCheckRes = await fetch(igCheckUrl);
      const igCheckData = await igCheckRes.json();
      if (igCheckData.data && Array.isArray(igCheckData.data) && igCheckData.data.length > 0) {
        authorizedInstagrams = igCheckData.data;
        console.log(`📸 [INSTAGRAM] Contas CONECTADAS (autorizadas para ads):`, authorizedInstagrams.map((ig)=>`${ig.id} (@${ig.username})`));
        if (validInstagramActorId) {
          // Check if the configured Instagram is authorized
          const configuredIg = authorizedInstagrams.find((ig)=>ig.id === validInstagramActorId);
          if (configuredIg) {
            verifiedInstagramActorId = validInstagramActorId;
            console.log(`✅ [INSTAGRAM] Instagram configurado ${validInstagramActorId} (@${configuredIg.username}) está AUTORIZADO.`);
          } else {
            // 🔧 AUTO-FIX: Use first authorized Instagram instead
            verifiedInstagramActorId = authorizedInstagrams[0].id;
            console.warn(`⚠️ [INSTAGRAM] Instagram configurado ${validInstagramActorId} NÃO está autorizado.`);
            console.log(`🔄 [INSTAGRAM] AUTO-CORREÇÃO: Usando ${verifiedInstagramActorId} (@${authorizedInstagrams[0].username}) que está autorizado.`);
          }
        } else {
          // No Instagram configured, use first authorized one
          verifiedInstagramActorId = authorizedInstagrams[0].id;
          console.log(`🔄 [INSTAGRAM] Nenhum configurado. Usando ${verifiedInstagramActorId} (@${authorizedInstagrams[0].username}) automaticamente.`);
        }
      } else {
        console.warn(`⚠️ [INSTAGRAM] Nenhuma conta Instagram autorizada para ${apiAccountId}. Criando apenas para Facebook.`);
      }
    } catch (igErr) {
      console.error(`❌ [INSTAGRAM] Erro ao verificar autorização:`, igErr);
    }
    // 🔧 FIX: Verify PAGE <-> INSTAGRAM Link
    // Even if both are authorized in the user's Business Manager, they must be linked to EACH OTHER
    if (finalPageId && verifiedInstagramActorId) {
      try {
        console.log(`🔗 [PAGE-IG-CHECK] Verificando vínculo entre Page ${finalPageId} e Instagram ${verifiedInstagramActorId}...`);
        const pageUrl = `https://graph.facebook.com/${META_API_VERSION}/${finalPageId}?fields=instagram_business_account,connected_instagram_account&access_token=${accessToken}`;
        const pageRes = await fetch(pageUrl);
        const pageData = await pageRes.json();
        if (pageData.error) {
          console.warn(`⚠️ [PAGE-IG-CHECK] Falha ao ler dados da página: ${pageData.error.message}`);
        } else {
          const linkedIgId = pageData.instagram_business_account?.id || pageData.connected_instagram_account?.id;
          if (linkedIgId) {
            if (linkedIgId === verifiedInstagramActorId) {
              console.log(`✅ [PAGE-IG-CHECK] Vínculo CONFIRMADO! Page ${finalPageId} está ligada ao IG ${verifiedInstagramActorId}`);
            } else {
              console.warn(`⚠️ [PAGE-IG-CHECK] MISMATCH! Page ${finalPageId} está ligada ao IG ${linkedIgId}, mas estamos tentando usar ${verifiedInstagramActorId}`);
              console.log(`🔄 [PAGE-IG-CHECK] AUTO-CORREÇÃO: Atualizando verifiedInstagramActorId para ${linkedIgId} (o oficial da página)`);
              verifiedInstagramActorId = linkedIgId;
            }
          } else {
            console.warn(`⚠️ [PAGE-IG-CHECK] Page ${finalPageId} NÃO TEM conta do Instagram vinculada (retornou null).`);
            console.warn(`⚠️ [PAGE-IG-CHECK] O anúncio pode falhar com erro (#100) se forçar o uso de um IG não vinculado.`);
          // Opcional: Anular o IG se não estiver vinculado, para evitar erro?
          // verifiedInstagramActorId = null; // Decisão arriscada, melhor tentar mandar e ver o erro, ou usar FB only.
          }
        }
      } catch (linkErr) {
        console.error(`❌ [PAGE-IG-CHECK] Erro ao verificar vínculo:`, linkErr);
      }
    }
    console.log(`[PARAMS] accountId=${accountId}, name=${name}, pageId=${finalPageId}, instagram_actor_id=${instagram_actor_id}, verifiedInstagramActorId=${verifiedInstagramActorId}`);
    // ==========================================
    // MODO HIERÁRQUICO (NOVO)
    // ==========================================
    if (mode === 'hierarchical' && nestedCampaign) {
      console.log(`[Create] Iniciando Modo Hierárquico (Batch Processor)...`);
      // 🔧 FIX: Extract page_id from hierarchical structure if not provided at top level
      let hierarchicalPageId = finalPageId;
      if (!hierarchicalPageId && nestedCampaign.adSets?.length > 0) {
        // Try to find page_id in first ad of first adset
        const firstAd = nestedCampaign.adSets[0]?.ads?.[0];
        hierarchicalPageId = firstAd?.page_id || nestedCampaign.page_id || nestedCampaign.pageId;
        console.log(`[Create] 📄 Extracted page_id from hierarchical structure: ${hierarchicalPageId}`);
      }
      // Override finalPageId for hierarchical mode
      const effectivePageId = hierarchicalPageId;
      console.log(`[Create] 📄 Effective Page ID for this campaign: ${effectivePageId}`);
      // ==========================================
      // CIRCUIT BREAKER INITIALIZATION
      // ==========================================
      const connectionId = account.connection_id;
      let circuitBreaker = null;
      if (connectionId) {
        // Fetch workspace_id for the connection logic
        const { data: conn } = await supabase.from('fb_connections').select('workspace_id').eq('id', connectionId).single();
        if (conn?.workspace_id) {
          circuitBreaker = new CircuitBreaker(supabase, conn.workspace_id, connectionId);
          console.log(`🛡️ [Shield] Circuit Breaker armed for connection ${connectionId}`);
        }
      } else {
        console.warn(`⚠️ [Shield] No connection_id found for account. Circuit Breaker bypassed.`);
      }
      // Execute safely via Circuit Breaker (or directly if legacy)
      const executeSafely = async (operation)=>{
        if (circuitBreaker) {
          return await circuitBreaker.execute(operation);
        }
        return await operation();
      };
      // Generate timestamp for campaign name
      const timeString = new Date().toISOString().slice(0, 16).replace('T', ' ');
      // Objective mapping
      const objectiveMap = {
        "OUTCOME_SALES": "OUTCOME_SALES",
        "OUTCOME_LEADS": "OUTCOME_LEADS",
        "OUTCOME_TRAFFIC": "OUTCOME_TRAFFIC",
        "OUTCOME_ENGAGEMENT": "OUTCOME_ENGAGEMENT",
        "OUTCOME_AWARENESS": "OUTCOME_AWARENESS",
        "OUTCOME_APP_PROMOTION": "OUTCOME_APP_PROMOTION",
        "PRODUCT_CATALOG_SALES": "PRODUCT_CATALOG_SALES"
      };
      // ==========================================
      // STEP 1: CREATE CAMPAIGN
      // ==========================================
      // 🔧 FIX: Respect explicit budgetStrategy first, then fall back to budget heuristic
      let isCBO;
      if (nestedCampaign.budgetStrategy) {
        isCBO = nestedCampaign.budgetStrategy.toUpperCase() === 'CBO';
        console.log(`[Create] Modo de orçamento EXPLÍCITO: ${nestedCampaign.budgetStrategy} -> isCBO=${isCBO}`);
      } else {
        // Fallback: If campaign has daily_budget without explicit strategy, assume CBO
        isCBO = !!nestedCampaign.daily_budget;
        console.log(`[Create] Modo de orçamento INFERIDO: ${isCBO ? 'CBO (tem daily_budget)' : 'ABO (sem daily_budget)'}`);
      }
      // 🔧 CAMPAIGN PAYLOAD - Following Meta API v24.0 specs
      // special_ad_categories must be an array (can be empty [] for no special category)
      const specialAdCategories = nestedCampaign.special_ad_categories || [];
      // Filter out 'NONE' as it's not a valid value - use empty array instead
      const validSpecialCategories = Array.isArray(specialAdCategories) ? specialAdCategories.filter((c)=>c !== 'NONE') : [];
      const hierarchyCampaignPayload = {
        name: `[LADS] • ${(objectiveMap[nestedCampaign.objective] || 'SALES').replace('OUTCOME_', '')} • ${nestedCampaign.name} • ${timeString}`,
        objective: objectiveMap[nestedCampaign.objective] || "OUTCOME_SALES",
        status: "PAUSED",
        special_ad_categories: validSpecialCategories,
        buying_type: nestedCampaign.buyingType || "AUCTION",
        ...nestedCampaign.startTime ? {
          start_time: nestedCampaign.startTime
        } : {},
        // 🆕 Catalog Sales: Add promoted_object with product_catalog_id
        ...objectiveMap[nestedCampaign.objective] === 'PRODUCT_CATALOG_SALES' && nestedCampaign.productCatalogId ? {
          promoted_object: {
            product_catalog_id: nestedCampaign.productCatalogId
          }
        } : {}
      };
      // Log catalog campaign info
      if (objectiveMap[nestedCampaign.objective] === 'PRODUCT_CATALOG_SALES') {
        console.log(`[Create] 📦 Catalog Campaign Detected!`);
        console.log(`[Create] Catalog ID: ${nestedCampaign.productCatalogId || 'WILL AUTO-DETECT'}`);
        console.log(`[Create] Product Set ID: ${nestedCampaign.productSetId || 'ALL PRODUCTS'}`);
      }
      // CBO: Add budget and bid_strategy to campaign
      if (isCBO) {
        hierarchyCampaignPayload.daily_budget = Math.round(nestedCampaign.daily_budget * 100); // Convert to cents
        hierarchyCampaignPayload.bid_strategy = nestedCampaign.bid_strategy || "LOWEST_COST_WITHOUT_CAP";
        console.log(`[Create] CBO Budget: ${hierarchyCampaignPayload.daily_budget} centavos, Strategy: ${hierarchyCampaignPayload.bid_strategy}`);
      } else {
        // ABO: Must specify is_adset_budget_sharing_enabled (required in v24.0)
        // false = each adset has its own budget, no sharing
        hierarchyCampaignPayload.is_adset_budget_sharing_enabled = false;
        console.log(`[Create] ABO Mode: is_adset_budget_sharing_enabled = false`);
      }
      console.log(`[Create] Campaign Payload:`, JSON.stringify(hierarchyCampaignPayload));
      const cmpRes = await executeSafely(async ()=>await fetch(`https://graph.facebook.com/${META_API_VERSION}/${apiAccountId}/campaigns?access_token=${accessToken}`, {
          method: "POST",
          headers: shieldHeaders,
          body: JSON.stringify(hierarchyCampaignPayload)
        }));
      const cmpData = await cmpRes.json();
      console.log(`[Create] Campaign Response:`, JSON.stringify(cmpData));
      if (cmpData.error) {
        console.error(`[Create] Campaign Error Details:`, JSON.stringify(cmpData.error));
        throw new Error(`Erro Campanha: ${cmpData.error.message}`);
      }
      const campaignId = cmpData.id;
      console.log(`[Create] Campanha criada: ${campaignId}`);
      const fullCampaign = {
        id: campaignId,
        name: hierarchyCampaignPayload.name,
        objective: hierarchyCampaignPayload.objective,
        status: "PAUSED",
        daily_budget: hierarchyCampaignPayload.daily_budget ? (hierarchyCampaignPayload.daily_budget / 100).toFixed(2) : undefined,
        active: false,
        platform: 'Meta',
        advantage_catalog: nestedCampaign.advantageCatalog // Store catalog flag
      };
      // 1.1 Handle Advantage+ Catalog (Product Catalog Sales)
      // If objective is PRODUCT_CATALOG_SALES, we need to associate a Product Catalog
      if (hierarchyCampaignPayload.objective === 'PRODUCT_CATALOG_SALES') {
        try {
          // Fetch account's catalogs
          const catalogRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${accountIdWithoutPrefix}/product_catalogs?access_token=${accessToken}`);
          const catalogData = await catalogRes.json();
          if (catalogData.data && catalogData.data.length > 0) {
            const catalogId = catalogData.data[0].id;
            console.log(`[Create] Auto-selected Catalog: ${catalogId}`);
          // Note: For Catalog Sales, the Promoted Object is usually set at the Campaign or Ad Set level depending on the sub-type.
          // For standard Advantage+ Catalog ads, it's often at the Campaign level.
          // hierarchyCampaignPayload.promoted_object = { product_catalog_id: catalogId };
          // However, the Graph API often requires this field in the POST /campaigns call or update.
          // Let's try to update it if the initial creation didn't include it, OR include it in initial payload if possible.
          // According to documentation, promoted_object for campaign is for specific objectives.
          } else {
            console.warn("[Create] Warning: No Product Catalog found for Catalog Sales campaign.");
          }
        } catch (e) {
          console.error("[Create] Error fetching catalogs:", e);
        }
      }
      // ==========================================
      // STEP 2: BATCH ADSETS + ADS (Parallel with Concurrency Control)
      // ==========================================
      // 🚀 OPTIMIZATION: Process adsets in parallel batches instead of sequentially
      // This dramatically speeds up creation of large structures (1-15-5 = 75 ads)
      const BATCH_SIZE = 10; // Increased to 10 to speed up mass creation (safe for Meta API)
      // 🔍 PRE-PROCESSING: Validate and enhance adsets structure
      const rawAdSets = nestedCampaign.adSets || [];
      console.log(`[Batch] 🔍 Pre-processing ${rawAdSets.length} adsets...`);
      rawAdSets.forEach((adSet, i)=>{
        // Ensure unique name
        if (!adSet.name) {
          adSet.name = `AdSet ${i + 1}`;
          console.warn(`[Batch] ⚠️ AdSet[${i}] had no name, assigned: "${adSet.name}"`);
        }
        // Ensure geo_locations - GLOBAL: Don't silently add fallback
        if (!adSet.targeting?.geo_locations) {
          console.error(`[Batch] ❌ AdSet[${i}] "${adSet.name}" missing geo_locations! Location must be resolved in chat first.`);
        // Don't add fallback - let it fail if not resolved
        }
        // Log ads in this adset
        const adsInSet = adSet.ads || [];
        console.log(`[Batch] 📊 AdSet[${i}] "${adSet.name}": ${adsInSet.length} ads, geo: ${JSON.stringify(adSet.targeting?.geo_locations)}`);
        adsInSet.forEach((ad, j)=>{
          const hasCreative = !!(ad.creative_hash || ad.video_id);
          if (!hasCreative) {
            console.warn(`[Batch] ⚠️ Ad[${j}] in AdSet "${adSet.name}" has no creative_hash or video_id`);
          }
        });
      });
      const createdAdSets = [];
      const createdAds = [];
      const errors = [];
      const fullAdSets = [];
      const fullAds = [];
      // 🔧 HELPER: Normalize country codes - GLOBAL: No default country
      const normalizeCountryCode = (code)=>{
        const countryMap = {
          'brasil': 'BR',
          'brazil': 'BR',
          'br': 'BR',
          'estados unidos': 'US',
          'eua': 'US',
          'usa': 'US',
          'united states': 'US',
          'us': 'US',
          'portugal': 'PT',
          'pt': 'PT',
          'argentina': 'AR',
          'ar': 'AR',
          'méxico': 'MX',
          'mexico': 'MX',
          'mx': 'MX',
          'canadá': 'CA',
          'canada': 'CA',
          'ca': 'CA',
          'reino unido': 'GB',
          'uk': 'GB',
          'united kingdom': 'GB',
          'gb': 'GB',
          'espanha': 'ES',
          'spain': 'ES',
          'es': 'ES',
          'alemanha': 'DE',
          'germany': 'DE',
          'de': 'DE',
          'frança': 'FR',
          'france': 'FR',
          'fr': 'FR',
          'itália': 'IT',
          'italy': 'IT',
          'it': 'IT',
          'japão': 'JP',
          'japan': 'JP',
          'jp': 'JP',
          'china': 'CN',
          'cn': 'CN',
          'austrália': 'AU',
          'australia': 'AU',
          'au': 'AU'
        };
        const lowerCode = code.toLowerCase().trim();
        // 🌍 GLOBAL: Return mapped code, or uppercase if 2-letter, or original if unrecognized
        if (countryMap[lowerCode]) {
          return countryMap[lowerCode];
        }
        if (code.length === 2) {
          return code.toUpperCase();
        }
        console.warn(`⚠️ [GEO-FIX] Unrecognized country code: "${code}" - passing through unchanged`);
        return code;
      };
      // 🚀 HELPER: Process items in parallel batches with concurrency control
      const processBatch = async (items, processor, batchSize = BATCH_SIZE)=>{
        const results = [];
        for(let i = 0; i < items.length; i += batchSize){
          const batch = items.slice(i, i + batchSize);
          console.log(`[Batch] Processing items ${i + 1} to ${Math.min(i + batchSize, items.length)} of ${items.length}...`);
          const batchResults = await Promise.all(batch.map((item, idx)=>processor(item, i + idx)));
          results.push(...batchResults);
          // Small delay between batches to avoid rate limiting
          if (i + batchSize < items.length) {
            await new Promise((resolve)=>setTimeout(resolve, 100));
          }
        }
        return results;
      };
      // 🔧 HELPER: Build AdSet Payload (extracted for reuse)
      const buildAdSetPayload = async (adSet, adSetIndex)=>{
        // 🔧 FIX: Inherit campaign-level targeting if adset doesn't have its own
        const campaignTargeting = nestedCampaign.targeting || {};
        const adSetTargeting = adSet.targeting || {};
        // Merge: adset targeting takes priority, campaign targeting is fallback
        const rawTargeting = {
          ...campaignTargeting,
          ...adSetTargeting,
          // Deep merge geo_locations and interests
          geo_locations: adSetTargeting.geo_locations || campaignTargeting.geo_locations,
          interests: adSetTargeting.interests || campaignTargeting.interests,
          genders: adSetTargeting.genders || campaignTargeting.genders,
          age_min: adSetTargeting.age_min || campaignTargeting.age_min,
          age_max: adSetTargeting.age_max || campaignTargeting.age_max,
          behaviors: adSetTargeting.behaviors || campaignTargeting.behaviors,
          custom_audiences: adSetTargeting.custom_audiences || campaignTargeting.custom_audiences
        };
        console.log(`[Batch] AdSet "${adSet.name}" merged targeting:`, JSON.stringify({
          campaign: campaignTargeting,
          adSet: adSetTargeting,
          merged: rawTargeting
        }));
        const locationDisplay = rawTargeting.geo_locations?.countries?.join('/') || rawTargeting.geo_locations?.cities?.[0]?.name || 'BR';
        const ageDisplay = `${rawTargeting.age_min || 18}-${rawTargeting.age_max || 65}`;
        // 🔧 FIX: Determine if we should use Advantage+ or manual targeting
        // Meta API Rule: With Advantage+, age_max CANNOT be less than 65
        // So if specific targeting is requested (age, gender, interests), disable Advantage+
        const hasSpecificAge = rawTargeting.age_min > 18 || rawTargeting.age_max < 65;
        const hasSpecificGender = rawTargeting.genders && rawTargeting.genders.length > 0;
        const hasSpecificInterests = rawTargeting.interests && rawTargeting.interests.length > 0;
        const hasCustomAudiences = rawTargeting.custom_audiences && rawTargeting.custom_audiences.length > 0;
        const isManualMode = rawTargeting.audience_mode === 'manual';
        // If ANY specific targeting is requested, disable Advantage+
        const useAdvantageAudience = !hasSpecificAge && !hasSpecificGender && !hasSpecificInterests && !hasCustomAudiences && !isManualMode;
        console.log(`[Targeting] Advantage+ decision for "${adSet.name}":`, {
          hasSpecificAge,
          hasSpecificGender,
          hasSpecificInterests,
          hasCustomAudiences,
          isManualMode,
          useAdvantageAudience: useAdvantageAudience ? 'YES (broad targeting)' : 'NO (specific targeting)'
        });
        // 🌍 GLOBAL: Start without default geo - must be provided from upstream
        const targeting = {
          targeting_automation: {
            advantage_audience: useAdvantageAudience ? 1 : 0
          }
        };
        // Geo Locations with normalization and KEY VALIDATION
        if (rawTargeting.geo_locations) {
          const geo = rawTargeting.geo_locations;
          if (Array.isArray(geo)) {
            // 🔧 FIX: Detect numeric keys (city keys) vs country codes
            const countryValues = [];
            const cityValues = [];
            for (const item of geo){
              const str = String(item).trim();
              // If it's a numeric string with 5+ digits, it's a city key
              if (/^\d{5,}$/.test(str)) {
                console.log(`[GEO-FIX] "${str}" is a city key, routing to cities`);
                cityValues.push({
                  key: str,
                  radius: 40,
                  distance_unit: 'kilometer'
                });
              } else if (str.length === 2 && /^[A-Za-z]+$/.test(str)) {
                // 2-letter alphabetic code = country
                countryValues.push(normalizeCountryCode(str));
              } else {
                // Try to resolve via normalizeCountryCode
                const normalized = normalizeCountryCode(str);
                if (normalized.length === 2) {
                  countryValues.push(normalized);
                } else {
                  console.warn(`[GEO-FIX] "${str}" unrecognized, skipping`);
                }
              }
            }
            if (cityValues.length > 0 || countryValues.length > 0) {
              targeting.geo_locations = {
                ...countryValues.length > 0 ? {
                  countries: countryValues
                } : {},
                ...cityValues.length > 0 ? {
                  cities: cityValues
                } : {}
              };
            } else {
              console.error(`[Targeting] ❌ geo_locations array was empty after processing!`);
            }
          } else {
            // 🔧 FIX: Validate and fix city/region keys before using (for OBJECT structure)
            // This ensures we clean up empty arrays and add required radius for cities
            targeting.geo_locations = await validateAndFixGeoLocations(geo, accessToken);
          }
        } else if (rawTargeting.countries && Array.isArray(rawTargeting.countries)) {
          targeting.geo_locations = {
            countries: rawTargeting.countries.map((c)=>normalizeCountryCode(c))
          };
        }
        // Age - 🔧 FIX: Always respect age values from request, even with Advantage+ on
        // For Advantage+, age is a "suggestion" but still applied
        if (targeting.targeting_automation.advantage_audience === 1) {
          // In Advantage+ mode, age_min/age_max are still valid as audience suggestions
          targeting.age_min = rawTargeting.age_min || 18;
          targeting.age_max = rawTargeting.age_max || 65;
        } else {
          targeting.age_min = rawTargeting.age_min || 18;
          targeting.age_max = rawTargeting.age_max || 65;
        }
        // Genders - same handling for both modes
        if (rawTargeting.genders) {
          const g = rawTargeting.genders;
          if (Array.isArray(g)) {
            targeting.genders = g.map((v)=>parseInt(v)).filter((v)=>!isNaN(v));
          } else if (typeof g === 'number' || typeof g === 'string') {
            const val = parseInt(g);
            if (!isNaN(val)) targeting.genders = [
              val
            ];
          }
        }
        // Interests - 🔧 FIX: Map interests array to Meta's flexible_spec format
        // 🔒 VALIDATION: Only include interests with VALID NUMERIC IDs (Meta requires real IDs like "6003139266461")
        if (rawTargeting.flexible_spec) {
          targeting.flexible_spec = rawTargeting.flexible_spec;
        } else if (rawTargeting.interests && Array.isArray(rawTargeting.interests) && rawTargeting.interests.length > 0) {
          // Filter only interests with valid numeric IDs
          const validInterests = rawTargeting.interests.filter((interest)=>{
            const id = interest.id || interest;
            const isNumeric = /^\d+$/.test(String(id));
            if (!isNumeric) {
              console.warn(`[Targeting] ⚠️ Skipping invalid interest (non-numeric ID): ${JSON.stringify(interest)}`);
            }
            return isNumeric;
          }).map((interest)=>({
              id: String(interest.id || interest),
              name: interest.name || interest.id || interest
            }));
          if (validInterests.length > 0) {
            targeting.flexible_spec = [
              {
                interests: validInterests
              }
            ];
            console.log(`[Targeting] ✅ Mapped ${validInterests.length} valid interests to flexible_spec`);
          } else {
            console.warn(`[Targeting] ⚠️ No valid interests found (all had non-numeric IDs). Use searchMetaInterests to get real Meta IDs.`);
          }
        }
        // Behaviors
        if (rawTargeting.behaviors && Array.isArray(rawTargeting.behaviors) && rawTargeting.behaviors.length > 0) {
          if (!targeting.flexible_spec) targeting.flexible_spec = [];
          targeting.flexible_spec.push({
            behaviors: rawTargeting.behaviors.map((b)=>({
                id: b.id || b,
                name: b.name || b
              }))
          });
        }
        // Custom Audiences
        if (rawTargeting.custom_audiences && Array.isArray(rawTargeting.custom_audiences)) {
          targeting.custom_audiences = rawTargeting.custom_audiences.map((a)=>({
              id: a.id || a
            }));
        }
        // Excluded Custom Audiences
        if (rawTargeting.excluded_custom_audiences && Array.isArray(rawTargeting.excluded_custom_audiences)) {
          targeting.excluded_custom_audiences = rawTargeting.excluded_custom_audiences.map((a)=>({
              id: a.id || a
            }));
        }
        console.log(`[Targeting] Final targeting for AdSet "${adSet.name}":`, JSON.stringify(targeting));
        // 🆕 OBJECTIVE-AWARE DEFAULTS
        const campaignObjective = nestedCampaign.objective || 'OUTCOME_SALES';
        let defaultOptimizationGoal = 'OFFSITE_CONVERSIONS';
        let defaultBillingEvent = 'IMPRESSIONS';
        let requiresPixel = true;
        let defaultEventType = 'PURCHASE';
        switch(campaignObjective){
          case 'OUTCOME_LEADS':
            // LEADS: Use LEAD_GENERATION for instant forms, OFFSITE_CONVERSIONS for website
            defaultOptimizationGoal = adSet.destination_type === 'WEBSITE' ? 'OFFSITE_CONVERSIONS' : 'LEAD_GENERATION';
            defaultEventType = 'LEAD';
            // LEAD_GENERATION (instant forms) doesn't require pixel
            requiresPixel = adSet.destination_type === 'WEBSITE' || adSet.optimization_goal === 'OFFSITE_CONVERSIONS';
            console.log(`[Objective] LEADS campaign - opt_goal: ${defaultOptimizationGoal}, requiresPixel: ${requiresPixel}`);
            break;
          case 'OUTCOME_TRAFFIC':
            // TRAFFIC: Use LANDING_PAGE_VIEWS (higher quality) or LINK_CLICKS
            defaultOptimizationGoal = adSet.optimization_goal || 'LANDING_PAGE_VIEWS';
            requiresPixel = false; // Traffic doesn't require pixel
            console.log(`[Objective] TRAFFIC campaign - opt_goal: ${defaultOptimizationGoal}, requiresPixel: ${requiresPixel}`);
            break;
          case 'OUTCOME_ENGAGEMENT':
            // ENGAGEMENT: Varies by destination
            if (adSet.destination_type === 'MESSENGER' || adSet.destination_type === 'WHATSAPP') {
              defaultOptimizationGoal = 'CONVERSATIONS';
            } else {
              defaultOptimizationGoal = adSet.optimization_goal || 'POST_ENGAGEMENT';
            }
            requiresPixel = false;
            console.log(`[Objective] ENGAGEMENT campaign - opt_goal: ${defaultOptimizationGoal}`);
            break;
          case 'OUTCOME_AWARENESS':
            defaultOptimizationGoal = 'REACH';
            requiresPixel = false;
            console.log(`[Objective] AWARENESS campaign - opt_goal: ${defaultOptimizationGoal}`);
            break;
          default:
            defaultOptimizationGoal = 'OFFSITE_CONVERSIONS';
            defaultEventType = 'PURCHASE';
            requiresPixel = true;
        }
        const adSetPayload = {
          name: `[0${adSetIndex + 1}] • ${adSet.name} • ${locationDisplay} • ${ageDisplay}`,
          campaign_id: campaignId,
          status: adSet.status || "PAUSED",
          billing_event: adSet.billingEvent || adSet.billing_event || defaultBillingEvent,
          optimization_goal: adSet.optimizationGoal || adSet.optimization_goal || nestedCampaign.optimizationGoal || defaultOptimizationGoal,
          targeting,
          // 🆕 Add destination_type if specified
          ...adSet.destination_type ? {
            destination_type: adSet.destination_type
          } : {},
          ...adSet.attributionSpec ? {
            attribution_spec: adSet.attributionSpec
          } : {},
          ...adSet.startTime ? {
            start_time: adSet.startTime
          } : {},
          ...adSet.endTime ? {
            end_time: adSet.endTime
          } : {}
        };
        // ABO: Add budget
        if (!isCBO) {
          const adsetBudget = adSet.daily_budget || adSet.budget || 50;
          adSetPayload.daily_budget = Math.round(adsetBudget * 100);
          if (adSet.bidAmount) {
            adSetPayload.bid_amount = Math.round(adSet.bidAmount * 100);
            adSetPayload.bid_strategy = "COST_CAP";
          } else {
            adSetPayload.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
          }
        }
        // Promoted Object
        const isCatalogCampaign = hierarchyCampaignPayload.objective === 'PRODUCT_CATALOG_SALES';
        if (isCatalogCampaign) {
          adSetPayload.optimization_goal = 'OFFSITE_CONVERSIONS';
          const productSetId = nestedCampaign.productSetId || adSet.productSetId;
          if (productSetId && productSetId !== 'all' && productSetId !== 'ALL') {
            adSetPayload.promoted_object = {
              product_set_id: productSetId
            };
          } else {
            // Fetch default product set
            try {
              const catalogId = nestedCampaign.productCatalogId;
              if (catalogId) {
                const setsRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${catalogId}/product_sets?fields=id,name&access_token=${accessToken}`);
                const setsData = await setsRes.json();
                if (setsData?.data?.length > 0) {
                  const allProductsSet = setsData.data.find((ps)=>ps.name?.toLowerCase().includes('all') || ps.name?.toLowerCase().includes('todos')) || setsData.data[0];
                  adSetPayload.promoted_object = {
                    product_set_id: allProductsSet.id
                  };
                }
              }
            } catch (e) {
              console.error(`[Batch] Error fetching product sets:`, e);
            }
          }
        } else if (adSet.promoted_object) {
          // 🔧 FIX: Convert camelCase to snake_case for Meta API
          // Frontend may send pixelId/customEventType, but Meta requires pixel_id/custom_event_type
          const promoObj = adSet.promoted_object;
          let resolvedPixelId = promoObj.pixel_id || promoObj.pixelId;
          // 🔧 PIXEL VALIDATION: Always verify pixel belongs to current account
          // Even if pixel_id is numeric, it might be from a different account
          let validatedPixelId = resolvedPixelId;
          if (resolvedPixelId) {
            try {
              // Fetch all pixels from this account
              const pixelRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${apiAccountId}/adspixels?fields=id,name&access_token=${accessToken}`);
              const pixelData = await pixelRes.json();
              if (pixelData?.data?.length > 0) {
                const accountPixelIds = pixelData.data.map((p)=>p.id);
                // Check if provided pixel belongs to this account
                if (/^\d+$/.test(resolvedPixelId) && accountPixelIds.includes(resolvedPixelId)) {
                  console.log(`✅ [PIXEL-FIX] Pixel ${resolvedPixelId} verified - belongs to account`);
                  validatedPixelId = resolvedPixelId;
                } else if (!/^\d+$/.test(resolvedPixelId)) {
                  // It's a name, try to match
                  const matchedPixel = pixelData.data.find((p)=>p.name?.toLowerCase().includes(resolvedPixelId.toLowerCase().replace('pixel ', ''))) || pixelData.data[0];
                  console.log(`✅ [PIXEL-FIX] Resolved name "${resolvedPixelId}" to ID: ${matchedPixel.id} (${matchedPixel.name})`);
                  validatedPixelId = matchedPixel.id;
                } else {
                  // Numeric but doesn't belong to account - use first available
                  console.warn(`⚠️ [PIXEL-FIX] Pixel ${resolvedPixelId} NOT in account. Using first available: ${pixelData.data[0].id}`);
                  validatedPixelId = pixelData.data[0].id;
                }
              } else {
                console.error(`❌ [PIXEL-FIX] No pixels found in account ${apiAccountId}!`);
              }
            } catch (e) {
              console.error(`❌ [PIXEL-FIX] Failed to validate pixel:`, e);
            }
          }
          adSetPayload.promoted_object = {
            pixel_id: validatedPixelId,
            custom_event_type: promoObj.custom_event_type || promoObj.customEventType || adSet.custom_event_type || defaultEventType
          };
        } else {
          // Fetch pixel for conversion campaigns (only if required)
          const optGoal = adSetPayload.optimization_goal;
          // 🆕 LEAD_GENERATION (instant forms) needs page_id, not pixel_id
          const isLeadGenInstantForm = campaignObjective === 'OUTCOME_LEADS' && (adSet.destination_type === 'ON_AD' || optGoal === 'LEAD_GENERATION');
          if (isLeadGenInstantForm) {
            // 🔧 For Lead Generation with Instant Forms, promoted_object needs page_id only
            const pageId = adSet.page_id || nestedCampaign.pageId || adSet.ads?.[0]?.creative?.page_id;
            if (pageId) {
              adSetPayload.promoted_object = {
                page_id: pageId
              };
              console.log(`[Objective] LEAD_GENERATION instant form - using page_id: ${pageId}`);
            } else {
              console.warn(`⚠️ [LEADS] No page_id found for instant form campaign!`);
            }
          } else {
            // 🆕 Only require pixel for OFFSITE_CONVERSIONS or PURCHASE goals
            // TRAFFIC (LANDING_PAGE_VIEWS, LINK_CLICKS) doesn't need promoted_object
            const needsPixelForGoal = optGoal === 'OFFSITE_CONVERSIONS' || optGoal === 'PURCHASE';
            if (requiresPixel && needsPixelForGoal) {
              try {
                const pixelRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${apiAccountId}/adspixels?fields=id&access_token=${accessToken}`);
                const pixelData = await pixelRes.json();
                if (pixelData?.data?.[0]?.id) {
                  adSetPayload.promoted_object = {
                    pixel_id: pixelData.data[0].id,
                    custom_event_type: adSet.custom_event_type || defaultEventType
                  };
                  console.log(`[Objective] Auto-fetched pixel ${pixelData.data[0].id} for ${optGoal}`);
                }
              } catch (e) {
                console.error(`[Batch] Error fetching pixel:`, e);
              }
            } else if (!requiresPixel) {
              console.log(`[Objective] Skipping promoted_object for ${campaignObjective} - not required`);
            }
          }
        }
        return {
          adSetPayload,
          adSet,
          adSetIndex,
          locationDisplay
        };
      };
      console.log(`[Batch] Starting parallel creation of ${(nestedCampaign.adSets || []).length} ad sets...`);
      // STEP 2a: Create all AdSets in parallel batches
      const adSetResults = await processBatch(nestedCampaign.adSets || [], async (adSet, adSetIndex)=>{
        try {
          const { adSetPayload, locationDisplay } = await buildAdSetPayload(adSet, adSetIndex);
          const adSetRes = await executeSafely(async ()=>await fetch(`https://graph.facebook.com/${META_API_VERSION}/${apiAccountId}/adsets?access_token=${accessToken}`, {
              method: "POST",
              headers: shieldHeaders,
              body: JSON.stringify(adSetPayload)
            }));
          const adSetData = await adSetRes.json();
          if (adSetData.error) {
            // 🔍 DETAILED ERROR LOGGING: Show exactly what failed
            console.error(`[Batch] ❌ AdSet "${adSet.name}" failed:`, adSetData.error.message);
            console.error(`[Batch] Error code: ${adSetData.error.code}, Type: ${adSetData.error.type}`);
            console.error(`[Batch] Error sub-code: ${adSetData.error.error_subcode || 'N/A'}`);
            console.error(`[Batch] Error user message: ${adSetData.error.error_user_msg || 'N/A'}`);
            console.error(`[Batch] Full error:`, JSON.stringify(adSetData.error));
            console.error(`[Batch] 🚨 FAILED PAYLOAD (AdSet):`, JSON.stringify(adSetPayload, null, 2));
            return {
              success: false,
              adSet,
              adSetIndex,
              error: adSetData.error.message,
              fullError: adSetData.error,
              payload: adSetPayload
            };
          }
          console.log(`[Batch] ✓ AdSet ${adSetIndex + 1} created: ${adSetData.id}`);
          return {
            success: true,
            adSetId: adSetData.id,
            adSet,
            adSetIndex,
            payload: adSetPayload
          };
        } catch (e) {
          console.error(`[Batch] AdSet ${adSet.name} exception:`, e);
          return {
            success: false,
            adSet,
            adSetIndex,
            error: e.message
          };
        }
      });
      // Collect successful AdSets
      const successfulAdSets = adSetResults.filter((r)=>r.success);
      successfulAdSets.forEach((r)=>{
        createdAdSets.push(r.adSetId);
        fullAdSets.push({
          id: r.adSetId,
          name: r.adSet.name,
          status: r.adSet.status || "PAUSED",
          daily_budget: r.payload.daily_budget ? (r.payload.daily_budget / 100).toFixed(2) : undefined,
          targeting: r.payload.targeting,
          promoted_object: r.payload.promoted_object,
          optimization_goal: r.payload.optimization_goal,
          billing_event: r.payload.billing_event
        });
      });
      // Collect errors
      adSetResults.filter((r)=>!r.success).forEach((r)=>{
        errors.push({
          level: 'adset',
          name: r.adSet.name,
          error: r.error
        });
      });
      console.log(`[Batch] AdSets complete: ${successfulAdSets.length} success, ${adSetResults.length - successfulAdSets.length} failed`);
      // STEP 2b: Create all Ads in parallel batches
      // Build flat list of all ads with their parent adset IDs
      const allAdsToCreate = [];
      successfulAdSets.forEach((result)=>{
        (result.adSet.ads || []).forEach((ad, adIndex)=>{
          allAdsToCreate.push({
            ad,
            adSetId: result.adSetId,
            adSet: result.adSet,
            adSetIndex: result.adSetIndex,
            adIndex
          });
        });
      });
      console.log(`[Batch] Starting parallel creation of ${allAdsToCreate.length} ads...`);
      const adResults = await processBatch(allAdsToCreate, async (item)=>{
        const { ad, adSetId, adSet, adSetIndex, adIndex } = item;
        try {
          const adDestinationUrl = ad.destination_url || finalDestinationUrl;
          const adPageId = ad.page_id || effectivePageId;
          // 🔧 FIX: Use verifiedInstagramActorId (already validated against ad account)
          // Only use ad-level instagram if it matches the verified one, otherwise use verified fallback
          const rawInstagramId = ad.instagram_actor_id ? String(ad.instagram_actor_id).trim() : null;
          const adInstagramActorId = rawInstagramId && rawInstagramId === verifiedInstagramActorId ? rawInstagramId : verifiedInstagramActorId;
          console.log(`📸 [AD ${adIndex}] Final instagram_actor_id: ${adInstagramActorId || 'NONE (Facebook only)'}`);
          if (!adPageId) {
            return {
              success: false,
              ad,
              error: "page_id obrigatório"
            };
          }
          const creativeType = ad.video_id ? 'VIDEO' : ad.creative_hash ? 'IMAGE' : 'PENDING';
          const copyAngle = ad.copy?.headline?.slice(0, 20) || 'Criativo';
          const adName = `[AD0${adIndex + 1}] • ${creativeType} • ${copyAngle}`;
          // 🆕 Check if this is a Lead Ad with instant form
          const campaignObjective = nestedCampaign.objective || 'OUTCOME_SALES';
          const adSetDestType = adSet.destination_type || 'WEBSITE';
          const isLeadInstantForm = campaignObjective === 'OUTCOME_LEADS' && adSetDestType === 'ON_AD';
          // 🆕 Get lead form ID from ad, adSet, or campaign level
          const leadGenFormId = ad.lead_gen_form_id || ad.copy?.lead_gen_form_id || adSet.lead_gen_form_id || nestedCampaign.lead_gen_form_id;
          // 🆕 Determine CTA type and value based on campaign type
          const ctaType = ad.copy?.cta_type || call_to_action?.type || (isLeadInstantForm ? 'SIGN_UP' : 'SHOP_NOW');
          let ctaValue = {
            link: adDestinationUrl
          };
          // 🆕 For Lead Ads with instant forms, use lead_gen_form_id instead of link
          if (isLeadInstantForm && leadGenFormId) {
            ctaValue = {
              lead_gen_form_id: leadGenFormId
            };
            console.log(`📋 [AD ${adIndex}] Lead Ad with instant form - using form ID: ${leadGenFormId}`);
          } else if (isLeadInstantForm && !leadGenFormId) {
            console.warn(`⚠️ [AD ${adIndex}] Lead Ad with instant form - NO FORM ID! Campaign may fail.`);
          }
          // Build creative object_story_spec
          const object_story_spec = {
            page_id: adPageId,
            link_data: {
              // 🆕 For Lead Ads, link is still required but can be a placeholder
              link: isLeadInstantForm ? 'http://fb.me/' : adDestinationUrl,
              message: ad.copy?.primary_text || ad.copy?.message || "",
              name: ad.copy?.headline || "",
              description: ad.copy?.description || "",
              call_to_action: {
                type: ctaType,
                value: ctaValue
              }
            }
          };
          // Add Instagram if valid
          // 🔧 FIX: Use instagram_user_id instead of instagram_actor_id (deprecated in v22.0)
          if (adInstagramActorId) {
            object_story_spec.instagram_user_id = adInstagramActorId;
          }
          // Add image or video
          // 🔧 FIX: Prioritize VIDEO over IMAGE if both are present
          if (ad.video_id) {
            // 🎥 VIDEO: Build video_data with required thumbnail
            const thumbnailUrl = ad.thumbnail_url || ad.creative_url || ad.image_url;
            object_story_spec.video_data = {
              video_id: ad.video_id,
              // 🖼️ REQUIRED: Meta requires image_url or image_hash for video thumbnails
              ...thumbnailUrl ? {
                image_url: thumbnailUrl
              } : {},
              message: ad.copy?.primary_text || "",
              title: ad.copy?.headline || "",
              link_description: ad.copy?.description || "",
              call_to_action: {
                type: ctaType,
                value: ctaValue
              }
            };
            if (adInstagramActorId) object_story_spec.instagram_user_id = adInstagramActorId; // Use instagram_user_id (instagram_actor_id deprecated in v22.0)
            // Remove link_data because video_data replaces it
            delete object_story_spec.link_data;
          } else if (ad.creative_hash) {
            object_story_spec.link_data.image_hash = ad.creative_hash;
          }
          const adPayload = {
            name: adName,
            adset_id: adSetId,
            status: "PAUSED",
            creative: {
              object_story_spec
            }
          };
          const adRes = await executeSafely(async ()=>await fetch(`https://graph.facebook.com/${META_API_VERSION}/${apiAccountId}/ads?access_token=${accessToken}`, {
              method: "POST",
              headers: shieldHeaders,
              body: JSON.stringify(adPayload)
            }));
          const adData = await adRes.json();
          if (adData.error) {
            console.error(`[Batch] ❌ Ad "${adName}" failed: ${adData.error.message}`);
            console.error(`[Batch] Error details:`, JSON.stringify(adData.error));
            console.error(`[Batch] 🚨 FAILED PAYLOAD (Ad):`, JSON.stringify(adPayload, null, 2));
            return {
              success: false,
              ad,
              error: adData.error.message
            };
          }
          console.log(`[Batch] ✓ Ad created: ${adData.id}`);
          return {
            success: true,
            adId: adData.id,
            ad,
            adSetId
          };
        } catch (e) {
          return {
            success: false,
            ad,
            error: e.message
          };
        }
      });
      // Collect successful Ads
      adResults.filter((r)=>r.success).forEach((r)=>{
        createdAds.push(r.adId);
        fullAds.push({
          id: r.adId,
          name: r.ad.name,
          adset_id: r.adSetId,
          status: "PAUSED"
        });
      });
      // Collect Ad errors
      adResults.filter((r)=>!r.success).forEach((r)=>{
        errors.push({
          level: 'ad',
          name: r.ad?.name || 'Unknown',
          error: r.error
        });
      });
      console.log(`[Batch] Ads complete: ${adResults.filter((r)=>r.success).length} success, ${adResults.filter((r)=>!r.success).length} failed`);
      // Skip the old sequential loop - go directly to response
      // ==========================================
      // STEP 3: RETURN RESPONSE
      // ==========================================
      console.log(`[Create] ✅ Campaign creation complete! Campaign: ${campaignId}, AdSets: ${createdAdSets.length}, Ads: ${createdAds.length}`);
      return new Response(JSON.stringify({
        success: true,
        campaignId,
        adSets: createdAdSets,
        ads: createdAds,
        errors: errors.length > 0 ? errors : undefined,
        // Include full objects for frontend preload
        fullCampaign: {
          id: campaignId,
          name: hierarchyCampaignPayload.name,
          objective: hierarchyCampaignPayload.objective,
          status: hierarchyCampaignPayload.status,
          daily_budget: hierarchyCampaignPayload.daily_budget ? (hierarchyCampaignPayload.daily_budget / 100).toFixed(2) : undefined,
          special_ad_categories: hierarchyCampaignPayload.special_ad_categories,
          adSets: fullAdSets.map((adSet)=>({
              ...adSet,
              ads: fullAds.filter((ad)=>ad.adset_id === adSet.id)
            }))
        }
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    } // END hierarchical mode
    // No hierarchical campaign provided - return error
    throw new Error("Modo hierárquico não especificado. Use mode: 'hierarchical' com campaign object.");
  // Legacy Flat Mode code removed - unified into Hierarchical Batch Processor
  } catch (error) {
    console.error("[Create Campaign] Erro Geral:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));
