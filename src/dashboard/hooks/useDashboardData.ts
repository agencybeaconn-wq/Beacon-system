/**
 * useDashboardData — fonte única de dados pra dashboard de qualquer role.
 *
 * Centraliza tudo que hoje está espalhado dentro de OverviewClone:
 *   - filtros de data (today/7d/month/custom)
 *   - useOverviewMetrics  (Meta via Supabase)
 *   - useClientMetrics    (Meta consolidado por cliente)
 *   - useShopifyOrders    (ground truth quando conectado)
 *   - useCartPandaOrders  (fallback quando Shopify off)
 *   - useSmartDataV2      (agency aggregate view "Lever")
 *   - profitSettings      (per-client, gateway/tax/fixed_costs/product_cost)
 *   - supplierPayments    (localStorage)
 *
 * Retorna um shape estável que os blocos consomem via props.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { useOverviewMetrics } from "@/hooks/useOverviewMetrics";
import { useCartPandaOrders } from "@/hooks/useCartPandaOrders";
import { useShopifyOrders } from "@/hooks/useShopifyOrders";
import { useClientMetrics } from "@/hooks/useClientMetrics";
import { useSmartDataV2, SmartDataPeriod } from "@/hooks/useSmartDataV2";
import { getFxRate } from "@/lib/fxRates";
import { getTodayInBrazil, formatDateInBrazil } from "@/lib/dateUtils";

export type DashboardDateRange = "today" | "7d" | "month" | "custom";

const datePresetMap: Record<DashboardDateRange, "today" | "last_7d" | "this_month" | "last_30d"> = {
    today: "today",
    "7d": "last_7d",
    month: "this_month",
    custom: "last_7d",
};

export interface SupplierPayment {
    id: string;
    date: string;
    value: number;
    description: string;
    category: "produto" | "fornecedor" | "operacional" | "outro";
}

export interface ProfitSettings {
    gateway_percent: number;
    tax_percent: number;
    fixed_costs: number;
    product_cost: number;
}

/**
 * Brazil timezone offset (dynamic — handles DST edge cases). Returns e.g. "-03:00".
 */
function getBrazilOffsetString(): string {
    try {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Sao_Paulo",
            timeZoneName: "longOffset",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(now);
        const raw = parts.find((p) => p.type === "timeZoneName")?.value || "";
        const match = raw.match(/([+-]\d{2}:\d{2})/);
        return match ? match[1] : "-03:00";
    } catch {
        return "-03:00";
    }
}

export interface UseDashboardDataOptions {
    /**
     * Override do cliente selecionado. Usado pelo portal do cliente —
     * o portal força `linkedClientId` em vez de respeitar a seleção do contexto.
     * Se não passar, usa o `selectedClientId` do `DashboardContext`.
     */
    clientIdOverride?: string | null;
}

export function useDashboardData(options: UseDashboardDataOptions = {}) {
    const { clientIdOverride } = options;
    const { selectedClientId: ctxClientId, clients: allClients } = useDashboard();
    const selectedClientId = clientIdOverride ?? ctxClientId;

    // ─── Filtros de data ──────────────────────────────────────────
    const [dateFilter, setDateFilter] = useState<DashboardDateRange>("today");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const apiDates = useMemo(() => {
        const today = getTodayInBrazil();
        const fmt = (d: Date) => formatDateInBrazil(d);
        if (dateFilter === "today") return { startDate: fmt(today), endDate: fmt(today) };
        if (dateFilter === "7d") {
            const start = new Date(today);
            start.setDate(today.getDate() - 6);
            return { startDate: fmt(start), endDate: fmt(today) };
        }
        if (dateFilter === "month") {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            return { startDate: fmt(start), endDate: fmt(today) };
        }
        if (dateFilter === "custom" && dateRange?.from) {
            return { startDate: fmt(dateRange.from), endDate: fmt(dateRange.to || dateRange.from) };
        }
        return { startDate: fmt(today), endDate: fmt(today) };
    }, [dateFilter, dateRange]);

    const cpDates = useMemo(() => {
        const today = getTodayInBrazil();
        const fmt = (d: Date) => formatDateInBrazil(d);
        const offset = getBrazilOffsetString();
        const startOfDay = (d: Date) => `${fmt(d)}T00:00:00${offset}`;
        const endOfDay = (d: Date) => `${fmt(d)}T23:59:59${offset}`;
        if (dateFilter === "today") return { startDate: startOfDay(today), endDate: endOfDay(today) };
        if (dateFilter === "7d") {
            const start = new Date(today);
            start.setDate(today.getDate() - 6);
            return { startDate: startOfDay(start), endDate: endOfDay(today) };
        }
        if (dateFilter === "month") {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            return { startDate: startOfDay(start), endDate: endOfDay(today) };
        }
        if (dateFilter === "custom" && dateRange?.from) {
            return { startDate: startOfDay(dateRange.from), endDate: endOfDay(dateRange.to || dateRange.from) };
        }
        return { startDate: startOfDay(today), endDate: endOfDay(today) };
    }, [dateFilter, dateRange]);

    // ─── Dados do cliente selecionado ─────────────────────────────
    const [clientData, setClientData] = useState<any>(null);
    const fetchClientData = useCallback(async () => {
        if (!selectedClientId) {
            setClientData(null);
            return;
        }
        try {
            const { data, error } = await (supabase as any)
                .from("agency_clients")
                .select("*")
                .eq("id", selectedClientId)
                .single();
            if (error) throw error;
            setClientData(data);
        } catch (err) {
            console.error("[useDashboardData] Error fetching client data:", err);
        }
    }, [selectedClientId]);

    useEffect(() => {
        fetchClientData();
    }, [fetchClientData]);

    // ─── Profit settings (per-client) ─────────────────────────────
    const [profitSettings, setProfitSettings] = useState<ProfitSettings>({
        gateway_percent: 0,
        tax_percent: 0,
        fixed_costs: 0,
        product_cost: 0,
    });
    useEffect(() => {
        if (!clientData) return;
        const tempProductCostStr = localStorage.getItem(`product_cost_${selectedClientId}`);
        const tempProductCost = tempProductCostStr ? parseFloat(tempProductCostStr) : 0;
        setProfitSettings({
            gateway_percent: (clientData as any).profit_gateway_percent || 0,
            tax_percent: (clientData as any).profit_tax_percent || 0,
            fixed_costs: (clientData as any).profit_fixed_costs || 0,
            product_cost: tempProductCost,
        });
    }, [clientData, selectedClientId]);

    // ─── Supplier payments (localStorage) ─────────────────────────
    const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
    useEffect(() => {
        if (!selectedClientId) {
            setSupplierPayments([]);
            return;
        }
        const stored = localStorage.getItem(`supplier_payments_${selectedClientId}`);
        if (!stored) {
            setSupplierPayments([]);
            return;
        }
        try {
            setSupplierPayments(JSON.parse(stored));
        } catch {
            setSupplierPayments([]);
        }
    }, [selectedClientId]);

    const totalSupplierPayments = useMemo(
        () => supplierPayments.reduce((sum, p) => sum + p.value, 0),
        [supplierPayments],
    );

    // ─── Hooks de métricas ──────────────────────────────────────
    const { metrics: clientMetrics, dailyBreakdown, isLoading: isClientMetricsLoading, refetch: refetchClientMetrics } =
        useClientMetrics({
            clientId: selectedClientId || null,
            datePreset: datePresetMap[dateFilter] || "last_7d",
            startDate: apiDates.startDate,
            endDate: apiDates.endDate,
        });

    const { metrics: dbMetrics, isLoading: isMetricsLoading, chartsData, refetch: refetchOverview } =
        useOverviewMetrics(dateFilter, dateRange);

    const shopifyConnected = clientData?.shopify_status === "connected";
    const shopify = useShopifyOrders();

    useEffect(() => {
        if (shopifyConnected && selectedClientId) {
            shopify.fetchOrders(selectedClientId, apiDates?.startDate, apiDates?.endDate);
        }
    }, [shopifyConnected, selectedClientId, dateFilter, dateRange, apiDates?.startDate, apiDates?.endDate]);

    const { summary: cartPandaSummary, orders, isLoading: isCartPandaLoading, refetch: refetchCartPanda } =
        useCartPandaOrders(cpDates, shopifyConnected ? undefined : (selectedClientId || undefined));

    const refetchAll = useCallback(() => {
        refetchClientMetrics();
        refetchOverview();
        if (shopifyConnected && selectedClientId) {
            shopify.fetchOrders(selectedClientId, apiDates?.startDate, apiDates?.endDate);
        } else {
            refetchCartPanda();
        }
    }, [refetchClientMetrics, refetchOverview, shopifyConnected, selectedClientId, apiDates, shopify, refetchCartPanda]);

    // Auto-refresh a cada 2min
    useEffect(() => {
        const intervalId = setInterval(refetchAll, 2 * 60 * 1000);
        return () => clearInterval(intervalId);
    }, [refetchAll]);

    // ─── Merge Meta DB + Meta cliente ─────────────────────────────
    const metrics = useMemo(() => {
        const baseDbMetrics = {
            ...dbMetrics,
            addToCart: (dbMetrics as any).addToCart || 0,
            initiateCheckout: (dbMetrics as any).initiateCheckout || 0,
            clicks: (dbMetrics as any).clicks || 0,
            impressions: (dbMetrics as any).impressions || 1,
            cpc: (dbMetrics as any).cpc || 0,
            ctr: (dbMetrics as any).ctr || 0,
            cpm: (dbMetrics as any).cpm || 0,
        };
        if (selectedClientId && clientMetrics) {
            if (clientMetrics.totalSpend === 0 && dbMetrics.spend > 0) return baseDbMetrics;
            return {
                ...baseDbMetrics,
                spend: clientMetrics.totalSpend || 0,
                revenue: clientMetrics.totalConversionValue || 0,
                conversions: clientMetrics.totalConversions || 0,
                roas: clientMetrics.roas || 0,
                cpa: clientMetrics.cpa || 0,
                addToCart: clientMetrics.totalAddToCart || 0,
                initiateCheckout: clientMetrics.totalInitiateCheckout || 0,
                clicks: clientMetrics.totalClicks || 0,
                impressions: clientMetrics.totalImpressions || 1,
                cpc: clientMetrics.cpc || 0,
                ctr: clientMetrics.ctr || 0,
                pageViews: clientMetrics.totalPageViews || 0,
                cpm:
                    clientMetrics.totalImpressions > 0 && clientMetrics.totalSpend > 0
                        ? (clientMetrics.totalSpend / clientMetrics.totalImpressions) * 1000
                        : 0,
            };
        }
        return baseDbMetrics;
    }, [selectedClientId, clientMetrics, dbMetrics]);

    // ─── combinedMetrics: prioridade Shopify > CartPanda > Meta ───
    const combinedMetrics = useMemo(() => {
        const spRevenue = shopify.summary?.totalRevenue || 0;
        const spOrders = shopify.summary?.totalOrders || 0;
        const spTicket = shopify.summary?.averageOrderValue || 0;

        const cpRevenue = cartPandaSummary?.totalRevenue || 0;
        const cpOrders = cartPandaSummary?.totalOrders || 0;
        const cpTicket = cartPandaSummary?.averageOrderValue || 0;

        const totalSpend = metrics.spend || 0;
        const metaConversions = metrics.conversions || 0;
        const metaRevenue = metrics.revenue || 0;

        const hasShopify = shopifyConnected && (spRevenue > 0 || spOrders > 0);
        const hasCartPanda = !hasShopify && (cpRevenue > 0 || cpOrders > 0);

        let bestRevenue: number, bestOrders: number, revenueSource: string;
        if (hasShopify) {
            bestRevenue = spRevenue;
            bestOrders = spOrders;
            revenueSource = "Shopify";
        } else if (hasCartPanda) {
            bestRevenue = cpRevenue;
            bestOrders = cpOrders;
            revenueSource = "CartPanda";
        } else {
            bestRevenue = metaRevenue;
            bestOrders = metaConversions;
            revenueSource = "Meta";
        }

        const bestRoas = totalSpend > 0 ? bestRevenue / totalSpend : 0;
        const bestCpa = bestOrders > 0 ? totalSpend / bestOrders : 0;
        const bestTicket = bestOrders > 0 ? bestRevenue / bestOrders : 0;

        const pageViews = (metrics as any).pageViews || 0;

        const feeMultiplier = 1 - profitSettings.gateway_percent / 100 - profitSettings.tax_percent / 100;
        const netRevenue = bestRevenue * feeMultiplier;
        const actualProfit =
            netRevenue -
            totalSpend -
            profitSettings.fixed_costs -
            bestOrders * profitSettings.product_cost -
            totalSupplierPayments;

        // ─── Comissão Lever ──────────────────────────────────────
        // Regra de negócio: a comissão variável só "compensa" quando o cálculo
        // (% × base) ultrapassa o fee_fixed mensal do cliente. Antes disso, a
        // Lever fica com o fixo e a comissão variável é R$ 0.
        //
        // Modelos comuns (ver agency_clients):
        //   - sem_taxa  (rate=0, fixed=0)  → sempre R$ 0
        //   - só_taxa   (rate>0, fixed=0)  → sempre = % × base   (Julico 3,5%)
        //   - híbrido   (rate>0, fixed>0)  → 0 até superar o fixo (Mantos PH 3% / R$ 3k)
        //   - só_fixo   (rate=0, fixed>0)  → sempre R$ 0
        //
        // calculation_base define a base (revenue default ou spend).
        const commissionRate = Number(clientData?.commission_rate) || 0;
        const feeFixed = Number(clientData?.fee_fixed) || 0;
        const commissionBase = clientData?.calculation_base || "revenue";
        const commissionBaseValue = commissionBase === "spend" ? totalSpend : bestRevenue;
        const commissionCalculated = commissionBaseValue * (commissionRate / 100);
        const commission = commissionCalculated > feeFixed ? commissionCalculated : 0;

        return {
            ...metrics,
            shopify_revenue: spRevenue,
            shopify_orders: spOrders,
            shopify_ticket: spTicket,
            cartpanda_revenue: cpRevenue,
            cartpanda_orders: cpOrders,
            cartpanda_ticket: cpTicket,
            meta_conversions: metaConversions,
            meta_revenue: metaRevenue,
            bestRevenue,
            bestOrders,
            bestCpa,
            bestTicket,
            roas: bestRoas,
            profit: actualProfit,
            commission,
            commissionRate,
            addToCart: (metrics as any).addToCart || 0,
            initiateCheckout: (metrics as any).initiateCheckout || 0,
            clicks: (metrics as any).clicks || 0,
            cpc: (metrics as any).cpc || 0,
            cpm: (metrics as any).cpm || 0,
            ctr: (metrics as any).ctr || 0,
            impressions: (metrics as any).impressions || 1,
            pageViews,
            revenueSource,
        };
    }, [metrics, shopify.summary, cartPandaSummary, shopifyConnected, profitSettings, totalSupplierPayments, clientData]);

    // ─── Agency aggregate view ("Lever") ──────────────────────────
    const isAgencyAggregateView = clientData?.name === "Lever";
    const aggregatePeriod: SmartDataPeriod =
        dateFilter === "today" ? "today" : dateFilter === "7d" ? "7d" : dateFilter === "month" ? "month" : "30d";
    const { summary: agencySummary, isLoadingLive: isAgencyLoading, changePeriod: changeAggregatePeriod } =
        useSmartDataV2();
    useEffect(() => {
        if (isAgencyAggregateView) changeAggregatePeriod(aggregatePeriod);
    }, [isAgencyAggregateView, aggregatePeriod, changeAggregatePeriod]);

    // Cross-client Shopify aggregate
    const [shopifyAggregate, setShopifyAggregate] = useState<{ revenue: number; orders: number; loading: boolean }>({
        revenue: 0,
        orders: 0,
        loading: false,
    });
    useEffect(() => {
        if (!isAgencyAggregateView || !allClients?.length) return;
        const fixos = allClients.filter((c: any) => c.fee_fixed > 0 && c.shopify_status === "connected");
        if (fixos.length === 0) return;

        let cancelled = false;
        const run = async () => {
            setShopifyAggregate((prev) => ({ ...prev, loading: true }));
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || anonKey;

            const startDate = apiDates.startDate;
            const endDate = apiDates.endDate;
            const offset = getBrazilOffsetString();

            const perClient = await Promise.all(
                fixos.map(async (c: any) => {
                    try {
                        const resp = await fetch(`${supabaseUrl}/functions/v1/shopify-admin-proxy`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                                apikey: anonKey,
                            },
                            body: JSON.stringify({
                                clientId: c.id,
                                resource: "orders",
                                method: "list",
                                params: {
                                    status: "any",
                                    limit: "250",
                                    fields: "id,total_price,financial_status,created_at,currency",
                                    created_at_min: `${startDate}T00:00:00${offset}`,
                                    created_at_max: `${endDate}T23:59:59${offset}`,
                                },
                            }),
                        });
                        if (!resp.ok) return { revenue: 0, orders: 0 };
                        const data = await resp.json();
                        const raw = data?.data?.orders || data?.orders || [];
                        const paid = raw.filter((o: any) => o.financial_status === "paid");
                        const currency = (paid[0]?.currency || "BRL").toUpperCase();
                        const fx = currency === "BRL" ? 1 : await getFxRate(currency);
                        const revenue = paid.reduce((acc: number, o: any) => acc + parseFloat(o.total_price || "0"), 0) * fx;
                        return { revenue, orders: paid.length };
                    } catch {
                        return { revenue: 0, orders: 0 };
                    }
                }),
            );

            if (cancelled) return;
            const totalRevenue = perClient.reduce((a, b) => a + b.revenue, 0);
            const totalOrders = perClient.reduce((a, b) => a + b.orders, 0);
            setShopifyAggregate({ revenue: totalRevenue, orders: totalOrders, loading: false });
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [isAgencyAggregateView, allClients, apiDates.startDate, apiDates.endDate]);

    // Patch combinedMetrics quando em agency aggregate
    const finalMetrics = useMemo(() => {
        if (!isAgencyAggregateView) return combinedMetrics;
        const patched: any = { ...combinedMetrics };
        const shopifyRev = shopifyAggregate.revenue || 0;
        const metaSpend = agencySummary.totalInvested || 0;
        patched.bestRevenue = shopifyRev > 0 ? shopifyRev : agencySummary.totalRevenue || 0;
        patched.spend = metaSpend;
        patched.roas = metaSpend > 0 ? patched.bestRevenue / metaSpend : 0;

        const rev = patched.bestRevenue;
        const spd = patched.spend || rev / 5;
        const ticketMock = 280;
        const realOrders = shopifyAggregate.orders;
        const ordersMock = realOrders > 0 ? realOrders : Math.max(1, Math.round(rev / ticketMock));
        const ctrMock = 1.85;
        const cpmMock = 22;
        const impressionsMock = spd > 0 ? Math.round((spd / cpmMock) * 1000) : 0;
        const clicksMock = Math.round(impressionsMock * (ctrMock / 100));
        patched.bestOrders = ordersMock;
        patched.meta_conversions = ordersMock;
        patched.bestTicket = ticketMock;
        patched.bestCpa = ordersMock > 0 ? spd / ordersMock : 0;
        patched.impressions = impressionsMock;
        patched.clicks = clicksMock;
        patched.cpc = clicksMock > 0 ? spd / clicksMock : 0;
        patched.ctr = ctrMock;
        patched.cpm = cpmMock;
        return patched;
    }, [combinedMetrics, isAgencyAggregateView, shopifyAggregate, agencySummary]);

    const isTopCardsLoading = isAgencyAggregateView
        ? isAgencyLoading || shopifyAggregate.loading
        : isClientMetricsLoading && isCartPandaLoading;

    /**
     * Flag de conveniência: o cliente tem ad accounts Meta vinculadas?
     * Quando false, os blocos de métricas Meta (Valor Gasto, ROAS, CPC/CTR/CPM/CPA,
     * Conversões Meta, MarketingFunnel, WeeklyReport, barras de spend no chart)
     * devem ser escondidos em vez de exibir R$ 0,00 enganoso.
     *
     * Regra simples: precisa de pelo menos 1 ad account.
     * No agency aggregate ("Lever"), sempre true (consolidado cross-cliente).
     */
    const hasMetaAccounts =
        isAgencyAggregateView ||
        (Array.isArray(clientData?.selected_ad_accounts) &&
            clientData.selected_ad_accounts.length > 0);

    // ─── Persistência de supplier payments ────────────────────────
    const saveSupplierPayments = useCallback(
        (payments: SupplierPayment[]) => {
            setSupplierPayments(payments);
            if (selectedClientId) {
                localStorage.setItem(`supplier_payments_${selectedClientId}`, JSON.stringify(payments));
            }
        },
        [selectedClientId],
    );

    const saveProfitSettings = useCallback(
        async (settings: ProfitSettings) => {
            if (!selectedClientId) return;
            try {
                localStorage.setItem(`product_cost_${selectedClientId}`, settings.product_cost.toString());
                const { error } = await (supabase as any)
                    .from("agency_clients")
                    .update({
                        profit_gateway_percent: settings.gateway_percent,
                        profit_tax_percent: settings.tax_percent,
                        profit_fixed_costs: settings.fixed_costs,
                    })
                    .eq("id", selectedClientId);
                if (error) throw error;
                setProfitSettings(settings);
                await fetchClientData();
            } catch (err) {
                console.error("[useDashboardData] Error saving profit settings:", err);
                throw err;
            }
        },
        [selectedClientId, fetchClientData],
    );

    return {
        // Filtros
        dateFilter,
        setDateFilter,
        dateRange,
        setDateRange,
        apiDates,
        cpDates,

        // Identidade
        selectedClientId,

        // Dados
        data: finalMetrics,
        chartsData,
        dailyBreakdown,
        shopify,
        cartPandaSummary,
        orders,
        clientData,
        isAgencyAggregateView,
        shopifyConnected,

        // Flags
        hasMetaAccounts,

        // Loading
        isLoading: isTopCardsLoading,
        isClientMetricsLoading,
        isCartPandaLoading,
        isMetricsLoading,
        isAgencyLoading,

        // Refetch
        refetchAll,

        // Profit / supplier
        profitSettings,
        saveProfitSettings,
        supplierPayments,
        saveSupplierPayments,
        totalSupplierPayments,
    };
}

export type DashboardData = ReturnType<typeof useDashboardData>["data"];
