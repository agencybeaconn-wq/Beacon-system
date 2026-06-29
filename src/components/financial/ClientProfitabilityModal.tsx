import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Target,
    Zap,
    ArrowUpRight,
    PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface ClientProfitabilityModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    client: any;
    metrics: {
        revenue: number;
        spend: number;
        operatingProfit: number;
        fee: number;
        roas: number;
    };
}

export function ClientProfitabilityModal({
    isOpen,
    onOpenChange,
    client,
    metrics
}: ClientProfitabilityModalProps) {
    if (!isOpen || !metrics) return null;

    const margin = metrics.operatingProfit > 0
        ? (metrics.operatingProfit / metrics.revenue) * 100
        : 0;

    const agencyProfitability = metrics.operatingProfit > 0
        ? (metrics.fee / metrics.operatingProfit) * 100
        : 0;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-background border-border/50">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">{client?.name}</DialogTitle>
                            <DialogDescription>Detalhamento de Rentabilidade e Performance</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Primary Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4 space-y-2 bg-muted/30 border-none">
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-xs font-medium uppercase tracking-wider">Lucro Operacional</span>
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div className="text-2xl font-bold text-emerald-500">
                                {formatCurrency(metrics.operatingProfit)}
                            </div>
                            <div className="flex items-center gap-2">
                                <Progress value={margin} className="h-1.5" />
                                <span className="text-[10px] font-medium">{margin.toFixed(1)}% Margem</span>
                            </div>
                        </Card>

                        <Card className="p-4 space-y-2 bg-muted/30 border-none">
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-xs font-medium uppercase tracking-wider">Fee da Agência</span>
                                <DollarSign className="h-4 w-4 text-primary" />
                            </div>
                            <div className="text-2xl font-bold text-primary">
                                {formatCurrency(metrics.fee)}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-medium text-muted-foreground">Representa {agencyProfitability.toFixed(1)}% do Lucro Oper.</span>
                            </div>
                        </Card>
                    </div>

                    {/* Performance Details */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <PieChart className="h-4 w-4" />
                            Estrutura de Custos & Retorno
                        </h4>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <TrendingDown className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm">Investimento em Ads</span>
                                </div>
                                <span className="font-semibold">{formatCurrency(metrics.spend)}</span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded bg-purple-500/10 flex items-center justify-center text-purple-500">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm">Faturamento Bruto</span>
                                </div>
                                <span className="font-semibold">{formatCurrency(metrics.revenue)}</span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center text-primary">
                                        <Target className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium">ROAS da Operação</span>
                                </div>
                                <Badge className="bg-primary text-primary-foreground">{metrics.roas.toFixed(2)}x</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs leading-relaxed">
                        <strong>Insight:</strong> Esta operação possui uma margem de {margin.toFixed(1)}%.
                        {metrics.roas > 4 ? " O ROAS está excelente, sugerindo espaço para escala no investimento." : " O ROAS está dentro do limite aceitável, mas requer acompanhamento próximo."}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
