import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import {
    DollarSign,
    TrendingUp,
    Calendar as CalendarIcon,
    Plus,
    Check,
    AlertTriangle,
    AlertCircle,
    ArrowUpRight,
    RefreshCw,
    Wallet,
    CreditCard,
    ChevronDown,
    MoreHorizontal,
    Users,
    FileText,
    BarChart3,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboard } from "@/contexts/DashboardContext";
import { useFinancials, ClientFinancialRow } from "@/hooks/useFinancials";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOverviewMetrics } from "@/hooks/useOverviewMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useClientMetrics } from "@/hooks/useClientMetrics";
import { useCartPandaOrders } from "@/hooks/useCartPandaOrders";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

import { ExpensesList } from "@/components/financial/ExpensesList";
import { InvoicesList } from "@/components/financial/InvoicesList";
import { ClientProfitabilityModal } from "@/components/financial/ClientProfitabilityModal";
import { AddTransactionModal } from "@/components/financial/AddTransactionModal";
import { SalesTab } from "@/components/financial/SalesTab";
import { DREGerencialView } from "@/components/financial/DREGerencialView";
import { useSales } from "@/hooks/useSales";
import { useOneOffReceivables } from "@/hooks/useOneOffReceivables";


// Internal Component to handle individual client metrics for the table
// This helps isolate the hooks for better performance and easier state management
const ClientFinancialRowItem = ({ client, monthReference, invoices, onInvoiceAction, onShowDetails }: {
    client: any,
    monthReference: string,
    invoices: any[],
    onInvoiceAction: (clientId: string, type: 'create' | 'pay', invoiceId?: string) => void,
    onShowDetails: (client: any, metrics: any) => void
}) => {
    const { t, i18n } = useTranslation();
    const { getDateRangeForAPI } = useDashboard();
    const apiDates = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);

    const { metrics: metaMetrics, isLoading: isMetaLoading } = useClientMetrics({
        clientId: client.id,
        datePreset: 'this_month',
        startDate: apiDates.startDate,
        endDate: apiDates.endDate
    });

    const { summary: cpSummary, isLoading: isPandaLoading } = useCartPandaOrders(apiDates, client.id);

    // Business Logic: Commission Calculation
    const cartPandaRevenue = cpSummary?.totalRevenue || 0;
    const metaSpend = metaMetrics.totalSpend || 0;
    const operatingProfit = cartPandaRevenue - metaSpend;

    const fixedFee = client.fee_fixed || 0;
    const commissionRate = (client.commission_rate || 0) / 100;
    const commissionValue = cartPandaRevenue * commissionRate;

    const finalFee = Math.max(fixedFee, commissionValue);

    const clientInvoice = useMemo(() => {
        return invoices.find(inv => inv.client_id === client.id);
    }, [invoices, client.id]);

    const performanceBonus = commissionValue > fixedFee ? commissionValue - fixedFee : 0;

    return (
        <TableRow
            className="group hover:bg-muted/50 transition-colors"
        >
            <TableCell className="font-medium text-left pl-6 border-r border-border/50">
                <div className="flex items-center gap-2">
                    {client.name}
                    {clientInvoice?.status === 'overdue' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-destructive text-destructive-foreground border-none">
                                    <p className="text-xs font-bold">PAGAMENTO EM ATRASO</p>
                                    <p className="text-[10px] opacity-90">Operação em dependência financeira.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </TableCell>
            {/* 1. Custo Fixo */}
            <TableCell className="text-left font-bold text-emerald-500 border-r border-border/50">
                {formatCurrency(fixedFee)}
            </TableCell>
            {/* 3. Performance (Nosso Lucro Bonus) */}
            <TableCell className="text-left font-bold text-emerald-500 border-r border-border/50">
                {performanceBonus > 0 ? formatCurrency(performanceBonus) : '-'}
            </TableCell>
            <TableCell className="text-left border-r border-border/50">
                {(() => {
                    const today = new Date();
                    const dueDate = clientInvoice?.due_date
                        ? parseISO(clientInvoice.due_date)
                        : null;

                    if (clientInvoice?.status === 'paid') {
                        return (
                            <Badge variant="outline" className="border-none bg-emerald-500/10 text-emerald-500 font-bold px-2 py-0 h-5">
                                PAGO
                            </Badge>
                        );
                    }

                    if (clientInvoice?.status === 'overdue' || (dueDate && !isNaN(dueDate.getTime()) && today > dueDate)) {
                        return (
                            <Badge variant="outline" className="border-none bg-destructive/10 text-destructive font-bold px-2 py-0 h-5">
                                INADIMPLENTE
                            </Badge>
                        );
                    }

                    return (
                        <Badge variant="outline" className="border-none bg-amber-500/10 text-amber-500 font-bold px-2 py-0 h-5">
                            PENDENTE
                        </Badge>
                    );
                })()}
            </TableCell>
            <TableCell className="text-left pr-6">
                <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-xs">
                        {(() => {
                            const dueDay = client?.payment_due_day || 5;
                            const today = new Date();
                            const targetDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
                            return format(targetDate, 'dd/MM/yy');
                        })()}
                    </span>

                    {clientInvoice?.status !== 'paid' && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px] font-bold border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all"
                            onClick={() => onInvoiceAction(client.id, 'pay', clientInvoice?.id)}
                        >
                            <Check className="h-3 w-3 mr-1" />
                            PAGAR
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
};

// Sales Summary Cards Component (displayed horizontally above tabs)
const SalesSummaryCards = ({
    mrr,
    accountsReceivable,
    revenuePaid,
    totalCosts,
    totalFeesInvoiced,
    salesSummary, // Monthly for progress contexts if needed
    filteredSalesSummary, // For the main cards
    oneOffSummary,
    isSalesLoading,
    isOneOffLoading
}: {
    mrr: number,
    accountsReceivable: number,
    revenuePaid: number,
    totalCosts: number,
    totalFeesInvoiced: number,
    salesSummary: any,
    filteredSalesSummary: any,
    oneOffSummary: any,
    isSalesLoading: boolean,
    isOneOffLoading: boolean
}) => {
    // Faturado Total = MRR (sempre do mês) + Vendas Avulsas FILTRADAS
    const combinedInvoiced = (filteredSalesSummary?.totalInvoiced || 0) + (mrr || 0);

    // Recebido Total = Recebido das Vendas FILTRADAS + Faturas Pagas FILTRADAS
    const combinedReceived = (filteredSalesSummary?.totalReceived || 0) + (revenuePaid || 0);

    // A Receber = Faturado - Recebido (no período filtrado) -- ou global? 
    // Para "A Receber", geralmente olhamos o saldo pendente total por segurança
    const combinedPending = Math.max(0, combinedInvoiced - combinedReceived);

    // Lucro = Recebido - Custos
    const profit = combinedReceived - totalCosts;

    const isLoading = isSalesLoading || isOneOffLoading;

    return (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            {/* 1. MRR */}
            <Card className="p-3 bg-background border border-border/50 hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">MRR (Fixo)</span>
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                </div>
                <div className="mt-1">
                    <span className="text-base font-bold">{formatCurrency(mrr)}</span>
                </div>
            </Card>

            {/* 2. Total Faturado (Unificado) */}
            <Card className="p-3 bg-background border border-border/50 hover:border-blue-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Faturado Total</span>
                    <FileText className="h-3 w-3 text-blue-500" />
                </div>
                <div className="mt-1">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : (
                        <span className="text-base font-bold">{formatCurrency(combinedInvoiced)}</span>
                    )}
                </div>
            </Card>

            {/* 3. Total Recebido (Unificado) */}
            <Card className="p-3 bg-background border border-border/50 hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Recebido Total</span>
                    <Check className="h-3 w-3 text-emerald-500" />
                </div>
                <div className="mt-1">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : (
                        <span className="text-base font-bold text-emerald-500">{formatCurrency(combinedReceived)}</span>
                    )}
                </div>
            </Card>

            {/* 4. Total a Receber (Unificado) */}
            <Card className="p-3 bg-background border border-border/50 hover:border-amber-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">A Receber</span>
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                </div>
                <div className="mt-1">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : (
                        <span className="text-base font-bold text-amber-500">{formatCurrency(combinedPending)}</span>
                    )}
                </div>
            </Card>

            {/* 5. Custos (Despesas + Colaboradores) */}
            <Card className="p-3 bg-background border border-border/50 hover:border-destructive/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Custos Totais</span>
                    <Wallet className="h-3 w-3 text-destructive" />
                </div>
                <div className="mt-1">
                    <span className="text-base font-bold text-destructive">{formatCurrency(totalCosts)}</span>
                </div>
            </Card>

            {/* 6. Lucro Real */}
            <Card className="p-3 bg-background border border-border/50 hover:border-purple-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Lucro Real</span>
                    <BarChart3 className="h-3 w-3 text-purple-500" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                    <span className={cn(
                        "text-base font-bold",
                        profit >= 0 ? "text-purple-500" : "text-destructive"
                    )}>
                        {formatCurrency(profit)}
                    </span>
                    {combinedReceived > 0 && (
                        <span className="text-[9px] text-muted-foreground">
                            ({((profit / combinedReceived) * 100).toFixed(0)}%)
                        </span>
                    )}
                </div>
            </Card>
        </div>
    );
};

const Financeiro = () => {
    const { t } = useTranslation();
    console.log('[Financeiro] Render start');
    const { dateFilter, dateRange, setDateFilter, setDateRange, workspaceId } = useDashboard();
    const {
        clients,
        expenses,
        invoices,
        staffFinancials,
        partnersProlabore,
        isLoading,
        monthReference,
        updateInvoiceStatus,
        createInvoice,
        addExpense,
        deleteExpense,
        updateExpenseStatus,
        updateMemberFinancials,
        updateMemberCommission,
        addStaffMember,
        deleteStaffMember,
        addPartnerProlabore,
        updatePartnerProlabore,
        deletePartnerProlabore
    } = useFinancials();

    const { chartsData, isLoading: isMetricsLoading, refetch } = useOverviewMetrics(dateFilter as any, dateRange as any, null);
    const salesData = useSales();
    const oneOffData = useOneOffReceivables();

    // Persistência da aba ativa
    const [activeTab, setActiveTabRaw] = useState(() => {
        return localStorage.getItem('financeiro_active_tab') || 'overview';
    });

    const setActiveTab = (val: string) => {
        setActiveTabRaw(val);
        localStorage.setItem('financeiro_active_tab', val);
    };

    console.log('[Financeiro] Rendering state:', {
        isLoading,
        isMetricsLoading,
        clientsCount: clients?.length,
        expensesCount: expenses?.length,
        invoicesCount: invoices?.length
    });

    const handleDateFilterChange = (value: string) => {
        setDateFilter(value as any);
        if (value !== "custom") {
            setDateRange(undefined);
        }
    };

    const [calendarOpen, setCalendarOpen] = useState(false);

    const handleCustomRange = (range: DateRange | undefined) => {
        setDateRange(range as any);
        if (range?.from && range?.to) {
            setDateFilter("custom" as any);
            setCalendarOpen(false); // Fecha só quando ambas datas selecionadas
        }
    };

    // Modal State
    const [selectedClientForDetail, setSelectedClientForDetail] = useState<any>(null);
    const [detailMetrics, setDetailMetrics] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

    const handleShowDetails = (client: any, metrics: any) => {
        setSelectedClientForDetail(client);
        setDetailMetrics(metrics);
        setIsDetailModalOpen(true);
    };

    const { getDateRangeForAPI } = useDashboard();
    const apiDates = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);

    // Pagination states for the overview table
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const stats = useMemo(() => {
        const safeInvoices = invoices || [];
        const safeExpenses = expenses || [];
        const safeStaff = staffFinancials || [];
        const safeClients = (clients as any[]) || [];
        const safePartners = partnersProlabore || [];

        // Filter data forcards based on selected date range
        // Note: For MRR (fixed fees) we usually consider the whole month context 
        // but if the user wants "everything" to filter, we might need to decide how to handle MRR.
        // However, user said "everything else working perfectly as before".

        const filterByDate = (dateStr: string | null) => {
            if (!dateStr) return false;
            const d = dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr.split('T')[0];
            const start = apiDates.startDate.split(' ')[0];
            const end = apiDates.endDate.split(' ')[0];
            return d >= start && d <= end;
        };

        const filteredInvoices = safeInvoices.filter(i => filterByDate(i.payment_date || i.due_date));
        const filteredExpenses = safeExpenses.filter(e => filterByDate(e.payment_date || e.due_date));

        const totalFeesPaid = filteredInvoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + (i.amount || 0), 0);
        const totalAgencyExpenses = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
        const totalFeesInvoiced = filteredInvoices.reduce((acc, i) => acc + (i.amount || 0), 0);

        // Staff Costs (Salaries + Calculated commissions)
        // Usually fixed per month, but if we filter "Today" should it be 0? 
        // User likely wants the summary of what happened in the period.
        const staffBaseSalaries = safeStaff.reduce((acc, m) => acc + (m.base_salary || 0), 0);

        // Partners Pro-labore
        const partnersTotal = safePartners.reduce((acc, p) => acc + (p.amount || 0), 0);

        // For "Custos Totais" card, if filtered, we might only show one-off expenses?
        // Let's stick to the period for agency expenses.
        const totalCosts = totalAgencyExpenses + staffBaseSalaries + partnersTotal;

        const pendingOverviewFees = totalFeesInvoiced - totalFeesPaid;

        // Add One-off Receivables to accounts receivable
        const accountsReceivable = pendingOverviewFees + (oneOffData.summary?.totalPending || 0);

        const mrrSum = safeClients.reduce((acc, c) => acc + (c.fee_fixed || 0), 0);

        return {
            revenuePaid: totalFeesPaid,
            totalFeesInvoiced: totalFeesInvoiced,
            accountsReceivable: accountsReceivable,
            mrr: mrrSum,
            totalCosts: totalCosts
        };
    }, [invoices, expenses, clients, staffFinancials, partnersProlabore, oneOffData.summary, apiDates]);

    // Pagination logic (must be above early return to satisfy Rules of Hooks)
    const overviewClients = useMemo(() => {
        return (clients || []).filter((client: any) => (client.fee_fixed || 0) > 0);
    }, [clients]);

    const totalPages = Math.ceil(overviewClients.length / itemsPerPage);

    const paginatedClients = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return overviewClients.slice(start, end);
    }, [overviewClients, currentPage, itemsPerPage]);

    if (isLoading) {
        return (
            <div className="flex-1 space-y-10 p-10 pt-10 min-h-screen w-full bg-background">
                <div className="flex items-start gap-4 mb-4">
                    <Skeleton className="p-3 w-14 h-14 rounded-xl shrink-0" />
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-48" />
                        <Skeleton className="h-6 w-64" />
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    // Go to previous page
    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    // Go to next page
    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    // Handle items per page change
    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1); // Reset to first page
    };

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 space-y-6 p-10 pt-10 min-h-screen w-full bg-background">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Financeiro Agência</h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">Controle de faturamento, fees e custos da agência.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <TabsList className="h-10 mr-2">
                        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                        <TabsTrigger value="sales">Vendas</TabsTrigger>
                        <TabsTrigger value="expenses">Despesas & Custos</TabsTrigger>
                        <TabsTrigger value="dre">DRE Gerencial</TabsTrigger>
                    </TabsList>

                    <div className="flex gap-1 items-center bg-secondary/30 p-1 rounded-md border border-white/5 mr-2">
                        <Button
                            variant={dateFilter === "today" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleDateFilterChange("today")}
                            className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "today" && "font-semibold")}
                        >
                            {t('common.today', 'Today')}
                        </Button>
                        <Button
                            variant={dateFilter === "7d" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleDateFilterChange("7d")}
                            className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "7d" && "font-semibold")}
                        >
                            7d
                        </Button>
                        <Button
                            variant={dateFilter === "month" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleDateFilterChange("month")}
                            className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "month" && "font-semibold")}
                        >
                            {t('common.month', 'Month')}
                        </Button>
                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={dateFilter === "custom" ? "default" : "ghost"}
                                    size="sm"
                                    className={cn("rounded-sm h-7 px-2", dateFilter === "custom" && "font-semibold")}
                                >
                                    <CalendarIcon className="h-3.5 w-3.5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    mode="range"
                                    selected={dateRange as any}
                                    onSelect={handleCustomRange as any}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            refetch(true, true); // true = force sync
                        }}
                        className="h-8 px-3 border-white/5 bg-secondary/30 hover:bg-white/5"
                        disabled={isMetricsLoading}
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", isMetricsLoading && "animate-spin")} />
                        {t('common.refresh', 'Refresh')}
                    </Button>

                </div>
            </div>

            <div className="space-y-6">
                <TabsContent value="overview" className="space-y-6 mt-0">
                    {/* Global Sales Summary Cards - Horizontal */}
                    <SalesSummaryCards
                        {...stats}
                        salesSummary={salesData.monthlySummary}
                        filteredSalesSummary={salesData.filteredSummary}
                        oneOffSummary={oneOffData.summary}
                        isSalesLoading={salesData.isLoading}
                        isOneOffLoading={oneOffData.isLoading}
                    />

                    {/* Metrics moved to header as requested by USER */}

                    {/* Clients Table */}
                    <Card className="border border-border/50 bg-background/50 overflow-hidden">
                        <div className="px-6 pt-6 pb-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold">
                                    Detalhamento por Operação
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        ({apiDates.startDate.split(' ')[0].split('-').reverse().join('/')} a {apiDates.endDate.split(' ')[0].split('-').reverse().join('/')})
                                    </span>
                                </h3>
                            </div>
                        </div>
                        <Table className="table-fixed">
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[20%] text-left pl-6 border-r border-border/50">Cliente</TableHead>
                                    <TableHead className="w-[18%] text-left border-r border-border/50">Custo Fixo</TableHead>
                                    <TableHead className="w-[18%] text-left border-r border-border/50">Performance</TableHead>
                                    <TableHead className="w-[18%] text-left border-r border-border/50">Status</TableHead>
                                    <TableHead className="w-[26%] text-left pr-6">Vencimento</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell className="pr-6"><Skeleton className="h-4 w-16" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    paginatedClients.map((client) => (
                                        <ClientFinancialRowItem
                                            key={client.id}
                                            client={client}
                                            monthReference={monthReference}
                                            invoices={invoices}
                                            onInvoiceAction={(clientId, type, invoiceId) => {
                                                if (type === 'pay' && invoiceId) {
                                                    updateInvoiceStatus(invoiceId, 'paid');
                                                }
                                            }}
                                            onShowDetails={handleShowDetails}
                                        />
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* Pagination Controls */}
                        {!isLoading && overviewClients.length > 0 && (
                            <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                                <div className="text-sm text-muted-foreground">
                                    Mostrando <span className="font-medium text-foreground">{Math.min(((currentPage - 1) * itemsPerPage) + 1, overviewClients.length)}</span> a <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, overviewClients.length)}</span> de <span className="font-medium text-foreground">{overviewClients.length}</span> resultados
                                </div>

                                <div className="flex items-center space-x-6 lg:space-x-8">
                                    <div className="flex items-center space-x-2">
                                        <p className="text-sm font-medium">Linhas por página</p>
                                        <select
                                            className="h-8 w-[70px] rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            value={itemsPerPage.toString()}
                                            onChange={(e) => handleItemsPerPageChange(e.target.value)}
                                        >
                                            <option value="10">10</option>
                                            <option value="20">20</option>
                                            <option value="50">50</option>
                                        </select>
                                    </div>
                                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                                        Página {currentPage} de {totalPages || 1}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            className="h-8 w-8 p-0"
                                            onClick={handlePrevPage}
                                            disabled={currentPage === 1}
                                        >
                                            <span className="sr-only">Voltar página</span>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-8 w-8 p-0"
                                            onClick={handleNextPage}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                        >
                                            <span className="sr-only">Próxima página</span>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </TabsContent>

                <TabsContent value="sales">
                    <SalesTab {...salesData} />
                </TabsContent>



                <TabsContent value="expenses">
                    <ExpensesList
                        expenses={expenses}
                        staff={staffFinancials}
                        partners={partnersProlabore}
                        onUpdateStatus={updateExpenseStatus}
                        onDeleteExpense={deleteExpense}
                        onAddExpense={() => setIsAddExpenseModalOpen(true)}
                        onUpdateStaffFinancials={updateMemberFinancials}
                        onAddStaffMember={addStaffMember}
                        onDeleteStaffMember={deleteStaffMember}
                        onAddPartner={addPartnerProlabore}
                        onUpdatePartner={updatePartnerProlabore}
                        onDeletePartner={deletePartnerProlabore}
                    />
                </TabsContent>

                <TabsContent value="dre">
                    <DREGerencialView
                        clients={clients}
                        staffFinancials={staffFinancials}
                        expenses={expenses}
                        invoices={invoices}
                        partnersProlabore={partnersProlabore}
                        salesTotal={salesData.monthlySummary?.totalInvoiced || 0}
                        workspaceId={workspaceId}
                    />
                </TabsContent>

            </div>

            <ClientProfitabilityModal
                isOpen={isDetailModalOpen}
                onOpenChange={setIsDetailModalOpen}
                client={selectedClientForDetail}
                metrics={detailMetrics}
            />

            <AddTransactionModal
                isOpen={isAddExpenseModalOpen}
                onOpenChange={setIsAddExpenseModalOpen}
                clients={clients}
                onAddExpense={addExpense}
                onCreateInvoice={createInvoice}
            />

            {/* Footer note */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-4 rounded-lg border border-border/50">
                <ShieldCheck className="h-4 w-4" />
                Esta área é visível apenas para usuários com perfil de Proprietário (Owner) ou Administrador (Admin).
            </div>
        </Tabs>
    );
};

const ShieldCheck = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
);

export default Financeiro;
