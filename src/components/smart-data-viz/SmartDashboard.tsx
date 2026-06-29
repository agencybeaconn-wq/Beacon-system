import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DataConfig, parseBrazilianNumber, calculateExecutiveScore } from '@/hooks/useSmartData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Target, Activity, Zap, TrendingDown } from 'lucide-react';

interface SmartDashboardProps {
    data: any[];
    config: DataConfig;
}

export function SmartDashboard({ data, config }: SmartDashboardProps) {

    const executiveScore = useMemo(() => {
        try {
            return calculateExecutiveScore(data || [], config);
        } catch (e) {
            console.error('[SmartDashboard] Score calculation error:', e);
            return 0;
        }
    }, [data, config]);

    const metrics = useMemo(() => {
        return (config?.main_metrics || []).filter(m => m && m.field).map(metric => {
            const values = (data || []).map(d => parseBrazilianNumber(d?.[metric.field])).filter(v => !isNaN(v));
            let value = 0;

            if (metric.action === 'sum') value = values.reduce((a, b) => a + b, 0);
            else if (metric.action === 'avg') value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            else if (metric.action === 'count') value = (data || []).length;

            return { ...metric, value };
        });
    }, [data, config]);

    const getScoreColor = (score: number) => {
        if (score >= 7) return 'text-emerald-500 bg-emerald-50 border-emerald-100';
        if (score >= 5) return 'text-amber-500 bg-amber-50 border-amber-100';
        return 'text-rose-500 bg-rose-50 border-rose-100';
    };

    const getScoreStatus = (score: number) => {
        if (score >= 7) return 'BOM';
        if (score >= 5) return 'MÉDIO';
        return 'RUIM';
    };

    const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6'];

    const formatValue = (val: number, field: string) => {
        if (config?.data_types?.[field] === 'currency') {
            return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        return val.toLocaleString('pt-BR');
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center gap-4 bg-white rounded-[40px] border-2 border-dashed border-slate-100">
                <div className="p-4 bg-slate-50 rounded-full">
                    <Activity className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-600">Aguardando dados...</h3>
                <p className="text-slate-400 max-w-xs">Suba uma planilha ou configure o Master da Agência para ativar esse Dashboard.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-1000">
            {/* Executive Hero Section */}
            <Card className="overflow-hidden border-none shadow-2xl shadow-slate-200/50 rounded-[40px] bg-slate-900 text-white p-8 sm:p-12 relative">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/20 to-transparent pointer-events-none" />
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <span className="text-primary font-black uppercase tracking-[0.2em] text-xs">Diagnóstico Geral</span>
                            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter italic">Diagnóstico Executivo</h2>
                            <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md">
                                Análise automatizada baseada em KPIs de faturamento, ROI e conversão.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border ${getScoreColor(executiveScore)}`}>
                                <div className={`h-3 w-3 rounded-full animate-pulse ${executiveScore >= 7 ? 'bg-emerald-500' : executiveScore >= 5 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                <span className="font-black tracking-widest text-sm">STATUS: {getScoreStatus(executiveScore)}</span>
                            </div>
                            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl border border-slate-700 bg-slate-800 text-slate-300">
                                <Activity className="h-4 w-4" />
                                <span className="font-black tracking-widest text-sm uppercase">Active Engine</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center lg:justify-end">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-500" />
                            <div className="relative bg-slate-800 h-48 w-48 sm:h-64 sm:w-64 rounded-full border-8 border-slate-700 flex flex-col items-center justify-center shadow-inner">
                                <span className="text-6xl sm:text-8xl font-black italic tracking-tighter leading-none">{(executiveScore || 0).toFixed(1)}</span>
                                <span className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest mt-2">Média Score</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {(metrics || []).map((m, idx) => {
                    if (!m) return null;
                    const icons = [<Target key="1" />, <TrendingUp key="2" />, <Activity key="3" />, <Zap key="4" />];
                    const label = m?.label || '';
                    const isHighImpact = label.includes('Faturamento') || label.includes('Conversão');

                    return (
                        <Card key={idx} className="relative overflow-hidden group bg-white border-none shadow-xl shadow-slate-200/40 rounded-[28px] p-4 hover:-translate-y-1 transition-all duration-300 ring-1 ring-slate-100">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                {isHighImpact ? <Zap className="text-amber-500" /> : icons[idx % icons.length]}
                            </div>
                            <div className="space-y-3">
                                <div className={`p-2.5 w-fit rounded-2xl ${isHighImpact ? 'bg-amber-50 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                                    {isHighImpact ? <Zap className="h-4.5 w-4.5" /> : icons[idx % icons.length]}
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        {label}
                                        {isHighImpact && <span className="text-[9px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">PESO 5</span>}
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                                        {formatValue(m.value || 0, m.field)}
                                    </h3>
                                </div>
                                <div className={`flex items-center gap-1.2 text-[9px] font-bold px-2 py-0.5 rounded-full w-fit ${m.value > 0 ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>
                                    {m.value > 0 ? <TrendingUp className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                                    {m.value > 0 ? 'PERFORMANCE ATIVA' : 'SEM DADOS'}
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Recommendations & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 rounded-[32px] border-none shadow-2xl shadow-slate-200/50 p-8 bg-white ring-1 ring-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black tracking-tighter text-slate-900 italic">Análise de Desempenho</h3>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest text-[10px]">Sugestões Automáticas</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-600">
                                <TrendingUp className="h-5 w-5" />
                                <span className="font-black uppercase tracking-widest text-xs italic">O Que Manter</span>
                            </div>
                            <p className="text-emerald-800 text-sm font-medium leading-relaxed">
                                {executiveScore > 5
                                    ? "As métricas de faturamento estão saudáveis. Continue o plano de escala horizontal."
                                    : "Mantenha o foco na estabilização dos custos fixos enquanto melhora a conversão."}
                            </p>
                        </div>
                        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-100 space-y-3">
                            <div className="flex items-center gap-2 text-rose-600">
                                <TrendingDown className="h-5 w-5" />
                                <span className="font-black uppercase tracking-widest text-xs italic">O Que Melhorar</span>
                            </div>
                            <p className="text-rose-800 text-sm font-medium leading-relaxed">
                                {executiveScore < 7
                                    ? "Atenção ao ROAS. A eficiência criativa precisa de revisão imediata para subir o score."
                                    : "Excelente performance. Considere aumentar o orçamento nas campanhas de conversão topo de funil."}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="rounded-[32px] border-none shadow-2xl shadow-slate-200/50 p-8 bg-gradient-to-br from-primary to-indigo-600 text-white flex flex-col justify-between overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <div className="relative z-10 space-y-4">
                        <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <Zap className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-2xl font-black italic tracking-tighter leading-tight">Insight da IA</h3>
                        <p className="text-white/80 text-sm font-medium leading-relaxed">
                            Baseado nos dados da aba "{config?.category || 'Geral'}", detectamos que o gargalo atual está na taxa de conversão do checkout.
                        </p>
                    </div>
                    <button className="relative z-10 mt-6 w-full py-4 bg-white text-primary font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:bg-slate-50 transition-colors">
                        Gerar Plano de Ação
                    </button>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {(config?.charts || []).filter(c => c && c.xField && c.yField).map((chart, idx) => {
                    const chartData = (data || []).slice(0, 15).map(d => ({
                        ...d,
                        [chart.yField]: parseBrazilianNumber(d?.[chart.yField])
                    }));

                    if (chartData.length === 0) return null;

                    return (
                        <Card key={idx} className="rounded-[32px] border-none shadow-2xl shadow-slate-200/50 p-8 bg-white ring-1 ring-slate-100 flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black tracking-tighter text-slate-900 italic">
                                    {chart.title}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Insight</span>
                                </div>
                            </div>

                            <div className="h-[350px] w-full mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chart.type === 'bar' ? (
                                        <BarChart data={chartData}>
                                            <defs>
                                                <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#6366F1" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#818CF8" stopOpacity={0.8} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                            <XAxis
                                                dataKey={chart.xField}
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#94A3B8', fontWeight: 700 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#94A3B8', fontWeight: 700 }}
                                                tickFormatter={(v) => v > 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#F1F5F9' }}
                                                contentStyle={{
                                                    borderRadius: '20px',
                                                    border: 'none',
                                                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                                                    padding: '16px',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                            <Bar dataKey={chart.yField} fill={`url(#grad-${idx})`} radius={[10, 10, 0, 0]} />
                                        </BarChart>
                                    ) : chart.type === 'line' ? (
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id={`area-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                                                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                            <XAxis
                                                dataKey={chart.xField}
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#94A3B8', fontWeight: 700 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#94A3B8', fontWeight: 700 }}
                                            />
                                            <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                                            <Area
                                                type="monotone"
                                                dataKey={chart.yField}
                                                stroke="#6366F1"
                                                strokeWidth={4}
                                                fill={`url(#area-${idx})`}
                                                dot={{ r: 5, fill: '#6366F1', strokeWidth: 3, stroke: '#fff' }}
                                                activeDot={{ r: 8, fill: '#6366F1', strokeWidth: 0 }}
                                            />
                                        </AreaChart>
                                    ) : (
                                        <PieChart>
                                            <Pie
                                                data={chartData.slice(0, 5)}
                                                dataKey={chart.yField}
                                                nameKey={chart.xField}
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                innerRadius={70}
                                                paddingAngle={8}
                                                strokeWidth={0}
                                            >
                                                {chartData.slice(0, 5).map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                                        </PieChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
