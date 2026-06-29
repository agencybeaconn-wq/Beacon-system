// @ts-ignore: Deno types
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// 🔧 CACHE DURATION: 1 hour (in milliseconds)
const CACHE_DURATION_MS = 60 * 60 * 1000;
serve(instrument("get-ad-identities", async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log(`🚀 [GET_IDENTITIES] Request received.`);
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'ads'
      }
    });
    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Invalid JSON body.");
    }
    let { accountId, accessToken, userId: bodyUserId, forceRefresh } = body;
    // Token Resolution
    if (!accessToken) {
      console.log("🔍 [GET_IDENTITIES] Token não fornecido, buscando no banco...");
      let userId = bodyUserId || null;
      if (!userId) {
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
          const jwt = authHeader.replace('Bearer ', '').trim();
          if (jwt) {
            const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
            if (user) {
              userId = user.id;
            }
          }
        }
      }
      if (!userId) {
        throw new Error("Não foi possível identificar o usuário. Reautentique-se.");
      }
      const { data: tokenData, error: tokenError } = await supabase.from('meta_tokens').select('access_token').eq('user_id', userId).eq('status', 'connected').order('updated_at', {
        ascending: false
      }).limit(1).single();
      if (tokenError || !tokenData) {
        throw new Error("Conta Meta Ads não conectada. Por favor, vá em Conexões e reconecte sua conta.");
      }
      accessToken = tokenData.access_token;
      bodyUserId = userId;
    }
    if (!accessToken) throw new Error("Token de acesso não identificado.");
    const cleanAccountId = accountId.replace(/^act_/i, '');
    const formattedAccountId = `act_${cleanAccountId}`;
    // 🔧 CHECK CACHE FIRST
    if (!forceRefresh) {
      console.log(`🔍 [GET_IDENTITIES] Checking cache for account ${formattedAccountId}...`);
      const { data: cached, error: cacheError } = await supabase.from('identity_cache').select('pages, instagram_accounts, cached_at').eq('ad_account_id', formattedAccountId).single();
      if (cached && !cacheError) {
        const cachedAt = new Date(cached.cached_at).getTime();
        const now = Date.now();
        if (now - cachedAt < CACHE_DURATION_MS) {
          console.log(`✅ [GET_IDENTITIES] Returning CACHED data (age: ${Math.round((now - cachedAt) / 1000 / 60)} min)`);
          return new Response(JSON.stringify({
            success: true,
            pages: cached.pages || [],
            instagramAccounts: cached.instagram_accounts || [],
            cached: true
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } else {
          console.log(`⏰ [GET_IDENTITIES] Cache expired, refreshing...`);
        }
      }
    } else {
      console.log(`🔄 [GET_IDENTITIES] Force refresh requested, skipping cache.`);
    }
    console.log(`🔎 Identities Scan initiated for account: ${formattedAccountId}`);
    let pagesMap = new Map();
    let instagramMap = new Map();
    // 0. Get Business ID for the Ad Account
    let businessId = null;
    try {
      const accResp = await fetch(`https://graph.facebook.com/v24.0/${formattedAccountId}?fields=business,name&access_token=${accessToken}`);
      const accData = await accResp.json();
      businessId = accData.business?.id || null;
    } catch (e) {
      console.warn(`⚠️ [GET_IDENTITIES] Failed to fetch account business details:`, e);
    }
    const addInstagram = (ig, vinculadaPageId, isPageBacked = false)=>{
      if (!ig.id) return;
      // 🔧 FIX: Use ID as fallback name when username/name are undefined
      const displayName = ig.username || ig.name || `Instagram ${ig.id.slice(-6)}`;
      if (instagramMap.has(ig.id)) {
        const existing = instagramMap.get(ig.id);
        if (vinculadaPageId && !existing.page_id_vinculada) existing.page_id_vinculada = vinculadaPageId;
        if (isPageBacked) existing.is_page_backed = true;
        if (ig.profile_picture_url && !existing.picture_url) existing.picture_url = ig.profile_picture_url;
        // Update name if we now have a better one (not ID-based)
        if ((ig.username || ig.name) && existing.name?.startsWith('Instagram ')) {
          existing.name = displayName;
          existing.username = displayName;
        }
        instagramMap.set(ig.id, existing);
        return;
      }
      instagramMap.set(ig.id, {
        id: ig.id,
        name: displayName,
        username: displayName,
        picture_url: ig.profile_picture_url,
        page_id_vinculada: vinculadaPageId,
        is_page_backed: isPageBacked
      });
    };
    const addPage = (p)=>{
      if (!p.id || pagesMap.has(p.id)) return;
      pagesMap.set(p.id, {
        id: p.id,
        name: p.name,
        picture_url: p.picture?.data?.url || p.picture_url,
        access_token: p.access_token
      });
      if (p.instagram_business_account) {
        addInstagram(p.instagram_business_account, p.id, false);
      }
    };
    // ==============================================
    // 1. FETCH PAGES (Combined: User + Business)
    // ==============================================
    console.log(`📌 [STEP 1] Fetching Pages...`);
    // User pages
    try {
      const url = `https://graph.facebook.com/v24.0/me/accounts?fields=name,picture{url},access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}&limit=200`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.data) data.data.forEach((p)=>addPage(p));
    } catch (e) {
      console.error(`❌ [STEP 1] me/accounts failed:`, e);
    }
    // Business pages (if businessId available)
    if (businessId) {
      try {
        const [ownedRes, clientRes] = await Promise.all([
          fetch(`https://graph.facebook.com/v24.0/${businessId}/owned_pages?fields=name,picture{url},access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}&limit=200`),
          fetch(`https://graph.facebook.com/v24.0/${businessId}/client_pages?fields=name,picture{url},access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}&limit=200`)
        ]);
        const ownedData = await ownedRes.json();
        const clientData = await clientRes.json();
        if (ownedData.data) ownedData.data.forEach((p)=>addPage(p));
        if (clientData.data) clientData.data.forEach((p)=>addPage(p));
      } catch (e) {
        console.error(`❌ [STEP 1] Business pages failed:`, e);
      }
    }
    // ==============================================
    // 2. FETCH PAGE-BACKED INSTAGRAMS (Ad-Ready Actors)
    // 🔧 OPTIMIZED: Only fetch if we have pages
    // ==============================================
    if (pagesMap.size > 0) {
      console.log(`📌 [STEP 2] Scanning ${pagesMap.size} pages for Ad-Ready Instagram Actors...`);
      const pageActorPromises = Array.from(pagesMap.values()).map(async (p)=>{
        if (!p.access_token || !p.id) return;
        try {
          const actorUrl = `https://graph.facebook.com/v24.0/${p.id}?fields=page_backed_instagram_accounts{id,username,profile_picture_url}&access_token=${p.access_token}`;
          const actorResp = await fetch(actorUrl);
          const actorData = await actorResp.json();
          if (actorData.page_backed_instagram_accounts?.data) {
            actorData.page_backed_instagram_accounts.data.forEach((ig)=>addInstagram(ig, p.id, true));
          }
        } catch (err) {}
      });
      await Promise.all(pageActorPromises);
    }
    // ==============================================
    // 3. FETCH INSTAGRAMS FROM BUSINESS (SIMPLIFIED)
    // 🔧 OPTIMIZED: Only use ONE endpoint per BM (owned_instagram_accounts)
    // 🔧 REMOVED: Redundant instagram_accounts call (reduces 50% of IG calls)
    // ==============================================
    console.log(`📌 [STEP 3] Scanning Business Managers for Instagram accounts...`);
    try {
      const bmsResp = await fetch(`https://graph.facebook.com/v24.0/me/businesses?limit=20&access_token=${accessToken}`);
      const bmsData = await bmsResp.json();
      if (bmsData.data) {
        // 🔧 OPTIMIZED: Limit to 5 BMs to reduce API calls significantly
        const bms = bmsData.data.slice(0, 5);
        console.log(`   Scanning ${bms.length} Business Managers (limited from ${bmsData.data.length})...`);
        const bmPromises = bms.map(async (bm)=>{
          try {
            // 🔧 OPTIMIZED: Only call owned_instagram_accounts (removed instagram_accounts)
            // 🔧 FIX: Added id to fields to ensure we always have it
            const owned = await fetch(`https://graph.facebook.com/v24.0/${bm.id}/owned_instagram_accounts?fields=id,username,profile_picture_url&limit=50&access_token=${accessToken}`).then((r)=>r.json()).catch(()=>({}));
            if (owned.data) owned.data.forEach((ig)=>addInstagram(ig));
          } catch (err) {}
        });
        await Promise.all(bmPromises);
      }
    } catch (e) {
      console.warn(`   Failed Step 3:`, e);
    }
    // ==============================================
    // 4. FETCH INSTAGRAMS FROM CURRENT AD ACCOUNT ONLY
    // 🔧 OPTIMIZED: Only scan the current account, not ALL accounts
    // ==============================================
    console.log(`📌 [STEP 4] Checking connected IGs for current Ad Account...`);
    try {
      const igUrl = `https://graph.facebook.com/v24.0/${formattedAccountId}/connected_instagram_accounts?fields=id,username,profile_picture_url&access_token=${accessToken}`;
      const igResp = await fetch(igUrl);
      const igData = await igResp.json();
      if (igData.data) {
        igData.data.forEach((ig)=>addInstagram(ig));
      }
    } catch (e) {
      console.warn(`   Failed Step 4:`, e);
    }
    // 🔧 REMOVED OLD STEP 4 (Page-IG Link Verification)
    // This was causing N+1 API calls for each page - redundant after STEP 2
    const pages = Array.from(pagesMap.values());
    const instagramAccounts = Array.from(instagramMap.values());
    console.log(`🏁 [FINAL] Found ${pages.length} Pages, ${instagramAccounts.length} Instagram Accounts.`);
    // 🔧 CACHE THE RESULTS
    try {
      await supabase.from('identity_cache').upsert({
        ad_account_id: formattedAccountId,
        user_id: bodyUserId,
        pages: pages,
        instagram_accounts: instagramAccounts,
        cached_at: new Date().toISOString()
      }, {
        onConflict: 'ad_account_id'
      });
      console.log(`💾 [GET_IDENTITIES] Results cached successfully.`);
    } catch (cacheErr) {
      console.warn(`⚠️ [GET_IDENTITIES] Failed to cache results:`, cacheErr);
    }
    return new Response(JSON.stringify({
      success: true,
      pages,
      instagramAccounts,
      cached: false
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error("❌ [FATAL ERROR]:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
