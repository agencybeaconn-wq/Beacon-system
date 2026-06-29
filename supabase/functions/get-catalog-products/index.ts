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
serve(instrument("get-catalog-products", async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { accountId, catalogId, productSetId, limit = 10 } = await req.json();
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
    if (!catalogId && !productSetId) {
      return new Response(JSON.stringify({
        error: 'Either catalogId or productSetId is required'
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
    // Get access token from ad_accounts
    const cleanAccountId = accountId.replace(/^act_/i, '');
    let accessToken = null;
    const { data: account } = await supabase.from('ad_accounts').select('access_token').eq('id', `act_${cleanAccountId}`).single();
    if (account?.access_token) {
      accessToken = account.access_token;
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
    // Fetch products from catalog or product set
    const sourceId = productSetId || catalogId;
    const fields = 'id,name,description,price,sale_price,currency,image_url,url,brand,availability';
    const url = `https://graph.facebook.com/${META_API_VERSION}/${sourceId}/products?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
    console.log(`🛍️ [GET-CATALOG-PRODUCTS] Fetching products from: ${sourceId}`);
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      console.error(`❌ [GET-CATALOG-PRODUCTS] Meta API Error:`, data.error);
      return new Response(JSON.stringify({
        error: data.error.message || 'Meta API Error'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse and normalize products
    const products = (data.data || []).map((p)=>({
        id: p.id,
        name: p.name || 'Produto',
        description: p.description || '',
        price: p.price || '0',
        sale_price: p.sale_price || null,
        currency: p.currency || 'BRL',
        image_url: p.image_url || '',
        url: p.url || '',
        brand: p.brand || '',
        availability: p.availability || 'in stock'
      }));
    console.log(`✅ [GET-CATALOG-PRODUCTS] Found ${products.length} products`);
    return new Response(JSON.stringify({
      products
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ [GET-CATALOG-PRODUCTS] Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
