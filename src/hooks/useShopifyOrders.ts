import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFxRate } from '@/lib/fxRates';

export interface ShopifyOrder {
    id: number;
    orderNumber: string;
    /** Valor já convertido pra BRL via getFxRate (USD/EUR/etc → BRL). */
    totalPrice: number;
    totalPriceFormatted: string;
    /** Moeda original da loja Shopify (ex: USD, EUR). BRL quando loja é brasileira. */
    currency: string;
    /** Valor antes da conversão (na moeda original). Útil pra debug e exibição mista. */
    originalPrice: number;
    financialStatus: string;
    fulfillmentStatus: string | null;
    paymentMethod: 'credit_card' | 'pix' | 'boleto' | 'other';
    createdAt: string;
    customerName: string;
    customerEmail: string;
    itemCount: number;
}

export interface PaymentMethodBreakdown {
    method: 'credit_card' | 'pix' | 'boleto' | 'other';
    label: string;
    paid: number;
    pending: number;
    cancelled: number;
    total: number;
    orderCount: number;
    percent: number;
}

export interface ShopifyOrdersSummary {
    totalOrders: number;
    totalRevenue: number;
    totalRevenueFormatted: string;
    averageOrderValue: number;
    paymentMethods: PaymentMethodBreakdown[];
}

interface UseShopifyOrdersResult {
    orders: ShopifyOrder[];
    summary: ShopifyOrdersSummary;
    isLoading: boolean;
    error: string | null;
    fetchOrders: (clientId: string, startDate?: string, endDate?: string) => Promise<void>;
}

export function useShopifyOrders(): UseShopifyOrdersResult {
    const [orders, setOrders] = useState<ShopifyOrder[]>([]);
    const [summary, setSummary] = useState<ShopifyOrdersSummary>({
        totalOrders: 0,
        totalRevenue: 0,
        totalRevenueFormatted: 'R$ 0,00',
        averageOrderValue: 0,
        paymentMethods: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = useCallback(async (clientId: string, startDate?: string, endDate?: string) => {
        setIsLoading(true);
        setError(null);

        try {
            // Build params for Shopify orders API
            // OBS: NÃO setamos `limit` aqui — o método 'list_all' usa limit=250 internamente
            // e pagina via Link header até esgotar. Setar `limit` aqui apenas reduziria o batch.
            const params: Record<string, string> = {
                status: 'any',
                fields: 'id,name,total_price,financial_status,fulfillment_status,created_at,customer,line_items,currency,payment_gateway_names',
            };

            if (startDate) {
                params.created_at_min = `${startDate}T00:00:00-03:00`;
            }
            if (endDate) {
                params.created_at_max = `${endDate}T23:59:59-03:00`;
            }

            // Use fetch directly (same pattern as shopifyAdminService)
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || anonKey;

            // method='list_all' pagina via Link header até esgotar.
            // Antes usávamos 'list' que limitava a 250 orders/chamada — pra lojas
            // de volume alto (ex: Brasileiríssimo com ~800+ orders/mês) isso truncava
            // o faturamento em ~30%. list_all percorre todas as páginas.
            const response = await fetch(`${supabaseUrl}/functions/v1/shopify-admin-proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': anonKey,
                },
                body: JSON.stringify({
                    clientId,
                    resource: 'orders',
                    method: 'list_all',
                    params,
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro ${response.status}: ${errText}`);
            }

            const data = await response.json();
            // list_all retorna { success, data: [...] (array direto), count }
            // list retorna { success, data: { orders: [...] } }
            // Suportamos os dois pra robustez.
            const rawOrders = Array.isArray(data?.data)
                ? data.data
                : (data?.data?.orders || data?.orders || []);

            // ─── FX → BRL ─────────────────────────────────────────────
            // Lojas como Brasileiríssimo, MatchWear, JGS Sports vendem em USD/EUR.
            // Shopify retorna `total_price` na shop currency. Sem conversão, R$ 100k
            // em USD vira "R$ 100k" literal no dashboard — subdimensiona em ~5,5×.
            //
            // Estratégia pragmática: 1 cotação por currency único, usando a data atual.
            // Trade-off: períodos longos com câmbio volátil têm imprecisão. Pra precisão
            // total, seria 1 cotação por (currency, data-da-order) — fica como dívida
            // técnica caso filtros custom em datas antigas exibam números fora do esperado.
            const uniqueCurrencies = Array.from(new Set(
                rawOrders
                    .map((o: any) => String(o.currency || 'BRL').toUpperCase())
                    .filter(Boolean)
            )) as string[];

            const fxRates: Record<string, number> = {};
            await Promise.all(
                uniqueCurrencies.map(async (cur) => {
                    fxRates[cur] = await getFxRate(cur);
                })
            );

            // Classify payment gateway
            const classifyGateway = (gateways: string[]): 'credit_card' | 'pix' | 'boleto' | 'other' => {
                const g = (gateways || []).join(' ').toLowerCase();
                if (g.includes('cc') || g.includes('credit') || g.includes('card') || g.includes('cartao')) return 'credit_card';
                if (g.includes('pix')) return 'pix';
                if (g.includes('boleto') || g.includes('billet')) return 'boleto';
                return 'other';
            };

            // Transform Shopify orders to our format (com FX → BRL)
            const transformed: ShopifyOrder[] = rawOrders.map((o: any) => {
                const originalPrice = parseFloat(o.total_price || '0');
                const currency = String(o.currency || 'BRL').toUpperCase();
                const fx = fxRates[currency] ?? 1;
                const priceBRL = originalPrice * fx;
                return {
                    id: o.id,
                    orderNumber: o.name || `#${o.id}`,
                    totalPrice: priceBRL,
                    totalPriceFormatted: `R$ ${priceBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    currency,
                    originalPrice,
                    financialStatus: o.financial_status || 'pending',
                    fulfillmentStatus: o.fulfillment_status,
                    createdAt: o.created_at,
                    customerName: o.customer
                        ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim()
                        : 'Cliente',
                    customerEmail: o.customer?.email || '',
                    paymentMethod: classifyGateway(o.payment_gateway_names),
                    itemCount: (o.line_items || []).length,
                };
            });

            // Filter only paid orders for summary
            const paidOrders = transformed.filter(o => o.financialStatus === 'paid');
            const totalRevenue = paidOrders.reduce((acc, o) => acc + o.totalPrice, 0);

            // Payment methods breakdown
            const methodMap: Record<string, { paid: number; pending: number; cancelled: number; count: number }> = {};
            const methodLabels: Record<string, string> = { credit_card: 'Cartão de Crédito', pix: 'Pix', boleto: 'Boleto', other: 'Outros' };
            for (const o of transformed) {
                const m = o.paymentMethod;
                if (!methodMap[m]) methodMap[m] = { paid: 0, pending: 0, cancelled: 0, count: 0 };
                methodMap[m].count++;
                if (o.financialStatus === 'paid') methodMap[m].paid += o.totalPrice;
                else if (o.financialStatus === 'pending' || o.financialStatus === 'authorized') methodMap[m].pending += o.totalPrice;
                else methodMap[m].cancelled += o.totalPrice;
            }
            const totalAllOrders = transformed.length || 1;
            const paymentMethods: PaymentMethodBreakdown[] = (['credit_card', 'pix', 'boleto', 'other'] as const)
                .filter(m => methodMap[m])
                .map(m => ({
                    method: m,
                    label: methodLabels[m],
                    paid: methodMap[m].paid,
                    pending: methodMap[m].pending,
                    cancelled: methodMap[m].cancelled,
                    total: methodMap[m].paid + methodMap[m].pending + methodMap[m].cancelled,
                    orderCount: methodMap[m].count,
                    percent: Math.round((methodMap[m].paid / (methodMap[m].paid + methodMap[m].pending + methodMap[m].cancelled || 1)) * 100),
                }));

            setOrders(transformed);
            setSummary({
                totalOrders: paidOrders.length,
                totalRevenue,
                totalRevenueFormatted: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                averageOrderValue: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
                paymentMethods,
            });
        } catch (err: any) {
            console.error('[useShopifyOrders] Error:', err);
            setError(err.message || 'Erro ao buscar pedidos');
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { orders, summary, isLoading, error, fetchOrders };
}
