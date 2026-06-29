import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Wallet,
    ArrowUpRight,
    PieChart,
    Users,
    Activity
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";
import { MemberFinancial, ClientInvoice, FinancialExpense } from "@/hooks/useFinancials";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface InternalAgencyDashboardProps {
    invoices: ClientInvoice[];
    expenses: FinancialExpense[];
    staffFinancials: MemberFinancial[];
    mrr: number;
}

export function InternalAgencyDashboard({ invoices, expenses, staffFinancials, mrr }: InternalAgencyDashboardProps) {
    const metrics = useMemo(() => {
        const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0);
        const totalExpenses = expenses.filter(e => e.status === 'paid').reduce((acc, e) => acc + e.amount, 0);
        const baseSalaries = staffFinancials.reduce((acc, curr) => acc + curr.base_salary, 0);

        const netProfit = totalRevenue - (totalExpenses + baseSalaries);
        const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        return {
            totalRevenue,
            totalExpenses: totalExpenses + baseSalaries,
            netProfit,
            margin,
            baseSalaries
        };
    }, [invoices, expenses, staffFinancials]);

    const chartData = useMemo(() => {
        const start = startOfMonth(new Date());
        const end = endOfMonth(new Date());
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const dailyRevenue = invoices
                .filter(i => i.payment_date && isSameDay(new Date(i.payment_date), day))
                .reduce((acc, i) => acc + i.amount, 0);

            const dailyExpenses = expenses
                .filter(e => e.payment_date && isSameDay(new Date(e.payment_date), day))
                .reduce((acc, e) => acc + e.amount, 0);

            // Distributed salary for visualization (simplified)
            const dailySalary = metrics.baseSalaries / days.length;

            return {
                name: format(day, 'dd/MM'),
                revenue: dailyRevenue,
                expenses: dailyExpenses + dailySalary,
                profit: dailyRevenue - (dailyExpenses + dailySalary)
            };
        });
    }, [invoices, expenses, metrics.baseSalaries]);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="p-6 space-y-2 bg-background border border-border/50">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                        <span>Faturamento Real</span>
                        <DollarSign className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-black text-emerald-500">{formatCurrency(metrics.totalRevenue)}</div>
                    <p className="text-[10px] text-muted-foreground">Entradas liquidadas no mês</p>
                </Card>

                <Card className="p-6 space-y-2 bg-background border border-border/50">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                        <span>Custos Operacionais</span>
                        <TrendingDown className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="text-2xl font-black text-destructive">{formatCurrency(metrics.totalExpenses)}</div>
                    <p className="text-[10px] text-muted-foreground">Fixos + Variáveis + Staff</p>
                </Card>

                <Card className="p-6 space-y-2 bg-background border border-border/50">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                        <span>Lucro Líquido</span>
                        <Wallet className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-2xl font-black text-primary">{formatCurrency(metrics.netProfit)}</div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-500">
                        <TrendingUp className="h-3 w-3" />
                        <span>{metrics.margin.toFixed(1)}% Margem Real</span>
                    </div>
                </Card>

                <Card className="p-6 space-y-2 bg-background border border-border/50">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
                        <span>Previsão MRR</span>
                        <PieChart className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-black">{formatCurrency(mrr)}</div>
                    <p className="text-[10px] text-muted-foreground">Total em contratos ativos</p>
                </Card>
            </div>

            <Card className="p-6 border border-border/50 bg-background/50 h-[400px]">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            Saúde Financeira da Agência
                        </h3>
                        <p className="text-xs text-muted-foreground">Comparativo de fluxo de caixa diário (Realizado)</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            RECEITAS
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <div className="w-2 h-2 rounded-full bg-destructive" />
                            DESPESAS
                        </div>
                    </div>
                </div>

                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" strokeOpacity={0.1} />
                            <XAxis
                                dataKey="name"
                                fontSize={10}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#888888' }}
                            />
                            <YAxis
                                fontSize={10}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#888888' }}
                                tickFormatter={(val) => `R$ ${val / 1000}k`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#10b981"
                                fillOpacity={1}
                                fill="url(#colorRev)"
                                strokeWidth={1.5}
                            />
                            <Area
                                type="monotone"
                                dataKey="expenses"
                                stroke="#ef4444"
                                fillOpacity={1}
                                fill="url(#colorExp)"
                                strokeWidth={1.5}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
