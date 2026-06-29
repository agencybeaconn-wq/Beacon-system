// @ts-ignore: Deno types
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const META_API_VERSION = 'v24.0';
serve(instrument("get-meta-hierarchy", async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { action, accessToken, businessId } = await req.json();
    if (!accessToken) {
      throw new Error('Missing accessToken');
    }
    console.log(`🚀 [GET-META-HIERARCHY] Action: ${action}`);
    if (action === 'GET_BUSINESSES') {
      // Fetch User's Businesses
      const url = `https://graph.facebook.com/${META_API_VERSION}/me/businesses?fields=id,name,profile_picture_uri,verification_status&limit=50&access_token=${accessToken}`;
      console.log(`🔗 [GET-META-HIERARCHY] Fetching businesses: ${url.replace(accessToken, 'HIDDEN')}`);
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        console.error('❌ [GET-META-HIERARCHY] Meta API Error:', data.error);
        throw new Error(data.error.message);
      }
      const businesses = data.data || [];
      console.log(`✅ [GET-META-HIERARCHY] Found ${businesses.length} businesses.`);
      return new Response(JSON.stringify({
        businesses
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (action === 'GET_AD_ACCOUNTS') {
      if (!businessId) {
        throw new Error('Missing businessId for GET_AD_ACCOUNTS action');
      }
      console.log(`🔍 [GET-META-HIERARCHY] Fetching Ad Accounts for Business: ${businessId}`);
      // Fetch Owned and Client Ad Accounts in parallel
      const ownedUrl = `https://graph.facebook.com/${META_API_VERSION}/${businessId}/owned_ad_accounts?fields=id,name,account_id,currency,timezone_name,account_status,amount_spent&limit=50&access_token=${accessToken}`;
      const clientUrl = `https://graph.facebook.com/${META_API_VERSION}/${businessId}/client_ad_accounts?fields=id,name,account_id,currency,timezone_name,account_status,amount_spent&limit=50&access_token=${accessToken}`;
      const [ownedRes, clientRes] = await Promise.all([
        fetch(ownedUrl),
        fetch(clientUrl)
      ]);
      let accounts = [];
      if (ownedRes.ok) {
        const ownedData = await ownedRes.json();
        const owned = ownedData.data || [];
        // Tag them
        owned.forEach((acc)=>acc.relation_type = 'OWNED');
        accounts = [
          ...accounts,
          ...owned
        ];
      } else {
        console.warn('⚠️ [GET-META-HIERARCHY] Failed to fetch owned accounts', await ownedRes.text());
      }
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        const client = clientData.data || [];
        // Tag them
        client.forEach((acc)=>acc.relation_type = 'CLIENT');
        accounts = [
          ...accounts,
          ...client
        ];
      } else {
        console.warn('⚠️ [GET-META-HIERARCHY] Failed to fetch client accounts', await clientRes.text());
      }
      console.log(`✅ [GET-META-HIERARCHY] Total Ad Accounts found: ${accounts.length}`);
      return new Response(JSON.stringify({
        accounts
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    throw new Error(`Invalid action: ${action}`);
  } catch (error) {
    console.error('❌ [GET-META-HIERARCHY] Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
