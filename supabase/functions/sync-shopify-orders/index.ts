// Sync Shopify Orders - Fetches orders and aggregates daily revenue
// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// @ts-ignore
Deno.serve(instrument("sync-shopify-orders", async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-ignore
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  try {
    const { adAccountId, fromDate, toDate } = await req.json();
    if (!adAccountId) {
      return new Response(JSON.stringify({
        error: 'adAccountId é obrigatório'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    // 1. Get Shopify config for this ad account
    const { data: config, error: configError } = await supabase.from('shopify_configs').select('*').eq('ad_account_id', adAccountId).eq('is_active', true).maybeSingle();
    if (configError || !config) {
      return new Response(JSON.stringify({
        error: 'Shopify não configurado para esta conta',
        details: configError?.message
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`🔄 [SHOPIFY-SYNC] Starting sync for shop: ${config.shop_domain}`);
    // 2. Build date range
    const now = new Date();
    const from = fromDate ? new Date(fromDate) : new Date(now.setDate(now.getDate() - 30));
    const to = toDate ? new Date(toDate) : new Date();
    const createdAtMin = from.toISOString();
    const createdAtMax = to.toISOString();
    // 3. Fetch orders from Shopify Admin API
    const shopifyApiUrl = `https://${config.shop_domain}/admin/api/2024-01/orders.json`;
    const queryParams = new URLSearchParams({
      status: 'any',
      created_at_min: createdAtMin,
      created_at_max: createdAtMax,
      limit: '250',
      fields: 'id,created_at,total_price,line_items'
    });
    const ordersResponse = await fetch(`${shopifyApiUrl}?${queryParams}`, {
      headers: {
        'X-Shopify-Access-Token': config.access_token,
        'Content-Type': 'application/json'
      }
    });
    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('❌ [SHOPIFY-SYNC] Shopify API error:', errorText);
      return new Response(JSON.stringify({
        error: 'Erro ao buscar pedidos do Shopify',
        details: errorText
      }), {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const ordersData = await ordersResponse.json();
    const orders = ordersData.orders || [];
    console.log(`📊 [SHOPIFY-SYNC] Fetched ${orders.length} orders`);
    // 4. Aggregate by day
    const dailyData = {};
    for (const order of orders){
      const date = order.created_at.split('T')[0] // YYYY-MM-DD
      ;
      const revenue = parseFloat(order.total_price) || 0;
      if (!dailyData[date]) {
        dailyData[date] = {
          revenue: 0,
          orders: 0,
          productCosts: 0
        };
      }
      dailyData[date].revenue += revenue;
      dailyData[date].orders += 1;
    // TODO: Fetch product costs from Products API if needed
    // For now, we estimate based on typical margin (can be refined)
    }
    // 5. Upsert daily revenue data
    const upsertData = Object.entries(dailyData).map(([date, data])=>({
        ad_account_id: adAccountId,
        date: date,
        gross_revenue: data.revenue,
        total_orders: data.orders,
        product_costs: data.productCosts,
        net_revenue: data.revenue - data.productCosts
      }));
    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase.from('shopify_daily_revenue').upsert(upsertData, {
        onConflict: 'ad_account_id,date'
      });
      if (upsertError) {
        console.error('❌ [SHOPIFY-SYNC] Error upserting revenue:', upsertError.message);
      }
    }
    // 6. Update last_sync_at
    await supabase.from('shopify_configs').update({
      last_sync_at: new Date().toISOString()
    }).eq('id', config.id);
    console.log(`✅ [SHOPIFY-SYNC] Sync completed. ${upsertData.length} days updated.`);
    return new Response(JSON.stringify({
      success: true,
      message: `Sincronização concluída`,
      daysUpdated: upsertData.length,
      totalOrders: orders.length,
      totalRevenue: Object.values(dailyData).reduce((sum, d)=>sum + d.revenue, 0)
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // @ts-ignore
    console.error('❌ [SHOPIFY-SYNC] Fatal error:', error.message);
    return new Response(// @ts-ignore
    JSON.stringify({
      error: 'Erro interno',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
