// @ts-ignore - Deno import
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(instrument("get-fb-token", async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionKey = Deno.env.get("FB_TOKEN_ENCRYPTION_KEY") || "default-key-change-me";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    // Get the authorization header to verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: "Missing authorization header"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { connectionId } = await req.json();
    if (!connectionId) {
      return new Response(JSON.stringify({
        error: "Missing connection_id"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get user's workspace
    const { data: workspaces } = await supabase.rpc('get_user_workspace', {
      p_user_id: user.id
    });
    const workspace = workspaces && workspaces.length > 0 ? workspaces[0] : null;
    if (!workspace) {
      return new Response(JSON.stringify({
        error: "Workspace not found"
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get the connection and verify ownership
    const { data: connection, error: connError } = await supabase.from('fb_connections').select('id, access_token_encrypted, workspace_id').eq('id', connectionId).eq('workspace_id', workspace.id).single();
    if (connError || !connection) {
      return new Response(JSON.stringify({
        error: "Connection not found or access denied"
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Decrypt the token
    const { data: decryptedToken, error: decryptError } = await supabase.rpc('decrypt_fb_token', {
      encrypted_token: connection.access_token_encrypted,
      encryption_key: encryptionKey
    });
    if (decryptError || !decryptedToken) {
      console.error('❌ [get-fb-token] Decryption error:', decryptError);
      return new Response(JSON.stringify({
        error: "Failed to decrypt token"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log(`✅ [get-fb-token] Token decrypted for connection ${connectionId}`);
    return new Response(JSON.stringify({
      accessToken: decryptedToken
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [get-fb-token] Error:', error);
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));
