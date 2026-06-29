import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(instrument("sync-meta-campaigns", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json().catch(() => ({}))
        const { accountId, force, days, datePreset, workspace_id } = body

        console.log('🔄 [SYNC] Iniciando sincronização...')

        // 1. Get access token from fb_connections table
        let connections: any[] = [];

        if (workspace_id) {
            const { data } = await supabase
                .from('fb_connections')
                .select('id, access_token, name, workspace_id')
                .eq('status', 'connected')
                .eq('workspace_id', workspace_id)
                .not('access_token', 'is', null);
            connections = data || [];
        }

        if (connections.length === 0) {
            const { data } = await supabase
                .from('fb_connections')
                .select('id, access_token, name, workspace_id')
                .eq('status', 'connected')
                .is('workspace_id', null)
                .not('access_token', 'is', null)
                .order('created_at', { ascending: false });
            connections = data || [];
        }

        if (connections.length === 0) {
            const { data } = await supabase
                .from('fb_connections')
                .select('id, access_token, name, workspace_id')
                .eq('status', 'connected')
                .not('access_token', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1);
            connections = data || [];
        }

        if (connections.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No active Meta connections found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const accessToken = connections[0].access_token
        console.log(`✅ [SYNC] Token encontrado (${connections[0].name})`)

        // 2. Get ad accounts to sync
        let adAccountIds: string[] = []

        if (accountId) {
            adAccountIds = [accountId.startsWith('act_') ? accountId : `act_${accountId}`]
        } else {
            const accountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}&limit=50`
            const accountsResp = await fetch(accountsUrl)
            const accountsData = await accountsResp.json()

            if (accountsData.error) {
                throw new Error(`Meta API Error: ${accountsData.error.message}`)
            }

            adAccountIds = (accountsData.data || [])
                .filter((acc: any) => acc.account_status === 1)
                .map((acc: any) => acc.id)

            console.log(`📊 [SYNC] ${adAccountIds.length} contas ativas encontradas`)
        }

        if (adAccountIds.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No active ad accounts to sync' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Load ALL clients with their selected_ad_accounts for quick lookup
        const { data: allClients } = await supabase
            .from('agency_clients')
            .select('id, selected_ad_accounts, cartpanda_store_slug, cartpanda_bearer_token, cartpanda_status')
            .not('selected_ad_accounts', 'is', null);

        // Build reverse map: accountId (without act_) → clientId
        const accountToClientMap: Record<string, string> = {};
        for (const client of (allClients || [])) {
            const accounts: string[] = client.selected_ad_accounts || [];
            for (const acc of accounts) {
                // Normalize: strip act_ prefix to match
                const normalized = acc.replace('act_', '');
                accountToClientMap[normalized] = client.id;
            }
        }
        console.log(`🗺️ [SYNC] Mapa de contas: ${Object.keys(accountToClientMap).length} contas mapeadas para ${(allClients || []).length} clientes`)

        const clientDailyMap: Record<string, Record<string, any>> = {};
        const results: any[] = []

        const insightDatePreset = datePreset || (
            days === 1 ? 'today' :
                days === 7 ? 'last_7d' :
                    'last_30d'
        );

        const getConversionActionTypes = (objective: string) => {
            const normalized = (objective || '').toUpperCase()
            if (normalized.includes('SALE') || normalized.includes('PURCHASE')) {
                return ['offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase']
            }
            if (normalized.includes('LEAD')) {
                return ['lead', 'onsite_lead', 'leadgen_grouped']
            }
            return ['offsite_conversion.fb_pixel_purchase', 'purchase', 'lead', 'onsite_lead']
        }

        // 4. For each ad account: fetch campaigns + insights
        for (const actId of adAccountIds) {
            try {
                console.log(`\n📁 [SYNC] Processando conta: ${actId}`)
                const cleanActId = actId.replace('act_', '');
                const clientId = accountToClientMap[cleanActId] || null;

                if (!clientId) {
                    console.log(`⚠️ [SYNC] Conta ${actId} sem cliente vinculado — pulando`)
                    results.push({ account: actId, status: 'skipped', reason: 'no client linked' })
                    continue;
                }

                // 4.1 Fetch campaigns
                const campaignsUrl = `https://graph.facebook.com/v21.0/${actId}/campaigns?fields=id,name,objective,status&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&access_token=${accessToken}&limit=100`
                const campaignsData = await (await fetch(campaignsUrl)).json()

                if (campaignsData.error) {
                    results.push({ account: actId, status: 'error', error: campaignsData.error.message })
                    continue
                }

                const campaigns = campaignsData.data || []
                const campaignObjectiveMap: Record<string, string> = {}
                for (const c of campaigns) {
                    campaignObjectiveMap[c.id] = c.objective;
                    // lightweight upsert campaign
                    await supabase.from('campaigns').upsert({
                        id: c.id, account_id: actId, name: c.name,
                        objective: c.objective, status: c.status,
                        last_updated_at: new Date().toISOString()
                    }, { onConflict: 'id' })
                }

                // 4.2 Fetch insights (daily breakdown for 30 days)
                const insightsUrl = `https://graph.facebook.com/v21.0/${actId}/insights?level=campaign&fields=campaign_id,spend,impressions,clicks,reach,actions,action_values,date_start,date_stop&time_increment=1&date_preset=${insightDatePreset}&access_token=${accessToken}&limit=500`
                const insightsData = await (await fetch(insightsUrl)).json()

                if (insightsData.error) {
                    results.push({ account: actId, status: 'partial', error: insightsData.error.message })
                    continue
                }

                const insights = insightsData.data || []

                // 4.3 Process insights into clientDailyMap (collect, not write yet)
                for (const row of insights) {
                    const campaignObjective = campaignObjectiveMap[row.campaign_id] || 'UNKNOWN'
                    const actionTypes = getConversionActionTypes(campaignObjective)

                    // Revenue: find() = first matching action_value (avoids double-counting)
                    let revenue = 0
                    if (row.action_values && Array.isArray(row.action_values)) {
                        const pv = row.action_values.find((av: any) => actionTypes.includes(av.action_type))
                        if (pv) revenue = parseFloat(pv.value) || 0
                    }

                    // Conversions: find() = take only primary action type (avoid 3x inflation)
                    let conversions = 0
                    if (row.actions && Array.isArray(row.actions)) {
                        const pa = row.actions.find((a: any) => actionTypes.includes(a.action_type))
                        if (pa) conversions = parseInt(pa.value) || 0
                    }

                    const spend = parseFloat(row.spend || '0')
                    const date = row.date_start;

                    if (!clientDailyMap[clientId]) clientDailyMap[clientId] = {};
                    if (!clientDailyMap[clientId][date]) {
                        clientDailyMap[clientId][date] = {
                            spend: 0, impressions: 0, clicks: 0, reach: 0,
                            revenue: 0, orders: 0,
                            sessions: 0, add_to_cart: 0, checkouts_initiated: 0
                        };
                    }
                    const target = clientDailyMap[clientId][date];
                    target.spend += spend;
                    target.impressions += parseInt(row.impressions || '0');
                    target.clicks += parseInt(row.clicks || '0');
                    target.reach += parseInt(row.reach || '0');
                    target.revenue += revenue;
                    target.orders += conversions;

                    // Extract funnel actions
                    if (row.actions && Array.isArray(row.actions)) {
                        for (const act of row.actions) {
                            if (act.action_type === 'landing_page_view') {
                                target.sessions += parseInt(act.value) || 0;
                            } else if (act.action_type === 'add_to_cart') {
                                target.add_to_cart += parseInt(act.value) || 0;
                            } else if (act.action_type === 'initiate_checkout') {
                                target.checkouts_initiated += parseInt(act.value) || 0;
                            }
                        }
                    }
                }

                console.log(`✅ [SYNC] Conta ${actId}: ${campaigns.length} campanhas, ${insights.length} insights → cliente ${clientId}`)
                results.push({ account: actId, status: 'synced', campaigns_count: campaigns.length, insights_count: insights.length, client_id: clientId })

            } catch (err: any) {
                console.error(`❌ [SYNC] Erro conta ${actId}:`, err)
                results.push({ account: actId, status: 'error', error: err.message })
            }
        }

        // 5. Write aggregated data per client — BULK inserts instead of row-by-row
        for (const [clientId, dailyData] of Object.entries(clientDailyMap)) {
            try {
                const dates = Object.keys(dailyData).sort();
                if (dates.length === 0) continue;

                const minDate = dates[0];
                const maxDate = dates[dates.length - 1];

                console.log(`\n🎯 [SYNC] Escrevendo métricas para cliente: ${clientId} (${dates.length} dias)`);

                // Delete ALL old rows for this client (clears any inflated data from old syncs)
                await supabase
                    .from('client_daily_metrics')
                    .delete()
                    .eq('client_id', clientId);

                // Bulk insert all rows at once (much faster than row-by-row)
                const rows = Object.entries(dailyData).map(([date, metrics]: [string, any]) => ({
                    client_id: clientId,
                    date,
                    spend: metrics.spend,
                    impressions: metrics.impressions,
                    clicks: metrics.clicks,
                    reach: metrics.reach,
                    revenue: metrics.revenue,
                    orders: metrics.orders,
                    sessions: metrics.sessions,
                    add_to_cart: metrics.add_to_cart,
                    checkouts_initiated: metrics.checkouts_initiated,
                    updated_at: new Date().toISOString()
                }));

                const { error: bulkErr } = await supabase
                    .from('client_daily_metrics')
                    .insert(rows);

                if (bulkErr) {
                    console.error(`❌ [SYNC] Bulk insert error for ${clientId}:`, bulkErr.message);
                    // Fallback: upsert row by row
                    for (const row of rows) {
                        await supabase.from('client_daily_metrics').upsert(row, { onConflict: 'client_id,date' });
                    }
                }

                console.log(`✅ [SYNC] Meta data written for ${clientId} (${rows.length} rows)`);

                // 5.1 CartPanda integration — only for connected clients
                const clientRecord = (allClients || []).find((c: any) => c.id === clientId);
                if (clientRecord?.cartpanda_status === 'connected' && clientRecord.cartpanda_store_slug && clientRecord.cartpanda_bearer_token) {
                    try {
                        console.log(`🛒 [SYNC] Buscando CartPanda para ${clientId}...`);
                        const cpUrl = `https://accounts.cartpanda.com/api/${clientRecord.cartpanda_store_slug}/orders?page=1&limit=250&per_page=250`;
                        const cpResp = await fetch(cpUrl, {
                            headers: { 'Authorization': `Bearer ${clientRecord.cartpanda_bearer_token}`, 'Content-Type': 'application/json' }
                        });

                        if (cpResp.ok) {
                            const cpJson = await cpResp.json();
                            const allOrders = cpJson.orders || cpJson.data || [];
                            const cpDaily: Record<string, { revenue: number; approved: number; total: number }> = {};

                            for (const order of allOrders) {
                                const orderDate = (order.created_at || order.confirmed_at || '').split('T')[0];
                                if (!orderDate || orderDate < minDate || orderDate > maxDate) continue;
                                if (!cpDaily[orderDate]) cpDaily[orderDate] = { revenue: 0, approved: 0, total: 0 };
                                cpDaily[orderDate].total += 1;
                                const status = (order.payment_status || order.financial_status || '').toLowerCase();
                                if (status === 'approved' || status === 'paid' || status === 'captured') {
                                    cpDaily[orderDate].approved += 1;
                                    cpDaily[orderDate].revenue += parseFloat(order.total_price || order.total || '0');
                                }
                            }

                            // Update existing rows with CartPanda data (don't overwrite Meta fields)
                            for (const [date, m] of Object.entries(cpDaily)) {
                                await supabase
                                    .from('client_daily_metrics')
                                    .update({
                                        cartpanda_revenue: m.revenue,
                                        cartpanda_orders: m.approved,
                                        approved_transactions: m.approved,
                                        transaction_count: m.total,
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('client_id', clientId)
                                    .eq('date', date);
                            }
                            console.log(`✅ [SYNC] CartPanda synced for ${clientId}: ${Object.keys(cpDaily).length} days`);
                        }
                    } catch (cpErr: any) {
                        console.warn(`⚠️ [SYNC] CartPanda error for ${clientId}:`, cpErr.message);
                    }
                }

            } catch (clientErr: any) {
                console.error(`❌ [SYNC] Error writing client ${clientId}:`, clientErr.message);
            }
        }

        console.log('\n✅ [SYNC] Sincronização concluída!')

        return new Response(
            JSON.stringify({
                success: true,
                results,
                clients_synced: Object.keys(clientDailyMap).length,
                accounts_checked: adAccountIds.length,
                accounts_linked: results.filter(r => r.status === 'synced').length,
                synced_at: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('❌ [SYNC] Erro fatal:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}));
