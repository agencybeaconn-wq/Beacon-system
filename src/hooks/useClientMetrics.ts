import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { getFxRate } from '@/lib/fxRates';

export interface ClientMetrics {
    totalSpend: number;
    totalConversions: number;
    totalConversionValue: number;
    totalImpressions: number;
    totalClicks: number;
    totalReach: number;
    totalAddToCart: number;
    totalInitiateCheckout: number;
    totalPageViews: number;
    roas: number;
    cpc: number;
    ctr: number;
    cpa: number;
}

export interface DailyBreakdown {
    date: string; // YYYY-MM-DD
    spend: number;
    revenue: number;
    conversions: number;
}

interface UseClientMetricsOptions {
    clientId: string | null;
    datePreset?: 'last_7d' | 'last_30d' | 'this_month' | 'today';
    startDate?: string;
    endDate?: string;
}

const INITIAL_METRICS: ClientMetrics = {
    totalSpend: 0,
    totalConversions: 0,
    totalConversionValue: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalReach: 0,
    totalAddToCart: 0,
    totalInitiateCheckout: 0,
    totalPageViews: 0,
    roas: 0,
    cpc: 0,
    ctr: 0,
    cpa: 0,
};

// Helper: determine which action types count as conversions based on campaign objective
function getConversionActionTypes(objective: string): string[] {
    const normalized = (objective || '').toUpperCase();
    if (normalized.includes('SALE') || normalized.includes('PURCHASE')) {
        return ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'];
    }
    if (normalized.includes('LEAD')) {
        return ['lead', 'onsite_lead', 'leadgen_grouped'];
    }
    return ['purchase', 'omni_purchase', 'lead', 'onsite_lead'];
}

// Helper: extract a specific action count from Meta's actions array
function getActionCount(actions: any[] | undefined, actionType: string): number {
    if (!actions) return 0;
    const found = actions.find((a: any) => a.action_type === actionType);
    return found ? parseInt(found.value) || 0 : 0;
}

export function useClientMetrics({ clientId, datePreset = 'last_7d', startDate, endDate }: UseClientMetricsOptions) {
    const { clientData: contextClientData, workspaceId } = useDashboard();
    const [metrics, setMetrics] = useState<ClientMetrics>(INITIAL_METRICS);
    const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);

    const fetchMetrics = useCallback(async () => {
        if (!clientId) {
            setMetrics(INITIAL_METRICS);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Get client's selected ad accounts
            let adAccountIds: string[] = [];

            if (contextClientData && contextClientData.id === clientId) {
                adAccountIds = contextClientData.selected_ad_accounts || [];
            } else {
                const { data, error: clientError } = await (supabase as any)
                    .from('agency_clients')
                    .select('selected_ad_accounts')
                    .eq('id', clientId)
                    .single();

                if (clientError) throw clientError;
                adAccountIds = data?.selected_ad_accounts || [];
            }

            if (adAccountIds.length === 0) {
                console.log('[useClientMetrics] No ad accounts linked to client');
                setMetrics(INITIAL_METRICS);
                setIsLoading(false);
                return;
            }

            // 2. Get access token from fb_connections (3-tier fallback)
            let connections: any[] = [];

            // Tier 1: workspace-specific
            if (workspaceId) {
                const { data } = await (supabase as any)
                    .from('fb_connections')
                    .select('access_token')
                    .eq('status', 'connected')
                    .eq('workspace_id', workspaceId)
                    .not('access_token', 'is', null)
                    .limit(1);
                connections = data || [];
            }

            // Tier 2: global (null workspace)
            if (connections.length === 0) {
                const { data } = await (supabase as any)
                    .from('fb_connections')
                    .select('access_token')
                    .eq('status', 'connected')
                    .is('workspace_id', null)
                    .not('access_token', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1);
                connections = data || [];
            }

            // Tier 3: any connected
            if (connections.length === 0) {
                const { data } = await (supabase as any)
                    .from('fb_connections')
                    .select('access_token')
                    .eq('status', 'connected')
                    .not('access_token', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1);
                connections = data || [];
            }

            if (!connections || connections.length === 0 || !connections[0].access_token) {
                setError('Nenhuma conexão Meta ativa encontrada');
                setMetrics(INITIAL_METRICS);
                setIsLoading(false);
                return;
            }

            const accessToken = connections[0].access_token;
            console.log('[useClientMetrics] ✅ Token found, fetching insights for', adAccountIds.length, 'ad account(s)');

            // 3. Call Meta Graph API directly (no Edge Function needed)
            let timeRangeParam = '';
            if (startDate && endDate) {
                const s = startDate.split(' ')[0];
                const e = endDate.split(' ')[0];
                timeRangeParam = `&time_range=${encodeURIComponent(JSON.stringify({ since: s, until: e }))}`;
            } else {
                timeRangeParam = `&date_preset=${datePreset || 'last_7d'}`;
            }

            // `account_currency` vem do Meta na moeda em que a conta paga ads (USD pra
             // Brasileiríssimo, BRL pras BR). `spend` e `action_values.value` vêm na
             // mesma moeda — convertemos pra BRL via getFxRate antes de somar pra evitar
             // misturar moedas no agregado de múltiplas ad accounts do mesmo cliente.
            const fields = 'campaign_id,campaign_name,objective,spend,impressions,clicks,reach,actions,action_values,account_currency';

            // Fetch insights for each ad account in parallel
            const accountResults = await Promise.all(
                adAccountIds.map(async (accountId) => {
                    try {
                        const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
                        const url = `https://graph.facebook.com/v21.0/${formattedId}/insights?level=campaign&fields=${fields}${timeRangeParam}&access_token=${accessToken}`;

                        console.log(`[useClientMetrics] Fetching insights for ${formattedId}...`);
                        const response = await fetch(url);
                        const data = await response.json();

                        if (data.error) {
                            console.error(`[useClientMetrics] Meta API error for ${formattedId}:`, data.error.message);
                            return { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0, addToCart: 0, initiateCheckout: 0, pageViews: 0 };
                        }

                        let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalReach = 0;
                        let totalConversions = 0, totalValue = 0;
                        let totalAddToCart = 0, totalInitiateCheckout = 0;
                        let totalPageViews = 0;
                        let accountCurrency = 'BRL';

                        (data.data || []).forEach((row: any) => {
                            const actionTypes = getConversionActionTypes(row.objective);
                            // Captura a moeda da ad account (mesma em todas as rows; última escrita serve)
                            if (row.account_currency) accountCurrency = String(row.account_currency).toUpperCase();

                            totalSpend += parseFloat(row.spend) || 0;
                            totalImpressions += parseInt(row.impressions) || 0;
                            totalClicks += parseInt(row.clicks) || 0;
                            totalReach += parseInt(row.reach) || 0;

                            // Extract funnel actions from Meta pixel
                            totalAddToCart += getActionCount(row.actions, 'add_to_cart');
                            totalPageViews += getActionCount(row.actions, 'landing_page_view');
                            totalInitiateCheckout += getActionCount(row.actions, 'initiate_checkout');

                            // IMPORTANT: Meta reports the same conversion under multiple action_types
                            // (purchase, omni_purchase, offsite_conversion.fb_pixel_purchase).
                            // We must pick ONLY the best one to avoid double/triple counting.
                            if (row.actions) {
                                let foundConversions = false;
                                for (const actionType of actionTypes) {
                                    const count = getActionCount(row.actions, actionType);
                                    if (count > 0 && !foundConversions) {
                                        totalConversions += count;
                                        foundConversions = true;
                                        break;
                                    }
                                }
                            }

                            if (row.action_values) {
                                let foundValue = false;
                                for (const actionType of actionTypes) {
                                    const found = row.action_values.find((a: any) => a.action_type === actionType);
                                    if (found && !foundValue) {
                                        totalValue += parseFloat(found.value) || 0;
                                        foundValue = true;
                                        break;
                                    }
                                }
                            }
                        });

                        // Converte spend e conversionValue pra BRL (Meta retorna na moeda da conta)
                        const fx = accountCurrency === 'BRL' ? 1 : await getFxRate(accountCurrency);
                        const spendBRL = totalSpend * fx;
                        const conversionValueBRL = totalValue * fx;

                        console.log(`[useClientMetrics] ✅ ${formattedId}: spend=${totalSpend} ${accountCurrency} → R$ ${spendBRL.toFixed(2)} (fx=${fx}), clicks=${totalClicks}`);
                        return {
                            spend: spendBRL,
                            impressions: totalImpressions,
                            clicks: totalClicks,
                            reach: totalReach,
                            conversions: totalConversions,
                            conversionValue: conversionValueBRL,
                            addToCart: totalAddToCart,
                            initiateCheckout: totalInitiateCheckout,
                            pageViews: totalPageViews,
                            _accountCurrency: accountCurrency,
                            _fxRate: fx,
                        };
                    } catch (err: any) {
                        console.error(`[useClientMetrics] Error fetching ${accountId}:`, err);
                        return { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0, addToCart: 0, initiateCheckout: 0, pageViews: 0 };
                    }
                })
            );

            // Aggregate all account results
            const totals = accountResults.reduce((acc, r) => ({
                totalSpend: acc.totalSpend + r.spend,
                totalImpressions: acc.totalImpressions + r.impressions,
                totalClicks: acc.totalClicks + r.clicks,
                totalReach: acc.totalReach + r.reach,
                totalConversions: acc.totalConversions + r.conversions,
                totalConversionValue: acc.totalConversionValue + r.conversionValue,
                totalAddToCart: acc.totalAddToCart + r.addToCart,
                totalInitiateCheckout: acc.totalInitiateCheckout + r.initiateCheckout,
                totalPageViews: acc.totalPageViews + r.pageViews,
            }), { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalReach: 0, totalConversions: 0, totalConversionValue: 0, totalAddToCart: 0, totalInitiateCheckout: 0, totalPageViews: 0 });

            // Calculate derived metrics
            const roas = totals.totalSpend > 0 ? totals.totalConversionValue / totals.totalSpend : 0;
            const cpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
            const ctr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
            const cpa = totals.totalConversions > 0 ? totals.totalSpend / totals.totalConversions : 0;

            setMetrics({
                totalSpend: totals.totalSpend,
                totalConversions: totals.totalConversions,
                totalConversionValue: totals.totalConversionValue,
                totalImpressions: totals.totalImpressions,
                totalClicks: totals.totalClicks,
                totalReach: totals.totalReach,
                totalAddToCart: totals.totalAddToCart,
                totalInitiateCheckout: totals.totalInitiateCheckout,
                totalPageViews: totals.totalPageViews,
                roas,
                cpc,
                ctr,
                cpa,
            });

            setLastFetched(new Date());
            console.log('[useClientMetrics] ✅ Metrics loaded:', totals);

            // === DAILY BREAKDOWN: Second API call with time_increment=1 ===
            // Reusa o accountResults pra saber a moeda+fx_rate de cada ad account
            // (evita re-fetch dos fx rates — já estão em memória via getFxRate cache).
            const fxByAccountIdx = new Map<number, number>();
            accountResults.forEach((r: any, idx) => {
                fxByAccountIdx.set(idx, r._fxRate ?? 1);
            });

            try {
                const dailyResults = await Promise.all(
                    adAccountIds.map(async (accountId, idx) => {
                        try {
                            const formattedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
                            const dailyFields = 'spend,actions,action_values';
                            const url = `https://graph.facebook.com/v21.0/${formattedId}/insights?fields=${dailyFields}&time_increment=1${timeRangeParam}&access_token=${accessToken}&limit=500`;
                            const fx = fxByAccountIdx.get(idx) ?? 1;

                            console.log(`[useClientMetrics] Fetching daily breakdown for ${formattedId}... (fx=${fx})`);
                            const response = await fetch(url);
                            const data = await response.json();

                            if (data.error) {
                                console.error(`[useClientMetrics] Daily API error for ${formattedId}:`, data.error.message);
                                return [] as DailyBreakdown[];
                            }

                            return (data.data || []).map((row: any) => {
                                const daySpend = parseFloat(row.spend) || 0;

                                // Extract revenue (same dedup logic as totals)
                                let dayRevenue = 0;
                                if (row.action_values) {
                                    const revenueTypes = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
                                    for (const actionType of revenueTypes) {
                                        const found = row.action_values.find((a: any) => a.action_type === actionType);
                                        if (found) {
                                            dayRevenue = parseFloat(found.value) || 0;
                                            break;
                                        }
                                    }
                                }

                                // Extract conversions (same dedup logic)
                                let dayConversions = 0;
                                if (row.actions) {
                                    const convTypes = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
                                    for (const actionType of convTypes) {
                                        const count = getActionCount(row.actions, actionType);
                                        if (count > 0) {
                                            dayConversions = count;
                                            break;
                                        }
                                    }
                                }

                                // Aplica FX → BRL (mesma cotação do bloco principal)
                                return {
                                    date: row.date_start?.split('T')[0] || '',
                                    spend: daySpend * fx,
                                    revenue: dayRevenue * fx,
                                    conversions: dayConversions,
                                } as DailyBreakdown;
                            });
                        } catch (err) {
                            console.error(`[useClientMetrics] Daily error for ${accountId}:`, err);
                            return [] as DailyBreakdown[];
                        }
                    })
                );

                // Aggregate daily data across all ad accounts
                const allDaily = dailyResults.flat();
                const dailyMap: Record<string, DailyBreakdown> = {};
                allDaily.forEach(d => {
                    if (!d.date) return;
                    if (!dailyMap[d.date]) {
                        dailyMap[d.date] = { date: d.date, spend: 0, revenue: 0, conversions: 0 };
                    }
                    dailyMap[d.date].spend += d.spend;
                    dailyMap[d.date].revenue += d.revenue;
                    dailyMap[d.date].conversions += d.conversions;
                });

                const sortedDaily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
                setDailyBreakdown(sortedDaily);
                console.log(`[useClientMetrics] ✅ Daily breakdown loaded: ${sortedDaily.length} days`);
            } catch (dailyErr) {
                console.error('[useClientMetrics] Daily breakdown error:', dailyErr);
                setDailyBreakdown([]);
            }

        } catch (err: any) {
            console.error('[useClientMetrics] Error:', err);
            setError(err.message || 'Erro ao buscar métricas');
            setMetrics(INITIAL_METRICS);
        } finally {
            setIsLoading(false);
        }
    }, [clientId, datePreset, startDate, endDate, contextClientData, workspaceId]);

    // Fetch on mount and when dependencies change
    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    return {
        metrics,
        dailyBreakdown,
        isLoading,
        error,
        lastFetched,
        refetch: fetchMetrics
    };
}
