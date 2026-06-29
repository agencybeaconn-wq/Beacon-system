import { useState, useMemo } from 'react';

// Cores do score alinhadas à classificação (7 níveis).
// score >= 85 ESCALAR | >=70 OTIMIZADO | >=60 BOM | >=50 OTIMIZAR | >=40 ATENÇÃO | >=30 CRÍTICO | <30 PAUSAR
function getScoreColor(score: number): string {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-emerald-500';
    if (score >= 60) return 'text-lime-400';
    if (score >= 50) return 'text-amber-400';
    if (score >= 40) return 'text-orange-500';
    if (score >= 30) return 'text-red-500';
    return 'text-red-700';
}

import {
    TrendingUp, Activity, CheckCircle2, AlertTriangle,
    Search, Download, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { classifyClient } from '@/utils/smartDataLogic';
import { SmartClientDetail } from './SmartClientDetail';
import { useSmartDataV2, SmartDataPeriod } from '@/hooks/useSmartDataV2';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const PERIOD_OPTIONS: { value: SmartDataPeriod; label: string }[] = [
    { value: 'today', label: 'Hoje' },
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: 'month', label: 'Mês' },
];

export function SmartDataDashboardV2() {
    const {
        clients, summary, isLoading, isLoadingLive, error, period, periodLabel,
        changePeriod, refresh, syncFromMeta, updateClientMetric
    } = useSmartDataV2();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [editingCell, setEditingCell] = useState<{ id: string, field: string, value: string } | null>(null);

    const stats = useMemo(() => {
        const countByStatus = {
            ESCALAR: clients.filter(c => c.status === "ESCALAR").length,
            OTIMIZADO: clients.filter(c => c.status === "OTIMIZADO").length,
            BOM: clients.filter(c => c.status === "BOM").length,
            OTIMIZAR: clients.filter(c => c.status === "OTIMIZAR").length,
            ATENÇÃO: clients.filter(c => c.status === "ATENÇÃO").length,
            CRÍTICO: clients.filter(c => c.status === "CRÍTICO").length,
            PAUSAR: clients.filter(c => c.status === "PAUSAR").length,
            AVALIAR: clients.filter(c => c.status === "AVALIAR").length,
            SEM_DADOS: clients.filter(c => c.status === "SEM DADOS").length,
        };
        return { ...summary, countByStatus };
    }, [clients, summary]);

    const filteredClients = useMemo(() => {
        return clients
            .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => b.score - a.score);
    }, [clients, searchTerm]);

    if (error) {
        return (
            <div className="p-8 text-center bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/40">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-red-800 dark:text-red-200">Erro ao carregar dados</h3>
                <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>
                <Button onClick={() => refresh()} className="mt-6" variant="destructive">Tentar Novamente</Button>
            </div>
        );
    }

    if (isLoading && clients.length === 0) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
                <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-[500ms]">
            {/* Live data loading indicator */}
            {isLoadingLive && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Carregando dados ao vivo...</span>
                </div>
            )}
            {/* Controls Row: Search left, Period + Actions right */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar cliente..."
                        className="pl-10 bg-background border-border rounded-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Period Selector */}
                    <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1">
                        {PERIOD_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => changePeriod(opt.value)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                    period === opt.value
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-background"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncFromMeta()}
                        disabled={isLoadingLive}
                        className="font-bold"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoadingLive ? 'animate-spin' : ''}`} />
                        {isLoadingLive ? 'Atualizando...' : 'Atualizar Dados'}
                    </Button>
                    <Button variant="outline" size="sm" className="hidden md:flex font-bold">
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 bg-background border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Investido</span>
                        <Activity className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="text-2xl font-black tracking-tight">
                        R$ {stats.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{periodLabel}</p>
                </Card>

                <Card className="p-4 bg-background border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Faturado</span>
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black tracking-tight">
                        R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                    <p className="text-[10px] text-emerald-500 font-bold mt-1">ROAS Médio: {stats.avgRoas.toFixed(2)}</p>
                </Card>

                <Card className="p-4 bg-background border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comissão Beacon</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black tracking-tight text-emerald-500">
                        R$ {(stats.totalCommission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Somatória a receber no período</p>
                </Card>

                <Card className="p-4 bg-background border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</span>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold mt-1 tabular-nums">
                        <span className="flex items-center gap-1.5" title="ESCALAR + OTIMIZADO + BOM">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                            <span className="text-emerald-500">
                                {(stats.countByStatus.ESCALAR || 0) + (stats.countByStatus.OTIMIZADO || 0) + (stats.countByStatus.BOM || 0)}
                            </span>
                        </span>
                        <span className="flex items-center gap-1.5" title="OTIMIZAR">
                            <div className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20" />
                            <span className="text-amber-400">{stats.countByStatus.OTIMIZAR || 0}</span>
                        </span>
                        <span className="flex items-center gap-1.5" title="ATENÇÃO">
                            <div className="w-2 h-2 rounded-full bg-orange-500 ring-2 ring-orange-500/20" />
                            <span className="text-orange-500">{stats.countByStatus.ATENÇÃO || 0}</span>
                        </span>
                        <span className="flex items-center gap-1.5" title="CRÍTICO + PAUSAR">
                            <div className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-500/20" />
                            <span className="text-red-500">
                                {(stats.countByStatus.CRÍTICO || 0) + (stats.countByStatus.PAUSAR || 0)}
                            </span>
                        </span>
                        {stats.countByStatus.SEM_DADOS > 0 && (
                            <span className="flex items-center gap-1.5" title="SEM DADOS">
                                <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                                <span className="text-muted-foreground">{stats.countByStatus.SEM_DADOS}</span>
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">Clientes ativos: {stats.activeClients}</p>
                </Card>
            </div>

            {/* Clients Table */}
            <Card className="bg-background border border-border/50 rounded-xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-border/50 hover:bg-transparent">
                            <TableHead className="w-[120px] text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Status</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Cliente</TableHead>
                            <TableHead className="text-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Score</TableHead>
                            <TableHead className="text-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground">ROAS</TableHead>
                            <TableHead className="text-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Conv. Site</TableHead>
                            <TableHead className="text-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Aprovação</TableHead>
                            <TableHead className="text-right text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Investimento</TableHead>
                            <TableHead className="text-right text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Faturamento</TableHead>
                            <TableHead className="text-right text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Lucro Líquido</TableHead>
                            <TableHead className="text-right text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Ação</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                    Nenhum cliente encontrado para {periodLabel}.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredClients.map((client) => {
                                const isNoData = client.status === 'SEM DADOS';
                                const statusInfo = !isNoData
                                    ? classifyClient(client.score)
                                    : { emoji: '', cor: '#71717a', status: 'SEM DADOS' };
                                return (
                                    <TableRow
                                        key={client.id}
                                        className={cn(
                                            "cursor-pointer transition-colors border-b border-border/20",
                                            "even:bg-muted/10 hover:bg-muted/40",
                                            isNoData && "opacity-50"
                                        )}
                                        onClick={() => setSelectedClient(client)}
                                    >
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className="font-bold whitespace-nowrap text-[10px]"
                                                style={{
                                                    backgroundColor: `${statusInfo.cor}26`,
                                                    color: statusInfo.cor,
                                                    borderColor: `${statusInfo.cor}55`
                                                }}
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: statusInfo.cor }} />
                                                {statusInfo.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-bold text-foreground">
                                            {client.name}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {client.status !== 'SEM DADOS' ? (
                                                <div className="flex flex-col items-center">
                                                    <span className={cn("text-lg font-black tabular-nums", getScoreColor(client.score))}>
                                                        {client.score.toFixed(0)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">/100</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                        </TableCell>

                                        {/* ROAS — editable */}
                                        <TableCell
                                            className="text-center font-medium cursor-pointer group/cell"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingCell({ id: client.id, field: 'roas', value: client.roas.toFixed(2) });
                                            }}
                                        >
                                            {editingCell?.id === client.id && editingCell?.field === 'roas' ? (
                                                <Input
                                                    className="w-16 h-7 p-1 text-center font-bold text-xs"
                                                    value={editingCell.value}
                                                    onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                                    onBlur={() => {
                                                        const val = parseFloat(editingCell.value);
                                                        if (!isNaN(val)) updateClientMetric(client.id, 'roas', val);
                                                        setEditingCell(null);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = parseFloat(editingCell.value);
                                                            if (!isNaN(val)) updateClientMetric(client.id, 'roas', val);
                                                            setEditingCell(null);
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className={cn(
                                                    "tabular-nums font-semibold group-hover/cell:text-primary transition-colors",
                                                    client.roas >= 5 ? 'text-emerald-500'
                                                        : client.roas >= 3 ? 'text-lime-400'
                                                            : client.roas >= 2 ? 'text-amber-400'
                                                                : client.roas > 0 ? 'text-red-500'
                                                                    : 'text-muted-foreground'
                                                )}>
                                                    {client.roas > 0 ? client.roas.toFixed(2) : '-'}
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* Conv. Site — benchmark camisa: ≥1.5% top, ≥1% bom, ≥0.7% médio, <0.4% ruim */}
                                        <TableCell className="text-center">
                                            <span className={cn(
                                                "tabular-nums",
                                                client.taxaConversaoSite >= 1.5 ? 'text-emerald-500 font-semibold'
                                                    : client.taxaConversaoSite >= 1.0 ? 'text-lime-400'
                                                        : client.taxaConversaoSite >= 0.7 ? 'text-foreground'
                                                            : client.taxaConversaoSite > 0 ? 'text-amber-400'
                                                                : 'text-muted-foreground'
                                            )}>
                                                {client.taxaConversaoSite > 0 ? `${client.taxaConversaoSite.toFixed(1)}%` : '-'}
                                            </span>
                                        </TableCell>

                                        {/* Aprovação */}
                                        <TableCell className="text-center">
                                            <span className={cn(
                                                "tabular-nums",
                                                client.taxaAprovacao >= 85 ? 'text-emerald-500 font-semibold'
                                                    : client.taxaAprovacao >= 75 ? 'text-lime-400'
                                                        : client.taxaAprovacao >= 70 ? 'text-amber-400'
                                                            : client.taxaAprovacao > 0 ? 'text-red-500'
                                                                : 'text-muted-foreground'
                                            )}>
                                                {client.taxaAprovacao > 0 ? `${client.taxaAprovacao.toFixed(0)}%` : '-'}
                                            </span>
                                        </TableCell>

                                        {/* Investimento — editable */}
                                        <TableCell
                                            className="text-right font-medium cursor-pointer group/cell"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingCell({ id: client.id, field: 'spend', value: client.spend.toString() });
                                            }}
                                        >
                                            {editingCell?.id === client.id && editingCell?.field === 'spend' ? (
                                                <Input
                                                    className="w-24 h-7 p-1 text-right font-bold text-xs"
                                                    value={editingCell.value}
                                                    onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                                    onBlur={() => {
                                                        const val = parseFloat(editingCell.value);
                                                        if (!isNaN(val)) updateClientMetric(client.id, 'spend', val);
                                                        setEditingCell(null);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = parseFloat(editingCell.value);
                                                            if (!isNaN(val)) updateClientMetric(client.id, 'spend', val);
                                                            setEditingCell(null);
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className={cn(
                                                    "tabular-nums group-hover/cell:text-primary transition-colors",
                                                    client.spend > 0 ? "text-foreground" : "text-muted-foreground"
                                                )}>
                                                    R$ {client.spend.toLocaleString('pt-BR', { notation: 'compact' })}
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell className={cn(
                                            "text-right tabular-nums",
                                            client.faturamento > 0 ? "font-bold text-foreground" : "text-muted-foreground"
                                        )}>
                                            R$ {client.faturamento.toLocaleString('pt-BR', { notation: 'compact' })}
                                        </TableCell>

                                        <TableCell className={cn(
                                            "text-right tabular-nums font-bold",
                                            client.lucro > 0 ? 'text-emerald-500'
                                                : client.lucro < 0 ? 'text-red-500'
                                                    : 'text-muted-foreground font-normal'
                                        )}>
                                            R$ {client.lucro.toLocaleString('pt-BR', { notation: 'compact' })}
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 font-bold text-[10px] uppercase tracking-wide"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedClient(client);
                                                }}
                                            >
                                                Ver Análise
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Detail Modal */}
            {selectedClient && (
                <SmartClientDetail
                    client={{
                        ...selectedClient.metrics,
                        name: selectedClient.name,
                        score: selectedClient.healthScore,
                        classification: selectedClient.classification
                    }}
                    onClose={() => setSelectedClient(null)}
                />
            )}
        </div>
    );
}
