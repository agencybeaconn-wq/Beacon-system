import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DateRange } from 'react-day-picker';
import { format, addDays } from 'date-fns';

export interface ClientCosts {
    supplier_cost_mode: 'fixed' | 'per_sale';
    supplier_cost_value: number;
    gateway_fee_percent: number;
}

export interface SharedDashboardMetrics {
    spend: number;
    revenue: number;
    conversions: number;
    roas: number;
    impressions: number;
    clicks: number;
    cpc: number;
    ctr: number;
    cpa: number;
}

export interface DailyDataPoint {
    date: string;
    fullDate: string;
    spend: number;
    revenue: number;
    profit: number;
    roas: number;
}

export interface TopCampaign {
    id: string;
    name: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
}

export interface TopAd {
    id: string;
    name: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
    cpa: number;
    imageUrl: string | null;
}

export interface WhiteLabel {
    agencyName: string | null;
    agencyLogo: string | null;
    primaryColor: string;
}

interface SharedDashboardData {
    whiteLabel: WhiteLabel;
    clientCosts: ClientCosts;
    metrics: SharedDashboardMetrics;
    chartsData: {
        dailyEvolution: DailyDataPoint[];
    };
    topCampaigns: TopCampaign[];
    topAds: TopAd[];
}

export type DateFilter = 'today' | '7d' | '30d' | 'custom';

export function useSharedDashboard(shareToken: string | null | undefined) {
    const [data, setData] = useState<SharedDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<DateFilter>('7d');
    const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);

    const fetchData = useCallback(async () => {
        if (!shareToken) {
            setError('Token não fornecido');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Calculate date range
            const today = new Date();
            let fromDate: string;
            let toDate = format(today, 'yyyy-MM-dd');

            if (dateFilter === 'custom' && customRange?.from && customRange?.to) {
                fromDate = format(customRange.from, 'yyyy-MM-dd');
                toDate = format(customRange.to, 'yyyy-MM-dd');
            } else if (dateFilter === 'today') {
                fromDate = format(today, 'yyyy-MM-dd');
            } else if (dateFilter === '30d') {
                fromDate = format(addDays(today, -29), 'yyyy-MM-dd');
            } else {
                // Default 7d
                fromDate = format(addDays(today, -6), 'yyyy-MM-dd');
            }

            const { data: responseData, error: funcError } = await supabase.functions.invoke(
                'get-shared-dashboard',
                {
                    body: null,
                    headers: {},
                    method: 'GET',
                }
            );

            // Since supabase.functions.invoke doesn't support GET with query params well,
            // we'll use fetch directly
            const baseUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/get-shared-dashboard`;
            const url = `${baseUrl}?token=${encodeURIComponent(shareToken)}&from=${fromDate}&to=${toDate}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const result: SharedDashboardData = await response.json();
            setData(result);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao carregar dados';
            console.error('❌ [SHARED-HOOK] Erro:', message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [shareToken, dateFilter, customRange]);

    // Initial fetch and refetch on date change
    useEffect(() => {
        if (shareToken) {
            fetchData();
        }
    }, [fetchData, shareToken]);

    // Update client costs
    const updateClientCosts = useCallback(async (newCosts: ClientCosts) => {
        if (!shareToken || !data) return;

        try {
            const baseUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/update-shared-dashboard-costs`;

            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shareToken,
                    clientCosts: newCosts,
                }),
            });

            if (!response.ok) {
                console.error('❌ [SHARED-HOOK] Erro ao salvar custos');
                return false;
            }

            // Update local state immediately
            setData(prev => prev ? {
                ...prev,
                clientCosts: newCosts,
            } : null);

            return true;

        } catch (err) {
            console.error('❌ [SHARED-HOOK] Erro ao salvar custos:', err);
            return false;
        }
    }, [shareToken, data]);

    // Calculate profit based on client costs
    const calculateProfit = useCallback((revenue: number, spend: number, conversions: number, costs: ClientCosts) => {
        const gatewayFee = revenue * (costs.gateway_fee_percent / 100);
        const supplierCost = costs.supplier_cost_mode === 'per_sale'
            ? costs.supplier_cost_value * conversions
            : costs.supplier_cost_value;

        const grossProfit = revenue - spend;
        const netProfit = grossProfit - gatewayFee - supplierCost;

        return {
            grossProfit,
            gatewayFee,
            supplierCost,
            netProfit,
        };
    }, []);

    return {
        data,
        isLoading,
        error,
        dateFilter,
        setDateFilter,
        customRange,
        setCustomRange,
        refetch: fetchData,
        updateClientCosts,
        calculateProfit,
    };
}
