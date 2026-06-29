import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "../KPICard";
import { Zap, ShoppingCart, RefreshCw, MousePointer2 } from "lucide-react";

// Mock Data
const creativeData = [
    { name: 'AD #04 - Depoimento', roas: 6.2, spend: 1200 },
    { name: 'AD #01 - Headline A', roas: 5.8, spend: 3500 },
    { name: 'AD #03 - Lifestyle', roas: 4.5, spend: 1800 },
    { name: 'AD #07 - Urgência', roas: 3.9, spend: 900 },
    { name: 'AD #02 - Oferta', roas: 2.1, spend: 4200 },
].sort((a, b) => b.roas - a.roas);

// Heatmap Data (Day x Hour)
// 0=Sun, 6=Sat. Hour 0-23. Value=Conversion Rate or Volume
const heatmapData = [
    { day: 0, hour: 10, value: 80 }, { day: 0, hour: 14, value: 90 }, { day: 0, hour: 20, value: 60 },
    { day: 1, hour: 9, value: 50 }, { day: 1, hour: 11, value: 85 }, { day: 1, hour: 19, value: 95 },
    { day: 2, hour: 10, value: 70 }, { day: 2, hour: 15, value: 60 }, { day: 2, hour: 21, value: 100 },
    { day: 3, hour: 12, value: 90 }, { day: 3, hour: 18, value: 80 }, { day: 3, hour: 22, value: 70 },
    { day: 4, hour: 11, value: 60 }, { day: 4, hour: 16, value: 75 }, { day: 4, hour: 20, value: 90 },
    { day: 5, hour: 10, value: 40 }, { day: 5, hour: 14, value: 50 }, { day: 5, hour: 21, value: 60 },
    { day: 6, hour: 11, value: 90 }, { day: 6, hour: 15, value: 85 }, { day: 6, hour: 20, value: 55 },
];

const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hours = [0, 6, 12, 18, 23];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                <p className="text-sm font-semibold">{payload[0].payload.name}</p>
                <p className="text-sm text-muted-foreground">ROAS: <span className="text-primary font-bold">{payload[0].value}x</span></p>
            </div>
        );
    }
    return null;
};

export function InfoproductTemplate() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="ROI (Retorno Imediato)"
                    value="458%"
                    icon={Zap}
                    trend={{ value: 15.2, isPositive: true }}
                    className="border-l-4 border-l-yellow-500"
                />
                <KPICard
                    title="Custo por Checkout (IC)"
                    value="R$ 18,50"
                    icon={ShoppingCart}
                    trend={{ value: -3.4, isPositive: true }}
                />
                <KPICard
                    title="Recuperação de Checkout"
                    value="12.5%"
                    icon={RefreshCw}
                    trend={{ value: 1.2, isPositive: false }}
                />
                <KPICard
                    title="Visitantes Únicos"
                    value="15.4k"
                    icon={MousePointer2}
                    trend={{ value: 8.9, isPositive: true }}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Creative Battle */}
                <Card className="lg:col-span-2 border-border/50 bg-card/50">
                    <CardHeader>
                        <CardTitle>Batalha de Criativos</CardTitle>
                        <CardDescription>Top 5 Anúncios por ROAS</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={creativeData} layout="vertical" margin={{ left: 40, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" opacity={0.2} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="roas" radius={[0, 4, 4, 0]} barSize={32} label={{ position: 'right', fill: '#fff' }}>
                                    {creativeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === creativeData.length - 1 ? '#ef4444' : '#e11d48'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Hourly Map */}
                <Card className="border-border/50 bg-card/50">
                    <CardHeader>
                        <CardTitle>Mapa de Calor</CardTitle>
                        <CardDescription>Picos de conversão (Dia x Hora)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} />
                                <XAxis
                                    type="number"
                                    dataKey="hour"
                                    name="Hora"
                                    domain={[0, 23]}
                                    tickCount={6}
                                    tick={{ fill: '#666', fontSize: 10 }}
                                    allowDecimals={false}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="day"
                                    name="Dia"
                                    domain={[0, 6]}
                                    tickFormatter={(val) => days[val]}
                                    tickCount={7}
                                    tick={{ fill: '#666', fontSize: 10 }}
                                />
                                <ZAxis type="number" dataKey="value" range={[50, 400]} />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-popover border border-border p-2 rounded text-xs">
                                                    {days[data.day]} às {data.hour}h<br />
                                                    <span className="font-bold text-primary">Score: {data.value}</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Scatter data={heatmapData} fill="#e11d48" shape="circle" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
