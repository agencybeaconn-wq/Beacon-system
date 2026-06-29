import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
    title: string;
    value: string;
    subValue?: string;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
        label?: string; // e.g. "vs last period"
    };
    className?: string;
}

export function KPICard({ title, value, subValue, icon: Icon, trend, className }: KPICardProps) {
    return (
        <Card className={cn("border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all", className)}>
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <Icon className="h-4 w-4 text-primary" />
                    </div>
                    {trend && (
                        <div className={cn(
                            "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md capitalize tracking-wider",
                            trend.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                        )}>
                            {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            <span>{Math.abs(trend.value)}%</span>
                        </div>
                    )}
                </div>

                <div className="space-y-0.5">
                    <h3 className="text-[11px] font-bold text-muted-foreground capitalize tracking-widest">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight">{value}</span>
                        {subValue && <span className="text-[10px] capitalize font-bold text-muted-foreground/60">{subValue}</span>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
