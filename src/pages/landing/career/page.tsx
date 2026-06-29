import { useUserAuthority } from "@/hooks/useUserAuthority";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, AUTHORITY_TIERS } from "@/lib/authorityUtils";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Flame, Target, Award, Lock, Star, Zap, Crown, Medal, CheckCircle2, Shield } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_campaign", name: "Primeira Campanha", description: "Criou sua primeira campanha", icon: "🎯", unlocked: true, unlockedAt: 0 },
  { id: "100k_club", name: "Clube dos R$ 100k", description: "Gerenciou mais de R$ 100.000", icon: "🏆", unlocked: false, unlockedAt: 100000 },
  { id: "1m_club", name: "Milionário", description: "Gerenciou mais de R$ 1.000.000", icon: "💎", unlocked: false, unlockedAt: 1000000 },
  { id: "roas_king", name: "Rei do ROAS", description: "Atingiu um ROAS acima de 10x", icon: "👑", unlocked: false },
  { id: "streak_master", name: "Mestre da Sequência", description: "Manteve uma sequência de 30 dias", icon: "🔥", unlocked: false },
];

const DAILY_QUESTS = [
  { id: 1, title: "Analista Diário", description: "Analise 3 campanhas com IA", xp: 150, completed: false },
  { id: 2, title: "Otimizador", description: "Faça 5 alterações em conjuntos", xp: 100, completed: true },
  { id: 3, title: "Sniper de ROAS", description: "Tenha uma campanha com ROAS > 4", xp: 300, completed: false },
];



export default function Career() {
  const { authority, isLoading, error } = useUserAuthority(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Carregando Perfil do Jogador...</p>
        </div>
      </div>
    );
  }

  if (error || !authority) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Erro de Conexão</CardTitle>
            <CardDescription>Não foi possível carregar seus dados de carreira.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { tier, nextTier, progressToNext, lifetime_spend, highest_roas, current_streak } = authority;
  const progressPercent = Math.round(progressToNext * 100);
  const remainingSpend = nextTier ? nextTier.minSpend - lifetime_spend : 0;

  const unlockedAchievements = ACHIEVEMENTS.map((achievement) => {
    if (achievement.unlockedAt !== undefined) return { ...achievement, unlocked: lifetime_spend >= achievement.unlockedAt };
    if (achievement.id === "roas_king") return { ...achievement, unlocked: highest_roas >= 10 };
    if (achievement.id === "streak_master") return { ...achievement, unlocked: current_streak >= 30 };
    return achievement;
  });

  return (
    <div className={cn("space-y-8 p-2 md:p-4 max-w-7xl mx-auto transition-opacity duration-500", mounted ? "opacity-100" : "opacity-0")}>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground animate-in slide-in-from-left duration-500">
            MINHA CARREIRA
          </h1>
          <p className="text-muted-foreground font-medium mt-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Painel do Gestor de Elite
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card border rounded-lg px-4 py-2 shadow-none animate-in slide-in-from-right duration-500">
          <span className="text-sm font-bold text-muted-foreground">Nível Atual:</span>
          <Badge variant="secondary" className={cn("text-sm font-bold px-3", tier.color)}>
            {tier.name}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Player Profile & Stats */}
        <div className="lg:col-span-2 space-y-8">

          {/* Hero Player Card */}
          <Card className="overflow-hidden border-none shadow-none bg-slate-900 text-white relative group">
            <div className="absolute inset-0 bg-primary/5"></div>
            <div className="absolute top-0 right-0 p-32 bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>

            <CardContent className="p-8 relative z-10">
              <div className="flex flex-col md:flex-row items-center gap-8">

                {/* Avatar / Tier Icon */}
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary/30 shadow-none backdrop-blur-sm group-hover:scale-105 transition-transform duration-500">
                    <div className="text-7xl drop-shadow-2xl animate-bounce-slow">{tier.icon}</div>
                  </div>
                  <div className="absolute -bottom-3 -right-3 bg-yellow-500 text-black font-black text-xs px-3 py-1 rounded-lg border-2 border-white shadow-none rotate-3">
                    LVL {AUTHORITY_TIERS.findIndex((t) => t.id === tier.id) + 1}
                  </div>
                </div>

                {/* Info & Progress */}
                <div className="flex-1 w-full text-center md:text-left">
                  <h2 className="text-3xl font-black tracking-tight mb-1">{tier.displayName}</h2>
                  <p className="text-slate-300 font-medium mb-6 flex items-center justify-center md:justify-start gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    {tier.name}
                  </p>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold text-slate-300">
                      <span>XP para o próximo nível</span>
                      <span className="text-primary">{progressPercent}%</span>
                    </div>
                    <div className="h-4 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                      <div
                        className="h-full bg-primary transition-all duration-1000 ease-out relative"
                        style={{ width: `${progressPercent}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Faltam <span className="text-white font-bold">{formatCurrency(remainingSpend)}</span> para evoluir
                    </p>
                  </div>
                </div>
              </div>

              {/* Mini Stats Row */}
              <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Total Investido</p>
                  <p className="text-xl font-black text-white">{formatCurrency(lifetime_spend)}</p>
                </div>
                <div className="text-center border-l border-white/10">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Recorde ROAS</p>
                  <p className="text-xl font-black text-green-400">{highest_roas.toFixed(1)}x</p>
                </div>
                <div className="text-center border-l border-white/10">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Sequência</p>
                  <p className="text-xl font-black text-orange-400 flex items-center justify-center gap-1">
                    {current_streak} <Flame className="h-4 w-4 fill-orange-400" />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trophy Room */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Sala de Troféus
              </h3>
              <Badge variant="outline" className="bg-background">
                {unlockedAchievements.filter(a => a.unlocked).length} / {ACHIEVEMENTS.length}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {unlockedAchievements.map((achievement, index) => (
                <div
                  key={achievement.id}
                  className={cn(
                    "relative group p-4 rounded-lg border transition-all duration-300 flex flex-col items-center text-center gap-3",
                    achievement.unlocked
                      ? "bg-primary/5 border-primary/20 hover:border-primary/50 hover:-translate-y-1"
                      : "bg-muted/20 border-muted grayscale opacity-60 hover:opacity-80"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={cn(
                    "text-4xl transition-transform duration-300 group-hover:scale-110",
                    achievement.unlocked ? "drop-shadow-md" : "opacity-50"
                  )}>
                    {achievement.unlocked ? achievement.icon : "🔒"}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight">{achievement.name}</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                      {achievement.description}
                    </p>
                  </div>
                  {achievement.unlocked && (
                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Star className="h-5 w-5 text-yellow-400 fill-yellow-400 animate-spin-slow" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Quests & Leaderboard */}
        <div className="space-y-8">

          {/* Daily Quests */}
          <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Missões Diárias
              </CardTitle>
              <CardDescription>Complete para ganhar XP extra</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DAILY_QUESTS.map((quest) => (
                <div
                  key={quest.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all bg-card",
                    quest.completed ? "border-green-500/30 bg-green-500/5" : "hover:border-primary/30"
                  )}
                >
                  <div className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    quest.completed ? "bg-green-500 border-green-500" : "border-muted-foreground/30"
                  )}>
                    {quest.completed && <CheckCircle2 className="h-4 w-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-bold truncate", quest.completed && "line-through text-muted-foreground")}>
                      {quest.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{quest.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                    +{quest.xp} XP
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>



        </div>
      </div>
    </div>
  );
}

