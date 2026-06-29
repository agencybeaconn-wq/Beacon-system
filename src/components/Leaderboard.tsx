import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, Crown, Rocket, Target, Settings, Zap, Instagram } from 'lucide-react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { formatCurrency } from '@/lib/authorityUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Leaderboard() {
  const { leaderboard, isLoading, error } = useLeaderboard();

  // Bento Grid Matte Style
  const bentoCardClass = "border-white/5 bg-secondary/20 backdrop-blur-xl shadow-sm rounded-3xl";

  if (isLoading) {
    return (
      <Card className={cn("p-8 border-none", bentoCardClass)}>
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary animate-pulse" />
          Global Leaderboard
        </h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-muted/50 rounded-2xl" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 border-destructive/20 bg-destructive/5 rounded-3xl">
        <h2 className="text-xl font-bold mb-4 text-destructive flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Erro ao carregar ranking
        </h2>
        <p className="text-sm text-muted-foreground">Não foi possível sincronizar os dados. Tente novamente.</p>
      </Card>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500 drop-shadow-sm" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-slate-300 drop-shadow-sm" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-700 drop-shadow-sm" />;
    return <span className="text-muted-foreground font-mono font-bold text-lg">#{rank}</span>;
  };

  const getTierIcon = (iconName: string) => {
    switch (iconName) {
      case 'Crown': return <Crown className="h-3.5 w-3.5" />;
      case 'Rocket': return <Rocket className="h-3.5 w-3.5" />;
      case 'Target': return <Target className="h-3.5 w-3.5" />;
      case 'Settings': return <Settings className="h-3.5 w-3.5" />;
      default: return <Settings className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Card className={cn("overflow-hidden border-none", bentoCardClass)}>
      {/* Header */}
      <div className="p-8 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Elite Global
              </h2>
              <p className="text-sm text-muted-foreground">Top 50 Gestores de Tráfego</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse px-3 py-1 rounded-full">
            Ao Vivo
          </Badge>
        </div>
      </div>

      {/* Table Header */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 bg-black/5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/5">
        <div className="col-span-1 text-center">Rank</div>
        <div className="col-span-4 pl-2">Gestor</div>
        <div className="col-span-3">Nível</div>
        <div className="col-span-2 text-right">Investimento</div>
        <div className="col-span-2 text-center">Social</div>
      </div>

      {/* Leaderboard Entries */}
      <div className="divide-y divide-white/5">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            className={cn(
              "grid grid-cols-12 gap-4 px-8 py-5 items-center transition-all duration-200 hover:bg-white/5",
              entry.isCurrentUser
                ? "bg-primary/5 border-l-4 border-primary"
                : "border-l-4 border-transparent",
              "animate-in fade-in slide-in-from-bottom-2"
            )}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            {/* Rank */}
            <div className="col-span-12 md:col-span-1 flex justify-center md:justify-center mb-2 md:mb-0">
              <div className="flex items-center justify-center w-10 h-10">
                {getRankIcon(entry.rank)}
              </div>
            </div>

            {/* Manager Info */}
            <div className="col-span-12 md:col-span-4 flex items-center gap-4 pl-2">
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center overflow-hidden shrink-0 ring-2",
                entry.rank <= 3 ? "ring-primary/50 shadow-md" : "ring-white/10 bg-muted"
              )}>
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt={entry.full_name || 'Avatar'} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-bold text-muted-foreground text-sm">
                    {entry.full_name?.charAt(0) || entry.username?.charAt(0) || '?'}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium truncate flex items-center gap-2 text-base", entry.isCurrentUser && "text-primary")}>
                  {entry.full_name || 'Usuário'}
                  {entry.isCurrentUser && <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full">Você</Badge>}
                </p>
                {entry.username && (
                  <p className="text-sm text-muted-foreground truncate">@{entry.username}</p>
                )}
              </div>
            </div>

            {/* Tier */}
            <div className="col-span-6 md:col-span-3 flex items-center mt-2 md:mt-0">
              <Badge variant="outline" className={cn(
                "text-xs gap-1.5 py-1.5 pl-1.5 pr-3 bg-white/5 backdrop-blur-sm border-white/10 transition-colors rounded-full",
                "group-hover:border-primary/30"
              )}>
                <div className={cn("p-1 rounded-full bg-muted/50", entry.tier.color.replace('text-', 'bg-') + '/10')}>
                  {getTierIcon(entry.tier.icon)}
                </div>
                <span className={cn("font-medium", entry.tier.color)}>{entry.tier.displayName}</span>
              </Badge>
            </div>

            {/* Lifetime Spend */}
            <div className="col-span-6 md:col-span-2 flex items-center justify-end mt-2 md:mt-0">
              <span className="font-mono font-bold text-base tracking-tight text-foreground/90">
                {formatCurrency(entry.lifetime_spend)}
              </span>
            </div>

            {/* Social */}
            <div className="col-span-12 md:col-span-2 flex items-center justify-center mt-2 md:mt-0">
              {entry.instagram_handle ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full hover:bg-pink-500/10 hover:text-pink-500 transition-colors"
                  asChild
                >
                  <a
                    href={`https://instagram.com/${entry.instagram_handle.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`@${entry.instagram_handle}`}
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                </Button>
              ) : (
                <span className="text-muted-foreground/20 text-xl leading-none">-</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {leaderboard.length === 0 && (
        <div className="text-center py-20 text-muted-foreground bg-white/5">
          <div className="bg-white/5 p-5 rounded-full w-fit mx-auto mb-4">
            <Rocket className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="font-medium text-lg">Ainda não há gestores no ranking.</p>
          <p className="text-sm mt-2 opacity-70">Seja o primeiro a subir de nível!</p>
        </div>
      )}
    </Card>
  );
}
