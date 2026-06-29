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
serve(instrument("fetch-meta-data", async (req)=>{
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
    const { endpoint, accountId, fbConnectionId, params = {} } = body;
    console.log(`📊 [fetch-meta-data] Endpoint: ${endpoint}, Account: ${accountId}`);
    // Get workspace
    const { data: workspace } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).single();
    // If not owner, check if team member
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
    // Decrypt token using the correct RPC function
    const { data: decryptedToken, error: decryptError } = await supabase.rpc("decrypt_fb_token", {
      encrypted_token: fbConnection.access_token_encrypted,
      encryption_key: encryptionKey
    });
    if (decryptError || !decryptedToken) {
      console.error("❌ [fetch-meta-data] Decryption error:", decryptError);
      throw new Error("Failed to decrypt token");
    }
    const accessToken = decryptedToken;
    console.log(`🔑 [fetch-meta-data] Token decrypted successfully`);
    // Build Meta API URL
    let url = "";
    const queryParams = new URLSearchParams();
    queryParams.append("access_token", accessToken);
    // Add custom params
    if (params.fields) queryParams.append("fields", params.fields);
    if (params.filtering) queryParams.append("filtering", params.filtering);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.date_preset) queryParams.append("date_preset", params.date_preset);
    if (params.time_range) queryParams.append("time_range", JSON.stringify(params.time_range));
    // Ensure accountId has act_ prefix
    const formattedAccountId = accountId?.startsWith("act_") ? accountId.replace("act_", "") : accountId;
    switch(endpoint){
      case "campaigns":
        url = `https://graph.facebook.com/${META_API_VERSION}/act_${formattedAccountId}/campaigns?${queryParams}`;
        break;
      case "adsets":
        url = `https://graph.facebook.com/${META_API_VERSION}/act_${formattedAccountId}/adsets?${queryParams}`;
        break;
      case "ads":
        url = `https://graph.facebook.com/${META_API_VERSION}/act_${formattedAccountId}/ads?${queryParams}`;
        break;
      case "campaign":
        // Get single campaign by ID
        const campaignId = params.campaignId;
        url = `https://graph.facebook.com/${META_API_VERSION}/${campaignId}?${queryParams}`;
        break;
      case "campaign_adsets":
        // Get adsets for a specific campaign (correct Meta API approach)
        const campIdForAdsets = params.campaignId;
        url = `https://graph.facebook.com/${META_API_VERSION}/${campIdForAdsets}/adsets?${queryParams}`;
        break;
      case "campaign_ads":
        // Get ads for a specific campaign
        const campIdForAds = params.campaignId;
        url = `https://graph.facebook.com/${META_API_VERSION}/${campIdForAds}/ads?${queryParams}`;
        break;
      case "adset_ads":
        // Get ads for a specific adset
        const adsetId = params.adsetId;
        url = `https://graph.facebook.com/${META_API_VERSION}/${adsetId}/ads?${queryParams}`;
        break;
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
    console.log(`🌐 [fetch-meta-data] Fetching: ${url.replace(accessToken, "***")}`);
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      console.error(`❌ [fetch-meta-data] Meta API Error:`, data.error);
      // Handle "Object with ID does not exist" gracefully for single campaign requests
      if (data.error.code === 100 && (endpoint === 'campaign' || endpoint === 'campaign_adsets' || endpoint === 'campaign_ads')) {
        console.log(`ℹ️ [fetch-meta-data] Campaign not found or archived, returning empty response`);
        return new Response(JSON.stringify({
          data: null,
          not_found: true,
          message: "Campaign may have been archived or deleted"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      throw new Error(data.error.message || "Meta API error");
    }
    console.log(`✅ [fetch-meta-data] Success: ${data.data?.length || 1} items`);
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("❌ [fetch-meta-data] Error:", error);
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
