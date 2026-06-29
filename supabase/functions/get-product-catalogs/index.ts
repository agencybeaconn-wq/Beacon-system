// @ts-ignore: Deno types
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const META_API_VERSION = 'v24.0';
serve(instrument("get-product-catalogs", async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { accountId } = await req.json();
    if (!accountId) {
      return new Response(JSON.stringify({
        error: 'accountId is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get access token from Supabase
    // @ts-ignore: Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno global
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    // Get access token AND business_id from ad_accounts
    const cleanAccountId = accountId.replace(/^act_/i, '');
    // Try ad_accounts first - now also get business_id
    let accessToken = null;
    let storedBusinessId = null;
    const { data: account } = await supabase.from('ad_accounts').select('access_token, business_id').eq('id', `act_${cleanAccountId}`).single();
    if (account?.access_token) {
      accessToken = account.access_token;
      storedBusinessId = account.business_id || null;
      console.log(`📦 [GET-PRODUCT-CATALOGS] Found stored business_id: ${storedBusinessId}`);
    } else {
      // Fallback: try meta_tokens by user
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: metaToken } = await supabase.from('meta_tokens').select('access_token').eq('user_id', user.id).order('updated_at', {
            ascending: false
          }).limit(1).single();
          if (metaToken?.access_token) {
            accessToken = metaToken.access_token;
          }
        }
      }
    }
    if (!accessToken) {
      return new Response(JSON.stringify({
        error: 'Access token not found for this account'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 1. Fetch Product Catalogs for the Ad Account
    // The catalogs are fetched via the Business associated with the ad account
    // PRIORITY: Use stored business_id from database (selected during integration)
    // FALLBACK: Fetch from Meta API (less reliable for shared accounts)
    const formattedAccountId = cleanAccountId.startsWith('act_') ? cleanAccountId : `act_${cleanAccountId}`;
    let businessId = storedBusinessId;
    let accountName = 'Unknown';
    // If no stored business_id, fallback to Meta API
    if (!businessId) {
      console.log(`🔍 [GET-PRODUCT-CATALOGS] No stored business_id, fetching from Meta API for: ${formattedAccountId}`);
      const accountUrl = `https://graph.facebook.com/${META_API_VERSION}/${formattedAccountId}?fields=business,name&access_token=${accessToken}`;
      const accountResponse = await fetch(accountUrl);
      const accountData = await accountResponse.json();
      businessId = accountData.business?.id || null;
      accountName = accountData.name || 'Unknown';
    } else {
      console.log(`✅ [GET-PRODUCT-CATALOGS] Using stored business_id: ${businessId}`);
      // Still fetch account name for logging
      const accountUrl = `https://graph.facebook.com/${META_API_VERSION}/${formattedAccountId}?fields=name&access_token=${accessToken}`;
      const accountResponse = await fetch(accountUrl);
      const accountData = await accountResponse.json();
      accountName = accountData.name || 'Unknown';
    }
    // We will collect catalogs from multiple sources and deduplicate by ID
    const allCatalogsMap = new Map();
    // Helper to add catalogs to map
    const addCatalogs = (source, list)=>{
      if (!list || !Array.isArray(list)) return;
      let count = 0;
      list.forEach((cat)=>{
        if (cat && cat.id) {
          allCatalogsMap.set(cat.id, cat);
          count++;
        }
      });
      console.log(`✅ [GET-PRODUCT-CATALOGS] Added ${count} catalogs from ${source}`);
    };
    // STRATEGY 1: Fetch from /me/product_catalogs (User Level - Most Reliable for permissions)
    console.log(`🔍 [GET-PRODUCT-CATALOGS] Strategy 1: Fetching User's Direct Catalogs (/me/product_catalogs)...`);
    const userCatalogsUrl = `https://graph.facebook.com/${META_API_VERSION}/me/product_catalogs?fields=id,name,product_count,vertical&limit=100&access_token=${accessToken}`;
    try {
      const userCatRes = await fetch(userCatalogsUrl);
      if (userCatRes.ok) {
        const userCatData = await userCatRes.json();
        addCatalogs('User Direct', userCatData.data);
      } else {
        console.warn(`⚠️ [GET-PRODUCT-CATALOGS] Failed user catalogs fetch: ${userCatRes.status} ${await userCatRes.text()}`);
      }
    } catch (e) {
      console.error(`❌ [GET-PRODUCT-CATALOGS] Error fetching user catalogs:`, e);
    }
    // STRATEGY 2: Business Level Fetching (If Business ID exists)
    if (businessId) {
      console.log(`🔍 [GET-PRODUCT-CATALOGS] Strategy 2: Fetching Business Catalogs for ${businessId}...`);
      // 2a. Generic Endpoint (often works when specific owned/client endpoints fail)
      const genericUrl = `https://graph.facebook.com/${META_API_VERSION}/${businessId}/product_catalogs?fields=id,name,product_count,vertical&limit=100&access_token=${accessToken}`;
      // 2b. Specific Endpoints (Owned/Client)
      const ownedUrl = `https://graph.facebook.com/${META_API_VERSION}/${businessId}/owned_product_catalogs?fields=id,name,product_count,vertical&limit=100&access_token=${accessToken}`;
      const clientUrl = `https://graph.facebook.com/${META_API_VERSION}/${businessId}/client_product_catalogs?fields=id,name,product_count,vertical&limit=100&access_token=${accessToken}`;
      const [genericRes, ownedRes, clientRes] = await Promise.allSettled([
        fetch(genericUrl),
        fetch(ownedUrl),
        fetch(clientUrl)
      ]);
      // Process Generic
      if (genericRes.status === 'fulfilled' && genericRes.value.ok) {
        const data = await genericRes.value.json();
        addCatalogs('Business Generic', data.data);
      } else if (genericRes.status === 'fulfilled') {
        console.warn(`⚠️ [GET-PRODUCT-CATALOGS] Business Generic failed: ${genericRes.value.status}`);
      }
      // Process Owned
      if (ownedRes.status === 'fulfilled' && ownedRes.value.ok) {
        const data = await ownedRes.value.json();
        addCatalogs('Business Owned', data.data);
      }
      // Process Client
      if (clientRes.status === 'fulfilled' && clientRes.value.ok) {
        const data = await clientRes.value.json();
        addCatalogs('Business Client', data.data);
      }
    } else {
      console.warn('⚠️ [GET-PRODUCT-CATALOGS] No Business ID found for this Ad Account.');
    }
    // STRATEGY 3: Fallback - Search in User's Businesses (Deep Search)
    // Only if we have very strictly 0 catalogs, or maybe we just add to be safe? 
    // Let's only do this if we have NO catalogs yet, to save time, OR if the user asked for it. 
    // For now, let's keep it as a fallback if map is empty.
    if (allCatalogsMap.size === 0) {
      console.log('🔄 [GET-PRODUCT-CATALOGS] Strategy 3: Still 0 catalogs. Trying deep User Business search...');
      const userBusinessesUrl = `https://graph.facebook.com/${META_API_VERSION}/me/businesses?fields=id,name,product_catalogs{id,name,product_count,vertical}&limit=10&access_token=${accessToken}`;
      try {
        const userBizRes = await fetch(userBusinessesUrl);
        if (userBizRes.ok) {
          const userBizData = await userBizRes.json();
          const businesses = userBizData.data || [];
          businesses.forEach((biz)=>{
            if (biz.product_catalogs?.data) {
              addCatalogs(`User Business (${biz.name})`, biz.product_catalogs.data);
            }
          });
        }
      } catch (e) {
        console.error('❌ [GET-PRODUCT-CATALOGS] Error in deep search:', e);
      }
    }
    const catalogs = Array.from(allCatalogsMap.values());
    console.log(`✅ [GET-PRODUCT-CATALOGS] Final Total: ${catalogs.length} unique catalogs.`);
    // 2. For each catalog, fetch its Product Sets
    const catalogsWithSets = await Promise.all(catalogs.map(async (catalog)=>{
      try {
        const productSetsUrl = `https://graph.facebook.com/${META_API_VERSION}/${catalog.id}/product_sets?fields=id,name,product_count&limit=500&access_token=${accessToken}`;
        const productSetsResponse = await fetch(productSetsUrl);
        const productSetsData = await productSetsResponse.json();
        const productSets = productSetsData.data || [];
        console.log(`📦 [GET-PRODUCT-CATALOGS] Catalog ${catalog.name}: ${productSets.length} product sets`);
        return {
          ...catalog,
          product_sets: productSets
        };
      } catch (err) {
        console.error(`⚠️ [GET-PRODUCT-CATALOGS] Error fetching sets for catalog ${catalog.id}:`, err);
        return {
          ...catalog,
          product_sets: []
        };
      }
    }));
    // Collect debug info
    const debugInfo = {
      businessId: businessId || 'NOT_FOUND',
      accountName: accountName || 'UNKNOWN',
      storedBusinessId: storedBusinessId || 'NONE',
      strategiesTried: [
        'user_direct',
        businessId ? 'business_generic' : 'skipped',
        businessId ? 'business_owned' : 'skipped',
        businessId ? 'business_client' : 'skipped',
        allCatalogsMap.size === 0 ? 'deep_search' : 'skipped'
      ],
      totalUniqueCatalogs: catalogs.length
    };
    console.log('🔍 [GET-PRODUCT-CATALOGS] Debug info:', debugInfo);
    return new Response(JSON.stringify({
      success: true,
      catalogs: catalogsWithSets,
      debug: debugInfo
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ [GET-PRODUCT-CATALOGS] Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
