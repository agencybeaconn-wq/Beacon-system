import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import type { DailyDataPoint, ClientCosts } from '@/hooks/useSharedDashboard';
import { formatCurrencyBRL as formatCurrency } from '@/lib/formatters';

interface ProfitChartProps {
    dailyData: DailyDataPoint[];
    clientCosts: ClientCosts;
    dailyConversions?: number;
    primaryColor?: string;
}

export function ProfitChart({
    dailyData,
    clientCosts,
    dailyConversions = 0,
    primaryColor = '#0066FF',
}: ProfitChartProps) {
    // Calculate daily profit with client costs applied
    const chartData = useMemo(() => {
        const totalDays = dailyData.length || 1;
        const avgDailyConversions = dailyConversions / totalDays;

        return dailyData.map(day => {
            // Apply gateway fee
            const gatewayFee = day.revenue * (clientCosts.gateway_fee_percent / 100);

            // Apply supplier cost (distribute evenly if fixed, or estimate per day if per_sale)
            let supplierCost = 0;
            if (clientCosts.supplier_cost_mode === 'per_sale') {
                // Estimate conversions for this day based on revenue proportion
                const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
                const dayConversionEstimate = totalRevenue > 0
                    ? (day.revenue / totalRevenue) * dailyConversions
                    : avgDailyConversions;
                supplierCost = clientCosts.supplier_cost_value * dayConversionEstimate;
            } else {
                // Fixed cost distributed across days
                supplierCost = clientCosts.supplier_cost_value / totalDays;
            }

            const netProfit = day.profit - gatewayFee - supplierCost;

            return {
                ...day,
                originalProfit: day.profit,
                netProfit: Math.round(netProfit * 100) / 100,
                gatewayFee: Math.round(gatewayFee * 100) / 100,
                supplierCost: Math.round(supplierCost * 100) / 100,
            };
        });
    }, [dailyData, clientCosts, dailyConversions]);

    // Calculate totals
    const totals = useMemo(() => {
        const totalProfit = chartData.reduce((sum, d) => sum + d.netProfit, 0);
        const avgDailyProfit = chartData.length > 0 ? totalProfit / chartData.length : 0;
        const profitableDays = chartData.filter(d => d.netProfit > 0).length;

        return { totalProfit, avgDailyProfit, profitableDays };
    }, [chartData]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;

        const data = payload[0].payload;

        return (
            <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 min-w-[180px]">
                <p className="font-medium text-sm border-b pb-1 mb-2">{label}</p>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Faturamento:</span>
                        <span className="font-medium">{formatCurrency(data.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Gasto Ads:</span>
                        <span className="font-medium text-red-500">-{formatCurrency(data.spend)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Taxa Gateway:</span>
                        <span className="font-medium text-orange-500">-{formatCurrency(data.gatewayFee)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Custo Fornec.:</span>
                        <span className="font-medium text-amber-500">-{formatCurrency(data.supplierCost)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-semibold">Lucro Real:</span>
                        <span className={`font-bold ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(data.netProfit)}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="rounded-sm border-border/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" style={{ color: primaryColor }} />
                        Evolução do Lucro Estimado
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                            <span className="text-muted-foreground">Total:</span>
                            <span className={`ml-1 font-bold ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(totals.totalProfit)}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-muted-foreground">Média/dia:</span>
                            <span className={`ml-1 font-semibold ${totals.avgDailyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(totals.avgDailyProfit)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {totals.profitableDays === chartData.length ? (
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-orange-500" />
                            )}
                            <span className="text-muted-foreground">
                                {totals.profitableDays}/{chartData.length} dias positivos
                            </span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="profitGradientPositive" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="profitGradientNegative" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                                className="text-muted-foreground"
                            />
                            <YAxis
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                                tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                                className="text-muted-foreground"
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                            <Area
                                type="monotone"
                                dataKey="netProfit"
                                stroke="#10b981"
                                strokeWidth={2}
                                fill="url(#profitGradientPositive)"
                                dot={false}
                                activeDot={{ r: 5, fill: '#10b981' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
