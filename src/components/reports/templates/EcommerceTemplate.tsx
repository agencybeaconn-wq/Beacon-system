import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, ComposedChart, FunnelChart, Funnel, Cell, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "../KPICard";
import { DollarSign, ShoppingBag, Users, TrendingUp, ArrowRight } from "lucide-react";

// Mock Data
const trendData = [
    { date: '01/05', spend: 1200, revenue: 4500 },
    { date: '02/05', spend: 1500, revenue: 6200 },
    { date: '03/05', spend: 1100, revenue: 4800 },
    { date: '04/05', spend: 1800, revenue: 8500 },
    { date: '05/05', spend: 2200, revenue: 11000 },
    { date: '06/05', spend: 1900, revenue: 9200 },
    { date: '07/05', spend: 2500, revenue: 13500 },
];

const funnelData = [
    { value: 12500, name: 'View Content', fill: '#ef4444' }, // red-500
    { value: 4200, name: 'Add to Cart', fill: '#f43f5e' }, // rose-500
    { value: 2100, name: 'Checkouts', fill: '#ec4899' }, // pink-500 (still warm) -> maybe changed to #be123c (rose-700)
    { value: 850, name: 'Purchases', fill: '#9f1239' }, // rose-800
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                <p className="text-sm font-semibold mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name === 'revenue' ? 'Receita' : 'Gasto'}:</span>
                        <span className="font-mono font-medium">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export function EcommerceTemplate() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="ROAS"
                    value="5.4x"
                    icon={TrendingUp}
                    trend={{ value: 12.5, isPositive: true }}
                    className="border-l-4 border-l-primary"
                />
                <KPICard
                    title="Receita Total"
                    value="R$ 138.450"
                    subValue="452 vendas"
                    icon={DollarSign}
                    trend={{ value: 8.2, isPositive: true }}
                />
                <KPICard
                    title="CPA (Custo/Compra)"
                    value="R$ 42,30"
                    icon={ShoppingBag}
                    trend={{ value: -5.1, isPositive: true }} // Negative cost is good
                />
                <KPICard
                    title="Ticket Médio (AOV)"
                    value="R$ 306,12"
                    icon={Users}
                    trend={{ value: 2.1, isPositive: true }}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Trend Chart */}
                <Card className="lg:col-span-2 border-border/50 bg-card/50">
                    <CardHeader>
                        <CardTitle>Tendência de Vendas</CardTitle>
                        <CardDescription>Relação entre Investimento (Gasto) e Retorno (Receita)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#666"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#666"
                                    fontSize={12}
                                    tickFormatter={(value) => `R$${value / 1000}k`}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="spend" name="spend" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.8} />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    name="revenue"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                    strokeWidth={3}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Purchase Funnel */}
                <Card className="border-border/50 bg-card/50">
                    <CardHeader>
                        <CardTitle>Funil de Vendas</CardTitle>
                        <CardDescription>Conversão por etapa</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] flex flex-col justify-center relative">
                        {/* Custom Funnel Representation since Recharts Funnel is tricky to style perfectly like the request */}
                        <div className="space-y-6">
                            {funnelData.map((item, index) => {
                                const prevValue = index > 0 ? funnelData[index - 1].value : item.value;
                                const dropOff = index > 0 ? Math.round(((prevValue - item.value) / prevValue) * 100) : 0;

                                return (
                                    <div key={item.name} className="relative">
                                        <div className="flex justify-between text-sm mb-1 px-1">
                                            <span className='font-medium text-muted-foreground'>{item.name}</span>
                                            <span className="font-bold">{new Intl.NumberFormat('pt-BR').format(item.value)}</span>
                                        </div>
                                        <div className="h-3 w-full bg-secondary/30 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(item.value / funnelData[0].value) * 100}%` }}
                                                transition={{ duration: 1, delay: index * 0.1 }}
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: item.fill }}
                                            />
                                        </div>
                                        {index > 0 && (
                                            <div className="absolute -top-5 right-0 text-[10px] text-muted-foreground flex items-center gap-1">
                                                <ArrowRight className="h-3 w-3 rotate-45 text-red-500" />
                                                {dropOff}% de queda
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Just for animation
import { motion } from "framer-motion";
