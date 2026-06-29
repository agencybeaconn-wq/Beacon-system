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
serve(instrument("list-leadgen-forms", async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    // @ts-ignore: Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno global
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    // Get request body
    const { pageId, accountId } = await req.json();
    if (!pageId) {
      throw new Error("pageId é obrigatório");
    }
    console.log(`[list-leadgen-forms] Fetching lead forms for page: ${pageId}`);
    // Get access token from ad_accounts table
    let accessToken = null;
    if (accountId) {
      const { data: account, error: accountError } = await supabase.from("ad_accounts").select("access_token").eq("id", accountId).single();
      if (accountError || !account) {
        console.error("[list-leadgen-forms] Error fetching account:", accountError);
      } else {
        accessToken = account.access_token;
      }
    }
    // If no token from account, try to get from authorization header
    if (!accessToken) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        // Try to get user and find their token
        const userToken = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
        if (user && !userError) {
          // Find any account for this user
          const { data: accounts } = await supabase.from("ad_accounts").select("access_token").not("access_token", "is", null).limit(1);
          if (accounts && accounts.length > 0) {
            accessToken = accounts[0].access_token;
          }
        }
      }
    }
    if (!accessToken) {
      throw new Error("Token de acesso não encontrado. Reconecte sua conta Meta.");
    }
    // Fetch lead forms from Meta API
    // GET /{page-id}/leadgen_forms?fields=id,name,status,leads_count,created_time,questions
    const url = `https://graph.facebook.com/${META_API_VERSION}/${pageId}/leadgen_forms?fields=id,name,status,leads_count,created_time,questions&access_token=${accessToken}`;
    console.log(`[list-leadgen-forms] Fetching from Meta API...`);
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      console.error("[list-leadgen-forms] Meta API error:", data.error);
      throw new Error(`Erro Meta API: ${data.error.message}`);
    }
    const forms = data.data || [];
    console.log(`[list-leadgen-forms] Found ${forms.length} lead forms`);
    // Format the response
    const formattedForms = forms.map((form)=>({
        id: form.id,
        name: form.name,
        status: form.status,
        leads_count: form.leads_count || 0,
        created_time: form.created_time,
        questions: form.questions || [],
        // Helper fields for UI
        is_active: form.status === 'ACTIVE'
      }));
    // Sort by status (ACTIVE first) then by leads_count (descending)
    formattedForms.sort((a, b)=>{
      if (a.is_active !== b.is_active) return b.is_active ? 1 : -1;
      return b.leads_count - a.leads_count;
    });
    return new Response(JSON.stringify({
      success: true,
      forms: formattedForms,
      total: formattedForms.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[list-leadgen-forms] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      forms: []
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));
