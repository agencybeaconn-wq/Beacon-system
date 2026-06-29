import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { type UserAuthorityWithTier } from "@/hooks/useUserAuthority";
import { formatCurrency } from "@/lib/authorityUtils";
import { cn } from "@/lib/utils";
import { TrendingUp, Flame, Target } from "lucide-react";

interface AuthorityHoverCardProps {
  authority: UserAuthorityWithTier;
}

export function AuthorityHoverCard({ authority }: AuthorityHoverCardProps) {
  const { tier, nextTier, progressToNext, lifetime_spend, highest_roas, current_streak } = authority;

  const progressPercent = Math.round(progressToNext * 100);
  const remainingSpend = nextTier
    ? nextTier.minSpend - lifetime_spend
    : 0;

  return (
    <div className="p-6 bg-background/95 backdrop-blur-sm">
      {/* Header: Tier Icon + Name */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{tier.icon}</span>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Nível Atual</p>
          <h3 className={cn("text-lg font-bold", tier.color)}>{tier.displayName}</h3>
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Progress Bar to Next Tier */}
      {nextTier ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Progresso</span>
            <span className="text-xs font-bold text-primary">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2 mb-2" />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{formatCurrency(lifetime_spend)}</span> /{" "}
              <span className="font-medium">{formatCurrency(nextTier.minSpend)}</span>
            </p>
            <p className="text-xs font-semibold text-primary">
              Faltam {formatCurrency(remainingSpend)} para virar {nextTier.displayName}
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
            🏆 Nível Máximo Atingido!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Você alcançou o mais alto nível de autoridade
          </p>
        </div>
      )}

      <Separator className="mb-4" />

      {/* Stats Grid */}
      <div className="space-y-3">
        {/* Lifetime Spend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Total Gerenciado</span>
          </div>
          <span className="text-sm font-bold text-primary">
            {formatCurrency(lifetime_spend)}
          </span>
        </div>

        {/* Highest ROAS */}
        {highest_roas > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recorde de ROAS</span>
            </div>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              {highest_roas.toFixed(1)}x
            </span>
          </div>
        )}

        {/* Current Streak */}
        {current_streak > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Sequência Ativa</span>
            </div>
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
              {current_streak} {current_streak === 1 ? "dia" : "dias"}
            </span>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <Separator className="my-4" />
      <p className="text-xs text-center text-muted-foreground">
        Baseado no gasto total gerenciado em todas as contas
      </p>
    </div>
  );
}

