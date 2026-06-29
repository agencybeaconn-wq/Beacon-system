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
serve(instrument("fetch-ad-comments", async (req)=>{
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
    const { adId, postId, limit = 50, adAccountId, fbConnectionId } = body;
    console.log(`💬 [fetch-ad-comments] Ad: ${adId}, Post: ${postId}`);
    // Get workspace
    const { data: workspace } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).single();
    let workspaceId = workspace?.id;
    if (!workspaceId) {
      const { data: membership } = await supabase.from("team_members").select("workspace_id").eq("user_id", user.id).eq("status", "active").single();
      workspaceId = membership?.workspace_id;
    }
    if (!workspaceId) throw new Error("Workspace not found");
    // Get the fb_connection for token - use fbConnectionId if provided
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
      console.error("❌ [fetch-ad-comments] Decryption error:", decryptError);
      throw new Error("Failed to decrypt token");
    }
    const userAccessToken = decryptedToken;
    console.log(`🔑 [fetch-ad-comments] User Token decrypted successfully`);
    // Get default page ID from account_settings using ad_account_id
    let defaultPageId = null;
    if (adAccountId) {
      const { data: accountSettings } = await supabase.from("account_settings").select("default_page_id").eq("ad_account_id", adAccountId).maybeSingle();
      defaultPageId = accountSettings?.default_page_id;
      console.log(`📄 [fetch-ad-comments] Default Page ID from settings: ${defaultPageId || 'not set'}`);
    } else {
      // Fallback to workspace settings if no adAccountId
      const { data: accountSettings } = await supabase.from("account_settings").select("default_page_id").eq("workspace_id", workspaceId).maybeSingle();
      defaultPageId = accountSettings?.default_page_id;
    }
    // Get Page Access Token using the user token
    const pagesUrl = `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();
    if (pagesData.error) {
      console.error("❌ [fetch-ad-comments] Error fetching pages:", pagesData.error);
      throw new Error(pagesData.error.message || "Failed to fetch pages");
    }
    // Find the page access token - prefer default, fallback to first available
    let targetPage = defaultPageId ? pagesData.data?.find((p)=>p.id === defaultPageId) : pagesData.data?.[0];
    if (!targetPage?.access_token) {
      console.error("❌ [fetch-ad-comments] No pages available. Pages:", pagesData.data?.map((p)=>p.id));
      throw new Error(`No Facebook Page access available. Make sure you are an Admin of a page and reconnect your Facebook profile.`);
    }
    const accessToken = targetPage.access_token;
    console.log(`✅ [fetch-ad-comments] Using Page Token for: ${targetPage.name} (ID: ${targetPage.id})`);
    let objectStoryId = postId;
    // If we have adId but no postId, get the effective_object_story_id from the ad
    if (adId && !postId) {
      console.log(`📋 [fetch-ad-comments] Getting effective_object_story_id from ad: ${adId}`);
      const adResponse = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${adId}?fields=creative{effective_object_story_id}&access_token=${accessToken}`);
      const adData = await adResponse.json();
      if (adData.error) {
        console.error("❌ [fetch-ad-comments] Error getting ad:", adData.error);
        throw new Error(adData.error.message);
      }
      objectStoryId = adData.creative?.effective_object_story_id;
      console.log(`📋 [fetch-ad-comments] effective_object_story_id: ${objectStoryId}`);
    }
    if (!objectStoryId) {
      return new Response(JSON.stringify({
        comments: [],
        total: 0,
        message: "No post ID found for this ad"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Fetch comments from the post
    const commentsUrl = `https://graph.facebook.com/${META_API_VERSION}/${objectStoryId}/comments?` + `fields=id,message,from,created_time,like_count,comment_count,is_hidden,can_reply_privately,` + `attachment,replies{id,message,from,created_time,like_count}` + `&limit=${limit}&order=reverse_chronological&access_token=${accessToken}`;
    console.log(`🌐 [fetch-ad-comments] Fetching comments from: ${objectStoryId}`);
    const response = await fetch(commentsUrl);
    const data = await response.json();
    if (data.error) {
      console.error(`❌ [fetch-ad-comments] Meta API Error:`, data.error);
      throw new Error(data.error.message || "Meta API error");
    }
    const comments = data.data || [];
    // Analyze sentiment (basic)
    const analyzedComments = comments.map((comment)=>{
      const text = (comment.message || '').toLowerCase();
      let sentiment = 'neutral';
      // Basic sentiment analysis
      const positiveWords = [
        'ótimo',
        'excelente',
        'maravilhoso',
        'perfeito',
        'amei',
        'adorei',
        'parabéns',
        'recomendo',
        'top',
        'incrível',
        'bom',
        'boa',
        'legal',
        'love',
        'great',
        'amazing',
        'awesome'
      ];
      const negativeWords = [
        'ruim',
        'péssimo',
        'horrível',
        'caro',
        'decepcionado',
        'nunca',
        'golpe',
        'fraude',
        'scam',
        'fake',
        'não comprem',
        'não recomendo',
        'bad',
        'terrible',
        'worst'
      ];
      const hasPositive = positiveWords.some((word)=>text.includes(word));
      const hasNegative = negativeWords.some((word)=>text.includes(word));
      if (hasPositive && !hasNegative) sentiment = 'positive';
      else if (hasNegative) sentiment = 'negative';
      return {
        ...comment,
        sentiment
      };
    });
    console.log(`✅ [fetch-ad-comments] Found ${comments.length} comments`);
    return new Response(JSON.stringify({
      comments: analyzedComments,
      total: comments.length,
      paging: data.paging
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("❌ [fetch-ad-comments] Error:", error);
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
