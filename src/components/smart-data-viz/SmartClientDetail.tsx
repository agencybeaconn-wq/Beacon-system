import { useState } from 'react';
import { X, TrendingUp, AlertTriangle, CheckCircle2, ShoppingCart, CreditCard, MousePointer, Activity, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { identifyBottlenecks, generateRecommendation, ClientMetrics, HealthScoreResult, ClientClassification } from '@/utils/smartDataLogic';
import { supabase } from '@/integrations/supabase/client';

interface SmartClientDetailProps {
    client: ClientMetrics & {
        name: string;
        score: HealthScoreResult;
        classification: ClientClassification;
    };
    onClose: () => void;
}

export function SmartClientDetail({ client, onClose }: SmartClientDetailProps) {
    const recommendation = generateRecommendation(client);
    const bottlenecks = identifyBottlenecks(client);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isLoadingAi, setIsLoadingAi] = useState(false);

    const generateAiAnalysis = async () => {
        setIsLoadingAi(true);
        try {
            const context = {
                cliente: client.name,
                status: client.classification.status,
                score: `${client.score.total}/100`,
                score_detalhes: {
                    trafego: `${client.score.detalhes.trafego}/20`,
                    conversao: `${client.score.detalhes.conversao}/35`,
                    aprovacao: `${client.score.detalhes.aprovacao}/25`,
                    lucratividade: `${client.score.detalhes.lucratividade}/20`
                },
                metricas: {
                    spend: `R$ ${client.spend.toFixed(2)}`,
                    faturamento: `R$ ${client.faturamento.toFixed(2)}`,
                    lucro: `R$ ${client.lucro.toFixed(2)}`,
                    roas: client.roas.toFixed(2),
                    cpc: `R$ ${client.cpc.toFixed(2)}`,
                    ctr: `${client.ctr.toFixed(2)}%`,
                    cpa: `R$ ${client.cpa.toFixed(2)}`,
                    vendas: client.orders,
                    ticket_medio: client.orders > 0 ? `R$ ${(client.faturamento / client.orders).toFixed(2)}` : 'N/A',
                    taxa_conversao_site: `${client.taxaConversaoSite.toFixed(2)}%`,
                    taxa_aprovacao: `${client.taxaAprovacao.toFixed(0)}%`,
                    margem_contribuicao: `${client.margemContribuicao.toFixed(1)}%`,
                },
                funil: {
                    cliques: client.clicks,
                    add_to_cart_rate: `${client.taxaAddToCart.toFixed(1)}%`,
                    checkout_rate: `${client.taxaCheckout.toFixed(1)}%`,
                    finalizacao_rate: `${client.taxaFinalizacao.toFixed(1)}%`,
                    abandono_carrinho: `${client.abandonoCarrinho.toFixed(1)}%`,
                },
                gargalos: bottlenecks.map(b => `${b.area}: ${b.problema} (${b.impacto})`),
            };

            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    action: 'analyzeWithContext',
                    prompt: `Analise a performance deste cliente de e-commerce/agência de marketing digital.
Faça uma análise PROFUNDA e PRÁTICA das métricas. Identifique:
1. PONTOS FORTES — o que está funcionando bem
2. PROBLEMAS CRÍTICOS — o que precisa de atenção imediata
3. OPORTUNIDADES — onde há espaço para crescimento
4. PLANO DE AÇÃO — 3-5 ações concretas ordenadas por prioridade

Seja direto, objetivo e use dados numéricos para justificar cada ponto.
Responda em português brasileiro, formatado com emojis e subtítulos.`,
                    context,
                    temperature: 0.5,
                    maxTokens: 4000
                })
            });

            const data = await res.json();

            if (!res.ok) {
                // Try to extract the actual error message from the response
                const errorMsg = data?.error || data?.message || `Erro do servidor: ${res.status}`;
                throw new Error(errorMsg);
            }
            if (data?.error) {
                throw new Error(data.error);
            }
            setAiAnalysis(data?.data?.text || 'Não foi possível gerar a análise.');
        } catch (err: any) {
            console.error('[SmartClientDetail] AI analysis error:', err);
            setAiAnalysis(`❌ Erro ao gerar análise: ${err.message}`);
        } finally {
            setIsLoadingAi(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-[200ms]">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-[200ms]">

                {/* HEADER */}
                <div className="p-6 border-b flex justify-between items-start bg-slate-50 dark:bg-slate-950">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{client.name}</h2>
                            <Badge
                                className="text-lg px-3 py-1 font-bold border-0"
                                style={{ backgroundColor: client.classification.cor, color: '#fff' }}
                            >
                                Score: {client.score.total}/100
                            </Badge>
                        </div>
                        <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
                            STATUS ATUAL:
                            <span style={{ color: client.classification.cor }} className="font-bold flex items-center gap-1">
                                {client.classification.emoji} {client.classification.status}
                            </span>
                            <span className="text-slate-300 mx-2">|</span>
                            AÇÃO: {client.classification.acao}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                        <X className="h-6 w-6" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* KEY METRICS GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">ROAS</div>
                            <div className={`text-3xl font-black ${client.roas >= 3 ? 'text-emerald-500' : client.roas < 2 ? 'text-red-500' : 'text-amber-500'}`}>
                                {client.roas.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Meta: &gt; 3.0</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Conv. Site</div>
                            <div className={`text-3xl font-black ${client.taxaConversaoSite >= 2.0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {client.taxaConversaoSite.toFixed(2)}%
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Meta: &gt; 2.0%</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Aprovação</div>
                            <div className={`text-3xl font-black ${client.taxaAprovacao >= 70 ? 'text-emerald-500' : client.taxaAprovacao < 40 ? 'text-red-500' : 'text-amber-500'}`}>
                                {client.taxaAprovacao.toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Meta: &gt; 70%</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ticket Médio</div>
                            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
                                R$ {(client.faturamento / (client.orders || 1)).toFixed(0)}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Meta: &gt; R$ 200</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* SCORE BREAKDOWN */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                                <Activity className="h-5 w-5 text-indigo-500" />
                                Pontuação Detalhada
                            </h3>
                            <div className="space-y-4 bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-sm">
                                <div>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span>Tráfego (CPC, CTR)</span>
                                        <span className="text-slate-500">{client.score.detalhes.trafego}/20</span>
                                    </div>
                                    <Progress value={(client.score.detalhes.trafego * 5)} className="h-2" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span>Conversão (Site, Funil)</span>
                                        <span className="text-slate-500">{client.score.detalhes.conversao}/35</span>
                                    </div>
                                    <Progress value={(client.score.detalhes.conversao / 35) * 100} className="h-2" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span>Aprovação (Cards, Gateway)</span>
                                        <span className="text-slate-500">{client.score.detalhes.aprovacao}/25</span>
                                    </div>
                                    <Progress value={(client.score.detalhes.aprovacao * 4)} className="h-2" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span>Lucratividade (ROAS, Margem)</span>
                                        <span className="text-slate-500">{client.score.detalhes.lucratividade}/20</span>
                                    </div>
                                    <Progress value={(client.score.detalhes.lucratividade * 5)} className="h-2" />
                                </div>
                            </div>
                        </div>

                        {/* FUNNEL VISUALIZATION */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-blue-500" />
                                Funil de Conversão
                            </h3>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5 border shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 p-2 rounded-full"><MousePointer className="h-4 w-4 text-blue-600" /></div>
                                        <span className="font-bold text-sm">Cliques</span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-500">{client.clicks.toLocaleString()}</span>
                                </div>
                                <div className="pl-4 ml-3 border-l-2 border-slate-200 h-6"></div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-100 p-2 rounded-full"><ShoppingCart className="h-4 w-4 text-indigo-600" /></div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">Add to Cart</span>
                                            <span className="text-[10px] text-slate-400">{client.taxaAddToCart.toFixed(1)}% dos cliques</span>
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-slate-500">{Math.round(client.clicks * (client.taxaAddToCart / 100)).toLocaleString()}</span>
                                </div>
                                <div className="pl-4 ml-3 border-l-2 border-slate-200 h-6"></div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-100 p-2 rounded-full"><CreditCard className="h-4 w-4 text-emerald-600" /></div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">Checkout</span>
                                            <span className="text-[10px] text-slate-400">{client.taxaCheckout.toFixed(1)}% do carrinho</span>
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-slate-500">{Math.round((client.clicks * (client.taxaAddToCart / 100)) * (client.taxaCheckout / 100)).toLocaleString()}</span>
                                </div>
                                <div className="pl-4 ml-3 border-l-2 border-slate-200 h-6"></div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 p-2 rounded-full"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">Vendas Aprovadas</span>
                                            <span className="text-[10px] text-slate-400">{client.taxaAprovacao.toFixed(1)}% de aprovação</span>
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-green-600">{Math.round(client.orders * (client.taxaAprovacao / 100)).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* AI ANALYSIS SECTION */}
                    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-200 dark:border-violet-800/50 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-slate-900 dark:text-violet-100 uppercase tracking-tight flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-violet-500" />
                                Análise Inteligente (IA)
                            </h3>
                            <Button
                                size="sm"
                                onClick={generateAiAnalysis}
                                disabled={isLoadingAi}
                                className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs"
                            >
                                {isLoadingAi ? (
                                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analisando...</>
                                ) : (
                                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> {aiAnalysis ? 'Analisar Novamente' : 'Gerar Análise IA'}</>
                                )}
                            </Button>
                        </div>
                        {aiAnalysis ? (
                            <div className="bg-white/50 dark:bg-black/20 rounded-lg p-5 max-h-[50vh] overflow-y-auto shadow-inner border border-violet-100 dark:border-violet-900/30">
                                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                    {aiAnalysis}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Clique em "Gerar Análise IA" para receber uma análise personalizada com insights e recomendações baseadas nos dados deste cliente.
                            </p>
                        )}
                    </div>

                    {/* RECOMMENDATION ENGINE */}
                    <div className="bg-[#FDFDEA] dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-xl p-6">
                        <h3 className="text-xl font-black text-slate-900 dark:text-yellow-100 uppercase tracking-tight mb-4 flex items-center gap-2">
                            ⚡ PLANO DE AÇÃO RECOMENDADO
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 uppercase text-[10px]">
                                Confiança: {recommendation.confianca}
                            </Badge>
                        </h3>

                        <div className="mb-6">
                            <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
                                {recommendation.decisao}
                            </h4>
                            <p className="text-lg font-medium text-slate-600 dark:text-slate-300">
                                {recommendation.acao}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg">
                                <h5 className="font-bold text-sm uppercase text-slate-500 mb-3">Checklist de Execução</h5>
                                <ul className="space-y-2">
                                    {recommendation.detalhes.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm font-medium">
                                            <span className="mt-1">{item.startsWith('✅') ? '✅' : (item.startsWith('🔴') ? '🔴' : '🔹')}</span>
                                            <span>{item.replace(/^[✅🔴🟡⚠️❌\s]+/, '')}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {bottlenecks.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-100 dark:border-red-900/50">
                                    <h5 className="font-bold text-sm uppercase text-red-600 mb-3 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        Gargalos Críticos
                                    </h5>
                                    <div className="space-y-4">
                                        {bottlenecks.slice(0, 3).map((b, idx) => (
                                            <div key={idx} className="border-b border-red-100 dark:border-red-900/50 last:border-0 pb-3 last:pb-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase">{b.area}</span>
                                                    <span className="text-[10px] font-bold text-red-400">{b.impacto}</span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{b.problema}</p>
                                                <p className="text-xs text-slate-500 mt-1">{b.acoes[0]}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
