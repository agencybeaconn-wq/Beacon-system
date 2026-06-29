import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ExternalLink, Sparkles, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SECTIONS = [
    { title: '1. Informações Gerais', keys: ['marca_nome', 'url_site', 'instagram', 'tempo_marca', 'tem_site', 'problema_site', 'nicho', 'vende_onde'] },
    { title: '2. Produtos', keys: ['produtos', 'outros_produtos', 'usar_nossos_produtos'] },
    { title: '3. Preços', keys: ['moeda', 'preco_torcedor', 'preco_jogador', 'preco_retro', 'preco_infantil', 'preco_agasalho_viagem', 'preco_conjunto_treino', 'preco_jaqueta', 'preco_moletom', 'preco_short'] },
    { title: '4. Ofertas', keys: ['ofertas', 'ofertas_descricao'] },
    { title: '5. Logo', keys: ['logo_manter', 'logo_estilo'] },
    { title: '6. Cores', keys: ['paleta_definida', 'paleta_cores'] },
    { title: '7. Banners', keys: ['banners_tipos', 'banners_colecoes', 'banners_conteudo', 'banners_quantidade', 'banner_parecer'] },
    { title: '8. Checkout', keys: ['checkout'] },
    { title: '9. Automações', keys: ['usar_automacoes', 'plataforma_automacao'] },
    { title: '10. Implementação', keys: ['contato_email', 'contato_telefone', 'politica_troca_dias', 'politica_entrega_prazo', 'frete_gratis_valor', 'politica_reembolso', 'marca_cnpj', 'marca_endereco'] },
];

const LABELS: Record<string, string> = {
    marca_nome: 'Nome da marca', url_site: 'URL do site', instagram: 'Instagram', tempo_marca: 'Tempo de marca',
    tem_site: 'Possui site?', problema_site: 'Problema do site', nicho: 'Nicho', vende_onde: 'Mercado',
    produtos: 'Produtos', outros_produtos: 'Outros', usar_nossos_produtos: 'Usa nossos produtos?',
    moeda: 'Moeda', preco_torcedor: 'Torcedor', preco_jogador: 'Jogador', preco_retro: 'Retrô',
    preco_infantil: 'Infantil', preco_agasalho_viagem: 'Agasalho', preco_conjunto_treino: 'Treino',
    preco_jaqueta: 'Jaqueta', preco_moletom: 'Moletom', preco_short: 'Short',
    ofertas: 'Ofertas', ofertas_descricao: 'Promoção personalizada',
    logo_manter: 'Manter logo?', logo_estilo: 'Estilo',
    paleta_definida: 'Paleta definida?', paleta_cores: 'Cores',
    banners_tipos: 'Tipos de banner', banners_colecoes: 'Coleções', banners_conteudo: 'Conteúdo',
    banners_quantidade: 'Quantidade', banner_parecer: 'Estilo visual',
    checkout: 'Checkout',
    usar_automacoes: 'Usa automações?', plataforma_automacao: 'Plataforma',
    contato_email: 'Email', contato_telefone: 'Telefone', politica_troca_dias: 'Troca (dias)',
    politica_entrega_prazo: 'Prazo entrega', frete_gratis_valor: 'Frete grátis acima de',
    politica_reembolso: 'Reembolso', marca_cnpj: 'CNPJ', marca_endereco: 'Endereço',
};

function formatValue(v: any): string {
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    return String(v);
}

interface Props {
    clientId: string;
    clientName: string;
}

export function ClientBriefingTab({ clientId, clientName }: Props) {
    const navigate = useNavigate();
    const [briefing, setBriefing] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBriefing = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await (supabase as any)
                    .from('briefings')
                    .select('*')
                    .eq('client_group_id', clientId)
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (error) { console.error('Erro ao buscar briefing:', error); }
                setBriefing(data?.[0] || null);
            } catch (err) {
                console.error('Erro inesperado ao buscar briefing:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchBriefing();
    }, [clientId]);

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!briefing) {
        return (
            <Card className="border border-amber-500/20 bg-amber-500/5 shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                    <FileText className="w-12 h-12 text-amber-500/50" />
                    <h3 className="text-lg font-bold text-amber-700 dark:text-amber-300">Sem briefing</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                        Este cliente ainda não possui um briefing preenchido. Preencha o briefing para gerar as demandas de implementação.
                    </p>
                    <Button onClick={() => navigate(`/briefing/formulario?client=${clientId}`)} className="gap-2 mt-2">
                        <ExternalLink className="w-4 h-4" /> Novo Briefing
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const answers = briefing.answers || {};

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">{clientName}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(briefing.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            {briefing.ai_summary && (
                                <span className="ml-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Resumo IA
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SECTIONS.map(section => {
                    const filled = section.keys.filter(k => {
                        const v = answers[k];
                        return v && (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.length > 0 : true);
                    });
                    if (filled.length === 0) return null;

                    return (
                        <Card key={section.title} className="shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold text-muted-foreground">{section.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5">
                                {filled.map(key => (
                                    <div key={key} className="flex justify-between items-start gap-2 py-1">
                                        <span className="text-xs text-muted-foreground shrink-0">{LABELS[key] || key}</span>
                                        <span className="text-sm font-medium text-right">{formatValue(answers[key])}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* AI Summary */}
            {briefing.ai_summary && (
                <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Resumo Executivo (IA)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{briefing.ai_summary}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
