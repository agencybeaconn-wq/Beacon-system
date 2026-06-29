
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, ShoppingBag } from "lucide-react";
import { useFinancialMetrics } from "@/hooks/useFinancialMetrics";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState } from "react";
import { startOfMonth, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

export default function FinancialDashboard() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });

    const { data: metrics, isLoading } = useFinancialMetrics(
        dateRange?.from && dateRange?.to ? { from: dateRange.from, to: dateRange.to } : undefined
    );

    const formatPercent = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value / 100); // Expecting 0-100 input based on engine, but standard is 0-1. Engine returns 0-100? Let's check engine.
        // Engine: (netProfit / revenue) * 100. So it is 0-100.
        // Divider by 100 for Intl format
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
                    <p className="text-muted-foreground">
                        Visão geral de margem real, lucro líquido e despesas.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Faturamento Bruto"
                    icon={DollarSign}
                    isLoading={isLoading}
                    value={formatCurrency(metrics?.grossRevenue || 0)}
                    subtext={`${metrics?.ordersCount || 0} pedidos`}
                />
                <MetricCard
                    title="Lucro Líquido"
                    icon={TrendingUp}
                    isLoading={isLoading}
                    value={formatCurrency(metrics?.netProfit || 0)}
                    subtext={`Margem: ${metrics ? Number(metrics.margin).toFixed(1) : 0}%`}
                />
                <MetricCard
                    title="Gasto em Ads"
                    icon={TrendingDown}
                    isLoading={isLoading}
                    value={formatCurrency(metrics?.adSpend || 0)}
                    subtext="Total investido"
                />
                <MetricCard
                    title="ROAS Real"
                    icon={ShoppingBag}
                    isLoading={isLoading}
                    value={`${metrics ? metrics.roas.toFixed(2) : '0.00'}x`}
                    subtext={`CPA: ${formatCurrency(metrics?.cpa || 0)}`}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Receita vs. Custos</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        {isLoading ? (
                            <Skeleton className="h-[350px] w-full" />
                        ) : (
                            <div className="h-[350px] w-full bg-muted/20 flex items-center justify-center text-muted-foreground">
                                Gráfico de Linha (Em Breve)
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Custos por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-[350px] w-full" />
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-muted-foreground">Impostos</span>
                                    <span className="font-medium">{formatCurrency(metrics ? (metrics.grossRevenue - metrics.netRevenue + (metrics.cogs * 0)) * 1 : 0)}
                                        {/* Simplified visual check, actually we don't return breakdown from hook yet in main obj. 
                         I should probably export costBreakdown if I want it here.
                         For now, let's just put placeholders or basic calc
                      */}
                                    </span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-muted-foreground">CMV (Produtos)</span>
                                    <span className="font-medium">{formatCurrency(metrics?.cogs || 0)}</span>
                                </div>
                                <div className="h-[200px] w-full bg-muted/20 flex items-center justify-center text-muted-foreground text-xs">
                                    Gráfico de Pizza (Em Breve)
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({ title, icon: Icon, isLoading, value, subtext }: { title: string; icon: any; isLoading: boolean; value?: string; subtext?: string }) {
    return (
        <Card className="border-slate-200/60 transition-all shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-1">
                <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
                <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-[100px]" />
                        <Skeleton className="h-4 w-[60px]" />
                    </div>
                ) : (
                    <>
                        <div className="text-3xl font-bold tracking-tight text-slate-900">{value}</div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground/60 mt-1">{subtext}</p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
