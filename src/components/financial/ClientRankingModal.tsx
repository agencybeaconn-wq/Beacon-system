import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";
import {
    Trophy,
    Crown,
    Medal,
    TrendingUp,
    DollarSign,
    ShoppingBag,
    Users,
    Star,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    Flame,
    Search,
    Package,
    CalendarDays,
    Repeat,
    Target,
    ArrowDown,
    ArrowUp,
    Eye,
    EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAgencyProducts } from "@/hooks/useAgencyProducts";
import { cn } from "@/lib/utils";

interface ClientRankingModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ClientRankingViewProps {
    embedded?: boolean;
}

interface RankedClient {
    clientId: string;
    clientName: string;
    logoUrl: string | null;
    primaryColor: string;
    totalPaid: number;
    totalSales: number;
    totalPending: number;
    saleCount: number;
    services: string[];
    lastSaleDate: string | null;
    firstSaleDate: string | null;
    avgTicket: number;
    assignedProductIds: string[];
    assignedProductNames: string[];
    isActive: boolean;
    monthsAsClient: number;
    ltv: number;
    hasMRR: boolean;
    mrrAmount: number;
    revenueGrowth: number; // positive = growth, negative = shrink
    storeGmv30d: number;        // GMV Shopify do cliente nos últimos 30d
    storeOrders30d: number;     // n pedidos Shopify 30d
    storeLastOrderAt: string | null;
    metaSpend30d: number;       // Spend Meta 30d
    metaRevenue30d: number;     // Receita reportada Meta 30d
    metaRoas30d: number;        // ROAS Meta 30d
    feeFixed: number;           // Fee mensal fixo cobrado pela Lever
    commissionRate: number;     // % de comissão (0-100)
    calculationBase: 'spend' | 'revenue';
    commission30d: number;      // Comissão estimada 30d (base × rate/100)
    leverRevenue30d: number;    // fee_fixed + commission30d (MRR + variável)
}

type SortField = 'totalPaid' | 'totalSales' | 'totalPending' | 'saleCount' | 'avgTicket' | 'monthsAsClient' | 'lastSaleDate' | 'clientName' | 'storeGmv30d' | 'metaRoas30d' | 'metaSpend30d' | 'commission30d' | 'leverRevenue30d';
type SortDirection = 'asc' | 'desc';

function generateColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 60%, 45%)`;
}

export function ClientRankingView({ embedded = false, active = true }: ClientRankingViewProps & { active?: boolean }) {
    const { workspaceId, clients } = useDashboard();
    const { products: agencyProducts } = useAgencyProducts();
    const [allSales, setAllSales] = useState<any[]>([]);
    const [storeStats, setStoreStats] = useState<Map<string, { gmv30d: number; orders30d: number; lastOrderAt: string | null }>>(new Map());
    const [metaStats, setMetaStats] = useState<Map<string, { spend30d: number; revenue30d: number }>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<SortField>('totalPaid');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [scope, setScope] = useState<'fixo' | 'geral'>(() => (localStorage.getItem('ranking_scope') as any) || 'geral');
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
        try {
            const raw = localStorage.getItem('ranking_hidden_ids');
            return new Set(raw ? JSON.parse(raw) : []);
        } catch { return new Set(); }
    });
    const [showHidden, setShowHidden] = useState(false);

    useEffect(() => { localStorage.setItem('ranking_scope', scope); }, [scope]);
    useEffect(() => { localStorage.setItem('ranking_hidden_ids', JSON.stringify(Array.from(hiddenIds))); }, [hiddenIds]);

    const toggleHidden = (id: string) => {
        setHiddenIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Build a lookup map: productId → productName
    const productNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of agencyProducts) {
            map.set(p.id, p.name);
        }
        return map;
    }, [agencyProducts]);

    useEffect(() => {
        if (!active || !workspaceId) return;

        const fetchAll = async () => {
            try {
                const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                const thirtyDaysAgoDate = thirtyDaysAgoIso.slice(0, 10);
                const [salesRes, ordersRes, metaRes] = await Promise.all([
                    supabase
                        .from("sales_records")
                        .select("client_name, total_amount, entry_amount, status, service, recurrence, sale_date")
                        .eq("workspace_id", workspaceId)
                        .order("sale_date", { ascending: false }),
                    (supabase as any)
                        .from("dw_orders")
                        .select("client_id, total_price, processed_at")
                        .gte("processed_at", thirtyDaysAgoIso)
                        .not("client_id", "is", null),
                    (supabase as any)
                        .from("dw_meta_insights_daily")
                        .select("client_id, spend, purchases_value, date")
                        .gte("date", thirtyDaysAgoDate)
                        .not("client_id", "is", null),
                ]);

                if (salesRes.error) throw salesRes.error;
                setAllSales(salesRes.data || []);

                const map = new Map<string, { gmv30d: number; orders30d: number; lastOrderAt: string | null }>();
                for (const o of (ordersRes.data || [])) {
                    const cid = o.client_id as string;
                    if (!cid) continue;
                    const cur = map.get(cid) || { gmv30d: 0, orders30d: 0, lastOrderAt: null };
                    cur.gmv30d += Number(o.total_price) || 0;
                    cur.orders30d += 1;
                    if (o.processed_at && (!cur.lastOrderAt || o.processed_at > cur.lastOrderAt)) {
                        cur.lastOrderAt = o.processed_at;
                    }
                    map.set(cid, cur);
                }
                setStoreStats(map);

                const metaMap = new Map<string, { spend30d: number; revenue30d: number }>();
                for (const r of (metaRes.data || [])) {
                    const cid = r.client_id as string;
                    if (!cid) continue;
                    const cur = metaMap.get(cid) || { spend30d: 0, revenue30d: 0 };
                    cur.spend30d += Number(r.spend) || 0;
                    cur.revenue30d += Number(r.purchases_value) || 0;
                    metaMap.set(cid, cur);
                }
                setMetaStats(metaMap);
            } catch (err) {
                console.error("[ClientRanking] Error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        setIsLoading(true);
        fetchAll();

        const intervalId = setInterval(fetchAll, 60000);
        return () => clearInterval(intervalId);
    }, [active, workspaceId]);

    const ranking: RankedClient[] = useMemo(() => {
        const salesMap = new Map<string, {
            totalPaid: number;
            totalSales: number;
            totalPending: number;
            saleCount: number;
            services: string[];
            lastSaleDate: string | null;
            firstSaleDate: string | null;
            hasMRR: boolean;
            mrrAmount: number;
            recentRevenue: number;
            olderRevenue: number;
        }>();

        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(now.getDate() - 60);

        for (const sale of allSales) {
            const name = (sale.client_name || "").trim().toLowerCase();
            if (!name) continue;

            if (!salesMap.has(name)) {
                salesMap.set(name, {
                    totalPaid: 0, totalSales: 0, totalPending: 0,
                    saleCount: 0, services: [], lastSaleDate: null,
                    firstSaleDate: null, hasMRR: false, mrrAmount: 0,
                    recentRevenue: 0, olderRevenue: 0,
                });
            }

            const entry = salesMap.get(name)!;
            const amount = sale.total_amount || 0;
            entry.totalSales += amount;
            entry.saleCount += 1;

            // Track recent vs older revenue for growth calculation
            const saleDate = sale.sale_date ? new Date(sale.sale_date) : null;
            if (saleDate) {
                if (saleDate >= thirtyDaysAgo) {
                    entry.recentRevenue += amount;
                } else if (saleDate >= sixtyDaysAgo) {
                    entry.olderRevenue += amount;
                }
            }

            if (sale.status === "pago") {
                entry.totalPaid += amount;
            } else if (sale.status === "parcial") {
                entry.totalPaid += sale.entry_amount || 0;
                entry.totalPending += amount - (sale.entry_amount || 0);
            } else {
                entry.totalPending += amount;
            }

            if (sale.service && !entry.services.includes(sale.service)) {
                entry.services.push(sale.service);
            }

            if (!entry.lastSaleDate || sale.sale_date > entry.lastSaleDate) {
                entry.lastSaleDate = sale.sale_date;
            }
            if (!entry.firstSaleDate || sale.sale_date < entry.firstSaleDate) {
                entry.firstSaleDate = sale.sale_date;
            }

            if (sale.recurrence === "recurring") {
                entry.hasMRR = true;
                entry.mrrAmount += amount;
            }
        }

        const eligibleClients = (clients as any[]).filter(
            (c) => c.name !== 'Lever' && !c.is_internal && c.is_ecommerce !== false
        );

        const result: RankedClient[] = eligibleClients.map((client) => {
            const key = (client.name || "").trim().toLowerCase();
            const sales = salesMap.get(key);
            const createdDate = client.created_at ? new Date(client.created_at) : now;
            const monthsAsClient = Math.max(1, Math.round(
                (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            ));

            const productIds = client.assigned_products || [];
            const productNames = productIds
                .map(id => productNameMap.get(id))
                .filter(Boolean) as string[];

            // Revenue growth: compare last 30 days vs 30-60 days ago
            const revenueGrowth = sales?.olderRevenue
                ? ((sales.recentRevenue - sales.olderRevenue) / sales.olderRevenue) * 100
                : 0;

            const store = storeStats.get(client.id);
            const meta = metaStats.get(client.id);
            const metaRoas = meta && meta.spend30d > 0 ? meta.revenue30d / meta.spend30d : 0;

            const feeFixed = Number((client as any).fee_fixed) || 0;
            const commissionRate = Number((client as any).commission_rate) || 0;
            const calculationBase: 'spend' | 'revenue' = (client as any).calculation_base === 'spend' ? 'spend' : 'revenue';
            const commissionBaseValue = calculationBase === 'spend' ? (meta?.spend30d || 0) : (store?.gmv30d || 0);
            const commission30d = commissionBaseValue * commissionRate / 100;
            const leverRevenue30d = feeFixed + commission30d;

            return {
                clientId: client.id,
                clientName: client.name,
                logoUrl: client.logo_url || null,
                primaryColor: (client as any).primaryColor || generateColor(client.name),
                totalPaid: sales?.totalPaid || 0,
                totalSales: sales?.totalSales || 0,
                totalPending: sales?.totalPending || 0,
                saleCount: sales?.saleCount || 0,
                services: sales?.services || [],
                lastSaleDate: sales?.lastSaleDate || null,
                firstSaleDate: sales?.firstSaleDate || null,
                avgTicket: sales && sales.saleCount > 0 ? sales.totalSales / sales.saleCount : 0,
                assignedProductIds: productIds,
                assignedProductNames: productNames,
                isActive: !!sales && sales.saleCount > 0,
                monthsAsClient,
                ltv: sales?.totalPaid || 0,
                hasMRR: sales?.hasMRR || false,
                mrrAmount: sales?.mrrAmount || 0,
                revenueGrowth,
                storeGmv30d: store?.gmv30d || 0,
                storeOrders30d: store?.orders30d || 0,
                storeLastOrderAt: store?.lastOrderAt || null,
                metaSpend30d: meta?.spend30d || 0,
                metaRevenue30d: meta?.revenue30d || 0,
                metaRoas30d: metaRoas,
                feeFixed,
                commissionRate,
                calculationBase,
                commission30d,
                leverRevenue30d,
            };
        });

        // Apply sorting dynamically
        return result.sort((a, b) => {
            let valA: any = a[sortField];
            let valB: any = b[sortField];

            // Handle null dates correctly, putting them at the bottom
            if (sortField === 'lastSaleDate') {
                valA = a.lastSaleDate ? new Date(a.lastSaleDate).getTime() : 0;
                valB = b.lastSaleDate ? new Date(b.lastSaleDate).getTime() : 0;
            }

            if (valA < valB) {
                return sortDirection === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [allSales, clients, productNameMap, sortField, sortDirection, storeStats, metaStats]);

    const clientTypeById = useMemo(() => {
        const m = new Map<string, string>();
        for (const c of clients as any[]) m.set(c.id, c.client_type || 'avulso');
        return m;
    }, [clients]);

    const filteredRanking = useMemo(() => {
        let list = ranking;
        if (scope === 'fixo') {
            list = list.filter(c => clientTypeById.get(c.clientId) === 'fixo');
        }
        if (!showHidden) {
            list = list.filter(c => !hiddenIds.has(c.clientId));
        }
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(c =>
            c.clientName.toLowerCase().includes(q) ||
            c.assignedProductNames.some(p => p.toLowerCase().includes(q)) ||
            c.services.some(s => s.toLowerCase().includes(q))
        );
    }, [ranking, searchQuery, scope, hiddenIds, showHidden, clientTypeById]);

    const hiddenCount = useMemo(() => ranking.filter(c => hiddenIds.has(c.clientId)).length, [ranking, hiddenIds]);

    const totals = useMemo(() => {
        const base = filteredRanking;
        const activeClients = base.filter(c => c.isActive);
        const totalSpend = base.reduce((a, c) => a + c.metaSpend30d, 0);
        const totalRev = base.reduce((a, c) => a + c.metaRevenue30d, 0);
        return {
            totalClients: base.length,
            activeClients: activeClients.length,
            totalRevenue: base.reduce((acc, c) => acc + c.totalPaid, 0),
            totalPending: base.reduce((acc, c) => acc + c.totalPending, 0),
            totalSalesCount: allSales.length,
            avgLTV: activeClients.length > 0
                ? activeClients.reduce((acc, c) => acc + c.ltv, 0) / activeClients.length
                : 0,
            mrrClients: base.filter(c => c.hasMRR).length,
            totalMRR: base.reduce((acc, c) => acc + c.mrrAmount, 0),
            avgTicket: activeClients.length > 0
                ? activeClients.reduce((acc, c) => acc + c.avgTicket, 0) / activeClients.length
                : 0,
            totalProducts: new Set(base.flatMap(c => c.assignedProductIds)).size,
            totalStoreGmv30d: base.reduce((acc, c) => acc + c.storeGmv30d, 0),
            storesWithGmv: base.filter(c => c.storeGmv30d > 0).length,
            totalMetaSpend30d: totalSpend,
            totalMetaRevenue30d: totalRev,
            avgMetaRoas: totalSpend > 0 ? totalRev / totalSpend : 0,
            totalFeeFixed: base.reduce((acc, c) => acc + c.feeFixed, 0),
            totalCommission30d: base.reduce((acc, c) => acc + c.commission30d, 0),
            totalLeverRevenue30d: base.reduce((acc, c) => acc + c.leverRevenue30d, 0),
        };
    }, [filteredRanking, allSales]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}/${y.slice(2)}`;
    };

    const getRankDisplay = (index: number) => {
        if (index === 0) return (
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/25">
                <Crown className="h-5 w-5 text-white drop-shadow" />
            </div>
        );
        if (index === 1) return (
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-zinc-300 to-zinc-500 shadow-lg shadow-zinc-400/20">
                <Medal className="h-5 w-5 text-white drop-shadow" />
            </div>
        );
        if (index === 2) return (
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 shadow-lg shadow-amber-600/20">
                <Medal className="h-5 w-5 text-white drop-shadow" />
            </div>
        );
        return (
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-muted/30 border border-border/30">
                <span className="text-sm font-bold text-muted-foreground">{index + 1}º</span>
            </div>
        );
    };

    const getRowHighlight = (index: number) => {
        if (index === 0) return "bg-primary/[0.05] hover:bg-primary/[0.08] border-l-2 border-l-primary";
        if (index === 1) return "bg-white/[0.02] hover:bg-white/[0.05] border-l-2 border-l-white/40";
        if (index === 2) return "bg-primary/[0.02] hover:bg-primary/[0.05] border-l-2 border-l-primary/40";
        return "hover:bg-muted/30 border-l-2 border-l-transparent";
    };



    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default to descending when changing fields
        }
    };

    const renderSortableHeader = (label: string, field: SortField, align: 'left' | 'center' | 'right' = 'right', className = '') => {
        const isSorted = sortField === field;
        return (
            <th
                className={cn(`text-${align} text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-3 py-2 cursor-pointer hover:bg-muted/30 hover:text-foreground transition-colors select-none group`, className)}
                onClick={() => handleSort(field)}
            >
                <div className={cn("flex items-center gap-1",
                    align === 'right' ? "justify-end" : align === 'center' ? "justify-center" : "justify-start"
                )}>
                    <span className={isSorted ? "text-primary" : ""}>{label}</span>
                    <span className={cn("flex flex-col -space-y-1.5 opacity-0 group-hover:opacity-40 transition-opacity",
                        isSorted && "opacity-100 group-hover:opacity-100"
                    )}>
                        <ArrowUp className={cn("w-3 h-3", isSorted && sortDirection === 'asc' ? "text-primary opacity-100" : "opacity-30")} />
                        <ArrowDown className={cn("w-3 h-3", isSorted && sortDirection === 'desc' ? "text-primary opacity-100" : "opacity-30")} />
                    </span>
                </div>
            </th>
        );
    };

    const getPaidColor = (index: number) => {
        if (index === 0) return "text-amber-400";
        if (index === 1) return "text-zinc-300";
        if (index === 2) return "text-amber-600";
        return "text-emerald-400";
    };

    const content = (
        <>
                {/* Header */}
                <div className="px-8 pt-7 pb-5 border-b border-border/10 bg-gradient-to-b from-primary/[0.02] to-transparent shrink-0">
                    <div className="mb-0 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight">
                                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400/15 to-amber-600/15 border border-amber-500/15">
                                    <Trophy className="h-6 w-6 text-amber-400" />
                                </div>
                                Ranking de Clientes
                            </h2>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Mostrando <strong>{filteredRanking.length}</strong> de <strong>{ranking.length}</strong> clientes
                                {hiddenCount > 0 && <> · <strong>{hiddenCount}</strong> oculto{hiddenCount === 1 ? '' : 's'}</>}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Toggle Fixos | Geral */}
                            <div className="inline-flex items-center p-1 rounded-2xl bg-secondary/40 border border-border/20">
                                <button
                                    onClick={() => setScope('fixo')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-xl text-xs font-bold transition-all",
                                        scope === 'fixo'
                                            ? "bg-emerald-500/15 text-emerald-400 shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Fixos
                                </button>
                                <button
                                    onClick={() => setScope('geral')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-xl text-xs font-bold transition-all",
                                        scope === 'geral'
                                            ? "bg-primary/15 text-primary shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Geral
                                </button>
                            </div>

                            {hiddenCount > 0 && (
                                <button
                                    onClick={() => setShowHidden(v => !v)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                                        showHidden
                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                            : "bg-secondary/40 text-muted-foreground border-border/20 hover:text-foreground"
                                    )}
                                    title={showHidden ? "Esconder novamente as ocultas" : "Mostrar lojas ocultas"}
                                >
                                    {showHidden ? `Ocultando (${hiddenCount})` : `Ver ${hiddenCount} oculta${hiddenCount === 1 ? '' : 's'}`}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Summary Cards - 15 cards (3 rows of 5) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-5">
                        {[
                            { icon: Users, color: "text-blue-400", label: "Total Clientes", value: isLoading ? "—" : `${totals.totalClients}`, sub: `${totals.activeClients} ativos` },
                            { icon: ShoppingBag, color: "text-purple-400", label: "Vendas", value: isLoading ? "—" : `${totals.totalSalesCount}`, sub: "registradas" },
                            { icon: DollarSign, color: "text-emerald-400", label: "Recebido", value: isLoading ? "—" : formatCurrency(totals.totalRevenue), sub: null, valueColor: "text-emerald-400" },
                            { icon: Clock, color: "text-amber-400", label: "Pendente", value: isLoading ? "—" : formatCurrency(totals.totalPending), sub: null, valueColor: "text-amber-400" },
                            { icon: BarChart3, color: "text-cyan-400", label: "LTV Médio", value: isLoading ? "—" : formatCurrency(totals.avgLTV), sub: null, valueColor: "text-cyan-400" },
                            { icon: Flame, color: "text-rose-400", label: "MRR", value: isLoading ? "—" : `${totals.mrrClients}`, sub: "recorrentes" },
                            { icon: Target, color: "text-orange-400", label: "Ticket Médio", value: isLoading ? "—" : formatCurrency(totals.avgTicket), sub: null, valueColor: "text-orange-400" },
                            { icon: Package, color: "text-violet-400", label: "Produtos", value: isLoading ? "—" : `${totals.totalProducts}`, sub: "ativos" },
                            { icon: Repeat, color: "text-teal-400", label: "MRR Total", value: isLoading ? "—" : formatCurrency(totals.totalMRR), sub: null, valueColor: "text-teal-400" },
                            { icon: CalendarDays, color: "text-indigo-400", label: "Clientes Inativos", value: isLoading ? "—" : `${totals.totalClients - totals.activeClients}`, sub: "sem vendas" },
                            { icon: ShoppingBag, color: "text-lime-400", label: "GMV Lojas 30d", value: isLoading ? "—" : formatCurrency(totals.totalStoreGmv30d), sub: `${totals.storesWithGmv} lojas`, valueColor: "text-lime-400" },
                            { icon: TrendingUp, color: "text-fuchsia-400", label: "Spend Meta 30d", value: isLoading ? "—" : formatCurrency(totals.totalMetaSpend30d), sub: null, valueColor: "text-fuchsia-400" },
                            { icon: BarChart3, color: "text-sky-400", label: "ROAS Meta 30d", value: isLoading ? "—" : (totals.avgMetaRoas > 0 ? `${totals.avgMetaRoas.toFixed(2)}x` : "—"), sub: "média ponderada", valueColor: "text-sky-400" },
                            { icon: Repeat, color: "text-emerald-500", label: "MRR Fees", value: isLoading ? "—" : formatCurrency(totals.totalFeeFixed), sub: "fixo mensal", valueColor: "text-emerald-500" },
                            { icon: DollarSign, color: "text-yellow-400", label: "Comissão 30d", value: isLoading ? "—" : formatCurrency(totals.totalCommission30d), sub: "variável estimada", valueColor: "text-yellow-400" },
                            { icon: Crown, color: "text-amber-400", label: "Receita Beacon 30d", value: isLoading ? "—" : formatCurrency(totals.totalBeaconRevenue30d), sub: "MRR + comissão", valueColor: "text-amber-400" },
                        ].map((card, i) => (
                            <Card key={i} className="p-3 bg-secondary/20 border-border/10 hover:bg-secondary/30 transition-colors shadow-none">
                                <div className="flex items-center gap-2 mb-1">
                                    <card.icon className={cn("h-3.5 w-3.5", card.color)} />
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{card.label}</span>
                                </div>
                                <p className={cn("text-lg font-extrabold", (card as any).valueColor || "text-foreground")}>{card.value}</p>
                                {card.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</p>}
                            </Card>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por cliente, produto ou serviço..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-secondary/30 border-border/20 h-9 text-sm"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-auto flex-1 px-4 pb-4">
                    <table className="w-full border-separate border-spacing-y-1 mt-2">
                        <thead className="sticky top-0 z-10 bg-background">
                            <tr>
                                <th className="text-left text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-3 py-2 w-14">#</th>
                                {renderSortableHeader('Cliente', 'clientName', 'left', 'min-w-[180px]')}
                                <th className="text-left text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-3 py-2 min-w-[200px]">Produtos / Serviços</th>
                                {renderSortableHeader('Vendas', 'saleCount', 'center')}
                                {renderSortableHeader('Ticket Médio', 'avgTicket', 'right')}
                                {renderSortableHeader('Total Vendido', 'totalSales', 'right')}
                                {renderSortableHeader('Pendente', 'totalPending', 'right')}
                                {renderSortableHeader('Total Pago', 'totalPaid', 'right')}
                                {renderSortableHeader('GMV Loja 30d', 'storeGmv30d', 'right')}
                                {renderSortableHeader('Spend Meta', 'metaSpend30d', 'right')}
                                {renderSortableHeader('ROAS', 'metaRoas30d', 'center')}
                                {renderSortableHeader('Comissão 30d', 'commission30d', 'right')}
                                {renderSortableHeader('Receita Beacon 30d', 'leverRevenue30d', 'right')}
                                <th className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-3 py-2">Tipo</th>
                                <th className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-3 py-2">Tendência</th>
                                {renderSortableHeader('Cliente Há', 'monthsAsClient', 'center')}
                                {renderSortableHeader('Última Venda', 'lastSaleDate', 'center')}
                                <th className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-3 py-2 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 18 }).map((_, j) => (
                                            <td key={j} className="px-3 py-3"><Skeleton className="h-5 w-full" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : filteredRanking.length === 0 ? (
                                <tr>
                                    <td colSpan={18} className="text-center text-muted-foreground py-20">
                                        <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                                        <p className="text-xl font-bold mb-1">{searchQuery ? "Nenhum resultado encontrado" : "Nenhum cliente cadastrado"}</p>
                                        <p className="text-sm text-muted-foreground/60">{searchQuery ? "Tente buscar por outro termo." : "Adicione clientes ao sistema para começar a ver o ranking."}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRanking.map((client, index) => (
                                    <tr
                                        key={client.clientId}
                                        className={cn(
                                            "rounded-xl transition-all duration-200",
                                            getRowHighlight(index),
                                            hiddenIds.has(client.clientId) && "opacity-40"
                                        )}
                                    >
                                        {/* Rank */}
                                        <td className="px-3 py-2.5">
                                            {getRankDisplay(index)}
                                        </td>

                                        {/* Client Name + Avatar */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-3">
                                                {client.logoUrl ? (
                                                    <img
                                                        src={client.logoUrl}
                                                        alt={client.clientName}
                                                        className="h-9 w-9 rounded-xl object-cover border border-border/30"
                                                    />
                                                ) : (
                                                    <div
                                                        className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm border border-white/10"
                                                        style={{ background: client.primaryColor }}
                                                    >
                                                        {client.clientName.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-[13px] leading-tight">{client.clientName}</p>
                                                    {!client.isActive && (
                                                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">sem vendas</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Products / Services */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-wrap gap-1 max-w-[250px]">
                                                {client.assignedProductNames.length > 0 ? (
                                                    <>
                                                        {client.assignedProductNames.slice(0, 2).map((name) => (
                                                            <Badge
                                                                key={name}
                                                                variant="outline"
                                                                className="text-[10px] bg-primary/5 border-primary/20 text-foreground/80 font-semibold"
                                                            >
                                                                {name}
                                                            </Badge>
                                                        ))}
                                                        {client.assignedProductNames.length > 2 && (
                                                            <Badge variant="outline" className="text-[10px] bg-secondary text-muted-foreground font-semibold">
                                                                +{client.assignedProductNames.length - 2}
                                                            </Badge>
                                                        )}
                                                    </>
                                                ) : client.services.length > 0 ? (
                                                    <>
                                                        {client.services.slice(0, 2).map((s) => (
                                                            <Badge
                                                                key={s}
                                                                variant="outline"
                                                                className="text-[10px] bg-secondary border-border text-muted-foreground font-semibold"
                                                            >
                                                                {s}
                                                            </Badge>
                                                        ))}
                                                        {client.services.length > 2 && (
                                                            <Badge variant="outline" className="text-[10px] bg-secondary text-muted-foreground font-semibold">
                                                                +{client.services.length - 2}
                                                            </Badge>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground/30 text-[11px]">—</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Sale Count */}
                                        <td className="px-3 py-2.5 text-center">
                                            {client.saleCount > 0 ? (
                                                <Badge variant="outline" className="bg-muted/20 border-border/30 font-bold text-xs">
                                                    {client.saleCount}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground/25">0</span>
                                            )}
                                        </td>

                                        {/* Avg Ticket */}
                                        <td className="px-3 py-2.5 text-right text-muted-foreground font-medium text-sm">
                                            {client.avgTicket > 0 ? formatCurrency(client.avgTicket) : "—"}
                                        </td>

                                        {/* Total Sales */}
                                        <td className="px-3 py-2.5 text-right text-muted-foreground font-medium text-sm">
                                            {client.totalSales > 0 ? formatCurrency(client.totalSales) : "—"}
                                        </td>

                                        {/* Pending */}
                                        <td className="px-3 py-2.5 text-right">
                                            {client.totalPending > 0 ? (
                                                <span className="text-amber-400 font-semibold text-sm flex items-center justify-end gap-1">
                                                    <ArrowDownRight className="h-3 w-3" />
                                                    {formatCurrency(client.totalPending)}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/25 text-sm">—</span>
                                            )}
                                        </td>

                                        {/* Total Paid */}
                                        <td className="px-3 py-2.5 text-right">
                                            {client.totalPaid > 0 ? (
                                                <span className={cn("font-extrabold text-base flex items-center justify-end gap-1", getPaidColor(index))}>
                                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                                    {formatCurrency(client.totalPaid)}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/25 text-sm">R$ 0</span>
                                            )}
                                        </td>

                                        {/* GMV Loja 30d */}
                                        <td className="px-3 py-2.5 text-right">
                                            {client.storeGmv30d > 0 ? (
                                                <div className="flex flex-col items-end leading-tight">
                                                    <span className="font-bold text-sm text-lime-400">
                                                        {formatCurrency(client.storeGmv30d)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/60">
                                                        {client.storeOrders30d} pedidos
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/25 text-sm">—</span>
                                            )}
                                        </td>

                                        {/* Spend Meta 30d */}
                                        <td className="px-3 py-2.5 text-right">
                                            {client.metaSpend30d > 0 ? (
                                                <span className="font-semibold text-sm text-fuchsia-400">
                                                    {formatCurrency(client.metaSpend30d)}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/25 text-sm">—</span>
                                            )}
                                        </td>

                                        {/* ROAS Meta 30d */}
                                        <td className="px-3 py-2.5 text-center">
                                            {client.metaSpend30d > 0 ? (
                                                <Badge className={cn(
                                                    "text-[11px] font-extrabold border-none",
                                                    client.metaRoas30d >= 3 ? "bg-emerald-500/15 text-emerald-400" :
                                                    client.metaRoas30d >= 1.5 ? "bg-amber-500/15 text-amber-400" :
                                                    "bg-rose-500/15 text-rose-400"
                                                )}>
                                                    {client.metaRoas30d.toFixed(2)}x
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground/25 text-sm">—</span>
                                            )}
                                        </td>

                                        {/* Comissão 30d */}
                                        <td className="px-3 py-2.5 text-right">
                                            {client.commissionRate > 0 ? (
                                                <div className="flex flex-col items-end leading-tight">
                                                    <span className={cn(
                                                        "font-bold text-sm",
                                                        client.commission30d > 0 ? "text-yellow-400" : "text-muted-foreground/40"
                                                    )}>
                                                        {formatCurrency(client.commission30d)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/60">
                                                        {client.commissionRate}% / {client.calculationBase === 'spend' ? 'spend' : 'GMV'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/25 text-sm">—</span>
                                            )}
                                        </td>

                                        {/* Receita Lever 30d (fee_fixed + commission) */}
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex flex-col items-end leading-tight">
                                                <span className="font-extrabold text-sm text-amber-400">
                                                    {formatCurrency(client.leverRevenue30d)}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/60">
                                                    {formatCurrency(client.feeFixed)} fixo
                                                </span>
                                            </div>
                                        </td>

                                        {/* Type */}
                                        <td className="px-3 py-2.5 text-center">
                                            {client.hasMRR ? (
                                                <Badge className="bg-purple-500/10 text-purple-400 border-none text-[10px] font-bold">
                                                    MRR
                                                </Badge>
                                            ) : client.saleCount > 0 ? (
                                                <Badge className="bg-blue-500/10 text-blue-400 border-none text-[10px] font-bold">
                                                    AVULSO
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground/25 text-[10px]">—</span>
                                            )}
                                        </td>

                                        {/* Revenue Trend */}
                                        <td className="px-3 py-2.5 text-center">
                                            {client.revenueGrowth !== 0 ? (
                                                <span className={cn(
                                                    "text-xs font-bold flex items-center justify-center gap-0.5",
                                                    client.revenueGrowth > 0 ? "text-emerald-400" : "text-rose-400"
                                                )}>
                                                    {client.revenueGrowth > 0 ? (
                                                        <TrendingUp className="h-3 w-3" />
                                                    ) : (
                                                        <ArrowDownRight className="h-3 w-3" />
                                                    )}
                                                    {Math.abs(client.revenueGrowth).toFixed(0)}%
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/25 text-[10px]">—</span>
                                            )}
                                        </td>

                                        {/* Months as Client */}
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="text-muted-foreground text-sm font-medium">
                                                {client.monthsAsClient >= 12
                                                    ? `${Math.floor(client.monthsAsClient / 12)}a ${client.monthsAsClient % 12}m`
                                                    : `${client.monthsAsClient}m`
                                                }
                                            </span>
                                        </td>

                                        {/* Last Sale */}
                                        <td className="px-3 py-2.5 text-center text-muted-foreground text-sm">
                                            {formatDate(client.lastSaleDate)}
                                        </td>

                                        {/* Hide toggle */}
                                        <td className="px-3 py-2.5 text-center">
                                            <button
                                                onClick={() => toggleHidden(client.clientId)}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
                                                    hiddenIds.has(client.clientId)
                                                        ? "text-amber-400 hover:bg-amber-500/10"
                                                        : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/30"
                                                )}
                                                title={hiddenIds.has(client.clientId) ? "Mostrar no ranking" : "Esconder do ranking"}
                                            >
                                                {hiddenIds.has(client.clientId) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
        </>
    );

    if (embedded) {
        return (
            <div className="flex flex-col h-full bg-background border border-border/30 rounded-2xl overflow-hidden">
                {content}
            </div>
        );
    }
    return content;
}

export function ClientRankingModal({ isOpen, onOpenChange }: ClientRankingModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] w-[1400px] max-h-[96vh] overflow-hidden flex flex-col p-0 gap-0 border-border/30">
                <DialogHeader className="sr-only">
                    <DialogTitle>Ranking de Clientes</DialogTitle>
                </DialogHeader>
                <ClientRankingView active={isOpen} />
            </DialogContent>
        </Dialog>
    );
}
