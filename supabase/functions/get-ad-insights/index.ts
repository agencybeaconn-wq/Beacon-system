import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface InsightsRequest {
    accessToken?: string
    workspaceId?: string     // Workspace context for fetching the right connection
    adAccountIds: string[]  // Array of ad account IDs (without 'act_' prefix)
    datePreset?: string     // e.g., 'last_7d', 'last_30d', 'this_month'
    startDate?: string      // YYYY-MM-DD format
    endDate?: string        // YYYY-MM-DD format
}

// @ts-ignore
Deno.serve(instrument("get-ad-insights", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        let { accessToken, workspaceId, adAccountIds, datePreset, startDate, endDate }: InsightsRequest = await req.json()

        // If no access token provided, fetch from fb_connections
        if (!accessToken) {
            const supabase = createClient(
                // @ts-ignore
                Deno.env.get('SUPABASE_URL') ?? '',
                // @ts-ignore
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )

            let connections = [];

            if (workspaceId) {
                console.log(`🔑 [get-ad-insights] Fetching token for workspace: ${workspaceId}`);
                const { data } = await supabase
                    .from('fb_connections')
                    .select('access_token')
                    .eq('status', 'connected')
                    .eq('workspace_id', workspaceId)
                    .not('access_token', 'is', null);
                connections = data || [];
            }

            // Fallback 1: Global connections (null workspace)
            if (connections.length === 0) {
                console.log('🔑 [get-ad-insights] No workspace connection found, searching for global (null workspace)');
                const { data } = await supabase
                    .from('fb_connections')
                    .select('access_token')
                    .eq('status', 'connected')
                    .is('workspace_id', null)
                    .not('access_token', 'is', null)
                    .order('created_at', { ascending: false });
                connections = data || [];
            }

            // Fallback 2: Most recent regardless of workspace
            if (connections.length === 0) {
                console.log('🔑 [get-ad-insights] Taking most recent active connection regardless of workspace');
                const { data } = await supabase
                    .from('fb_connections')
                    .select('access_token')
                    .eq('status', 'connected')
                    .not('access_token', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1);
                connections = data || [];
            }

            if (!connections || connections.length === 0 || !connections[0].access_token) {
                throw new Error(`No active Meta connection found`)
            }

            accessToken = connections[0].access_token
            console.log('🔑 [get-ad-insights] Token fetched from fb_connections')
        }

        if (!adAccountIds || adAccountIds.length === 0) {
            return new Response(
                JSON.stringify({
                    totalSpend: 0,
                    totalConversions: 0,
                    totalImpressions: 0,
                    totalClicks: 0,
                    totalReach: 0,
                    accounts: []
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Build date range params with proper truncation and encoding
        let timeRange = ''
        if (startDate && endDate) {
            // Meta API time_range keys 'since' and 'until' MUST be YYYY-MM-DD
            const s = startDate.split(' ')[0]
            const e = endDate.split(' ')[0]
            const timeRangeObj = JSON.stringify({ since: s, until: e })
            timeRange = `&time_range=${encodeURIComponent(timeRangeObj)}`
            console.log(`📅 [get-ad-insights] Using time_range: ${timeRangeObj}`)
        } else {
            // Default to last 7 days
            const preset = datePreset || 'last_7d'
            timeRange = `&date_preset=${preset}`
            console.log(`📅 [get-ad-insights] Using date_preset: ${preset}`)
        }

        // Fields to fetch
        const fields = 'campaign_id,campaign_name,objective,spend,impressions,clicks,reach,actions,action_values'

        // Fetch insights for each ad account
        const accountInsights = await Promise.all(
            adAccountIds.map(async (accountId) => {
                try {
                    // Ensure account ID has 'act_' prefix
                    const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`

                    // level=campaign is needed to get objective and campaign_id
                    const url = `https://graph.facebook.com/v21.0/${formattedId}/insights?level=campaign&fields=${fields}${timeRange}&access_token=${accessToken}`

                    const response = await fetch(url)
                    const data = await response.json()

                    if (data.error) {
                        console.error(`Error for account ${accountId}:`, data.error)
                        return { accountId, error: data.error.message, spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0 }
                    }

                    // Process insights data (aggregate all campaigns)
                    let totalSpend = 0
                    let totalImpressions = 0
                    let totalClicks = 0
                    let totalReach = 0
                    let totalConversions = 0
                    let totalValue = 0

                    const getConversionActionTypes = (objective: string) => {
                        const normalized = (objective || '').toUpperCase()
                        if (normalized.includes('SALE') || normalized.includes('PURCHASE')) {
                            return ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']
                        }
                        if (normalized.includes('LEAD')) {
                            return ['lead', 'onsite_lead', 'leadgen_grouped']
                        }
                        return ['purchase', 'omni_purchase', 'lead', 'onsite_lead']
                    }

                    (data.data || []).forEach((row: any) => {
                        const actionTypes = getConversionActionTypes(row.objective)

                        totalSpend += parseFloat(row.spend) || 0
                        totalImpressions += parseInt(row.impressions) || 0
                        totalClicks += parseInt(row.clicks) || 0
                        totalReach += parseInt(row.reach) || 0

                        if (row.actions) {
                            totalConversions += row.actions
                                .filter((a: any) => actionTypes.includes(a.action_type))
                                .reduce((acc: number, curr: any) => acc + (parseInt(curr.value) || 0), 0)
                        }

                        if (row.action_values) {
                            totalValue += row.action_values
                                .filter((a: any) => actionTypes.includes(a.action_type))
                                .reduce((acc: number, curr: any) => acc + (parseFloat(curr.value) || 0), 0)
                        }
                    })

                    return {
                        accountId,
                        spend: totalSpend,
                        impressions: totalImpressions,
                        clicks: totalClicks,
                        reach: totalReach,
                        conversions: totalConversions,
                        conversionValue: totalValue
                    }
                } catch (error: any) {
                    console.error(`Error fetching insights for ${accountId}:`, error)
                    return { accountId, error: error.message, spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0 }
                }
            })
        )

        // Calculate totals
        const totals = accountInsights.reduce((acc, account) => ({
            totalSpend: acc.totalSpend + account.spend,
            totalImpressions: acc.totalImpressions + account.impressions,
            totalClicks: acc.totalClicks + account.clicks,
            totalReach: acc.totalReach + account.reach,
            totalConversions: acc.totalConversions + account.conversions,
            totalConversionValue: acc.totalConversionValue + account.conversionValue
        }), {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalReach: 0,
            totalConversions: 0,
            totalConversionValue: 0
        })

        return new Response(
            JSON.stringify({
                ...totals,
                accounts: accountInsights,
                dateRange: {
                    preset: datePreset || 'last_7d',
                    startDate,
                    endDate
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('get-ad-insights error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}));
