import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { PlanUsage } from "@/hooks/usePlanUsage";

interface UsageProgressBarProps {
    usage: PlanUsage;
    isLoading?: boolean;
}

const UsageProgressBar = ({ usage, isLoading }: UsageProgressBarProps) => {
    if (isLoading) {
        return <div className="h-24 w-full bg-muted animate-pulse rounded-xl" />;
    }

    const formattedSpend = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usage.currentSpend);
    const formattedLimit = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(usage.limit);

    return (
        <div className="w-full bg-card border border-border/60 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-0.5">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">USO DO PLANO ({usage.planName.toUpperCase()})</h3>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Gasto acumulado (30d)</p>
                </div>
                <div className="text-right flex flex-col items-end">
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">{formattedSpend}</span>
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">/ {formattedLimit}</span>
                    </div>
                </div>
            </div>

            <div className="relative h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={cn("h-full transition-all duration-500 ease-in-out rounded-full bg-primary")}
                    style={{ width: `${usage.percentage}%` }}
                />
            </div>

            <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-tight text-muted-foreground/70">
                <span>{usage.percentage.toFixed(1)}% utilizado</span>
                {usage.isOverLimit && <span className="text-red-500">Limite excedido!</span>}
            </div>
        </div >
    );
};

export default UsageProgressBar;
