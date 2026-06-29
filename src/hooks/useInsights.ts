
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { MessageSquare, TrendingUp, TrendingDown, ImageIcon, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types (Mirrored from InsightsPage.tsx)
export interface Insight {
    id: string;
    type: 'COMMENT' | 'CREATIVE' | 'SCALING' | 'STOP_LOSS' | 'AUTOMATION' | 'RISK' | 'OPPORTUNITY' | 'TRACKING';
    title: string;
    subtitle: string;
    impact_score: number;
    icon: any; // React.ElementType is hard to type in raw TS file without React import, using any for simplicity or importing React
    dismissed?: boolean;
    ignored?: boolean;
    ignoredAt?: number;
    analysisTimeframe?: string;
    entity_id?: string;
    ad_id?: string;
    ad_name?: string;
    details: {
        comments?: Array<{ id: string; author: string; text: string; timestamp: string; adId: string; sentiment: string }>;
        rules?: Array<{ field: string; operator: string; value: any; label: string }>;
        automation_action?: string;
        metric_improvement?: string;
        potential_savings?: string;
        campaign_id?: string;
        campaign_name?: string;
        adset_id?: string;
        adset_name?: string;
        ad_id?: string;
        ad_name?: string;
        metric?: string;
        current_value?: number;
        average_value?: number;
        change_percent?: number;
        post_id?: string;
        unanswered_comments?: any[];
        negative_count?: number;
        question_count?: number;
    };
}

export const useInsights = () => {
    const { selectedAccountId, selectedProfileId } = useDashboard();
    const { toast } = useToast();
    const [insights, setInsights] = useState<Insight[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Comment fetching logic
    const fetchCommentInsights = useCallback(async (): Promise<Insight[]> => {
        if (!selectedAccountId) return [];

        try {
            const { data: session } = await supabase.auth.getSession();
            if (!session?.session?.access_token) return [];

            const { data, error } = await supabase.functions.invoke('scan-ad-comments', {
                body: { adAccountId: selectedAccountId, fbConnectionId: selectedProfileId, limit: 30 }
            });

            if (error || !data) {
                console.log('[useInsights] No comment insights available:', error);
                return [];
            }

            const insightsList: Insight[] = [];

            // Group comments by ad_name to create ONE insight per AD
            const commentsByAd = new Map<string, any[]>();
            const allComments = data.unanswered_comments || [];

            for (const comment of allComments) {
                const adKey = comment.ad_name || comment.ad_id || 'unknown';
                if (!commentsByAd.has(adKey)) {
                    commentsByAd.set(adKey, []);
                }
                commentsByAd.get(adKey)!.push(comment);
            }

            // Create one insight per ad that has unanswered comments
            let adIndex = 0;
            for (const [adName, adComments] of commentsByAd) {
                const negativeCount = adComments.filter(c => c.sentiment === 'negative').length;
                const questionCount = adComments.filter(c => {
                    const text = (c.message || '').toLowerCase();
                    return text.includes('?') || text.includes('como') || text.includes('quanto') ||
                        text.includes('qual') || text.includes('onde') || text.includes('quero');
                }).length;
                // Build subtitle with counts
                const subtitleParts = [adName];
                if (negativeCount > 0) subtitleParts.push(`${negativeCount} negativo(s)`);
                if (questionCount > 0) subtitleParts.push(`${questionCount} pergunta(s)`);

                insightsList.push({
                    id: `ad-comments-${adIndex}`,
                    type: 'COMMENT',
                    title: `💬 ${adComments.length} comentário(s) sem resposta`,
                    subtitle: subtitleParts.join(' • '),
                    impact_score: negativeCount > 0 ? 85 : 65,
                    icon: MessageSquare,
                    details: {
                        metric: negativeCount > 0 ? 'Sentiment' : 'Unanswered',
                        automation_action: negativeCount > 0 ? 'Responder Urgente' : 'Gerenciar Comentários',
                        comments: adComments,
                        unanswered_comments: adComments,
                        ad_id: adComments[0]?.ad_id,
                        ad_name: adName,
                        negative_count: negativeCount,
                        question_count: questionCount
                    }
                });
                adIndex++;
            }

            return insightsList;
        } catch (err) {
            console.error('[useInsights] Error fetching comment insights:', err);
            return [];
        }
    }, [selectedAccountId, selectedProfileId]);

    // Main fetch function
    const fetchInsights = useCallback(async () => {
        if (!selectedAccountId) {
            setInsights([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            if (!session?.session?.access_token) throw new Error("Not authenticated");

            // Fetch real-time insights from Meta API
            const { data, error } = await supabase.functions.invoke('generate-insights', {
                body: { adAccountId: selectedAccountId, fbConnectionId: selectedProfileId },
            });

            if (error) {
                console.error('[useInsights] Error from generate-insights:', error);
                throw error;
            }

            const backendInsights: Insight[] = (data?.insights || []).map((insight: any, index: number) => {
                const isRisk = insight.type === 'RISK';
                const severityScore = { CRITICAL: 100, HIGH: 80, MEDIUM: 60, LOW: 40 }[insight.severity] || 50;

                let icon = TrendingUp;
                if (insight.type === 'CREATIVE') icon = ImageIcon;
                else if (insight.type === 'COMMENT') icon = MessageSquare;
                else if (insight.type === 'TRACKING') icon = Activity;
                else if (isRisk) {
                    icon = insight.metric === 'ROAS' ? TrendingDown : TrendingUp;
                } else {
                    icon = insight.metric === 'CPA' ? TrendingDown : TrendingUp;
                }

                return {
                    id: `insight-${index}`,
                    type: insight.type,
                    title: insight.title,
                    subtitle: insight.subtitle || insight.ad_name || insight.campaign_name || 'Campanha',
                    impact_score: severityScore,
                    icon: icon,
                    analysisTimeframe: 'últimos 7 dias',
                    entity_id: insight.campaign_id,
                    ad_id: insight.ad_id,
                    ad_name: insight.ad_name,
                    details: {
                        campaign_id: insight.campaign_id,
                        campaign_name: insight.campaign_name,
                        adset_id: insight.adset_id,
                        adset_name: insight.adset_name,
                        ad_id: insight.ad_id,
                        ad_name: insight.ad_name,
                        metric: insight.metric,
                        current_value: insight.current_value,
                        average_value: insight.average_value,
                        change_percent: insight.change_percent,
                        automation_action: insight.automation_action || (isRisk ? 'Pausar Campanha' : 'Escalar +20%'),
                        rules: insight.type !== 'TRACKING' ? [
                            { field: insight.metric, operator: isRisk ? '>' : '<', value: insight.average_value, label: `${insight.metric}: ${insight.current_value?.toFixed?.(2) || insight.current_value}` },
                            { field: 'Variação', operator: '=', value: insight.change_percent, label: `${insight.change_percent?.toFixed?.(1) || insight.change_percent}%` }
                        ] : []
                    }
                };
            });

            // Comments
            const commentInsights = await fetchCommentInsights();

            // Mocks (for now, as per original file)
            const creativeInsights: Insight[] = [];
            const trackingInsights: Insight[] = [];
            const mockCommentInsights: Insight[] = [];

            const allInsights = [...backendInsights, ...creativeInsights, ...commentInsights, ...mockCommentInsights, ...trackingInsights]
                .sort((a, b) => {
                    const getPriority = (type: string) => {
                        if (type === 'OPPORTUNITY' || type === 'SCALING') return 3;
                        if (type === 'RISK' || type === 'STOP_LOSS') return 2;
                        return 1;
                    };
                    const priorityDiff = getPriority(b.type) - getPriority(a.type);
                    if (priorityDiff !== 0) return priorityDiff;
                    return b.impact_score - a.impact_score;
                });

            setInsights(allInsights);
        } catch (error: any) {
            console.error('Error fetching insights:', error);
            // Optional: toast error here or let consumer handle it? 
            // In hooks usually better not to toast unless global error. 
            // Original code toasted.
        } finally {
            setIsLoading(false);
        }
    }, [selectedAccountId, fetchCommentInsights]);

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    return { insights, isLoading, refetch: fetchInsights, setInsights };
};
