import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    TrendingUp,
    Check,
    AlertTriangle,
    Wallet,
    BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AcademySummary } from "@/hooks/useAcademyFinancials";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface AcademyOverviewCardsProps {
    summary: AcademySummary;
    isLoading: boolean;
}

export function AcademyOverviewCards({ summary, isLoading }: AcademyOverviewCardsProps) {
    return (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {/* Faturado */}
            <Card className="p-3 bg-background border border-border/50 hover:border-blue-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Faturado</span>
                    <TrendingUp className="h-3 w-3 text-blue-500" />
                </div>
                <div className="mt-1">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : (
                        <span className="text-base font-bold">{formatCurrency(summary.totalFaturado)}</span>
                    )}
                </div>
            </Card>

            {/* Recebido */}
            <Card className="p-3 bg-background border border-border/50 hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Recebido</span>
                    <Check className="h-3 w-3 text-emerald-500" />
                </div>
                <div className="mt-1">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : (
                        <span className="text-base font-bold text-emerald-500">{formatCurrency(summary.totalRecebido)}</span>
                    )}
                </div>
            </Card>

            {/* Pendente */}
            <Card className="p-3 bg-background border border-border/50 hover:border-amber-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Pendente</span>
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                </div>
                <div className="mt-1">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : (
                        <span className="text-base font-bold text-amber-500">{formatCurrency(summary.totalPendente)}</span>
                    )}
                </div>
            </Card>

            {/* Despesas */}
            <Card className="p-3 bg-background border border-border/50 hover:border-destructive/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Despesas</span>
                    <Wallet className="h-3 w-3 text-destructive" />
                </div>
                <div className="mt-1">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : (
                        <span className="text-base font-bold text-destructive">{formatCurrency(summary.totalDespesas)}</span>
                    )}
                </div>
            </Card>

            {/* Lucro */}
            <Card className="p-3 bg-background border border-border/50 hover:border-purple-500/50 transition-colors">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Lucro</span>
                    <BarChart3 className="h-3 w-3 text-purple-500" />
                </div>
                <div className="mt-1">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : (
                        <div className="flex items-baseline gap-1">
                            <span className={cn(
                                "text-base font-bold",
                                summary.lucro >= 0 ? "text-purple-500" : "text-destructive"
                            )}>
                                {formatCurrency(summary.lucro)}
                            </span>
                            {summary.totalRecebido > 0 && (
                                <span className="text-[9px] text-muted-foreground">
                                    ({((summary.lucro / summary.totalRecebido) * 100).toFixed(0)}%)
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
