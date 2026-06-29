import { useMemo, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Banknote, Plus, ShoppingCart, MousePointerClick, TrendingUp, CreditCard, Wallet, Loader2, Send, Copy, FileText, MessageCircle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { useDashboardData } from '@/dashboard/hooks/useDashboardData';
import { DateRangeFilter, KpiTopCards, CommissionCard, InvestmentMetricsGrid, PerformanceChart } from '@/dashboard/blocks';
import { formatCurrencyBRL } from '@/lib/formatters';

export type OverviewDateRange = 'today' | '7d' | 'month' | 'custom';

interface OverviewCloneProps {
    /**
     * Override do slot 4 do topo (Comissão pra admin/funcionário, Lucro pra cliente).
     * Quando não passado, escolhe automaticamente via `usePermissions().isClient`
     * (comportamento legacy mantido pra rota `/overview-old`).
     */
    topKpiSlot?: ReactNode;
    /**
     * Override do cliente — passado pelo portal pra forçar `linkedClientId`.
     */
    clientIdOverride?: string | null;
}

const OverviewClone = ({ topKpiSlot, clientIdOverride }: OverviewCloneProps = {}) => {
    const { t } = useTranslation();
    const { isClient } = usePermissions();
    const { instanceName: wpInstanceName } = useWhatsApp();

    // Fonte única de dados — substitui ~520 linhas de hooks/state/useMemo inline.
    const dashboard = useDashboardData({ clientIdOverride });
    const {
        dateFilter, setDateFilter, dateRange, setDateRange,
        apiDates,
        selectedClientId,
        data: combinedMetrics,
        chartsData, dailyBreakdown, shopify, cartPandaSummary, orders,
        clientData, isAgencyAggregateView, shopifyConnected,
        isLoading: isTopCardsLoading,
        isClientMetricsLoading, isCartPandaLoading,
        refetchAll,
        profitSettings, saveProfitSettings,
        supplierPayments, saveSupplierPayments, totalSupplierPayments,
    } = dashboard;

    // ─── State UI local (dialogs) ──────────────────────────────
    const [isProfitSettingsOpen, setIsProfitSettingsOpen] = useState(false);
    const [isSavingProfitSettings, setIsSavingProfitSettings] = useState(false);
    const [newPayment, setNewPayment] = useState({ date: new Date().toISOString().split('T')[0], value: 0, description: '', category: 'produto' as const });

    // Weekly Report State
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [whatsappGroups, setWhatsappGroups] = useState<{ id: string; subject: string }[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [isSendingReport, setIsSendingReport] = useState(false);
    const [isLoadingGroups, setIsLoadingGroups] = useState(false);
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
    const [reportTypeToShare, setReportTypeToShare] = useState<'standard' | 'ai'>('standard');

    const EVOLUTION_API_URL = 'https://evo.jotabot.site';
    const EVOLUTION_API_KEY = 'JotaBotEVO2025_API_Key_Definitiva';

    const fetchWhatsAppGroups = async () => {
        if (!wpInstanceName) {
            toast.error('WhatsApp não está conectado (ou não foi possível carregar a conexão).');
            return;
        }
        setIsLoadingGroups(true);
        try {
            const res = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/${wpInstanceName}?getParticipants=false`, {
                headers: { 'apikey': EVOLUTION_API_KEY }
            });
            if (!res.ok) throw new Error(`Erro ${res.status}`);
            const data = await res.json();
            const groups = Array.isArray(data) ? data : (data.groups || data.data || []);
            setWhatsappGroups(groups.map((g: any) => ({ id: g.id, subject: g.subject || g.name || g.id })));
        } catch (err: any) {
            console.error('[Report] Error fetching groups:', err);
            toast.error('Erro ao carregar grupos', { description: err.message });
        } finally {
            setIsLoadingGroups(false);
        }
    };

    const addSupplierPayment = () => {
        if (newPayment.value <= 0) return;
        const payment = { id: crypto.randomUUID(), ...newPayment };
        saveSupplierPayments([...supplierPayments, payment]);
        setNewPayment({ date: new Date().toISOString().split('T')[0], value: 0, description: '', category: 'produto' });
        toast.success('Pagamento adicionado!');
    };

    const removeSupplierPayment = (id: string) => {
        saveSupplierPayments(supplierPayments.filter(p => p.id !== id));
    };

    const totalProductPayments = useMemo(
        () => supplierPayments.filter(p => p.category === 'produto').reduce((sum, p) => sum + p.value, 0),
        [supplierPayments]
    );

    const handleSaveProfitSettings = async (settings: typeof profitSettings) => {
        if (!clientData?.id) return;
        setIsSavingProfitSettings(true);
        try {
            await saveProfitSettings(settings);
            setIsProfitSettingsOpen(false);
            toast.success(t('overview.profit_settings.success', 'Configurações salvas com sucesso'));
        } catch (err) {
            console.error("Error saving profit settings:", err);
            toast.error(t('overview.profit_settings.error', 'Erro ao salvar configurações'));
        } finally {
            setIsSavingProfitSettings(false);
        }
    };

    /**
     * Helper de formatação local — usado em InvestmentMetricsGrid, Chart, Funil, Dialogs.
     * Será removido em Fase 2 quando esses blocos forem extraídos pra componentes próprios.
     */
    const formatValue = (value: number, type: 'currency' | 'number' | 'percent') => {
        if (type === 'currency') return formatCurrencyBRL(value);
        if (type === 'percent') return `${value.toFixed(2)}%`;
        if (type === 'number') {
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toLocaleString('pt-BR');
        }
        return value.toString();
    };

    const displayedChartData = useMemo(() => {
        let data = [];
        if (dateFilter === 'today') {
            const baseHourly = chartsData.hourlyEvolution || [];
            const totalSpend = combinedMetrics.spend || 0;
            const currentHour = new Date().getHours();
            const currentDayStr = new Date().toISOString().split('T')[0];

            // Use real order timestamps when available (Shopify or CartPanda)
            const realOrders = shopifyConnected ? shopify.orders : (orders || []);
            const hasRealOrders = realOrders.length > 0;

            // Distribute spend by hour using Meta ads typical pattern
            const spendDistribution = [
                1, 0.5, 0.3, 0.2, 0.2, 0.3, 1, 2.5, 4.5, 6, 7, 7.5,
                7.5, 7, 6.5, 6, 6.5, 7, 8, 8.5, 7, 5.5, 3.5, 2
            ];
            const activeSpendHours = spendDistribution.slice(0, currentHour + 1);
            const spendTotal = activeSpendHours.reduce((a, b) => a + b, 0);

            // AGENCY AGGREGATE: distribute real cross-client revenue/spend across hours of today
            // using ecom traffic pattern (peaks 10-22h). Used for marketing screenshots.
            if (isAgencyAggregateView && combinedMetrics.bestRevenue > 0) {
                const revenueDistribution = [
                    0.3, 0.15, 0.1, 0.08, 0.08, 0.15, 0.4, 1, 2, 3.5, 5, 6,
                    6.5, 6, 5.5, 5, 5.5, 6.5, 8, 9, 8.5, 6.5, 4, 2
                ];
                const activeRev = revenueDistribution.slice(0, currentHour + 1);
                const revTotal = activeRev.reduce((a, b) => a + b, 0) || 1;
                const totalRevenue = combinedMetrics.bestRevenue;
                data = Array.from({ length: currentHour + 1 }, (_, hour) => {
                    const sFactor = spendTotal > 0 ? (spendDistribution[hour] / spendTotal) : 0;
                    const rFactor = revenueDistribution[hour] / revTotal;
                    const hSpend = totalSpend * sFactor;
                    const hRevenue = totalRevenue * rFactor;
                    return {
                        date: `${String(hour).padStart(2, '0')}:00`,
                        fullDate: currentDayStr,
                        spend: hSpend,
                        revenue: hRevenue,
                        bestRevenue: hRevenue,
                        externalCosts: 0,
                        profit: hRevenue - hSpend,
                        roas: hSpend > 0 ? hRevenue / hSpend : 0,
                        _isGhost: false,
                    };
                });
                // Add spacer + ghost fill is appended below by the existing logic — early return
                const maxVal = Math.max(...data.map((d: any) => (d.bestRevenue || 0) + (d.spend || 0)), 1);
                const spacerValue = maxVal * 0.02;
                data = data.map((d: any) => ({ ...d, _spacer: spacerValue, _isGhost: false }));
                const ghostHeight = maxVal * 0.5;
                for (let h = currentHour + 1; h < 24; h++) {
                    data.push({
                        date: `${String(h).padStart(2, '0')}:00`,
                        fullDate: currentDayStr,
                        spend: 0, bestRevenue: 0, revenue: 0, externalCosts: 0,
                        profit: 0, roas: 0, conversions: 0,
                        _spacer: 0, _isGhost: true, _ghostHeight: ghostHeight,
                    });
                }
                return data;
            }

            if (hasRealOrders) {
                // Aggregate revenue by hour from real orders
                const hourlyRevenue = new Array(24).fill(0);
                for (const order of realOrders) {
                    const status = (order as any).financialStatus || (order as any).paymentStatus;
                    if (status !== 'paid') continue;
                    const orderDate = new Date((order as any).createdAt);
                    const hour = orderDate.getHours();
                    hourlyRevenue[hour] += (order as any).totalPrice || 0;
                }

                data = hourlyRevenue.slice(0, currentHour + 1).map((hRevenue, hour) => {
                    const spendFactor = spendTotal > 0 ? (spendDistribution[hour] / spendTotal) : 0;
                    const hSpend = totalSpend * spendFactor;
                    const hExternalCosts = totalSupplierPayments * spendFactor;
                    return {
                        date: `${String(hour).padStart(2, '0')}:00`,
                        fullDate: currentDayStr,
                        spend: hSpend,
                        revenue: hRevenue,
                        bestRevenue: hRevenue,
                        externalCosts: hExternalCosts,
                        profit: hRevenue - hSpend - hExternalCosts,
                        roas: hSpend > 0 ? hRevenue / hSpend : 0,
                        _isGhost: false,
                    };
                });
            } else if (selectedClientId && (combinedMetrics.bestRevenue > 0 || totalSpend > 0)) {
                // Fallback: distribute using spend pattern
                const totalRevenue = combinedMetrics.bestRevenue;
                data = Array.from({ length: currentHour + 1 }, (_, hour) => {
                    const spendFactor = spendTotal > 0 ? (spendDistribution[hour] / spendTotal) : (1 / (currentHour + 1));
                    const hSpend = totalSpend * spendFactor;
                    const hRevenue = totalRevenue * spendFactor;
                    const hExternalCosts = totalSupplierPayments * spendFactor;
                    return {
                        date: `${String(hour).padStart(2, '0')}:00`,
                        fullDate: currentDayStr,
                        spend: hSpend,
                        revenue: hRevenue,
                        bestRevenue: hRevenue,
                        externalCosts: hExternalCosts,
                        profit: hRevenue - hSpend - hExternalCosts,
                        roas: hSpend > 0 ? hRevenue / hSpend : 0,
                        _isGhost: false,
                    };
                });
            } else {
                data = baseHourly.map((h: any) => ({
                    ...h,
                    bestRevenue: h.revenue || 0,
                }));
            }
        } else {
            // Build daily revenue/orders map from Shopify/CartPanda when those are the revenue source
            const externalSource = (combinedMetrics as any).revenueSource as string | undefined;
            const useExternal = externalSource === 'Shopify' || externalSource === 'CartPanda';
            const externalOrders = externalSource === 'Shopify' ? shopify.orders : (externalSource === 'CartPanda' ? (orders || []) : []);
            const externalDailyMap: Record<string, { revenue: number; orders: number }> = {};
            if (useExternal && externalOrders.length > 0) {
                for (const o of externalOrders as any[]) {
                    const status = o.financialStatus || o.paymentStatus;
                    if (status && status !== 'paid') continue;
                    const created = o.createdAt;
                    if (!created) continue;
                    const d = new Date(created);
                    if (Number.isNaN(d.getTime())) continue;
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const key = `${yyyy}-${mm}-${dd}`;
                    if (!externalDailyMap[key]) externalDailyMap[key] = { revenue: 0, orders: 0 };
                    externalDailyMap[key].revenue += (o.totalPrice || 0);
                    externalDailyMap[key].orders += 1;
                }
            }

            // PRIMARY SOURCE: Use real per-day Meta API data (dailyBreakdown) when available
            if (selectedClientId && dailyBreakdown && dailyBreakdown.length > 0) {
                const daysInPeriod = dailyBreakdown.length || 1;
                const dailyExternalCosts = totalSupplierPayments / daysInPeriod;

                data = dailyBreakdown.map(day => {
                    const external = externalDailyMap[day.date];
                    const bestRevenue = useExternal && external ? external.revenue : (day.revenue || 0);
                    const bestOrderCount = useExternal && external ? external.orders : (day.conversions || 0);
                    const feeMultiplier = 1 - (profitSettings.gateway_percent / 100) - (profitSettings.tax_percent / 100);
                    const netRevenue = bestRevenue * feeMultiplier;
                    const actualProfit = netRevenue - day.spend - profitSettings.fixed_costs - (bestOrderCount * profitSettings.product_cost) - dailyExternalCosts;

                    return {
                        date: day.date.split('-').slice(1).reverse().join('/'),
                        fullDate: day.date,
                        spend: day.spend,
                        revenue: bestRevenue,
                        bestRevenue,
                        conversions: bestOrderCount,
                        externalCosts: dailyExternalCosts,
                        profit: actualProfit,
                        roas: day.spend > 0 ? (bestRevenue / day.spend) : 0
                    };
                });
            } else {
                // FALLBACK: Use Supabase DB data (chartsData.financialEvolution) when no client is selected
                const rawBaseData = chartsData.financialEvolution || [];
                const dailyAggregated: Record<string, any> = {};

                rawBaseData.forEach(item => {
                    const fullDate = (item as any).fullDate || item.date;
                    if (!fullDate) return;
                    const dateKey = fullDate.split(' ')[0].split('T')[0];
                    if (!dailyAggregated[dateKey]) {
                        dailyAggregated[dateKey] = {
                            date: dateKey.split('-').slice(1).reverse().join('/'),
                            fullDate: dateKey,
                            spend: 0,
                            revenue: 0,
                            profit: 0,
                            roas: 0
                        };
                    }
                    dailyAggregated[dateKey].spend += (item.spend || 0);
                    dailyAggregated[dateKey].revenue += (item.revenue || 0);
                });

                data = Object.values(dailyAggregated)
                    .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
                    .map(day => {
                        const bestRevenue = day.revenue || 0;
                        const daysInPeriod = Object.keys(dailyAggregated).length || 1;
                        const dailyExternalCosts = totalSupplierPayments / daysInPeriod;
                        return {
                            ...day,
                            bestRevenue,
                            externalCosts: dailyExternalCosts,
                            profit: bestRevenue - day.spend - dailyExternalCosts,
                            roas: day.spend > 0 ? (bestRevenue / day.spend) : 0
                        };
                    });
            }
        }
        // Add spacer for stacked chart gap
        const maxVal = Math.max(...data.map((d: any) => (d.bestRevenue || 0) + (d.spend || 0)), 1);
        const spacerValue = maxVal * 0.02; // 2% of max for subtle gap
        data = data.map((d: any) => ({ ...d, _spacer: spacerValue, _isGhost: false }));

        // Fill remaining days with ghost placeholders for month view
        if (dateFilter === 'month' || dateFilter === '7d' || dateFilter === 'custom') {
            const today = new Date();
            let endOfPeriod: Date;
            if (dateFilter === 'month') {
                endOfPeriod = new Date(today.getFullYear(), today.getMonth() + 1, 0); // last day of month
            } else if (dateFilter === '7d') {
                endOfPeriod = today; // no ghost for 7d since it's backward-looking
            } else {
                endOfPeriod = dateRange?.to || today;
            }

            if (dateFilter === 'month' && data.length > 0) {
                const lastDataDate = data[data.length - 1]?.fullDate;
                if (lastDataDate) {
                    const lastDate = new Date(lastDataDate + 'T12:00:00');
                    const daysToFill = endOfPeriod.getDate() - lastDate.getDate();
                    const ghostHeight = maxVal * 0.5; // ghost bars at 50% height (middle)
                    for (let i = 1; i <= daysToFill; i++) {
                        const ghostDate = new Date(lastDate);
                        ghostDate.setDate(lastDate.getDate() + i);
                        const dd = String(ghostDate.getDate()).padStart(2, '0');
                        const mm = String(ghostDate.getMonth() + 1).padStart(2, '0');
                        data.push({
                            date: `${dd}/${mm}`,
                            fullDate: `${ghostDate.getFullYear()}-${mm}-${dd}`,
                            spend: 0,
                            bestRevenue: 0,
                            revenue: 0,
                            externalCosts: 0,
                            profit: 0,
                            roas: 0,
                            conversions: 0,
                            _spacer: 0,
                            _isGhost: true,
                            _ghostHeight: ghostHeight,
                        });
                    }
                }
            }
        }

        // Fill remaining hours for 'today' view with ghost placeholders
        if (dateFilter === 'today' && data.length > 0) {
            const currentHour = new Date().getHours();
            const ghostHeight = maxVal * 0.5;
            const currentDayStr = new Date().toISOString().split('T')[0];
            for (let h = currentHour + 1; h < 24; h++) {
                data.push({
                    date: `${String(h).padStart(2, '0')}:00`,
                    fullDate: currentDayStr,
                    spend: 0,
                    bestRevenue: 0,
                    revenue: 0,
                    externalCosts: 0,
                    profit: 0,
                    roas: 0,
                    conversions: 0,
                    _spacer: 0,
                    _isGhost: true,
                    _ghostHeight: ghostHeight,
                });
            }
        }

        return data;
    }, [chartsData.financialEvolution, chartsData.hourlyEvolution, dateFilter, selectedClientId, combinedMetrics, orders, shopify.orders, shopifyConnected, profitSettings, totalSupplierPayments, dailyBreakdown, dateRange]);

    return (
        <div className="flex flex-col gap-6 p-6 min-h-screen bg-background text-foreground overflow-x-hidden">
            {/* HEADER + DATE FILTER */}
            <DateRangeFilter
                value={dateFilter}
                onChange={setDateFilter}
                customRange={dateRange}
                onCustomRange={setDateRange}
                onRefresh={refetchAll}
                isRefreshing={isTopCardsLoading || shopify.isLoading}
            />

            {/* TOP CARDS GRID — 3 KPIs fixos + 1 slot polimórfico (Comissão | Lucro Previsto) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiTopCards
                    revenue={combinedMetrics.bestRevenue}
                    spend={combinedMetrics.spend}
                    roas={combinedMetrics.roas}
                    isLoading={isTopCardsLoading}
                />
                {topKpiSlot ?? (
                    <CommissionCard commission={combinedMetrics.commission} isLoading={isTopCardsLoading} />
                )}
            </div>

            {/* INVESTMENT METRICS GRID — 7 mini-cards (CPC / CTR / CPM / CPA / Vendas / Ticket / Conversões) */}
            <InvestmentMetricsGrid metrics={combinedMetrics} />

            {/* MIDDLE SECTION: CHART + WeeklyReport */}
            {/* Grid switch: 1 col se !isClient esconder o WeeklyReport, senão 4 cols c/ chart spanning 3 */}
            <div className={`grid grid-cols-1 ${isClient ? 'lg:grid-cols-1' : 'lg:grid-cols-4'} gap-4`}>
                <div className={isClient ? '' : 'lg:col-span-3'}>
                    <PerformanceChart
                        data={displayedChartData}
                        isLoading={isClientMetricsLoading || isCartPandaLoading}
                    />
                </div>

                {/* RELATÓRIO SEMANAL — Weekly Report Card (hidden in portal) */}
                {!isClient && (
                    <Card className="bg-card border-border text-card-foreground shadow-none rounded-2xl group hover:border-primary/20 transition-colors">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2 w-full">
                                <div className="p-1.5 bg-emerald-500/10 rounded-full shrink-0">
                                    <FileText className="w-4 h-4 text-emerald-400" strokeWidth={2} />
                                </div>
                                <div className="flex items-center justify-between w-full">
                                    <CardTitle className="text-sm font-bold capitalize text-muted-foreground">Relatório Semanal</CardTitle>
                                    <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                        📅 {(() => {
                                            const d = apiDates;
                                            const fmtBr = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');
                                            if (dateFilter === 'today') return `Hoje — ${fmtBr(d.startDate)}`;
                                            if (dateFilter === '7d') return `7 dias — ${fmtBr(d.startDate)} a ${fmtBr(d.endDate)}`;
                                            if (dateFilter === 'month') return `Mês — ${fmtBr(d.startDate)} a ${fmtBr(d.endDate)}`;
                                            return `${fmtBr(d.startDate)} a ${fmtBr(d.endDate)}`;
                                        })()}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col px-6 pb-4 pt-2">
                            <h3 className="text-3xl font-bold truncate text-foreground">{formatValue(combinedMetrics.bestRevenue, 'currency')}</h3>
                            <p className="text-[10px] text-muted-foreground mt-1">Faturamento Total</p>

                            <div className="space-y-3 flex-1 mt-5">
                                {(() => {
                                    const spendTotal = combinedMetrics.spend || 0;
                                    const ordersTotal = combinedMetrics.bestOrders || 0;
                                    const pageViewsTotal = (combinedMetrics as any).pageViews || 0;
                                    return [
                                        { label: 'Investimento em Tráfego', value: formatValue(spendTotal, 'currency'), color: 'text-blue-400' },
                                        { label: 'Compras Geradas', value: `${ordersTotal}`, color: ordersTotal > 0 ? 'text-emerald-400' : 'text-muted-foreground/40' },
                                        { label: 'CPA', value: ordersTotal > 0 && spendTotal > 0 ? formatValue(combinedMetrics.bestCpa, 'currency') : '—', color: 'text-amber-400' },
                                        { label: 'Ticket Médio', value: ordersTotal > 0 ? formatValue(combinedMetrics.bestTicket, 'currency') : '—', color: 'text-emerald-400' },
                                        { label: 'ROAS', value: spendTotal > 0 ? `${combinedMetrics.roas.toFixed(2)}x` : '—', color: spendTotal > 0 && combinedMetrics.roas >= 1 ? 'text-emerald-400' : 'text-[#FF2D55]' },
                                        { label: 'Taxa de Conversão', value: pageViewsTotal > 0 ? `${((ordersTotal / pageViewsTotal) * 100).toFixed(2)}%` : '—', color: 'text-blue-400' },
                                    ];
                                })().map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[11px] pb-2.5 border-b border-border/20 last:border-0 capitalize tracking-wider font-bold">
                                        <span className="text-foreground flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-border" />
                                            {item.label}
                                        </span>
                                        <span className={`font-mono-numbers ${item.color}`}>{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            <Button
                                size="sm"
                                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                onClick={() => { setIsReportDialogOpen(true); fetchWhatsAppGroups(); }}
                            >
                                <FileText className="w-3.5 h-3.5 mr-2" />
                                Gerar Relatório
                            </Button>
                        </CardContent>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
                    </Card>
                )}
            </div>



            {/* PAYMENT METHODS - Real data from Shopify */}
            {(() => {
                const methods = shopify.summary?.paymentMethods || [];
                if (methods.length === 0 && !shopifyConnected) return null;
                const totalAllRevenue = methods.reduce((acc, m) => acc + m.total, 0) || 1;
                const methodColors: Record<string, string> = { credit_card: '#22c55e', pix: '#22c55e', boleto: '#22c55e', other: '#22c55e' };
                const summaryData = methods.map(m => ({
                    label: m.label,
                    sharePercent: Math.round((m.total / totalAllRevenue) * 100),
                    color: methodColors[m.method] || '#22c55e',
                }));

                return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Summary card */}
                        <Card className="bg-card border-border shadow-none rounded-2xl">
                            <CardHeader className="pb-1 pt-4 px-5">
                                <CardTitle className="text-sm font-bold">Formas de Pagamento</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center gap-3 px-5 pb-4 pt-2">
                                <div className="relative w-16 h-16 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={summaryData.map(s => ({ name: s.label, value: s.sharePercent }))}
                                                innerRadius={20}
                                                outerRadius={28}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {summaryData.map((s, i) => <Cell key={i} fill={s.label === 'Cartão de Crédito' ? '#22c55e' : s.label === 'Pix' ? '#ef4444' : '#eab308'} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {summaryData.map((s, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-xs">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.label === 'Cartão de Crédito' ? '#22c55e' : s.label === 'Pix' ? '#ef4444' : '#eab308' }} />
                                            <span className="text-muted-foreground">{s.label}</span>
                                            <span className="font-bold ml-auto">{s.sharePercent}%</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Individual method cards */}
                        {methods.map((m, idx) => (
                            <Card key={idx} className="bg-card border-border shadow-none rounded-2xl">
                                <CardHeader className="pb-1 pt-4 px-5">
                                    <CardTitle className="text-sm font-bold">{m.label}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex items-center gap-3 px-5 pb-4 pt-2">
                                    <div className="relative w-16 h-16 shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[{ value: m.percent }, { value: 100 - m.percent }]}
                                                    innerRadius={20}
                                                    outerRadius={28}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    <Cell fill={m.method === 'pix' ? '#ef4444' : m.method === 'boleto' ? '#eab308' : '#22c55e'} />
                                                    <Cell fill="hsl(var(--muted))" />
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[11px] font-bold">{m.percent}%</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 flex-1 text-xs">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-muted-foreground">Aprovado</span>
                                            </div>
                                            <span className="font-bold">{formatValue(m.paid, 'currency')}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                <span className="text-muted-foreground">Pendente</span>
                                            </div>
                                            <span className="font-bold">{formatValue(m.pending, 'currency')}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                <span className="text-muted-foreground">Cancelado</span>
                                            </div>
                                            <span className="font-bold">{formatValue(m.cancelled, 'currency')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                );
            })()}

            {/* MARKETING FUNNEL - Integrated styling */}
            <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-2 mb-0 z-10 px-1">
                    <div className="p-1.5 bg-primary/10 rounded-full">
                        <TrendingUp className="w-4 h-4 text-primary" strokeWidth={2} />
                    </div>
                    <CardTitle className="text-sm font-bold capitalize">Funil de Vendas</CardTitle>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-10">
                    {(() => {
                        const clicks = combinedMetrics?.clicks || 0;
                        const pageViewsRaw = (combinedMetrics as any)?.pageViews || 0;
                        const atc = combinedMetrics?.addToCart || 0;
                        const ic = combinedMetrics?.initiateCheckout || 0;
                        const pur = combinedMetrics?.bestOrders || 0;

                        const base = pageViewsRaw > 0 ? pageViewsRaw : clicks;
                        const baseLabel = pageViewsRaw > 0 ? 'visitas' : 'cliques';
                        const denom = Math.max(base, 1);

                        const atcRate = Math.min((atc / denom) * 100, 100);
                        const icRate = Math.min((ic / denom) * 100, 100);
                        const purRate = Math.min((pur / denom) * 100, 100);
                        const topLabel = pageViewsRaw > 0 ? 'Visitas' : 'Cliques';
                        const topValue = pageViewsRaw > 0 ? pageViewsRaw : clicks;

                        return [
                            { label: topLabel, percent: '100,0%', value: `${formatValue(topValue, 'number')}`, height: '100%', baseColor: 'bg-[#34C759]', icon: <MousePointerClick className="w-3 h-3 text-primary" /> },
                            { label: 'Add to Cart', percent: base > 0 ? `${atcRate.toFixed(1)}%` : '—', value: `${formatValue(atc, 'number')} de ${formatValue(base, 'number')} ${baseLabel}`, height: `${Math.max(8, atcRate)}%`, baseColor: 'bg-[#34C759]', icon: <ShoppingCart className="w-3 h-3 text-primary" /> },
                            { label: 'Checkout', percent: base > 0 ? `${icRate.toFixed(1)}%` : '—', value: `${formatValue(ic, 'number')} de ${formatValue(base, 'number')} ${baseLabel}`, height: `${Math.max(8, icRate)}%`, baseColor: 'bg-[#34C759]', icon: <CreditCard className="w-3 h-3 text-primary" /> },
                            { label: 'Compras', percent: base > 0 ? `${purRate.toFixed(1)}%` : '—', value: `${formatValue(pur, 'number')}`, height: `${Math.max(8, purRate)}%`, baseColor: 'bg-[#34C759]', icon: <Banknote className="w-3 h-3 text-primary" /> },
                        ];
                    })().map((step, idx) => (
                        <div key={idx} className="flex flex-col bg-card rounded-2xl relative overflow-hidden border border-border h-[164px] justify-between">
                            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center gap-2 z-20 relative">
                                <div className="p-1.5 bg-primary/10 rounded-full">
                                    {step.icon}
                                </div>
                                <CardTitle className="text-sm font-bold capitalize">{step.label}</CardTitle>
                            </CardHeader>
                            <div className="z-20 relative px-5 pb-8 pt-0 flex flex-col items-center text-center justify-center flex-1 gap-1">
                                <h2 className="text-3xl font-bold font-mono-numbers tracking-tight text-foreground">{step.percent}</h2>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono-numbers">
                                    {step.value}
                                </p>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-muted">
                                <div
                                    className={`h-full ${step.baseColor} transition-all duration-[800ms] ease-out`}
                                    style={{ width: (step as any).height || '0%' }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal de Valores Adicionais (Pagamentos a Fornecedores) */}
            <Dialog open={isProfitSettingsOpen} onOpenChange={setIsProfitSettingsOpen}>
                <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Valores Adicionais</DialogTitle>
                        <DialogDescription>
                            Registre pagamentos a fornecedores. Esses valores são subtraídos automaticamente do lucro previsto.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Add new payment form */}
                        <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border/30">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Novo Pagamento</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1">
                                    <label className="text-xs text-muted-foreground">Data</label>
                                    <Input
                                        type="date"
                                        value={newPayment.date}
                                        onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <label className="text-xs text-muted-foreground">Valor (R$)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                                            <span className="text-muted-foreground text-xs">R$</span>
                                        </div>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={newPayment.value || ''}
                                            onChange={(e) => setNewPayment({ ...newPayment, value: parseFloat(e.target.value) || 0 })}
                                            className="pl-8 h-9"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-1">
                                <label className="text-xs text-muted-foreground">Descrição</label>
                                <Input
                                    value={newPayment.description}
                                    onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                                    placeholder="Ex: Pagamento fornecedor lote #42"
                                    className="h-9"
                                />
                            </div>
                            <div className="grid gap-1">
                                <label className="text-xs text-muted-foreground">Categoria</label>
                                <select
                                    value={newPayment.category}
                                    onChange={(e) => setNewPayment({ ...newPayment, category: e.target.value as any })}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="produto">🏷️ Produto</option>
                                    <option value="fornecedor">🏭 Fornecedor</option>
                                    <option value="operacional">⚙️ Operacional</option>
                                    <option value="outro">📌 Outro</option>
                                </select>
                            </div>
                            <Button onClick={addSupplierPayment} disabled={newPayment.value <= 0} size="sm" className="w-full gap-2">
                                <Plus className="h-3.5 w-3.5" />
                                Adicionar Pagamento
                            </Button>
                        </div>

                        {/* Payment history */}
                        {supplierPayments.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Histórico</p>
                                    <p className="text-xs font-bold text-emerald-400">Total: {formatValue(totalSupplierPayments, 'currency')}</p>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                                    {supplierPayments
                                        .sort((a, b) => b.date.localeCompare(a.date))
                                        .map((payment) => (
                                            <div key={payment.id} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2.5 border border-border/20 group">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-muted-foreground font-mono">
                                                            {payment.date.split('-').reverse().join('/')}
                                                        </span>
                                                        <span className="text-xs font-bold">{formatValue(payment.value, 'currency')}</span>
                                                        <span className="text-[9px] bg-muted/40 px-1.5 py-0.5 rounded-full">
                                                            {payment.category === 'produto' ? '🏷️' : payment.category === 'fornecedor' ? '🏭' : payment.category === 'operacional' ? '⚙️' : '📌'}
                                                        </span>
                                                    </div>
                                                    {payment.description && (
                                                        <p className="text-[10px] text-muted-foreground truncate">{payment.description}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                                    onClick={() => removeSupplierPayment(payment.id)}
                                                >
                                                    ×
                                                </Button>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {supplierPayments.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">Nenhum pagamento registrado</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsProfitSettingsOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ====== WEEKLY REPORT DIALOG ====== */}
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-emerald-500" />
                            Relatório Semanal
                        </DialogTitle>
                        <DialogDescription>
                            {(() => { const d = apiDates; return `Período: ${new Date(d.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(d.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}`; })()}
                            {clientData?.name && ` · ${clientData.name}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {[
                            { label: 'Investimento Total em Tráfego', value: formatValue(combinedMetrics.spend, 'currency') },
                            { label: 'Compras Geradas', value: `${combinedMetrics.bestOrders}` },
                            { label: 'Faturamento Total', value: formatValue(combinedMetrics.bestRevenue, 'currency') },
                            { label: 'CPA (Custo por Aquisição)', value: formatValue(combinedMetrics.bestCpa, 'currency') },
                            { label: 'Ticket Médio', value: formatValue(combinedMetrics.bestTicket, 'currency') },
                            { label: 'ROAS (Retorno sobre Investimento)', value: `${combinedMetrics.roas.toFixed(2)}` },
                            { label: 'Taxa de Conversão', value: (combinedMetrics as any).pageViews > 0 ? `${((combinedMetrics.bestOrders / (combinedMetrics as any).pageViews) * 100).toFixed(2)}%` : '—' },
                        ].map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm py-2 px-3 rounded-lg bg-muted/30">
                                <span className="text-muted-foreground font-medium">{item.label}</span>
                                <span className="font-bold font-mono-numbers">{item.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* GEMINI AI REPORT */}
                    <div className="border-t border-border/50 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                Análise IA
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-bold border-violet-300 text-violet-600 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30"
                                disabled={isGeneratingAiReport}
                                onClick={async () => {
                                    setIsGeneratingAiReport(true);
                                    try {
                                        const dates = apiDates;
                                        const periodStr = `${new Date(dates.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dates.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}`;
                                        const context = {
                                            cliente: clientData?.name || 'Geral',
                                            periodo: periodStr,
                                            investimento: formatValue(combinedMetrics.spend, 'currency'),
                                            faturamento: formatValue(combinedMetrics.bestRevenue, 'currency'),
                                            vendas: combinedMetrics.bestOrders,
                                            roas: combinedMetrics.roas.toFixed(2),
                                            cpa: formatValue(combinedMetrics.bestCpa, 'currency'),
                                            ticket_medio: formatValue(combinedMetrics.bestTicket, 'currency'),
                                            cpc: formatValue(combinedMetrics.cpc || 0, 'currency'),
                                            ctr: `${((combinedMetrics as any).ctr || 0).toFixed(2)}%`,
                                            lucro_previsto: formatValue(combinedMetrics.profit, 'currency'),
                                            fonte_dados: (combinedMetrics as any).revenueSource || 'Meta',
                                        };
                                        const { data: { session } } = await supabase.auth.getSession();
                                        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-ai`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
                                            },
                                            body: JSON.stringify({
                                                action: 'analyzeWithContext',
                                                prompt: `Gere um relatório executivo de performance de marketing digital.
O relatório deve ser profissional, direto e adequado para envio ao cliente.
Inclua: resumo executivo, análise de investimento x retorno, principais indicadores, pontos de atenção e recomendações.
Formate para envio via WhatsApp (use *negrito* e emojis).
Responda em português brasileiro.`,
                                                context,
                                                temperature: 0.4,
                                                maxTokens: 4000
                                            })
                                        });

                                        const data = await res.json();
                                        if (!res.ok) {
                                            const errorMsg = data?.error || data?.message || `Erro do servidor: ${res.status}`;
                                            throw new Error(errorMsg);
                                        }
                                        setAiReport(data?.data?.text || 'Não foi possível gerar o relatório.');
                                    } catch (err: any) {
                                        console.error('[Report] AI error:', err);
                                        setAiReport(`❌ Erro: ${err.message}`);
                                    } finally {
                                        setIsGeneratingAiReport(false);
                                    }
                                }}
                            >
                                {isGeneratingAiReport ? (
                                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Gerando...</>
                                ) : (
                                    <><Sparkles className="w-3 h-3 mr-1" /> {aiReport ? 'Gerar Novamente' : 'Gerar com IA'}</>
                                )}
                            </Button>
                        </div>
                        {aiReport && (
                            <div className="bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/30 rounded-lg p-4 text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 max-h-[40vh] overflow-y-auto shadow-inner">
                                {aiReport}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border/50 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                                <MessageCircle className="w-3.5 h-3.5" />
                                Enviar via WhatsApp
                            </p>

                            <div className="flex bg-muted/50 p-1 rounded-lg">
                                <button
                                    onClick={() => setReportTypeToShare('standard')}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${reportTypeToShare === 'standard' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    Padrão
                                </button>
                                <button
                                    onClick={() => setReportTypeToShare('ai')}
                                    disabled={!aiReport}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-colors flex items-center gap-1 ${reportTypeToShare === 'ai' ? 'bg-violet-100 dark:bg-violet-900/50 shadow-sm text-violet-700 dark:text-violet-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'} ${!aiReport ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Sparkles className="w-3 h-3" /> IA
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                <SelectTrigger className="h-10 text-sm flex-1">
                                    <SelectValue placeholder={isLoadingGroups ? 'Carregando grupos...' : 'Selecione um grupo'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {whatsappGroups.length === 0 && !isLoadingGroups && (
                                        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                            <p className="font-medium">Nenhum grupo encontrado</p>
                                            <p className="mt-1">Conecte seu WhatsApp primeiro na página Conexões</p>
                                        </div>
                                    )}
                                    {whatsappGroups.map((group) => (
                                        <SelectItem key={group.id} value={group.id}>
                                            {group.subject}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                size="sm"
                                className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white px-4"
                                disabled={!selectedGroupId || isSendingReport}
                                onClick={async () => {
                                    setIsSendingReport(true);
                                    try {
                                        if (!wpInstanceName) throw new Error('Conexão do WhatsApp não encontrada para esta agência');

                                        // Check connection state and reconnect if needed
                                        const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${wpInstanceName}`, {
                                            headers: { 'apikey': EVOLUTION_API_KEY }
                                        });
                                        const stateData = await stateRes.json();
                                        const connState = stateData.instance?.state || stateData.state;

                                        if (connState !== 'open') {
                                            console.log('[Report] Instance not open, attempting reconnect...', connState);
                                            // Try to connect/restart the instance
                                            await fetch(`${EVOLUTION_API_URL}/instance/connect/${wpInstanceName}`, {
                                                headers: { 'apikey': EVOLUTION_API_KEY }
                                            });
                                            // Wait a moment for the session to establish
                                            await new Promise(r => setTimeout(r, 2000));
                                        }

                                        let reportText = '';
                                        if (reportTypeToShare === 'ai' && aiReport) {
                                            reportText = aiReport;
                                        } else {
                                            const dates = apiDates;
                                            const periodStr = `${new Date(dates.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dates.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}`;
                                            reportText = [
                                                `📊 *Relatório Semanal – Beacon*`,
                                                `🗓️ *Período:* ${periodStr}`,
                                                `${clientData?.name ? `👤 *Cliente:* ${clientData.name}` : ''}`,
                                                ``,
                                                `*Investimento Total em Tráfego:*`,
                                                `${formatValue(combinedMetrics.spend, 'currency')}`,
                                                ``,
                                                `*Compras Geradas:*`,
                                                `${combinedMetrics.bestOrders}`,
                                                ``,
                                                `*Faturamento Total:*`,
                                                `${formatValue(combinedMetrics.bestRevenue, 'currency')}`,
                                                ``,
                                                `*CPA (Custo por Aquisição):*`,
                                                `${formatValue(combinedMetrics.bestCpa, 'currency')}`,
                                                ``,
                                                `*Ticket Médio:*`,
                                                `${formatValue(combinedMetrics.bestTicket, 'currency')}`,
                                                ``,
                                                `*ROAS (Retorno sobre Investimento):*`,
                                                `${combinedMetrics.roas.toFixed(2)}`,
                                                ``,
                                                `*Taxa de Conversão:*`,
                                                `${(combinedMetrics as any).pageViews > 0 ? `${((combinedMetrics.bestOrders / (combinedMetrics as any).pageViews) * 100).toFixed(2)}%` : '—'}`,
                                            ].filter(Boolean).join('\n');
                                        }

                                        // Send via direct Evolution API call
                                        console.log('[Report] Sending via Evolution API...', wpInstanceName, selectedGroupId);
                                        const sendUrl = `${EVOLUTION_API_URL}/message/sendText/${wpInstanceName}`;
                                        const sendRes = await fetch(sendUrl, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                                            body: JSON.stringify({ number: selectedGroupId, text: reportText })
                                        });

                                        const sendResult = await sendRes.json();

                                        if (!sendRes.ok) {
                                            throw new Error(sendResult.message || sendResult.error || `Erro ao enviar (${sendRes.status})`);
                                        }

                                        toast.success('Relatório enviado para o grupo!');
                                        setIsReportDialogOpen(false);
                                    } catch (err: any) {
                                        console.error('[Report] WhatsApp send error:', err);
                                        toast.error('Erro ao enviar', { description: err.message });
                                    } finally {
                                        setIsSendingReport(false);
                                    }
                                }}
                            >
                                {isSendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-muted-foreground"
                            onClick={fetchWhatsAppGroups}
                            disabled={isLoadingGroups}
                        >
                            {isLoadingGroups ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <MessageCircle className="w-3 h-3 mr-2" />}
                            Recarregar Grupos
                        </Button>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                let text = '';
                                if (reportTypeToShare === 'ai' && aiReport) {
                                    text = aiReport;
                                } else {
                                    const dates = apiDates;
                                    const periodStr = `${new Date(dates.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dates.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}`;
                                    text = [
                                        `📊 *Relatório Semanal – Beacon*`,
                                        `🗓️ *Período:* ${periodStr}`,
                                        clientData?.name ? `👤 *Cliente:* ${clientData.name}` : '',
                                        '',
                                        `*Investimento Total em Tráfego:*`,
                                        `${formatValue(combinedMetrics.spend, 'currency')}`,
                                        '',
                                        `*Compras Geradas:*`,
                                        `${combinedMetrics.bestOrders}`,
                                        '',
                                        `*Faturamento Total:*`,
                                        `${formatValue(combinedMetrics.bestRevenue, 'currency')}`,
                                        '',
                                        `*CPA (Custo por Aquisição):*`,
                                        `${formatValue(combinedMetrics.bestCpa, 'currency')}`,
                                        '',
                                        `*Ticket Médio:*`,
                                        `${formatValue(combinedMetrics.bestTicket, 'currency')}`,
                                        '',
                                        `*ROAS (Retorno sobre Investimento):*`,
                                        `${combinedMetrics.roas.toFixed(2)}`,
                                        '',
                                        `*Taxa de Conversão:*`,
                                        `${(combinedMetrics as any).pageViews > 0 ? `${((combinedMetrics.bestOrders / (combinedMetrics as any).pageViews) * 100).toFixed(2)}%` : '—'}`,
                                    ].filter(Boolean).join('\n');
                                }
                                navigator.clipboard.writeText(text);
                                toast.success('Relatório copiado!');
                            }}
                        >
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar Texto
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsReportDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default OverviewClone;
