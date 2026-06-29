// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(instrument("shopify-auth-start", async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  let shop = url.searchParams.get('shop')
  let clientId = url.searchParams.get('clientId')

  if (!shop || !clientId) {
    try {
      const body = await req.json()
      shop = body.shop
      clientId = body.clientId
    } catch (e) { /* ignore */ }
  }

  if (!shop || !clientId) {
    return new Response(JSON.stringify({ error: "Faltam parâmetros: shop ou clientId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  // Try to get per-client credentials from database
  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  // @ts-ignore
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: client } = await supabase
    .from('agency_clients')
    .select('shopify_client_id, shopify_client_secret')
    .eq('id', clientId)
    .single()

  // Use per-client credentials if available, fallback to env vars
  // @ts-ignore
  const apiKey = client?.shopify_client_id || Deno.env.get('SHOPIFY_CLIENT_ID')
  // @ts-ignore
  const scopes = Deno.env.get('SHOPIFY_SCOPES') || 'read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,read_checkout_branding_settings,write_checkout_branding_settings,read_content,write_content,read_customers,write_customers,read_discounts,write_discounts,read_draft_orders,write_draft_orders,read_files,write_files,read_fulfillments,write_fulfillments,read_gift_cards,write_gift_cards,read_inventory,write_inventory,read_legal_policies,write_legal_policies,read_locales,write_locales,read_locations,write_locations,read_markets,write_markets,read_metaobjects,write_metaobjects,read_online_store_navigation,write_online_store_navigation,read_online_store_pages,write_online_store_pages,read_orders,write_orders,read_products,write_products,read_publications,write_publications,read_returns,write_returns,read_script_tags,write_script_tags,read_selling_plans,write_selling_plans,read_shipping,write_shipping,read_themes,write_themes,read_translations,write_translations'

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Client ID do Shopify não configurado para este cliente" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  const redirectUri = "https://app.leverag.digital/api/shopify/callback"
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${clientId}`;

  if (req.method === 'GET') {
    return Response.redirect(authUrl)
  }

  return new Response(JSON.stringify({ url: authUrl }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}))
