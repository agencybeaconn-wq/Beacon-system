import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Package,
    CheckCircle2,
    AlertTriangle,
    Search,
    Plus,
    Filter,
    ArrowUpRight,
    Clock,
    RotateCcw,
    CreditCard,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    RefreshCw,
    Loader2,
    LayoutGrid
} from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip
} from "recharts";
import { trackingService, ShipmentStats } from "@/services/trackingService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TrackingDashboard = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<ShipmentStats>({
        total: 0, taxed: 0, attention: 0, delivered: 0, transit: 0
    });
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
    const [shipments, setShipments] = useState<any[]>([]);
    const [newTracking, setNewTracking] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState<string | null>(null);
    const [showShipments, setShowShipments] = useState(false);

    const fetchStats = async () => {
        try {
            const dbStats = await trackingService.getDashboardStats();
            const counts = await trackingService.getStatusCounts();
            const list = await trackingService.getShipments();
            setStats(dbStats);
            setStatusCounts(counts);
            setShipments(list);
        } catch (error) {
            console.error("Error fetching tracking stats:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleAddTracking = async () => {
        if (!newTracking) return;
        const toastId = toast.loading("Registrando e buscando status...");
        try {
            const data = await trackingService.registerTracking(newTracking);

            if (data?.success === false) {
                toast.error(`Aviso: ${data.details || data.error}`, { id: toastId });
                return;
            }

            toast.success("Pedido registrado com sucesso!", { id: toastId });
            setNewTracking("");
            fetchStats();
        } catch (error: any) {
            console.error("Add tracking catch error:", error);
            const msg = error.details || error.message || "Erro de conexão.";
            toast.error(`Erro ao registrar: ${msg}`, { id: toastId });
        }
    };

    const handleSync = async (number: string) => {
        setIsSyncing(number);
        try {
            const data = await trackingService.syncTracking(number);

            if (data?.error) {
                toast.error(`Erro: ${data.details || data.error}`);
                return;
            }

            toast.success(`Status de ${number} atualizado!`);

            // Optimistically update local state if history is returned
            if (data?.history) {
                setShipments(prev => prev.map(s =>
                    s.tracking_number === number
                        ? { ...s, status: data.status, last_event_description: data.details, tracking_history: data.history }
                        : s
                ));
            }

            fetchStats();
        } catch (error: any) {
            console.error("Sync catch error:", error);
            const msg = error.details || error.message || "Erro de conexão com o servidor.";
            toast.error(`Falha na sincronização: ${msg}`);
        } finally {
            setIsSyncing(null);
        }
    };

    const donutData = useMemo(() => [
        { name: t('tracking.status.entregue'), value: stats.delivered || 0, color: '#10b981' },
        { name: t('tracking.status.em_trânsito'), value: stats.transit || 0, color: '#3b82f6' },
        { name: t('tracking.status.postado'), value: (statusCounts['Postado'] || 0), color: '#60a5fa' },
    ], [stats, statusCounts, t]);

    const statusList = [
        { label: t('tracking.status.postado'), key: 'Postado', color: 'bg-blue-400' },
        { label: t('tracking.status.em_trânsito'), key: 'Em Trânsito', color: 'bg-blue-500' },
        { label: t('tracking.status.saiu_para_entrega'), key: 'Saiu para Entrega', color: 'bg-indigo-400' },
        { label: t('tracking.status.entregue'), key: 'Entregue', color: 'bg-emerald-500' },
        { label: t('tracking.status.devolvido'), key: 'Devolvido', color: 'bg-rose-500' },
        { label: t('tracking.status.atrasado'), key: 'Atrasado', color: 'bg-amber-500' },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-10 px-4">
            {/* Header section with integrated buttons */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-secondary/20 backdrop-blur-md p-6 rounded-2xl border border-border/20 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground uppercase">
                        {t('tracking.title')}
                    </h1>
                    <p className="text-muted-foreground font-medium">
                        Sistema de Gestão Logística Beacon
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    <Button
                        variant="ghost"
                        className={cn(
                            "rounded-xl h-11 border-2 transition-all font-bold flex items-center gap-2 group",
                            showShipments ? "border-primary bg-primary text-white" : "border-primary/20 bg-secondary/50 text-foreground/80 hover:bg-primary/10"
                        )}
                        onClick={() => {
                            const newState = !showShipments;
                            setShowShipments(newState);
                            if (newState) {
                                setTimeout(() => {
                                    document.getElementById('shipments-section')?.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                            }
                        }}
                    >
                        <LayoutGrid className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        {showShipments ? 'FECHAR PEDIDOS' : `MEUS PEDIDOS (${shipments.length})`}
                    </Button>
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Pesquisar ou adicionar código..."
                            className="pl-10 bg-background/50 border-border focus:ring-primary/20 rounded-xl h-11 text-foreground font-bold"
                            value={newTracking}
                            onChange={(e) => setNewTracking(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTracking()}
                        />
                    </div>
                    <Button onClick={handleAddTracking} className="bg-primary hover:bg-primary/90 rounded-xl h-11 px-6 font-bold transition-all active:scale-95 flex items-center gap-2 shadow-none">
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">ADICIONAR</span>
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard title="TOTAL DE PEDIDOS" value={stats.total} icon={<Package className="w-5 h-5" />} gradient="from-blue-500/10 to-indigo-500/5" dotColor="bg-blue-500" />
                <SummaryCard title="% DE TAXADOS" value={`${stats.total > 0 ? ((stats.taxed / stats.total) * 100).toFixed(1) : 0}%`} icon={<CreditCard className="w-5 h-5" />} gradient="from-amber-500/10 to-orange-500/5" dotColor="bg-amber-500" warning={stats.taxed > 0} />
                <SummaryCard title="PEDIDOS COM ATENÇÃO" value={stats.attention} icon={<AlertTriangle className="w-5 h-5" />} gradient="from-rose-500/10 to-red-500/5" dotColor="bg-rose-500" warning={stats.attention > 0} />
                <SummaryCard title="ENTREGUE" value={stats.delivered} icon={<CheckCircle2 className="w-5 h-5" />} gradient="from-emerald-500/10 to-teal-500/5" dotColor="bg-emerald-500" />
            </div>

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <Card className="lg:col-span-8 overflow-hidden bg-card border-border shadow-xl rounded-3xl">
                    <CardHeader>
                        <CardTitle className="text-xl font-black text-foreground tracking-tight uppercase">Status dos Objetos</CardTitle>
                        <CardDescription className="text-muted-foreground">Monitoramento logístico em tempo real</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="h-[280px] relative flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={donutData} innerRadius={85} outerRadius={115} paddingAngle={10} dataKey="value" stroke="none">
                                            {donutData.map((e, i) => <Cell key={i} fill={e.color} className="drop-shadow-lg" />)}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-5xl font-black text-foreground tracking-tighter">{stats.total}</span>
                                    <span className="text-[10px] text-muted-foreground font-black tracking-widest uppercase">Total</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {statusList.map(s => {
                                    const count = statusCounts[s.key] || 0;
                                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                                    return (
                                        <div key={s.key}>
                                            <div className="flex justify-between items-end mb-1">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
                                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-tight">{s.label}</span>
                                                </div>
                                                <span className="text-xs font-black text-foreground">{count} ({pct.toFixed(0)}%)</span>
                                            </div>
                                            <Progress value={pct} className="h-1.5 bg-secondary" indicatorClassName={cn("transition-all duration-1000", s.color)} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="lg:col-span-4 space-y-6">
                    <Card className="p-8 bg-card border border-border/50 text-white shadow-2xl rounded-3xl overflow-hidden relative group">
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-2 text-primary opacity-90">
                                <Filter className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-[0.2em]">{t('tracking.categories')}</span>
                            </div>
                            <h3 className="text-2xl font-black leading-tight tracking-tight uppercase">{t('tracking.quick_access')}</h3>
                            <div className="space-y-3 pt-2">
                                <StatusTabItem icon={<Clock className="w-4 h-4" />} label="Pendentes" count={statusCounts['Pendente'] || 0} color="text-slate-400" />
                                <StatusTabItem icon={<ArrowUpRight className="w-4 h-4" />} label="Em Trânsito" count={stats.transit} color="text-blue-400" />
                                <StatusTabItem icon={<CheckCircle2 className="w-4 h-4" />} label="Finalizados" count={stats.delivered} color="text-emerald-400" />
                            </div>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
                    </Card>
                </div>
            </div>

            {/* Shipments Section - Moved to Bottom */}
            {showShipments && (
                <div id="shipments-section" className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-700">
                    <div className="flex items-center justify-between border-b border-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <ArrowUpRight className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-2xl font-black text-foreground tracking-tighter uppercase">Meus Pedidos</h2>
                        </div>
                        <Badge variant="outline" className="text-muted-foreground font-bold px-4 py-1.5 rounded-full border-border/50">
                            {shipments.length} REGISTRADOS
                        </Badge>
                    </div>

                    <div className="space-y-4">
                        {shipments.length === 0 ? (
                            <div className="w-full flex flex-col items-center justify-center py-24 bg-secondary/20 border-2 border-dashed border-border/20 rounded-[2rem]">
                                <Package className="w-16 h-16 text-muted-foreground/20 mb-4" />
                                <p className="text-muted-foreground/40 font-bold uppercase tracking-widest">Nenhum pedido encontrado</p>
                            </div>
                        ) : (
                            shipments.map((shipment) => (
                                <ShipmentRowCard
                                    key={shipment.id}
                                    shipment={shipment}
                                    onSync={() => handleSync(shipment.tracking_number)}
                                    isSyncing={isSyncing === shipment.tracking_number}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ShipmentRowCard = ({ shipment, onSync, isSyncing }: any) => {
    const [expanded, setExpanded] = useState(false);

    const statusColors: any = {
        'Entregue': 'bg-emerald-500',
        'Pendente': 'bg-muted-foreground/30',
        'Em Trânsito': 'bg-blue-500',
        'Saiu para Entrega': 'bg-indigo-500',
        'Postado': 'bg-sky-500',
        'Devolvido': 'bg-rose-500',
        'Atrasado': 'bg-amber-500',
    };

    const history = shipment.tracking_history || [];

    return (
        <Card className={cn(
            "overflow-hidden border-border transition-all duration-300",
            expanded ? "shadow-xl border-primary/20 bg-card" : "hover:shadow-lg bg-card/60 backdrop-blur-sm"
        )}>
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row items-center justify-between p-5 gap-6">
                    {/* Identification */}
                    <div className="flex items-center gap-4 min-w-[200px]">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md transform rotate-2", statusColors[shipment.status] || "bg-muted")}>
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-foreground tracking-tighter leading-none">{shipment.tracking_number}</h4>
                            <div className="flex items-center gap-2 mt-1.5">
                                <Badge className={cn("text-[9px] font-black h-4.5 uppercase px-2", statusColors[shipment.status] || "bg-muted-foreground/50")}>
                                    {shipment.status}
                                </Badge>
                                {shipment.is_taxed && <Badge className="bg-amber-100 text-amber-700 border-none text-[9px] font-black uppercase h-4.5">TAXADO</Badge>}
                            </div>
                        </div>
                    </div>

                    {/* Latest Status - Inline */}
                    <div className="flex-1 flex flex-col md:flex-row md:items-center gap-6 px-4 border-l border-border/50 hidden md:flex">
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status Atual</p>
                            <p className="text-sm font-bold text-foreground/80 line-clamp-1">
                                {shipment.last_event_description || "Aguardando informações do transportador..."}
                            </p>
                        </div>
                        <div className="w-32 text-right">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Último Evento</p>
                            <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" />
                                {shipment.last_event_time ? new Date(shipment.last_event_time).toLocaleDateString('pt-BR') : '---'}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); onSync(); }}
                            disabled={isSyncing}
                            className="rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all w-10 h-10"
                        >
                            <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin text-primary")} />
                        </Button>
                        <Button
                            variant="default"
                            className={cn(
                                "rounded-xl h-10 font-black text-[11px] px-5 transition-all flex items-center gap-2 shadow-none",
                                expanded ? "bg-accent" : "bg-primary hover:bg-primary/90"
                            )}
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? 'FECHAR DETALHES' : 'TODOS OS DETALHES'}
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {/* Expandable History Area */}
                <div className={cn(
                    "transition-all duration-500 overflow-hidden",
                    expanded ? "max-h-[800px] border-t border-border/50 bg-secondary/5" : "max-h-0"
                )}>
                    <div className="p-8">
                        <div className="grid lg:grid-cols-12 gap-10">
                            {/* Timeline */}
                            <div className="lg:col-span-8">
                                <div className="flex items-center gap-2 mb-8">
                                    <Clock className="w-5 h-5 text-primary" />
                                    <h5 className="text-sm font-black text-foreground uppercase tracking-widest">Histórico de Movimentação</h5>
                                </div>
                                <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[3px] before:bg-border/30 before:rounded-full">
                                    {history.length > 0 ? (
                                        history.map((event: any, i: number) => (
                                            <TimelineItem
                                                key={i}
                                                date={event.time}
                                                content={event.content}
                                                active={i === 0}
                                            />
                                        ))
                                    ) : (
                                        <>
                                            <TimelineItem
                                                date={shipment.last_event_time}
                                                content={shipment.last_event_description || "Pendente de atualização no sistema 17TRACK."}
                                                active
                                            />
                                            <TimelineItem
                                                date={shipment.created_at}
                                                content="Código registrado no sistema Beacon OS."
                                            />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Info Box */}
                            <div className="lg:col-span-4 space-y-4">
                                <div className="p-6 bg-card rounded-[2rem] shadow-sm border border-border/50 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                                            <span className="text-muted-foreground">Transportadora</span>
                                            <span className="text-primary">{shipment.carrier || 'Padrão'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                                            <span className="text-muted-foreground">Origem</span>
                                            <span className="text-foreground/80">{shipment.origin_country || 'Processando...'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                                            <span className="text-muted-foreground">Destino</span>
                                            <span className="text-foreground/80">{shipment.destination_country || 'Brasil'}</span>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-border/50">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 text-center">ANÁLISE LOGÍSTICA</p>
                                        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                <AlertTriangle className="w-5 h-5" />
                                            </div>
                                            <p className="text-[10px] font-bold text-primary/80 leading-tight">
                                                Sistema em conformidade. Aguardando próximas movimentações nos centros de distribuição.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const TimelineItem = ({ date, content, active }: any) => (
    <div className="relative group">
        <div className={cn(
            "absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full z-10 transition-transform group-hover:scale-150 shadow-sm",
            active ? "bg-primary ring-4 ring-primary/20" : "bg-muted-foreground/30"
        )} />
        <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                {date ? new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
            </p>
            <p className={cn("text-xs leading-relaxed", active ? "font-bold text-foreground" : "text-muted-foreground font-medium")}>
                {content}
            </p>
        </div>
    </div>
);

const SummaryCard = ({ title, value, icon, gradient, dotColor, warning }: any) => (
    <Card className={cn(
        "p-6 relative overflow-hidden bg-card border border-border shadow-sm rounded-[2rem] transition-all duration-500 hover:shadow-xl hover:-translate-y-1 group",
        warning && "ring-2 ring-rose-500/10 shadow-rose-200/10"
    )}>
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", gradient)} />
        <div className="relative z-10 flex flex-col justify-between h-full gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", dotColor, "animate-pulse")} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
                </div>
                <div className="p-3 bg-secondary/50 rounded-2xl shadow-sm border border-border/50 group-hover:scale-110 transition-all text-muted-foreground">
                    {icon}
                </div>
            </div>
            <div className="flex items-baseline">
                <span className="text-4xl font-black text-foreground tracking-tighter leading-none">{value}</span>
                {warning && <Badge className="ml-2 bg-rose-500/10 text-rose-600 border-none text-[10px] font-black uppercase">ALERTA</Badge>}
            </div>
        </div>
    </Card>
);

const StatusTabItem = ({ icon, label, count, color }: any) => (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group active:scale-[0.98]">
        <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl bg-white/5 shadow-inner", color)}>{icon}</div>
            <span className="text-sm font-bold text-white/90 group-hover:text-white transition-colors uppercase tracking-tight">{label}</span>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-white/10 text-[11px] font-black text-white group-hover:bg-primary transition-colors">
            {count}
        </div>
    </div>
);

export default TrackingDashboard;
