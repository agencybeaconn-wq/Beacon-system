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
serve(instrument("reply-to-comment", async (req)=>{
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
    const { commentId, message, attachmentUrl, adAccountId, fbConnectionId } = body;
    if (!commentId || !message) {
      throw new Error("commentId and message are required");
    }
    console.log(`💬 [reply-to-comment] Replying to: ${commentId}`);
    // Get workspace
    const { data: workspace } = await supabase.from("workspaces").select("id").eq("owner_id", user.id).single();
    let workspaceId = workspace?.id;
    if (!workspaceId) {
      const { data: membership } = await supabase.from("team_members").select("workspace_id").eq("user_id", user.id).eq("status", "active").single();
      workspaceId = membership?.workspace_id;
    }
    if (!workspaceId) throw new Error("Workspace not found");
    // Get the fb_connection for user token - use fbConnectionId if provided
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
    // Decrypt user token
    const { data: userAccessToken, error: decryptError } = await supabase.rpc("decrypt_fb_token", {
      encrypted_token: fbConnection.access_token_encrypted,
      encryption_key: encryptionKey
    });
    if (decryptError || !userAccessToken) {
      console.error("❌ [reply-to-comment] Decryption error:", decryptError);
      throw new Error("Failed to decrypt token");
    }
    // Get default page ID from account_settings using ad_account_id
    let defaultPageId = null;
    if (adAccountId) {
      const { data: accountSettings } = await supabase.from("account_settings").select("default_page_id").eq("ad_account_id", adAccountId).maybeSingle();
      defaultPageId = accountSettings?.default_page_id;
      console.log(`📄 [reply-to-comment] Default Page ID from settings: ${defaultPageId || 'not set'}`);
    }
    // Get Page Access Token using the user token
    const pagesUrl = `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();
    if (pagesData.error) {
      console.error("❌ [reply-to-comment] Error fetching pages:", pagesData.error);
      throw new Error(pagesData.error.message || "Failed to fetch pages");
    }
    // Find the page access token - prefer default, fallback to first available
    let targetPage = defaultPageId ? pagesData.data?.find((p)=>p.id === defaultPageId) : pagesData.data?.[0];
    if (!targetPage?.access_token) {
      console.error("❌ [reply-to-comment] No pages available. Pages:", pagesData.data?.map((p)=>p.id));
      throw new Error(`No Facebook Page access available. Make sure you are an Admin of a page and reconnect your Facebook profile.`);
    }
    const pageAccessToken = targetPage.access_token;
    console.log(`✅ [reply-to-comment] Using Page: ${targetPage.name} (ID: ${targetPage.id})`);
    // Reply to the comment using Page Access Token
    const replyUrl = `https://graph.facebook.com/${META_API_VERSION}/${commentId}/comments`;
    const formData = new FormData();
    formData.append('message', message);
    formData.append('access_token', pageAccessToken);
    if (attachmentUrl) {
      formData.append('attachment_url', attachmentUrl);
    }
    const response = await fetch(replyUrl, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (data.error) {
      console.error(`❌ [reply-to-comment] Meta API Error:`, JSON.stringify(data.error, null, 2));
      throw new Error(data.error.message || "Failed to reply");
    }
    console.log(`✅ [reply-to-comment] Reply posted: ${data.id}`);
    return new Response(JSON.stringify({
      success: true,
      replyId: data.id,
      message: "Reply posted successfully"
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("❌ [reply-to-comment] Error:", error);
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
