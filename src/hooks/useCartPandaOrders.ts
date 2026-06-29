import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { toast } from 'sonner';

interface CartPandaOrder {
    id: number;
    orderNumber: string;
    totalPrice: number;
    totalPriceFormatted: string;
    paymentStatus: 'pending' | 'paid' | 'cancelled';
    paymentGateway: string;
    paymentType: string;
    payment_status?: number; // Raw status from API
    total_price?: string;    // Raw price from API
    createdAt: string;
    customerName: string;
    customerEmail: string;
    itemCount: number;
}

interface CartPandaSummary {
    totalOrders: number;
    totalRevenue: number;
    totalRevenueFormatted: string;
    averageOrderValue: number;
}

interface UseCartPandaOrdersResult {
    orders: CartPandaOrder[];
    summary: CartPandaSummary | null;
    isLoading: boolean;
    error: string | null;
    isConnected: boolean;
    refetch: () => Promise<void>;
}

// Simple in-memory cache to prevent redundant fetches
const orderCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export function useCartPandaOrders(
    dateRange?: { startDate?: string; endDate?: string },
    overrideClientId?: string
): UseCartPandaOrdersResult {
    const [orders, setOrders] = useState<CartPandaOrder[]>([]);
    const [summary, setSummary] = useState<CartPandaSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Now uses only unified DashboardContext
    const { selectedClientId, selectedAccountId, viewMode } = useDashboard();

    const fetchOrders = useCallback(async (forceRefresh = false) => {
        // Resolve targetClientId: override > selectedClientId > resolve from account
        let targetClientId = overrideClientId || selectedClientId;

        // Cache key based on params
        const cacheKey = `${targetClientId}-${dateRange?.startDate}-${dateRange?.endDate}`;

        if (!forceRefresh && orderCache[cacheKey] && (Date.now() - orderCache[cacheKey].timestamp < CACHE_TTL)) {
            const cached = orderCache[cacheKey].data;
            setOrders(cached.orders || []);
            setSummary(cached.summary || null);
            setIsConnected(true);
            setIsLoading(false); // Ensure loading state is cleared on cache hit
            return;
        }


        // RESOLUTION LOGIC ...
        if (!targetClientId && selectedAccountId) {
            try {
                // 1. Array search
                const { data: clientByArray } = await (supabase as any)
                    .from('agency_clients')
                    .select('id')
                    .contains('selected_ad_accounts', [selectedAccountId])
                    .maybeSingle();

                if (clientByArray) {
                    targetClientId = clientByArray.id;
                } else {
                    // 2. Name search fallback
                    const { data: account } = await supabase
                        .from('ad_accounts')
                        .select('name')
                        .eq('id', selectedAccountId)
                        .single();

                    if (account?.name) {
                        const { data: clientByName } = await (supabase as any)
                            .from('agency_clients')
                            .select('id')
                            .eq('name', account.name)
                            .maybeSingle();

                        if (clientByName) targetClientId = clientByName.id;
                    }
                }
            } catch (err) {
                console.error('[useCartPandaOrders] Error resolving client:', err);
            }
        }

        if (!targetClientId) {
            setOrders([]);
            setSummary(null);
            setIsConnected(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Check connection status
            const { data: clientData, error: clientError } = await (supabase as any)
                .from('agency_clients')
                .select('cartpanda_status, cartpanda_store_slug, cartpanda_store_name')
                .eq('id', targetClientId)
                .single();

            if (clientError || !clientData || clientData.cartpanda_status !== 'connected') {
                setIsConnected(false);
                setIsLoading(false);
                return;
            }

            setIsConnected(true);

            console.log(`[useCartPandaOrders] Fetching for client: ${targetClientId}, range: ${dateRange?.startDate} to ${dateRange?.endDate}`);

            const payload = {
                clientId: targetClientId,
                paymentStatus: 3, // Paid
                startDate: dateRange?.startDate,
                endDate: dateRange?.endDate,
                limit: 3000 // Increased to ensure we get all monthly orders even for high-volume stores
            };

            const { data, error: functionError } = await supabase.functions.invoke('cartpanda-list-orders', {
                body: payload
            });

            if (functionError || !data || data.error) {
                throw new Error(data?.error || functionError?.message || 'Erro ao buscar pedidos');
            }

            console.log(`[useCartPandaOrders] Received ${data.orders?.length || 0} orders.`);

            // Update cache
            orderCache[cacheKey] = {
                data: data,
                timestamp: Date.now()
            };

            setOrders(data.orders || []);
            setSummary(data.summary || null);

        } catch (err: any) {
            console.error('[useCartPandaOrders] Final Error:', err);
            setError(err.message || 'Erro ao buscar pedidos CartPanda');
            toast.error(`CartPanda: ${err.message || 'Erro ao buscar pedidos'}`);
        } finally {
            setIsLoading(false);
        }
    }, [selectedClientId, overrideClientId, selectedAccountId, viewMode, dateRange?.startDate, dateRange?.endDate]);

    // Reset state immediately when dependencies change to avoid showing stale data
    useEffect(() => {
        setIsLoading(true);
        setOrders([]);
        setSummary(null);
        setError(null);
    }, [selectedClientId, overrideClientId, dateRange?.startDate, dateRange?.endDate]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    return {
        orders,
        summary,
        isLoading,
        error,
        isConnected,
        refetch: () => fetchOrders(true)
    };
}
