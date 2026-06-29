import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { ClientClassification, classifyClient, ClientMetrics, calculateHealthScore, HealthScoreResult, ScoreDetail } from '@/utils/smartDataLogic';
import { getFxRate } from '@/lib/fxRates';
import { toast } from 'sonner';

export type SmartDataPeriod = 'today' | '7d' | '30d' | 'month';

export interface SmartClient extends ClientMetrics {
    id: string;
    name: string;
    status: ClientClassification['status'] | 'SEM DADOS';
    score: number;
    healthScore: HealthScoreResult;
    classification: ClientClassification;
    metrics: ClientMetrics;
    lastUpdated: string | null;
}

export interface SmartDataSummary {
    totalInvested: number;
    totalRevenue: number;
    totalProfit: number;
    totalCommission: number;
    activeClients: number;
    avgRoas: number;
}

function getDateRange(period: SmartDataPeriod): { from: string; to: string; label: string } {
    const today = new Date();
    const toStr = today.toISOString().split('T')[0];

    if (period === 'today') {
        return { from: toStr, to: toStr, label: 'Hoje' };
    }
    if (period === '7d') {
        const from = new Date(today);
        from.setDate(from.getDate() - 6);
        return { from: from.toISOString().split('T')[0], to: toStr, label: 'Últimos 7 dias' };
    }
    if (period === 'month') {
        const from = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: from.toISOString().split('T')[0], to: toStr, label: 'Este mês' };
    }
    // default: 30d
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: from.toISOString().split('T')[0], to: toStr, label: 'Últimos 30 dias' };
}

export function useSmartDataV2() {
    const { workspaceId, clients: contextClients, isLoadingClients: contextIsLoading } = useDashboard();
    const [period, setPeriod] = useState<SmartDataPeriod>('30d');
    const [clients, setClients] = useState<SmartClient[]>([]);
    const [summary, setSummary] = useState<SmartDataSummary>({
        totalInvested: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalCommission: 0,
        activeClients: 0,
        avgRoas: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingLive, setIsLoadingLive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Phase 1: Fast load from cached scores (instant)
    const loadCachedScores = useCallback(async () => {
        if (contextIsLoading) return;

        const mrrClients = (contextClients || []).filter((c: any) => c.fee_fixed && c.fee_fixed > 0);

        if (mrrClients.length === 0) {
            setClients([]);
            setSummary({ totalInvested: 0, totalRevenue: 0, totalProfit: 0, totalCommission: 0, activeClients: 0, avgRoas: 0 });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const clientIds = mrrClients.map((c: any) => c.id);
            let scoresMap: Record<string, any> = {};
            try {
                const { data: scoresData } = await (supabase as any)
                    .from('client_latest_scores')
                    .select('*')
                    .in('client_id', clientIds);
                if (scoresData) {
                    scoresData.forEach((s: any) => { scoresMap[s.client_id] = s; });
                }
            } catch (e) {
                console.warn('[useSmartDataV2] No scores table:', e);
            }

            // Build clients with score data only (no live metrics yet)
            const smartClients: SmartClient[] = mrrClients.map((c: any) => {
                const scoreData = scoresMap[c.id] || {};
                const emptyMetrics: ClientMetrics = {
                    cpc: 0, ctr: 0, cpm: 0, frequency: 1, reach: 0, spend: 0,
                    sessions: 0, orders: 0, addToCart: 0, initiateCheckout: 0,
                    impressions: 0, clicks: 0,
                    taxaConversaoSite: 0, taxaAddToCart: 0, taxaCheckout: 0, taxaFinalizacao: 0, abandonoCarrinho: 0,
                    taxaAprovacao: 0, chargebackRate: 0, pixApprovalRate: 0,
                    roas: 0, cpa: 0, margemContribuicao: 0, lucroPorPedido: 0, faturamento: 0, lucro: 0
                };

                let healthScore: HealthScoreResult;
                let classificationObj: ClientClassification;

                if (scoreData.total_score != null) {
                    healthScore = {
                        total: Number(scoreData.total_score),
                        detalhes: (scoreData.score_details as ScoreDetail) || { trafego: 0, conversao: 0, aprovacao: 0, lucratividade: 0 }
                    };
                    classificationObj = classifyClient(healthScore.total);
                    if (scoreData.status) classificationObj.status = scoreData.status;
                } else {
                    healthScore = { total: 0, detalhes: { trafego: 0, conversao: 0, aprovacao: 0, lucratividade: 0 } };
                    classificationObj = {
                        status: 'SEM DADOS', emoji: '', cor: '#94a3b8',
                        acao: 'Aguardando dados', urgencia: '-', descricao: 'Sem dados para este período.'
                    } as any;
                }

                return {
                    id: c.id, name: c.name,
                    status: (classificationObj.status as any),
                    score: healthScore.total,
                    healthScore, classification: classificationObj, metrics: emptyMetrics,
                    ...emptyMetrics,
                    lastUpdated: scoreData.last_calculated_at || null
                };
            });

            setClients(smartClients);
            setIsLoading(false);
        } catch (err: any) {
            console.error('[useSmartDataV2] Error loading scores:', err);
            setIsLoading(false);
        }
    }, [contextClients, contextIsLoading]);

    // Phase 2: Live data from Meta API + CartPanda (slow)
    const fetchData = useCallback(async (overridePeriod?: SmartDataPeriod) => {
        if (contextIsLoading) return;

        const activePeriod = overridePeriod || period;
        const { from: dateFrom, to: dateTo } = getDateRange(activePeriod);

        const mrrClients = (contextClients || []).filter((c: any) => c.fee_fixed && c.fee_fixed > 0);

        if (mrrClients.length === 0) return;

        setIsLoadingLive(true);
        setError(null);

        try {
            const clientIds = mrrClients.map((c: any) => c.id);

            // 1. Fetch Latest Scores
            let scoresMap: Record<string, any> = {};
            try {
                const { data: scoresData } = await (supabase as any)
                    .from('client_latest_scores')
                    .select('*')
                    .in('client_id', clientIds);
                if (scoresData) {
                    scoresData.forEach((s: any) => { scoresMap[s.client_id] = s; });
                }
            } catch (e) {
                console.warn('[useSmartDataV2] No scores table:', e);
            }

            // 2. Get Meta access token (same 3-tier fallback as useClientMetrics)
            let accessToken = '';
            try {
                let connections: any[] = [];
                if (workspaceId) {
                    const { data } = await (supabase as any).from('fb_connections').select('access_token')
                        .eq('status', 'connected').eq('workspace_id', workspaceId).not('access_token', 'is', null).limit(1);
                    connections = data || [];
                }
                if (connections.length === 0) {
                    const { data } = await (supabase as any).from('fb_connections').select('access_token')
                        .eq('status', 'connected').is('workspace_id', null).not('access_token', 'is', null).order('created_at', { ascending: false }).limit(1);
                    connections = data || [];
                }
                if (connections.length === 0) {
                    const { data } = await (supabase as any).from('fb_connections').select('access_token')
                        .eq('status', 'connected').not('access_token', 'is', null).order('created_at', { ascending: false }).limit(1);
                    connections = data || [];
                }
                accessToken = connections[0]?.access_token || '';
            } catch (e) {
                console.warn('[useSmartDataV2] Failed to get Meta token:', e);
            }

            // Helpers (same as useClientMetrics)
            const getConvActionTypes = (objective: string): string[] => {
                const n = (objective || '').toUpperCase();
                if (n.includes('SALE') || n.includes('PURCHASE')) return ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'];
                if (n.includes('LEAD')) return ['lead', 'onsite_lead', 'leadgen_grouped'];
                return ['purchase', 'omni_purchase', 'lead', 'onsite_lead'];
            };
            const getActionCount = (actions: any[] | undefined, type: string): number => {
                if (!actions) return 0;
                const f = actions.find((a: any) => a.action_type === type);
                return f ? parseInt(f.value) || 0 : 0;
            };

            const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });

            // 3. Fetch REAL data per client — Meta API direct + CartPanda
            let metricsMap: Record<string, any> = {};

            const clientPromises = mrrClients.map(async (c: any) => {
                const result: any = {
                    spend: 0, impressions: 0, clicks: 0, revenue: 0, reach: 0,
                    sessions: 0, orders: 0, add_to_cart: 0, checkouts_initiated: 0,
                    approved_transactions: 0, transaction_count: 0, chargebacks: 0,
                    product_costs: 0, total_tax_fees: 0,
                    cartpanda_revenue: 0, cartpanda_orders: 0,
                    currency: 'BRL', fx_rate: 1,
                };

                // 3a. META: Call Graph API for each ad account (same as dashboard)
                const adAccounts: string[] = c.selected_ad_accounts || [];
                if (accessToken && adAccounts.length > 0) {
                    try {
                        const fields = 'campaign_id,campaign_name,objective,spend,impressions,clicks,reach,actions,action_values,account_currency';
                        const accountResults = await Promise.all(
                            adAccounts.map(async (accId: string) => {
                                try {
                                    const fmtId = accId.startsWith('act_') ? accId : `act_${accId}`;
                                    const url = `https://graph.facebook.com/v21.0/${fmtId}/insights?level=campaign&fields=${fields}&time_range=${encodeURIComponent(timeRange)}&access_token=${accessToken}&limit=500`;
                                    const resp = await fetch(url);
                                    const data = await resp.json();
                                    if (data.error) {
                                        console.warn(`[useSmartDataV2] Meta error for ${fmtId}:`, data.error.message);
                                        return { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0, addToCart: 0, initiateCheckout: 0, currency: 'BRL' };
                                    }

                                    let s = 0, imp = 0, cl = 0, re = 0, conv = 0, val = 0, atc = 0, ic = 0;
                                    let currency = 'BRL';
                                    (data.data || []).forEach((row: any) => {
                                        if (row.account_currency) currency = row.account_currency;
                                        const actionTypes = getConvActionTypes(row.objective);
                                        s += parseFloat(row.spend) || 0;
                                        imp += parseInt(row.impressions) || 0;
                                        cl += parseInt(row.clicks) || 0;
                                        re += parseInt(row.reach) || 0;
                                        atc += getActionCount(row.actions, 'add_to_cart');
                                        ic += getActionCount(row.actions, 'initiate_checkout');

                                        // Conversions: pick ONLY the first matching action type (avoid double counting)
                                        if (row.actions) {
                                            for (const at of actionTypes) {
                                                const count = getActionCount(row.actions, at);
                                                if (count > 0) { conv += count; break; }
                                            }
                                        }
                                        // Revenue: pick ONLY the first matching action_value
                                        if (row.action_values) {
                                            for (const at of actionTypes) {
                                                const found = row.action_values.find((a: any) => a.action_type === at);
                                                if (found) { val += parseFloat(found.value) || 0; break; }
                                            }
                                        }
                                    });
                                    return { spend: s, impressions: imp, clicks: cl, reach: re, conversions: conv, conversionValue: val, addToCart: atc, initiateCheckout: ic, currency };
                                } catch { return { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, conversionValue: 0, addToCart: 0, initiateCheckout: 0, currency: 'BRL' }; }
                            })
                        );

                        // Detecta moeda dominante da conta (primeira não-BRL com dados)
                        let detectedCurrency = 'BRL';
                        for (const r of accountResults) {
                            if (r.currency && r.currency !== 'BRL' && (r.spend > 0 || r.conversionValue > 0)) {
                                detectedCurrency = r.currency;
                                break;
                            }
                        }

                        // Cotação → BRL (1 se já está em BRL)
                        const fxRate = await getFxRate(detectedCurrency);
                        result.currency = detectedCurrency;
                        result.fx_rate = fxRate;

                        // Aggregate all accounts for this client — convertendo valores monetários pra BRL
                        for (const r of accountResults) {
                            result.spend += r.spend * fxRate;
                            result.impressions += r.impressions;
                            result.clicks += r.clicks;
                            result.reach += r.reach;
                            result.orders += r.conversions;
                            result.revenue += r.conversionValue * fxRate;
                            result.add_to_cart += r.addToCart;
                            result.checkouts_initiated += r.initiateCheckout;
                        }
                    } catch (metaErr: any) {
                        console.warn(`[useSmartDataV2] Meta fetch error for ${c.name}:`, metaErr.message);
                    }
                }

                // 3b. CARTPANDA: Fetch paid orders (revenue) + all statuses (approval rate)
                if (c.cartpanda_status === 'connected') {
                    try {
                        // Paid orders (status 3) = revenue + approved count
                        const { data: paidData } = await supabase.functions.invoke('cartpanda-list-orders', {
                            body: { clientId: c.id, paymentStatus: 3, startDate: dateFrom, endDate: dateTo, limit: 3000 }
                        });
                        const paidOrders = paidData?.summary?.totalOrders || 0;
                        const paidRevenueRaw = paidData?.summary?.totalRevenue || 0;
                        // Aplica mesma cotação detectada na ad account (assume CartPanda na mesma moeda do Meta)
                        const cpFxRate = result.fx_rate || 1;
                        const paidRevenue = paidRevenueRaw * cpFxRate;
                        result.cartpanda_revenue = paidRevenue;
                        result.cartpanda_orders = paidOrders;
                        result.approved_transactions = paidOrders;

                        // Pending orders (status 1) + Cancelled orders (status 4) for total count
                        const [pendingRes, cancelledRes] = await Promise.all([
                            supabase.functions.invoke('cartpanda-list-orders', {
                                body: { clientId: c.id, paymentStatus: 1, startDate: dateFrom, endDate: dateTo, limit: 3000 }
                            }),
                            supabase.functions.invoke('cartpanda-list-orders', {
                                body: { clientId: c.id, paymentStatus: 4, startDate: dateFrom, endDate: dateTo, limit: 3000 }
                            }),
                        ]);
                        const pendingOrders = pendingRes.data?.summary?.totalOrders || 0;
                        const cancelledOrders = cancelledRes.data?.summary?.totalOrders || 0;
                        result.transaction_count = paidOrders + pendingOrders + cancelledOrders;

                    } catch (cpErr: any) {
                        console.warn(`[useSmartDataV2] CartPanda error for ${c.name}:`, cpErr.message);
                    }
                }

                metricsMap[c.id] = result;
            });

            await Promise.all(clientPromises);

            // 3. Build SmartClients
            const smartClients: SmartClient[] = mrrClients.map((c: any) => {
                const scoreData = scoresMap[c.id] || {};
                const raw = metricsMap[c.id] || {
                    spend: 0, impressions: 0, clicks: 0, revenue: 0, reach: 0,
                    sessions: 0, orders: 0, add_to_cart: 0, checkouts_initiated: 0,
                    approved_transactions: 0, transaction_count: 0, chargebacks: 0,
                    product_costs: 0, total_tax_fees: 0,
                    cartpanda_revenue: 0, cartpanda_orders: 0,
                };

                const spend = raw.spend || 0;

                // Revenue: Meta is primary source (same as dashboard)
                // Meta revenue comes directly from Graph API now — accurate
                const metaRevenue = raw.revenue || 0;
                const cpRevenue = raw.cartpanda_revenue || 0;
                const revenue = metaRevenue > 0 ? metaRevenue : cpRevenue;

                const clicks = raw.clicks || 0;
                const impressions = raw.impressions || 0;

                // Orders: Meta primary
                const metaOrders = raw.orders || 0;
                const cpOrders = raw.cartpanda_orders || 0;
                const conversions = metaOrders > 0 ? metaOrders : cpOrders;

                // Approval rate: CartPanda real data (paid / total)
                const approvedTx = raw.approved_transactions || 0;
                const totalTx = raw.transaction_count || 0;
                const taxaAprovacao = totalTx > 0 ? (approvedTx / totalTx) * 100 : 0;
                const chargebackRate = totalTx > 0 ? (raw.chargebacks / totalTx) * 100 : 0;

                // Conv. Site: orders / clicks (sessions not available from direct API)
                const taxaConversaoSite = clicks > 0 ? (conversions / clicks) * 100 : 0;
                const effectiveSessions = clicks; // Use clicks as sessions proxy

                // Traffic KPIs
                const cpc = clicks > 0 ? spend / clicks : 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

                // Funnel
                const taxaAddToCart = clicks > 0 ? (raw.add_to_cart / clicks) * 100 : 0;
                const taxaCheckout = raw.add_to_cart > 0 ? (raw.checkouts_initiated / raw.add_to_cart) * 100 : 0;
                const taxaFinalizacao = raw.checkouts_initiated > 0 ? (conversions / raw.checkouts_initiated) * 100 : 0;
                const abandonoCarrinho = raw.checkouts_initiated > 0 ? (1 - (conversions / raw.checkouts_initiated)) * 100 : 0;

                // Profitability
                const roas = spend > 0 ? revenue / spend : 0;
                const cpa = conversions > 0 ? spend / conversions : 0;

                const unitCost = c.product_unit_cost || 0;
                const gatewayFee = (revenue * (c.gateway_fee_percent || 5) / 100) + (conversions * (c.gateway_fee_fixed || 1));
                const taxCost = revenue * (c.tax_percent || 6) / 100;

                const totalCost = spend + unitCost + gatewayFee + taxCost;
                const lucro = revenue - totalCost;
                const margemContribuicao = revenue > 0 ? (lucro / revenue) * 100 : 0;
                const lucroPorPedido = conversions > 0 ? lucro / conversions : 0;

                const metrics: ClientMetrics = {
                    cpc, ctr, cpm, frequency: 1, reach: raw.reach || 0, spend,
                    sessions: effectiveSessions, orders: conversions,
                    addToCart: raw.add_to_cart || 0, initiateCheckout: raw.checkouts_initiated || 0,
                    impressions, clicks,
                    taxaConversaoSite, taxaAddToCart, taxaCheckout, taxaFinalizacao, abandonoCarrinho,
                    taxaAprovacao, chargebackRate, pixApprovalRate: 0,
                    roas, cpa, margemContribuicao, lucroPorPedido, faturamento: revenue, lucro
                };

                let healthScore: HealthScoreResult;
                let classificationObj: ClientClassification;

                if (scoreData.total_score != null) {
                    healthScore = {
                        total: Number(scoreData.total_score),
                        detalhes: (scoreData.score_details as ScoreDetail) || { trafego: 0, conversao: 0, aprovacao: 0, lucratividade: 0 }
                    };
                    classificationObj = classifyClient(healthScore.total);
                    if (scoreData.status) classificationObj.status = scoreData.status;
                } else {
                    if (metrics.faturamento === 0 && metrics.spend === 0) {
                        healthScore = { total: 0, detalhes: { trafego: 0, conversao: 0, aprovacao: 0, lucratividade: 0 } };
                        classificationObj = {
                            status: 'SEM DADOS', emoji: '⚪', cor: '#94a3b8',
                            acao: 'Aguardando dados', urgencia: '-', descricao: 'Sem dados para este período.'
                        } as any;
                    } else {
                        healthScore = calculateHealthScore(metrics);
                        classificationObj = classifyClient(healthScore.total);
                    }
                }

                return {
                    id: c.id, name: c.name,
                    status: (classificationObj.status as any),
                    score: healthScore.total,
                    healthScore, classification: classificationObj, metrics,
                    ...metrics,
                    lastUpdated: scoreData.last_calculated_at || null
                };
            });

            setClients(smartClients);

            const totalInvested = smartClients.reduce((acc, c) => acc + c.spend, 0);
            const totalRevenue = smartClients.reduce((acc, c) => acc + c.faturamento, 0);
            const totalProfit = smartClients.reduce((acc, c) => acc + c.lucro, 0);
            const activeClientsCount = smartClients.filter(c => c.status !== 'SEM DADOS' && c.spend > 0).length;
            const avgRoas = totalInvested > 0 ? totalRevenue / totalInvested : 0;

            // Comissão Lever (mesma regra de useDashboardData.ts):
            // commission = base × rate%; só compensa se ultrapassar fee_fixed (senão Lever fica com o fixo).
            const totalCommission = smartClients.reduce((acc, sc) => {
                const c: any = mrrClients.find((m: any) => m.id === sc.id) || {};
                const rate = Number(c.commission_rate) || 0;
                const feeFixed = Number(c.fee_fixed) || 0;
                const base = (c.calculation_base === 'spend') ? sc.spend : sc.faturamento;
                const calc = base * (rate / 100);
                return acc + (calc > feeFixed ? calc : 0);
            }, 0);

            setSummary({ totalInvested, totalRevenue, totalProfit, totalCommission, activeClients: activeClientsCount, avgRoas });

        } catch (err: any) {
            console.error('[useSmartDataV2] Error fetching data:', err);
            setError(err.message);
        } finally {
            setIsLoadingLive(false);
        }
    }, [workspaceId, contextClients, contextIsLoading, period]);

    // Phase 1: instant load
    useEffect(() => {
        loadCachedScores();
    }, [loadCachedScores]);

    // Phase 2: live data (runs after cached load and on period change)
    useEffect(() => {
        if (!isLoading && (contextClients || []).length > 0) {
            fetchData();
        }
    }, [isLoading, period]);

    // Change period and re-fetch
    const changePeriod = (newPeriod: SmartDataPeriod) => {
        setPeriod(newPeriod);
    };

    const syncFromMeta = async () => {
        setIsLoading(true);
        setError(null);
        const { label } = getDateRange(period);
        try {
            toast.loading(`Sincronizando com Meta (${label})...`, { id: 'meta-sync' });

            // Map period to days for the edge function
            const daysMap: Record<SmartDataPeriod, number> = { today: 1, '7d': 7, '30d': 30, month: 30 };
            const days = daysMap[period];

            const { data, error: fnError } = await supabase.functions.invoke('sync-meta-campaigns', {
                body: { workspace_id: workspaceId, days }
            });

            if (fnError) throw new Error(fnError.message || 'Erro ao sincronizar com Meta');

            const clientsSynced = data?.clients_synced ?? 0;
            const results = data?.results || [];
            const errors = results.filter((r: any) => r.status === 'error');

            await fetchData();

            if (errors.length > 0 && clientsSynced === 0) {
                toast.error('Sync com erros', {
                    id: 'meta-sync',
                    description: `Verifique se as contas Meta estão vinculadas aos clientes em Conexões.`
                });
            } else {
                toast.success('Sincronizado!', {
                    id: 'meta-sync',
                    description: clientsSynced > 0
                        ? `${clientsSynced} cliente(s) atualizados · ${label}`
                        : 'Sem novos dados. Vincule contas Meta aos clientes em Conexões.'
                });
            }
        } catch (err: any) {
            console.error('[useSmartDataV2] syncFromMeta error:', err);
            toast.error('Erro ao sincronizar', { id: 'meta-sync', description: err.message });
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const updateClientMetric = async (clientId: string, field: string, value: number) => {
        setIsLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            let updatePayload: any = { client_id: clientId, date: today };

            if (field === 'roas') {
                const client = clients.find(c => c.id === clientId);
                const spend = client?.spend || 0;
                updatePayload.revenue = value * spend;
            } else if (field === 'faturamento') {
                updatePayload.revenue = value;
            } else if (field === 'taxaConversaoSite') {
                const client = clients.find(c => c.id === clientId);
                const sessions = client?.metrics.sessions || 1000;
                updatePayload.orders = Math.round((value / 100) * sessions);
            } else if (field === 'taxaAprovacao') {
                const client = clients.find(c => c.id === clientId);
                const orders = client?.metrics.orders || 10;
                updatePayload.approved_transactions = Math.round((value / 100) * orders);
                updatePayload.transaction_count = orders;
            } else {
                updatePayload[field] = value;
            }

            const { error } = await (supabase as any)
                .from('client_daily_metrics')
                .upsert(updatePayload, { onConflict: 'client_id,date' });

            if (error) throw error;
            await fetchData();
        } catch (err: any) {
            console.error('[useSmartDataV2] Error updating metric:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const { label: periodLabel } = getDateRange(period);

    return {
        clients,
        summary,
        isLoading,
        isLoadingLive,
        error,
        period,
        periodLabel,
        changePeriod,
        refresh: fetchData,
        syncFromMeta,
        updateClientMetric
    };
}
