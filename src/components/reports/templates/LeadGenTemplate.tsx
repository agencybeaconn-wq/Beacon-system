import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "../KPICard";
import { DollarSign, Users, MousePointerClick, Target } from "lucide-react";

// Mock Data
const efficiencyData = [
    { date: '01/05', leads: 45, cpl: 12.50 },
    { date: '02/05', leads: 52, cpl: 11.80 },
    { date: '03/05', leads: 38, cpl: 14.20 },
    { date: '04/05', leads: 65, cpl: 10.50 },
    { date: '05/05', leads: 72, cpl: 9.80 },
    { date: '06/05', leads: 58, cpl: 11.20 },
    { date: '07/05', leads: 85, cpl: 9.10 },
];

const platformData = [
    { name: 'Facebook', value: 245, fill: '#3b5998' },
    { name: 'Instagram', value: 390, fill: '#E1306C' },
    { name: 'Audience Net', value: 45, fill: '#a0aec0' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                <p className="text-sm font-semibold mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name === 'leads' ? 'Leads' : 'CPL'}:</span>
                        <span className="font-mono font-medium">
                            {entry.name === 'cpl'
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)
                                : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export function LeadGenTemplate() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="CPL (Custo por Lead)"
                    value="R$ 10,45"
                    icon={DollarSign}
                    trend={{ value: -14.2, isPositive: true }}
                    className="border-l-4 border-l-emerald-500"
                />
                <KPICard
                    title="Total Leads"
                    value="680"
                    icon={Users}
                    trend={{ value: 23.5, isPositive: true }}
                />
                <KPICard
                    title="CTR (Taxa de Clique)"
                    value="2.45%"
                    icon={MousePointerClick}
                    trend={{ value: 0.8, isPositive: true }}
                />
                <KPICard
                    title="Taxa de Conversão da LP"
                    value="32.8%"
                    icon={Target}
                    trend={{ value: 5.4, isPositive: true }}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cost Efficiency Chart */}
                <Card className="lg:col-span-2 border-border/50 bg-card/50">
                    <CardHeader>
                        <CardTitle>Eficiência de Custo</CardTitle>
                        <CardDescription>Volume de Leads vs Custo por Lead ao longo do tempo</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={efficiencyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#666"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#666"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#666"
                                    fontSize={12}
                                    tickFormatter={(value) => `R$${value}`}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar yAxisId="left" dataKey="leads" name="leads" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={30} fillOpacity={0.8} />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="cpl"
                                    name="cpl"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Platform Breakdown */}
                <Card className="border-border/50 bg-card/50">
                    <CardHeader>
                        <CardTitle>Por Plataforma</CardTitle>
                        <CardDescription>Origem dos Leads</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={platformData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" opacity={0.2} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                                    {platformData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
