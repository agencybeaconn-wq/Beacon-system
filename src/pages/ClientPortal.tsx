import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
    TrendingUp,
    DollarSign,
    Target,
    BarChart3,
    Calendar,
    AlertCircle,
    Image as ImageIcon,
    Play,
    Settings2,
    RefreshCw,
    ArrowUpRight,
} from 'lucide-react';
import { useSharedDashboard, DateFilter } from '@/hooks/useSharedDashboard';
import { ProfitChart } from '@/components/portal/ProfitChart';
import { cn } from '@/lib/utils';
import leverLogo from '@/assets/lever-logo.png';
import { useTranslation } from 'react-i18next';
import { formatCurrencyBRL as formatCurrency } from '@/lib/formatters';

// Same card style as Overview - minimal border radius
const bentoCardClass = "bg-card border border-border/50 transition-all duration-300 rounded-sm";

// Same metric configs as Overview
const PORTAL_METRICS = [
    { key: 'roas', label: 'ROAS', icon: TrendingUp, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { key: 'revenue', label: 'Valor Conversão', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { key: 'spend', label: 'Custo', icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
    { key: 'conversions', label: 'Conversões', icon: Target, color: 'text-primary', bg: 'bg-primary/10' },
];

export default function ClientPortal() {
    const { t } = useTranslation();
    const { shareToken } = useParams<{ shareToken: string }>();
    const {
        data,
        isLoading,
        error,
        dateFilter,
        setDateFilter,
        customRange,
        setCustomRange,
        updateClientCosts,
        refetch,
    } = useSharedDashboard(shareToken);

    // Auto-refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            refetch();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refetch]);

    const formatNumber = (value: number) =>
        value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <div className="pt-6 text-center p-6">
                        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-lg font-semibold mb-2">Dashboard não encontrado</h2>
                        <p className="text-muted-foreground text-sm">
                            {error === 'Dashboard não encontrado ou expirado'
                                ? 'HTTP 401'
                                : error}
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    // Loading state - same style as Overview
    if (isLoading || !data) {
        return (
            <div className="flex-1 space-y-6 pt-4 px-4 md:pt-6 md:px-8 pb-8 bg-background min-h-screen">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-36 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-[400px] rounded-xl" />
            </div>
        );
    }

    const { whiteLabel, clientCosts, metrics, chartsData, topCampaigns, topAds } = data;

    // Calculate profit
    const gatewayFee = metrics.revenue * (clientCosts.gateway_fee_percent / 100);
    const supplierCost = clientCosts.supplier_cost_mode === 'fixed'
        ? clientCosts.supplier_cost_value
        : clientCosts.supplier_cost_value * metrics.conversions;
    const estimatedProfit = metrics.revenue - metrics.spend - gatewayFee - supplierCost;
    const profitMargin = metrics.revenue > 0 ? (estimatedProfit / metrics.revenue) * 100 : 0;

    const metricValues: Record<string, number> = {
        roas: metrics.roas,
        revenue: metrics.revenue,
        spend: metrics.spend,
        conversions: metrics.conversions,
    };

    const formatMetricValue = (key: string, value: number) => {
        if (key === 'roas') return `${value.toFixed(2)}x`;
        if (key === 'conversions') return formatNumber(value);
        return formatCurrency(value);
    };

    return (
        <div className="flex-1 space-y-6 pt-4 px-4 md:pt-6 md:px-8 pb-8 bg-background min-h-screen">
            {/* Header - Same style as Overview */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        {whiteLabel.agencyLogo ? (
                            <img
                                src={whiteLabel.agencyLogo}
                                alt={whiteLabel.agencyName || 'Logo'}
                                className="h-8 w-auto object-contain"
                            />
                        ) : (
                            <img src={leverLogo} alt="Beacon" className="h-8 w-auto" />
                        )}
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {t('overview.title', 'Overview')}
                        </h2>
                    </div>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        {t('overview.subtitle', 'Track your campaign performance')}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Date Filter - same style as Overview */}
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                        <Button
                            variant={dateFilter === 'today' ? 'default' : 'ghost'}
                            size="sm"
                            className={cn("h-8 text-xs", dateFilter === 'today' && "bg-primary text-primary-foreground")}
                            onClick={() => setDateFilter('today')}
                        >
                            {t('common.today', 'Today')}
                        </Button>
                        <Button
                            variant={dateFilter === '7d' ? 'default' : 'ghost'}
                            size="sm"
                            className={cn("h-8 text-xs", dateFilter === '7d' && "bg-primary text-primary-foreground")}
                            onClick={() => setDateFilter('7d')}
                        >
                            7d
                        </Button>
                        <Button
                            variant={dateFilter === '30d' ? 'default' : 'ghost'}
                            size="sm"
                            className={cn("h-8 text-xs", dateFilter === '30d' && "bg-primary text-primary-foreground")}
                            onClick={() => setDateFilter('30d')}
                        >
                            {t('common.month', 'Month')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                        >
                            <Calendar className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Refresh */}
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()}>
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>

                    {/* Costs Settings */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9">
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                            <div className="space-y-4">
                                <h4 className="font-medium text-sm">Configurar Custos</h4>

                                <div className="space-y-2">
                                    <Label className="text-xs">Custo de Fornecedor/Produto</Label>
                                    <div className="flex gap-2">
                                        <Select
                                            value={clientCosts.supplier_cost_mode}
                                            onValueChange={(v) => updateClientCosts({
                                                ...clientCosts,
                                                supplier_cost_mode: v as 'fixed' | 'per_sale'
                                            })}
                                        >
                                            <SelectTrigger className="w-[100px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="per_sale">Por Venda</SelectItem>
                                                <SelectItem value="fixed">Fixo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={clientCosts.supplier_cost_value}
                                                onChange={(e) => updateClientCosts({
                                                    ...clientCosts,
                                                    supplier_cost_value: parseFloat(e.target.value) || 0
                                                })}
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs">Taxa de Gateway/Checkout</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.1}
                                            value={clientCosts.gateway_fee_percent}
                                            onChange={(e) => updateClientCosts({
                                                ...clientCosts,
                                                gateway_fee_percent: parseFloat(e.target.value) || 0
                                            })}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {dateFilter === 'custom' && (
                        <DateRangePicker
                            dateRange={customRange}
                            onDateRangeChange={setCustomRange}
                        />
                    )}
                </div>
            </div>

            {/* Main grid - same structure as Overview */}
            <div className="grid grid-cols-12 gap-6">
                {/* KPI Cards - 4 columns */}
                <div className="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {PORTAL_METRICS.map((metric) => {
                        const Icon = metric.icon;
                        const value = metricValues[metric.key];

                        return (
                            <Card key={metric.key} className={cn("p-6 flex flex-col justify-between h-36 relative overflow-hidden", bentoCardClass)}>
                                <div className="flex items-start justify-between">
                                    <span className="font-medium text-sm text-muted-foreground">
                                        {metric.label}
                                    </span>
                                    <div className={cn("p-2.5 rounded-lg", metric.bg)}>
                                        <Icon className={cn("h-5 w-5", metric.color)} />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-3xl font-bold tracking-tight text-foreground">
                                        {formatMetricValue(metric.key, value)}
                                    </p>
                                    <div className="flex items-center gap-1 text-xs text-emerald-500">
                                        <ArrowUpRight className="h-3 w-3" />
                                        <span>{t('overview.metrics.vs_previous', 'vs previous period')}</span>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Profit Summary Card */}
                <Card className={cn("col-span-12 p-6", bentoCardClass)}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div className="space-y-3 flex-1">
                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-emerald-500" />
                                    Faturamento Bruto
                                </span>
                                <span className="font-semibold">{formatCurrency(metrics.revenue)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">- Gasto com Anúncios</span>
                                <span className="text-primary font-medium">- {formatCurrency(metrics.spend)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">- Taxa de Gateway ({clientCosts.gateway_fee_percent}%)</span>
                                <span className="text-primary font-medium">- {formatCurrency(gatewayFee)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">- Custo de Fornecedor</span>
                                <span className="text-primary font-medium">- {formatCurrency(supplierCost)}</span>
                            </div>
                        </div>

                        <div className="text-right md:border-l md:border-border/50 md:pl-8">
                            <p className="text-sm text-muted-foreground mb-1">Lucro Real Estimado</p>
                            <p className={cn("text-4xl font-bold", estimatedProfit >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                                {formatCurrency(estimatedProfit)}
                            </p>
                            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                                <span>{profitMargin.toFixed(1)}% margem</span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Profit Chart */}
                <div className="col-span-12">
                    <ProfitChart
                        dailyData={chartsData.dailyEvolution}
                        clientCosts={clientCosts}
                        dailyConversions={metrics.conversions}
                        primaryColor="#e5e5e5"
                    />
                </div>

                {/* Top Creatives - Table */}
                <Card className={cn("col-span-12 p-0 overflow-hidden", bentoCardClass)}>
                    <div className="p-6 pb-2">
                        <h3 className="font-semibold flex items-center gap-2">
                            <ImageIcon className="h-5 w-5 text-primary" />
                            {t('overview.top_creatives', 'Top Creatives')}
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        {topAds.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-8">
                                {t('overview.no_creatives', 'No creatives in this period')}
                            </p>
                        ) : (
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="border-b border-border hover:bg-transparent">
                                        <TableHead className="w-[50px] text-center border-r border-border text-[10px] uppercase tracking-wider text-muted-foreground font-bold">#</TableHead>
                                        <TableHead className="border-r border-border text-[10px] uppercase tracking-wider text-muted-foreground font-bold min-w-[200px]">{t('common.creative', 'Creative')}</TableHead>
                                        <TableHead className="border-r border-border text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-left min-w-[100px]">{t('campaigns.table.spend', 'Spend')}</TableHead>
                                        <TableHead className="border-r border-border text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-left min-w-[80px]">ROAS</TableHead>
                                        <TableHead className="border-r border-border text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-left min-w-[80px]">CPA</TableHead>
                                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-left">{t('campaigns.table.results', 'Conv.')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topAds.map((ad, index) => (
                                        <TableRow key={ad.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                                            <TableCell className="py-3 border-r border-border text-center">
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted border border-border text-[10px] font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors mx-auto">
                                                    {index + 1}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-3 border-r border-border font-medium text-sm text-foreground max-w-[250px] truncate" title={ad.name}>
                                                {ad.name}
                                            </TableCell>
                                            <TableCell className="py-3 border-r border-border text-left font-medium text-sm">
                                                {formatCurrency(ad.spend)}
                                            </TableCell>
                                            <TableCell className="py-3 border-r border-border text-left">
                                                <Badge
                                                    variant="secondary"
                                                    className={cn(
                                                        "font-bold",
                                                        ad.roas >= 2 ? 'bg-emerald-500/10 text-emerald-600' :
                                                            ad.roas >= 1 ? 'bg-yellow-500/10 text-yellow-600' :
                                                                'bg-red-500/10 text-red-600'
                                                    )}
                                                >
                                                    {ad.roas.toFixed(2)}x
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-3 border-r border-border text-left font-normal text-muted-foreground text-xs">
                                                {formatCurrency(ad.cpa)}
                                            </TableCell>
                                            <TableCell className="py-3 text-left font-medium text-sm">
                                                {ad.conversions}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </Card>
            </div>

            {/* Footer */}
            <footer className="text-center text-xs text-muted-foreground py-4 border-t border-border/50">
                <p>
                    Powered by{' '}
                    <span className="font-bold text-primary">Beacon</span>
                </p>
            </footer>
        </div>
    );
}
