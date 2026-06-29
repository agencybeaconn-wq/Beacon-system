import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Timer, Users, Briefcase, Layers, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimeAnalytics, type TimeAnalyticsRange, type TimeBucket } from "@/hooks/useTimeAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0min';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
}

interface BucketBarProps {
    bucket: TimeBucket;
    max: number;
    accentClass: string;
}

function BucketBar({ bucket, max, accentClass }: BucketBarProps) {
    const pct = max > 0 ? (bucket.seconds / max) * 100 : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-foreground truncate">{bucket.label}</span>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="text-sm font-black text-foreground">{formatDuration(bucket.seconds)}</span>
                    <span className="text-[11px] text-muted-foreground">
                        {bucket.sessions} {bucket.sessions === 1 ? 'sessão' : 'sessões'}
                    </span>
                </div>
            </div>
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all", accentClass)}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

interface TimeAnalyticsSectionProps {
    dateRange: TimeAnalyticsRange;
}

export function TimeAnalyticsSection({ dateRange }: TimeAnalyticsSectionProps) {
    const analytics = useTimeAnalytics(dateRange);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiText, setAiText] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const maxOf = (arr: TimeBucket[]) => (arr.length > 0 ? arr[0].seconds : 1);

    const runAiAnalysis = async () => {
        if (aiLoading) return;
        setAiLoading(true);
        setAiError(null);
        setAiText(null);
        try {
            const context = {
                periodo: { inicio: dateRange.startDate, fim: dateRange.endDate },
                totais: {
                    tempo_total_segundos: analytics.totalSeconds,
                    tempo_total_formatado: formatDuration(analytics.totalSeconds),
                    total_sessoes: analytics.totalSessions,
                    duracao_media_sessao_segundos: analytics.avgSessionSeconds,
                    duracao_media_sessao_formatada: formatDuration(analytics.avgSessionSeconds),
                    demandas_distintas: analytics.distinctTasks,
                },
                por_setor: analytics.byArea.map(b => ({ setor: b.label, tempo_segundos: b.seconds, tempo_formatado: formatDuration(b.seconds), sessoes: b.sessions })),
                por_cliente: analytics.byClient.map(b => ({ cliente: b.label, tempo_segundos: b.seconds, tempo_formatado: formatDuration(b.seconds), sessoes: b.sessions })),
                por_tipo_projeto: analytics.byType.map(b => ({ tipo: b.label, tempo_segundos: b.seconds, tempo_formatado: formatDuration(b.seconds), sessoes: b.sessions })),
                por_membro: analytics.byMember.map(b => ({ membro: b.label, tempo_segundos: b.seconds, tempo_formatado: formatDuration(b.seconds), sessoes: b.sessions })),
            };

            const prompt = `
Você é o analista de produtividade da agência Lever.
Analise os dados de tempo gasto em demandas no período especificado e produza um relatório curto, objetivo e acionável em português.

Estruture sua resposta em 4 seções curtas (máximo 2 frases por seção):
1. **Resumo** — o que mais chama atenção.
2. **Onde está indo o tempo** — qual setor/cliente/tipo consome mais, e se parece desproporcional.
3. **Alertas** — gargalos, distribuição desigual entre membros, sessões muito longas/curtas.
4. **Recomendações práticas** — 2-3 ações concretas para otimizar.

Use números concretos do contexto. Não invente dados. Se houver poucos dados, diga isso honestamente.
            `.trim();

            const { data, error } = await supabase.functions.invoke('gemini-ai', {
                body: {
                    action: 'analyzeWithContext',
                    prompt,
                    context,
                    temperature: 0.5,
                    maxTokens: 1200,
                },
            });

            if (error) {
                let realMsg = error.message || 'Erro desconhecido';
                try {
                    const ctx = (error as any).context as Response | undefined;
                    if (ctx && typeof ctx.json === 'function') {
                        const body = await ctx.json();
                        realMsg = body?.error || body?.message || realMsg;
                    }
                } catch { /* ignore */ }
                throw new Error(realMsg);
            }
            const text = (data as any)?.text || (data as any)?.data?.text;
            if (!text) throw new Error('Resposta vazia da IA');
            setAiText(text);
        } catch (e: any) {
            console.error('[TimeAnalytics AI] error:', e);
            setAiError(e?.message || 'Erro ao gerar análise');
            toast.error('Falha na análise de IA — verifique se o serviço está configurado');
        } finally {
            setAiLoading(false);
        }
    };

    if (analytics.isLoading) {
        return (
            <div>
                <SectionHeader />
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    if (analytics.error) {
        return (
            <div>
                <SectionHeader />
                <Card className="p-6 border-red-500/30 bg-red-500/5">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm font-semibold">Erro ao carregar: {analytics.error}</span>
                    </div>
                </Card>
            </div>
        );
    }

    if (analytics.totalSessions === 0) {
        return (
            <div>
                <SectionHeader />
                <Card className="p-8 text-center bg-muted/5 border-border/30">
                    <Timer className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                        Nenhum tempo registrado no período. Use o cronômetro dentro das demandas para começar a coletar dados.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div>
            <SectionHeader />

            {/* Stats topo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Card className="p-4 bg-muted/5 border-border/20">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Tempo Total</div>
                    <div className="text-2xl font-black tracking-tight tabular-nums">{formatDuration(analytics.totalSeconds)}</div>
                </Card>
                <Card className="p-4 bg-muted/5 border-border/20">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Sessões</div>
                    <div className="text-2xl font-black tracking-tight tabular-nums">{analytics.totalSessions}</div>
                </Card>
                <Card className="p-4 bg-muted/5 border-border/20">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Média/Sessão</div>
                    <div className="text-2xl font-black tracking-tight tabular-nums">{formatDuration(analytics.avgSessionSeconds)}</div>
                </Card>
                <Card className="p-4 bg-muted/5 border-border/20">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Demandas Cronometradas</div>
                    <div className="text-2xl font-black tracking-tight tabular-nums">{analytics.distinctTasks}</div>
                </Card>
            </div>

            <Tabs defaultValue="area" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
                    <TabsTrigger value="area" className="gap-1.5"><Layers className="w-3.5 h-3.5" /> Setor</TabsTrigger>
                    <TabsTrigger value="client" className="gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Cliente</TabsTrigger>
                    <TabsTrigger value="type" className="gap-1.5"><Timer className="w-3.5 h-3.5" /> Tipo</TabsTrigger>
                    <TabsTrigger value="member" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Membro</TabsTrigger>
                    <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Análise IA</TabsTrigger>
                </TabsList>

                <TabsContent value="area" className="mt-4">
                    <BucketList buckets={analytics.byArea} accent="bg-blue-500" maxSeconds={maxOf(analytics.byArea)} emptyLabel="Sem dados por setor" />
                </TabsContent>
                <TabsContent value="client" className="mt-4">
                    <BucketList buckets={analytics.byClient} accent="bg-emerald-500" maxSeconds={maxOf(analytics.byClient)} emptyLabel="Sem dados por cliente" />
                </TabsContent>
                <TabsContent value="type" className="mt-4">
                    <BucketList buckets={analytics.byType} accent="bg-orange-500" maxSeconds={maxOf(analytics.byType)} emptyLabel="Sem dados por tipo" />
                </TabsContent>
                <TabsContent value="member" className="mt-4">
                    <BucketList buckets={analytics.byMember} accent="bg-purple-500" maxSeconds={maxOf(analytics.byMember)} emptyLabel="Sem dados por membro" />
                </TabsContent>

                <TabsContent value="ai" className="mt-4">
                    <Card className="p-5 bg-zinc-900/40 border-primary/20 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <h3 className="text-sm font-bold text-foreground">Análise de Produtividade por IA</h3>
                            </div>
                            <Button
                                onClick={runAiAnalysis}
                                disabled={aiLoading || analytics.totalSessions === 0}
                                size="sm"
                                className="gap-2 font-semibold"
                            >
                                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {aiText ? 'Gerar novamente' : 'Analisar'}
                            </Button>
                        </div>

                        {!aiText && !aiLoading && !aiError && (
                            <p className="text-xs text-muted-foreground">
                                Gera um parecer com base nos dados do período: onde está indo o tempo, gargalos e recomendações práticas.
                            </p>
                        )}

                        {aiError && (
                            <div className="text-xs text-red-400 flex items-start gap-2">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                {aiError}
                            </div>
                        )}

                        {aiLoading && (
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Analisando dados...
                            </div>
                        )}

                        {aiText && (
                            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                                {aiText}
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function SectionHeader() {
    return (
        <div className="flex items-center gap-2 mb-4">
            <Timer className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold capitalize text-foreground">Tempo Gasto em Demandas</h2>
        </div>
    );
}

interface BucketListProps {
    buckets: TimeBucket[];
    maxSeconds: number;
    accent: string;
    emptyLabel: string;
}

function BucketList({ buckets, maxSeconds, accent, emptyLabel }: BucketListProps) {
    if (buckets.length === 0) {
        return (
            <Card className="p-6 text-center bg-muted/5 border-border/20">
                <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            </Card>
        );
    }
    return (
        <Card className="p-5 bg-muted/5 border-border/20 space-y-4">
            {buckets.map(b => (
                <BucketBar key={b.key} bucket={b} max={maxSeconds} accentClass={accent} />
            ))}
        </Card>
    );
}
