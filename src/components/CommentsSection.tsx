import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    MessageCircle,
    ThumbsUp,
    Send,
    Sparkles,
    Loader2,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle,
    MinusCircle,
    RefreshCw,
    ExternalLink
} from 'lucide-react';

interface Comment {
    id: string;
    message: string;
    from?: {
        id: string;
        name: string;
    };
    created_time: string;
    like_count?: number;
    comment_count?: number;
    is_hidden?: boolean;
    sentiment?: 'positive' | 'negative' | 'neutral';
    replies?: {
        data: Comment[];
    };
}

interface CommentsSectionProps {
    adId?: string;
    postId?: string;
    insightType?: string;
    initialComments?: any[]; // Pre-loaded comments from insights
}

const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return `${diffWeeks} sem`;
};

export function CommentsSection({ adId, postId, insightType, initialComments }: CommentsSectionProps) {
    const { selectedAccountId } = useDashboard();
    const { toast } = useToast();

    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

    useEffect(() => {
        // If we have initial comments from the insight, use those directly
        if (initialComments && initialComments.length > 0) {
            // Map the insight comment format to the Comment format
            const mappedComments: Comment[] = initialComments.map(c => ({
                id: c.id,
                message: c.text || c.message,
                from: c.from || { id: 'unknown', name: c.author || 'Usuário' },
                created_time: c.timestamp || c.created_time || new Date().toISOString(),
                sentiment: c.sentiment,
                like_count: c.like_count || 0
            }));
            setComments(mappedComments);
            return;
        }
        // Otherwise, fetch from API if we have adId or postId
        if (adId || postId) {
            loadComments();
        }
    }, [adId, postId, initialComments]);

    const loadComments = async () => {
        // Mock data logic
        if (adId?.includes('mock')) {
            setIsLoading(true);
            setTimeout(() => {
                const mockComments: Comment[] = adId === 'mock-ad-positive' ? [
                    {
                        id: 'm1',
                        from: { id: 'u1', name: 'Ricardo Dias' },
                        message: 'Oi pessoal! Qual o prazo de entrega para São Paulo?',
                        created_time: new Date(Date.now() - 3600000).toISOString(),
                        sentiment: 'neutral',
                        like_count: 2
                    },
                    {
                        id: 'm2',
                        from: { id: 'u2', name: 'Ana Oliveira' },
                        message: 'Produto maravilhoso, chegou super rápido! Recomendo demais 🚀',
                        created_time: new Date(Date.now() - 7200000).toISOString(),
                        sentiment: 'positive',
                        like_count: 12,
                        replies: {
                            data: [{
                                id: 'r1',
                                from: { id: 'page', name: 'Beacon AI' },
                                message: 'Ficamos felizes que gostou, Ana! Aproveite seu novo produto.',
                                created_time: new Date(Date.now() - 6000000).toISOString()
                            }]
                        }
                    },
                    {
                        id: 'm3',
                        from: { id: 'u3', name: 'Beatriz Costa' },
                        message: 'Valor do frete está meio alto para minha região...',
                        created_time: new Date(Date.now() - 86400000).toISOString(),
                        sentiment: 'neutral',
                        like_count: 0
                    }
                ] : [
                    {
                        id: 'm4',
                        from: { id: 'u4', name: 'João Silva' },
                        message: 'Não gostei, o site demorou a abrir e tive dificuldade no checkout.',
                        created_time: new Date(Date.now() - 1800000).toISOString(),
                        sentiment: 'negative',
                        like_count: 1
                    },
                    {
                        id: 'm5',
                        from: { id: 'u5', name: 'Carla Souza' },
                        message: 'Isso é propaganda enganosa! O preço no anúncio está diferente do site.',
                        created_time: new Date(Date.now() - 4500000).toISOString(),
                        sentiment: 'negative',
                        like_count: 5
                    }
                ];
                setComments(mockComments);
                setIsLoading(false);
            }, 600);
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('fetch-ad-comments', {
                body: {
                    adId,
                    postId,
                    limit: 50
                }
            });

            if (error) throw error;

            setComments(data?.comments || []);
        } catch (err: any) {
            console.error('[CommentsSection] Error loading comments:', err);
            // Don't show toast for missing post IDs - this is expected for some ads
            if (!err.message?.includes('No post ID')) {
                toast({
                    title: 'Erro ao carregar comentários',
                    description: err.message,
                    variant: 'destructive'
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleReply = async (commentId: string) => {
        if (!replyText.trim()) return;

        setIsSendingReply(true);
        try {
            const { error } = await supabase.functions.invoke('reply-to-comment', {
                body: {
                    commentId,
                    message: replyText,
                    adAccountId: selectedAccountId
                }
            });

            if (error) throw error;

            toast({
                title: 'Resposta enviada!',
                description: 'Sua resposta foi publicada com sucesso.'
            });

            setReplyText('');
            setReplyingTo(null);
            // Reload comments to show the new reply
            loadComments();
        } catch (err: any) {
            console.error('[CommentsSection] Error replying:', err);
            toast({
                title: 'Erro ao responder',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setIsSendingReply(false);
        }
    };

    const generateAIResponse = async (commentId: string, commentText: string, authorName?: string) => {
        setIsGeneratingAI(true);
        try {
            // Contexto de suporte para a IA usar se necessário
            const supportContext = `
            Informações de Suporte da Empresa:
            - Email: suporte@lojamodelo.com.br
            - WhatsApp: (11) 99999-8888
            - Horário: Seg-Sex 9h às 18h
            `;

            // Use the existing lads-brain Edge Function to generate a response
            const { data, error } = await supabase.functions.invoke('lads-brain', {
                body: {
                    accountId: selectedAccountId,
                    message: `Gere uma resposta educada, profissional e amigável para este comentário de um cliente em um anúncio do Facebook/Instagram. 
                    
                    Detalhes importantes:
                    1. Nome do cliente: ${authorName || 'Cliente'} (Use o nome para personalizar, se disponível).
                    2. Contexto de Suporte: ${supportContext} (Use APENAS se o comentário for uma reclamação ou pedido de suporte).
                    3. Tom de voz: Prestativo, empático e resolutivo.
                    4. Regra: Resposta curta (máximo 2-3 frases). Não use hashtags.

                    Comentário do cliente: "${commentText}"

                    Responda apenas com o texto da resposta.`,
                    type: 'chat',
                    conversationHistory: []
                }
            });

            if (error) throw error;

            const aiResponse = data?.response || data?.text || '';
            setReplyText(aiResponse);

            toast({
                title: 'Resposta gerada!',
                description: 'Revise e edite se necessário antes de enviar.'
            });
        } catch (err: any) {
            console.error('[CommentsSection] Error generating AI response:', err);
            toast({
                title: 'Erro ao gerar resposta',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const toggleReplies = (commentId: string) => {
        const newExpanded = new Set(expandedReplies);
        if (newExpanded.has(commentId)) {
            newExpanded.delete(commentId);
        } else {
            newExpanded.add(commentId);
        }
        setExpandedReplies(newExpanded);
    };

    const getSentimentIcon = (sentiment?: string) => {
        switch (sentiment) {
            case 'positive':
                return <CheckCircle className="w-3 h-3 text-green-500" />;
            case 'negative':
                return <AlertCircle className="w-3 h-3 text-red-500" />;
            default:
                return <MinusCircle className="w-3 h-3 text-gray-400" />;
        }
    };

    const getSentimentColor = (sentiment?: string) => {
        switch (sentiment) {
            case 'positive': return 'border-l-green-500';
            case 'negative': return 'border-l-red-500';
            default: return 'border-l-gray-300';
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <MessageCircle className="w-4 h-4" />
                    <span className="font-medium">Carregando comentários...</span>
                </div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (comments.length === 0) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Nenhum comentário encontrado</p>
                <p className="text-sm">Este anúncio ainda não recebeu comentários.</p>
            </div>
        );
    }

    return (
        <div className="bg-card border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <span className="font-medium">Comentários</span>
                    <Badge variant="secondary">{comments.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                    {postId && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://facebook.com/${postId}`, '_blank')}
                            title="Ver no Facebook"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={loadComments}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Comments List */}
            <div className="divide-y divide-border/50">
                {comments.map(comment => (
                    <div key={comment.id} className="p-4">
                        {/* Main Comment */}
                        <div className={`flex gap-3 border-l-4 pl-3 ${getSentimentColor(comment.sentiment)}`}>
                            {/* Avatar - Use FB profile picture if ID available */}
                            {comment.from?.id && comment.from.id !== 'unknown' ? (
                                <img
                                    src={`https://graph.facebook.com/${comment.from.id}/picture?type=small`}
                                    alt={comment.from?.name || 'User'}
                                    className="w-10 h-10 rounded-full flex-shrink-0 bg-muted"
                                    onError={(e) => {
                                        // Fallback to letter avatar on error
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        target.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                            ) : null}
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${comment.from?.id && comment.from.id !== 'unknown' ? 'hidden' : ''}`}>
                                {comment.from?.name?.charAt(0).toUpperCase() || '?'}
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* Comment Bubble */}
                                <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">
                                            {comment.from?.name || 'Usuário'}
                                        </span>
                                        {getSentimentIcon(comment.sentiment)}
                                    </div>
                                    <p className="text-sm mt-1">{comment.message}</p>
                                </div>

                                {/* Comment Actions */}
                                <div className="flex items-center gap-4 mt-1 ml-1 text-xs text-muted-foreground">
                                    <span>{formatTimeAgo(comment.created_time)}</span>
                                    {(comment.like_count ?? 0) > 0 && (
                                        <span className="flex items-center gap-1">
                                            <ThumbsUp className="w-3 h-3" />
                                            {comment.like_count}
                                        </span>
                                    )}
                                    <button
                                        className="font-semibold hover:text-foreground transition-colors"
                                        onClick={() => {
                                            setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                            setReplyText('');
                                        }}
                                    >
                                        Responder
                                    </button>
                                    {(comment.replies?.data?.length ?? 0) > 0 && (
                                        <button
                                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                                            onClick={() => toggleReplies(comment.id)}
                                        >
                                            {expandedReplies.has(comment.id) ? (
                                                <>
                                                    <ChevronUp className="w-3 h-3" />
                                                    Ocultar respostas
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-3 h-3" />
                                                    Ver {comment.replies?.data?.length} resposta(s)
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Existing Replies */}
                                {expandedReplies.has(comment.id) && comment.replies?.data && (
                                    <div className="mt-3 space-y-3">
                                        {comment.replies.data.map(reply => (
                                            <div key={reply.id} className="flex gap-3 relative ml-2">
                                                {/* Curved Line Connector - Glued to Parent & Reply */}
                                                <div className="absolute left-[-22px] top-[-20px] w-[38px] h-[44px] border-l-2 border-b-2 border-muted-foreground/20 rounded-bl-xl z-0"></div>

                                                {/* Reply Avatar */}
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 z-10 mt-1 ring-2 ring-background">
                                                    {reply.from?.name?.charAt(0).toUpperCase() || '?'}
                                                </div>

                                                <div className="flex-1">
                                                    <div className="bg-muted/30 rounded-2xl rounded-tl-sm px-3 py-2">
                                                        <span className="font-semibold text-xs">
                                                            {reply.from?.name || 'Você'}
                                                        </span>
                                                        <p className="text-sm">{reply.message}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 ml-1 text-xs text-muted-foreground">
                                                        <span>{formatTimeAgo(reply.created_time)}</span>
                                                        {(reply.like_count ?? 0) > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <ThumbsUp className="w-3 h-3" />
                                                                {reply.like_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Reply Input - Sharp & External Layout */}
                                {replyingTo === comment.id && (
                                    <div className="mt-6 relative ml-2">
                                        {/* Curved Line Connector - Glued (Icon to Icon) */}
                                        {/* Left: -37px to hit center of 40px parent avatar (20px center - 8px margin - existing offset) */}
                                        <div className="absolute left-[-37px] top-[-36px] w-[53px] h-[64px] border-l-2 border-b-2 border-muted-foreground/20 rounded-bl-xl z-0"></div>

                                        <div className="flex flex-col gap-3 relative z-10">
                                            <div className="flex gap-3">
                                                {/* Your Avatar */}
                                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-1 ring-4 ring-background">
                                                    Eu
                                                </div>

                                                <div className="flex-1 flex flex-col gap-2">
                                                    <Textarea
                                                        placeholder={`Responder a ${comment.from?.name || 'usuário'}...`}
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        className="min-h-[80px] rounded-none border-muted bg-muted/10 focus:bg-background transition-colors resize-none p-3"
                                                    />

                                                    {/* Actions Bar Outside Textarea */}
                                                    <div className="flex justify-between items-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2 text-xs text-muted-foreground hover:text-primary gap-1.5 rounded-none hover:bg-primary/5"
                                                            disabled={isGeneratingAI}
                                                            onClick={() => generateAIResponse(comment.id, comment.message, comment.from?.name)}
                                                        >
                                                            {isGeneratingAI ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Sparkles className="w-3 h-3 text-yellow-500" />
                                                            )}
                                                            Gerar com IA
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-6 rounded-none text-xs font-medium"
                                                            disabled={!replyText.trim() || isSendingReply}
                                                            onClick={() => handleReply(comment.id)}
                                                        >
                                                            {isSendingReply ? (
                                                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                            ) : (
                                                                <Send className="w-3 h-3 mr-1.5" />
                                                            )}
                                                            Responder
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
