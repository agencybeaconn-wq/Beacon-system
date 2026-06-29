import { useEffect, useState } from "react";
import { useUserAuthority } from "@/hooks/useUserAuthority";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { formatCurrency, formatNumber, getNextTier } from "@/lib/authorityUtils";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Star } from "lucide-react";

export function GamificationProgressBar() {
    const { t } = useTranslation();
    const { authority, isLoading } = useUserAuthority();
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (authority) {
            // Calculate precise percentage
            const currentTier = authority.tier;
            const nextTier = getNextTier(authority.tier);

            if (!nextTier) {
                setProgress(100);
            } else {
                const range = nextTier.minSpend - currentTier.minSpend;
                const currentProgress = authority.lifetime_spend - currentTier.minSpend;
                const percentage = Math.min(Math.max((currentProgress / range) * 100, 0), 100);
                setProgress(percentage);
            }
        }
    }, [authority]);

    if (isLoading || !authority) return null;

    const nextTier = getNextTier(authority.tier);
    const remaining = nextTier ? nextTier.minSpend - authority.lifetime_spend : 0;
    const isMaxRank = !nextTier;

    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <div className="hidden md:flex items-center gap-3 w-[240px] px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center text-xs font-medium">
                            <span className={cn("flex items-center gap-1.5", authority.tier.color)}>
                                {isMaxRank ? <Trophy className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                {authority.tier.name}
                            </span>
                            <span className="text-muted-foreground">
                                {isMaxRank ? t('profile.xp.max_rank') : formatNumber(nextTier.minSpend)}
                            </span>
                        </div>
                        <Progress
                            value={progress}
                            className="h-1.5 bg-muted"
                            indicatorClassName={cn(
                                "bg-gradient-to-r transition-all duration-1000",
                                isMaxRank ? "from-yellow-400 to-yellow-600" : "from-primary/80 to-primary"
                            )}
                        />
                    </div>
                </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80" align="end">
                <div className="space-y-4">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                {authority.tier.name}
                                {isMaxRank && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                {isMaxRank
                                    ? t('profile.xp.max_level_reached')
                                    : t('profile.xp.next_level_remaining', { amount: formatCurrency(remaining) })}
                            </p>
                        </div>
                        <div className={cn("p-2 rounded-full bg-muted/20", authority.tier.color)}>
                            {/* Icon placeholder or dynamic icon component could go here */}
                            <Trophy className="h-5 w-5" />
                        </div>
                    </div>

                    {!isMaxRank && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                <span>{t('profile.xp.current_progress')}</span>
                                <span>{progress.toFixed(1)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            <div className="flex justify-between text-xs pt-1">
                                <span>{formatNumber(authority.lifetime_spend)}</span>
                                <span>{formatNumber(nextTier?.minSpend || 0)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
