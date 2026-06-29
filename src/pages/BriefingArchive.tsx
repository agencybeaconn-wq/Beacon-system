/**
 * BriefingArchive — Arquivos de Briefing (visualização por cliente)
 */

import { useState } from 'react';
import { useBriefings, Briefing } from '@/hooks/useBriefings';
import { AiAnalysisService } from '@/services/aiAnalysisService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Search, Trash2, Calendar, User, Sparkles, X, RefreshCw, Download, Eye, ClipboardList, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

// ─── Sections in correct order ──────────────────────────────────────────────────

const SECTIONS = [
    {
        title: '1. Informações Gerais da Marca',
        keys: ['marca_nome', 'url_site', 'instagram', 'tempo_marca', 'tem_site', 'problema_site', 'nicho', 'vende_onde'],
    },
    {
        title: '2. Estrutura de Produtos e Preços',
        keys: ['usar_nossos_produtos', 'produtos', 'outros_produtos', 'moeda', 'preco_torcedor', 'preco_jogador', 'preco_retro', 'preco_infantil', 'preco_agasalho_viagem', 'preco_conjunto_treino', 'preco_jaqueta', 'preco_moletom', 'preco_short', 'preco_patchs', 'preco_patrocinios', 'preco_tamanho_2gg', 'preco_tamanho_3gg', 'preco_tamanho_4gg', 'preco_personalizacao', 'preco_manga_longa', 'frete_gratis', 'parcelamento', 'parcelas_max', 'parcelas_sem_juros'],
    },
    {
        title: '3. Ofertas da Loja',
        keys: ['ofertas', 'ofertas_descricao'],
    },
    {
        title: '4. Logo',
        keys: ['logo_manter', 'logo_estilo', 'logo_significado', 'logo_url'],
    },
    {
        title: '5. Cores & Identidade Visual',
        keys: ['paleta_definida', 'paleta_cores'],
    },
    {
        title: '6. Banners & Comunicação Visual',
        keys: ['banners_tipos', 'banners_colecoes', 'banners_conteudo', 'banners_quantidade', 'banner_parecer'],
    },
    {
        title: '7. Checkout',
        keys: ['checkout'],
    },
    {
        title: '8. Páginas e Políticas',
        keys: ['politicas_opcao', 'politicas_adaptar'],
    },
    {
        title: '9. Automações',
        keys: ['usar_automacoes', 'plataforma_automacao'],
    },
    {
        title: '10. Dados para Implementação',
        keys: ['contato_email', 'contato_telefone', 'instagram', 'facebook', 'tiktok', 'horario_atendimento', 'formas_pagamento', 'politica_troca_dias', 'politica_entrega_prazo', 'politica_entrega_info', 'frete_gratis_valor', 'politica_reembolso', 'politica_primeira_troca', 'marca_cnpj', 'marca_endereco'],
    },
    {
        title: '11. Informações Extras',
        keys: ['extras', 'extras_links', 'extras_images'],
    },
];

const LABELS: Record<string, string> = {
    form_type: 'Tipo de briefing',
    marca_nome: 'Nome da marca', url_site: 'URL do site', instagram: 'Instagram / Redes', tempo_marca: 'Tempo de marca', tem_site: 'Possui site?', problema_site: 'Problema do site atual',
    nicho: 'Nicho principal', vende_onde: 'Onde vende?', produtos: 'Produtos vendidos', outros_produtos: 'Outros produtos',
    moeda: 'Moeda utilizada',
    preco_torcedor: 'Camisas torcedor', preco_jogador: 'Camisas jogador', preco_retro: 'Camisas retrô', preco_infantil: 'Conjuntos infantil', preco_agasalho_viagem: 'Agasalho de viagem', preco_conjunto_treino: 'Conjunto de treino', preco_jaqueta: 'Jaqueta', preco_moletom: 'Moletom', preco_short: 'Short', preco_patchs: 'Patchs', preco_patrocinios: 'Extra por patrocínios', preco_tamanho_2gg: 'Acréscimo 2GG', preco_tamanho_3gg: 'Acréscimo 3GG', preco_tamanho_4gg: 'Acréscimo 4GG', preco_personalizacao: 'Personalização (nome/número)', preco_manga_longa: 'Manga longa', frete_gratis: 'Frete grátis?', parcelamento: 'Parcelamento?', parcelas_max: 'Máx. parcelas',
    contato_email: 'Email de contato', contato_telefone: 'Telefone / WhatsApp', politica_troca_dias: 'Prazo de troca (dias)', politica_entrega_prazo: 'Prazo de entrega', politica_entrega_info: 'Info extras de envio', frete_gratis_valor: 'Valor mín. frete grátis', politica_reembolso: 'Política de reembolso', politica_primeira_troca: 'Primeira troca gratuita?', marca_cnpj: 'CNPJ', marca_endereco: 'Endereço',
    usar_nossos_produtos: 'Utiliza nossos produtos?',
    ofertas: 'Ofertas ativas', ofertas_descricao: 'Outra promoção personalizada',
    logo_manter: 'Logo atual', logo_estilo: 'Estilo de logo preferido', logo_significado: 'Significado da logo', logo_url: 'Arquivo de logo',
    paleta_definida: 'Paleta de cores definida?', paleta_cores: 'Cores da paleta',
    banner_parecer: 'Estilo de banner desejado',
    checkout: 'Checkout utilizado',
    usar_automacoes: 'Utiliza automações?', plataforma_automacao: 'Plataforma de automação',
    banners_tipos: 'Banners a criar', banners_colecoes: 'Coleções dos banners', banners_conteudo: 'Conteúdo dos banners', banners_quantidade: 'Quantidade de banners',
    parcelas_sem_juros: 'Parcelas sem juros',
    politicas_opcao: 'Páginas de políticas', politicas_adaptar: 'O que adaptar nas políticas',
    extras: 'Informações adicionais', extras_links: 'Links de referência', extras_images: 'Imagens de referência',
};

// ─── Simple Markdown Renderer ───────────────────────────────────────────────────

function renderMarkdown(text: string) {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
            elements.push(<br key={i} />);
        } else if (trimmed.startsWith('### ')) {
            elements.push(<h4 key={i} className="text-sm font-bold mt-4 mb-1 text-foreground/90">{trimmed.replace(/^###\s*/, '').replace(/\*\*/g, '')}</h4>);
        } else if (trimmed.startsWith('## ')) {
            elements.push(<h3 key={i} className="text-base font-bold mt-5 mb-2 text-foreground">{trimmed.replace(/^##\s*/, '').replace(/\*\*/g, '')}</h3>);
        } else if (trimmed.startsWith('# ')) {
            elements.push(<h2 key={i} className="text-lg font-bold mt-4 mb-2 text-foreground">{trimmed.replace(/^#\s*/, '').replace(/\*\*/g, '')}</h2>);
        } else if (trimmed.startsWith('---')) {
            elements.push(<hr key={i} className="border-border/40 my-3" />);
        } else if (trimmed.match(/^[*\-•]\s/)) {
            const content = trimmed.replace(/^[*\-•]\s*/, '');
            elements.push(
                <div key={i} className="flex gap-2 pl-2 py-0.5">
                    <span className="text-primary/60 mt-0.5 shrink-0">•</span>
                    <span className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')) }} />
                </div>
            );
        } else if (trimmed.match(/^\d+\.\s/)) {
            const content = trimmed.replace(/^\d+\.\s*/, '');
            const num = trimmed.match(/^(\d+)\./)?.[1];
            elements.push(
                <div key={i} className="flex gap-2 pl-2 py-0.5">
                    <span className="text-primary/60 font-medium text-xs mt-0.5 shrink-0">{num}.</span>
                    <span className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')) }} />
                </div>
            );
        } else {
            elements.push(
                <p key={i} className="text-sm leading-relaxed py-0.5" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')) }} />
            );
        }
    });

    return <div className="space-y-0.5">{elements}</div>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function hasValue(v: any): boolean {
    if (!v) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
}

function formatValue(v: any): string {
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
}

// ─── Improved AI Prompt ─────────────────────────────────────────────────────────

function buildPrompt(clientName: string, answers: Record<string, any>) {
    const sections = SECTIONS.map(sec => {
        const entries = sec.keys
            .filter(k => hasValue(answers[k]))
            .map(k => `  - ${LABELS[k] || k}: ${formatValue(answers[k])}`);
        if (entries.length === 0) return null;
        return `${sec.title}\n${entries.join('\n')}`;
    }).filter(Boolean).join('\n\n');

    return `Você é um estrategista sênior de e-commerce e branding na agência Beacon. Crie um RESUMO EXECUTIVO profissional deste briefing de cliente.

REGRAS:
- Escreva de forma natural, em parágrafos fluidos. NÃO use marcadores com asteriscos ou bullets em excesso.
- Organize por seções com títulos claros (use ## para seções).
- Cada seção deve ser um texto corrido e analítico, não apenas listar dados.
- Destaque insights estratégicos e pontos de atenção com linguagem profissional.
- Indique oportunidades de melhoria e observações relevantes.
- Tom: executivo, direto, estratégico. Como se fosse um documento para apresentar ao time.
- Escreva em português brasileiro.
- NÃO copie os dados literalmente. Sintetize e interprete.

Cliente: ${clientName}

DADOS DO BRIEFING:
${sections}`;
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function BriefingArchive() {
    const { briefings, isLoading, deleteBriefing, updateBriefingSummary } = useBriefings();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Briefing | null>(null);
    const [regenerating, setRegenerating] = useState(false);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [generatingDemands, setGeneratingDemands] = useState(false);

    const filtered = briefings.filter(b => b.client_name.toLowerCase().includes(search.toLowerCase()));

    const downloadImage = async (url: string, name: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = name;
            a.click();
            URL.revokeObjectURL(blobUrl);
            toast.success('Imagem baixada!');
        } catch {
            // Fallback: open in new tab
            window.open(url, '_blank');
        }
    };

    const regenerateSummary = async (b: Briefing) => {
        setRegenerating(true);
        try {
            const result = await AiAnalysisService.analyze({
                prompt: buildPrompt(b.client_name, b.answers),
                temperature: 0.5,
                maxTokens: 4096,
            });
            await updateBriefingSummary(b.id, result.text);
            setSelected(prev => prev && prev.id === b.id ? { ...prev, ai_summary: result.text } : prev);
            toast.success('Resumo regenerado!');
        } catch (err: any) {
            toast.error('Erro ao regenerar: ' + err.message);
        } finally {
            setRegenerating(false);
        }
    };

    const downloadBriefing = (b: Briefing) => {
        let content = `BRIEFING INTERNO — ${b.client_name.toUpperCase()}\n`;
        content += `Data: ${new Date(b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}\n`;
        content += `${'═'.repeat(60)}\n\n`;

        if (b.ai_summary) {
            content += `RESUMO EXECUTIVO (IA)\n${'─'.repeat(40)}\n${b.ai_summary}\n\n`;
        }

        content += `RESPOSTAS COMPLETAS\n${'─'.repeat(40)}\n\n`;
        SECTIONS.forEach(sec => {
            const filled = sec.keys.filter(k => hasValue(b.answers[k]));
            if (filled.length === 0) return;
            content += `${sec.title}\n`;
            filled.forEach(k => {
                content += `  • ${LABELS[k] || k}: ${formatValue(b.answers[k])}\n`;
            });
            content += '\n';
        });

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `briefing-${b.client_name.toLowerCase().replace(/\s+/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Briefing baixado!');
    };

    const generateDemands = async (b: Briefing) => {
        if (!b.client_group_id) {
            toast.error('Este briefing não está vinculado a um cliente.');
            return;
        }
        setGeneratingDemands(true);
        try {
            const { BriefingAutomationService } = await import('@/services/automations/BriefingAutomationService');
            const result = await BriefingAutomationService.generateTasksFromBriefing(
                b.client_group_id,
                b.id,
                b.workspace_id,
                true // force: delete existing and regenerate
            );
            if (result.error) {
                toast.error('Erro ao gerar demandas: ' + (typeof result.error === 'string' ? result.error : result.error?.message || JSON.stringify(result.error)));
            } else {
                toast.success(`Demandas geradas com sucesso! (${result.data?.length || 0} tarefas)`);
            }
        } catch (err: any) {
            toast.error('Erro ao gerar demandas: ' + err.message);
        } finally {
            setGeneratingDemands(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="max-w-5xl mx-auto py-6 px-4 md:px-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Arquivos de Briefing</h1>
                        <p className="text-muted-foreground text-sm">{briefings.length} briefing{briefings.length !== 1 ? 's' : ''} salvos</p>
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente..." className="pl-9" />
                    </div>
                </div>

                {/* Grid */}
                {filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
                        <p className="text-lg font-medium text-muted-foreground">{search ? 'Nenhum resultado encontrado' : 'Nenhum briefing criado ainda'}</p>
                        <p className="text-sm text-muted-foreground/60 mt-1">Preencha o formulário para criar o primeiro briefing.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(b => (
                            <Card key={b.id} className="group cursor-pointer hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5" onClick={() => setSelected(b)}>
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 flex items-center justify-center">
                                                <User className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sm leading-tight">{b.client_name}</h3>
                                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(b.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); if (confirm('Excluir este briefing?')) deleteBriefing(b.id); }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>

                                    {b.ai_summary ? (
                                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                            <Sparkles className="w-3 h-3" /> Resumo gerado por IA
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Sem resumo IA</div>
                                    )}

                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                        {b.answers.nicho && `Nicho: ${b.answers.nicho}`}
                                        {b.answers.marca_nome && ` • ${b.answers.marca_nome}`}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* ═══ DETAIL MODAL ═══ */}
            <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
                <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden p-0 gap-0">
                    {selected && (
                        <div className="flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-lg leading-tight">{selected.client_name}</h2>
                                        <p className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mr-8">
                                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
                                        setSelected(null);
                                        navigate(`/briefing/formulario?client=${selected.client_group_id}&edit=${selected.id}`);
                                    }}>
                                        <Pencil className="w-3.5 h-3.5" /> Editar
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => generateDemands(selected)} disabled={generatingDemands}>
                                        {generatingDemands ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                                        {generatingDemands ? 'Gerando...' : 'Gerar Demandas'}
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => downloadBriefing(selected)}>
                                        <Download className="w-3.5 h-3.5" /> Baixar
                                    </Button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="overflow-y-auto flex-1 p-6 space-y-6">
                                {/* Answers organized by sections (FIRST) */}
                                <div className="space-y-5">
                                    <h3 className="font-bold text-base uppercase tracking-wider text-muted-foreground">Respostas do Briefing</h3>

                                    {SECTIONS.map(section => {
                                        const filledKeys = section.keys.filter(k => hasValue(selected.answers[k]));
                                        if (filledKeys.length === 0) return null;

                                        return (
                                            <div key={section.title} className="space-y-2">
                                                <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                                                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">{section.title.split('.')[0]}</div>
                                                    <h4 className="text-sm font-semibold text-foreground/80">{section.title.split('. ')[1]}</h4>
                                                </div>
                                                <div className="grid grid-cols-1 gap-1.5 pl-1">
                                                    {filledKeys.map(key => {
                                                        const val = selected.answers[key];

                                                        // Render logo image with view & download
                                                        if (key === 'logo_url' && typeof val === 'string') {
                                                            return (
                                                                <div key={key} className="py-3 px-3 rounded-lg bg-muted/30 border border-border/20">
                                                                    <span className="text-xs font-medium text-muted-foreground block mb-2">{LABELS[key] || key}</span>
                                                                    <div className="flex items-end gap-3">
                                                                        <img src={val} alt="Logo" className="h-24 w-auto rounded-lg border border-border object-contain bg-muted/20 p-1 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" onClick={() => setViewImage(val)} />
                                                                        <div className="flex gap-1.5">
                                                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setViewImage(val)}>
                                                                                <Eye className="w-3 h-3" /> Ver
                                                                            </Button>
                                                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadImage(val, `logo-${selected.client_name}.png`)}>
                                                                                <Download className="w-3 h-3" /> Baixar
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        // Render extras images gallery with view & download
                                                        if (key === 'extras_images' && Array.isArray(val) && val.length > 0) {
                                                            return (
                                                                <div key={key} className="py-3 px-3 rounded-lg bg-muted/30 border border-border/20">
                                                                    <span className="text-xs font-medium text-muted-foreground block mb-2">{LABELS[key] || key} ({val.length})</span>
                                                                    <div className="flex flex-wrap gap-3">
                                                                        {val.map((url: string, i: number) => (
                                                                            <div key={i} className="relative group/img">
                                                                                <img src={url} alt={`Ref ${i + 1}`} className="h-32 w-auto rounded-lg border border-border object-cover cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" onClick={() => setViewImage(url)} />
                                                                                <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setViewImage(url); }} className="w-7 h-7 rounded-md bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors">
                                                                                        <Eye className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadImage(url, `briefing-${selected.client_name}-ref-${i + 1}.png`); }} className="w-7 h-7 rounded-md bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors">
                                                                                        <Download className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        // Render links clickable
                                                        if (key === 'extras_links' && Array.isArray(val) && val.length > 0) {
                                                            return (
                                                                <div key={key} className="py-2 px-3 rounded-lg bg-muted/30 border border-border/20">
                                                                    <span className="text-xs font-medium text-muted-foreground block mb-2">{LABELS[key] || key}</span>
                                                                    <div className="space-y-1">
                                                                        {val.map((url: string, i: number) => (
                                                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                                                                                🔗 {url}
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        // Default text
                                                        return (
                                                            <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2 px-3 rounded-lg bg-muted/30 border border-border/20">
                                                                <span className="text-xs font-medium text-muted-foreground shrink-0 sm:w-52 sm:text-right">{LABELS[key] || key}</span>
                                                                <span className="text-sm text-foreground">{formatValue(val)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* AI Summary (LAST) */}
                                {selected.ai_summary ? (
                                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">Resumo Executivo (IA)</span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => regenerateSummary(selected)} disabled={regenerating}>
                                                <RefreshCw className={cn("w-3 h-3", regenerating && "animate-spin")} />
                                                {regenerating ? 'Gerando...' : 'Regenerar'}
                                            </Button>
                                        </div>
                                        <div className="text-foreground/80">{renderMarkdown(selected.ai_summary)}</div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Resumo IA não gerado</span>
                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => regenerateSummary(selected)} disabled={regenerating}>
                                                <Sparkles className={cn("w-3 h-3", regenerating && "animate-spin")} />
                                                {regenerating ? 'Gerando...' : 'Gerar Resumo'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ═══ IMAGE LIGHTBOX ═══ */}
            {viewImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
                    <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <img src={viewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
                        <div className="absolute top-3 right-3 flex gap-2">
                            <button onClick={() => downloadImage(viewImage, `briefing-image-${Date.now()}.png`)} className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors border border-white/20">
                                <Download className="w-5 h-5" />
                            </button>
                            <button onClick={() => setViewImage(null)} className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors border border-white/20">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

