import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
    Lightbulb,
    MessageSquare,
    TrendingUp,
    TrendingDown,
    StopCircle,
    Zap,
    CheckCircle2,
    X,
    Sparkles,
    ArrowRight,
    Loader2,
    AlertTriangle,
    RefreshCw,
    DollarSign,
    Image as ImageIcon,
    Activity,
    Clock,
    EyeOff,
    Settings2,
    Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { useOverviewMetrics } from '@/hooks/useOverviewMetrics';
import { useToast } from '@/hooks/use-toast';
import { CampaignPreviewCard } from '@/components/CampaignPreviewCard';
import { CommentsSection } from '@/components/CommentsSection';
import { AccountGovernanceForm } from '@/components/AccountGovernanceForm';
import { UTMBuilderModal } from '@/components/UTMBuilderModal';
import { AccountSettingsModal } from '@/components/AccountSettingsModal';
import { useInsights, Insight } from '@/hooks/useInsights';

// ============================================
// TYPES
// ============================================
interface Anomaly {
    type: 'RISK' | 'OPPORTUNITY' | 'CREATIVE' | 'COMMENT' | 'TRACKING';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    campaign_id?: string;
    campaign_name?: string;
    metric: string;
    current_value: number;
    average_value: number;
    change_percent: number;
}

// Types replaced by import from hook

// ============================================
// COMPONENT
// ============================================
const InsightsPage = () => {
    const { t } = useTranslation();
    const { selectedAccountId } = useDashboard();
    const { metrics } = useOverviewMetrics('7d'); // Get 7-day metrics for averages
    const { toast } = useToast();

    const [filterType, setFilterType] = useState<'ALL' | Insight['type'] | string>('ALL');
    const [activeTab, setActiveTab] = useState('open');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // UTM Builder Modal State
    const [utmModalOpen, setUtmModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedUtmInsight, setSelectedUtmInsight] = useState<Insight | null>(null);
    const location = useLocation();

    // Use centralized hook
    const { insights, isLoading, setInsights, refetch: fetchAnomalies } = useInsights();

    // ============================================
    // HANDLERS
    // ============================================
    // Filter out ignored insights older than 24 hours
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const validInsights = insights.filter(i => {
        if (i.ignored && i.ignoredAt) {
            return (now - i.ignoredAt) < TWENTY_FOUR_HOURS;
        }
        return true;
    });

    const openInsights = validInsights.filter(i => !i.dismissed && !i.ignored);
    const ignoredInsights = validInsights.filter(i => i.ignored && !i.dismissed);
    const dismissedInsights = validInsights.filter(i => i.dismissed);

    // Filter Logic
    // Main KPIs (Performance): ROAS, CPA, CPL, SPEND
    // Secondary Metrics (Criativos): CTR, CPC, CPM, Frequency
    const mainKPIs = ['ROAS', 'CPA', 'CPL', 'SPEND'];
    const secondaryMetrics = ['CTR', 'CPC', 'CPM', 'Frequency'];

    const filteredInsights = openInsights.filter(i => {
        if (filterType === 'ALL') return true;
        if (filterType === 'RISK') return i.type === 'RISK' || i.type === 'STOP_LOSS';
        if (filterType === 'OPPORTUNITY') return i.type === 'OPPORTUNITY' || i.type === 'SCALING';
        if (filterType === 'CREATIVE') return i.type === 'CREATIVE' || secondaryMetrics.includes(i.details.metric || '');
        if (filterType === 'CAMPAIGNS') return mainKPIs.includes(i.details.metric || '');
        if (filterType === 'COMMENT') return (i.type as string) === 'COMMENT' || (i.details.metric === 'Engagement' || i.details.metric === 'Sentiment');
        if (filterType === 'TRACKING') return i.type === 'TRACKING';

        // Metric Filters (legacy)
        if (filterType === 'ROAS') return i.details.metric === 'ROAS';
        if (filterType === 'CPA') return i.details.metric === 'CPA';
        if (filterType === 'CPL') return i.details.metric === 'CPL';
        if (filterType === 'CTR') return i.details.metric === 'CTR';
        if (filterType === 'SPEND') return i.details.metric === 'SPEND';

        return true;
    });

    const riskInsights = openInsights.filter(i => i.type === 'RISK' || i.type === 'STOP_LOSS');
    const opportunityInsights = openInsights.filter(i => i.type === 'OPPORTUNITY' || i.type === 'SCALING');
    const creativeInsights = openInsights.filter(i => i.type === 'CREATIVE');
    const commentInsights = openInsights.filter(i => i.type === 'COMMENT');
    const trackingInsights = openInsights.filter(i => i.type === 'TRACKING');

    const handleDismiss = (id: string) => {
        setInsights(prev => prev.map(i => i.id === id ? { ...i, dismissed: true } : i));
        if (expandedId === id) setExpandedId(null);
    };

    const handleIgnore = (id: string) => {
        setInsights(prev => prev.map(i => i.id === id ? { ...i, ignored: true, ignoredAt: Date.now() } : i));
        if (expandedId === id) setExpandedId(null);
        toast({ title: 'Insight ignorado', description: 'Reaparecerá em 24h se ainda for relevante.' });
    };

    const handleApply = async (id: string, insight: Insight) => {
        // For TRACKING insights, open UTM Builder modal
        if (insight.type === 'TRACKING') {
            setSelectedUtmInsight(insight);
            setUtmModalOpen(true);
            return;
        }

        // In a real implementation, this would call manage-meta-campaign to pause/scale
        toast({ title: 'Ação aplicada!', description: `${insight.details.automation_action}` });
        handleDismiss(id);
    };

    const handleUtmApplied = () => {
        if (selectedUtmInsight) {
            handleDismiss(selectedUtmInsight.id);
        }
        setSelectedUtmInsight(null);
        fetchAnomalies(); // Refresh to reflect changes
    };

    useEffect(() => {
        fetchAnomalies();
    }, [fetchAnomalies]);

    // Handle Deep Linking from Dashboard
    useEffect(() => {
        if (location.state?.focusInsightId && insights.length > 0) {
            const targetId = location.state.focusInsightId;
            setExpandedId(targetId);

            // Optional: Scroll to element if needed, but expanding is usually enough visibility
            setTimeout(() => {
                const element = document.getElementById(`insight-card-${targetId}`); // Assuming we add this ID to the card
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);

            // Clear state to prevent re-focusing on refresh (though React Router handles this mostly)
            window.history.replaceState({}, document.title);
        }
    }, [location.state, insights]);

    const toggleExpand = (id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    // ============================================
    // CALCULATED STATS
    // ============================================
    // Helper for Metric Colors
    const getMetricColor = (metric: string | undefined) => {
        if (!metric) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        const m = metric.toUpperCase();
        if (m === 'ROAS') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
        if (m === 'CPA') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
        if (m === 'CPL') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
        if (m === 'CTR') return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
        if (m === 'CPC') return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
        if (m === 'SPEND') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    };

    const averageROAS = metrics?.roas || 0;
    const averageCPA = metrics?.cpa || 0;

    // (Health score and color function removed - widget no longer used)

    // ============================================
    // RENDER
    // ============================================
    // Helper for Title Case
    const toTitleCase = (str: string | undefined) => {
        if (!str) return '';
        // Keep acronyms uppercase if short
        if (str.length <= 3 && str.toLowerCase() !== 'rio' && str.toLowerCase() !== 'low') return str.toUpperCase();
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    if (!selectedAccountId) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
                <div className="text-center">
                    <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">{t('insights.select_account', 'Select an Account')}</h2>
                    <p className="text-muted-foreground">{t('insights.select_account_desc', 'Choose an ad account to see personalized insights.')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-8 pt-2 px-4 md:pt-2 md:px-8 pb-8 min-h-screen bg-background">

            {/* HEADER SECTION */}
            {/* HEADER SECTION */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                    {/* Left Side: Title & Subtitle */}
                    <div className="space-y-2 max-w-2xl">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('insights.title', 'Insights & Optimizations')}</h1>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            <p className="text-muted-foreground">
                                {openInsights.length === 1 ? (
                                    <Trans i18nKey="insights.pending_recommendations_one">
                                        We found <span className="font-bold text-foreground">1 recommendation</span> pending affecting your performance score.
                                    </Trans>
                                ) : (
                                    <Trans i18nKey="insights.pending_recommendations" count={openInsights.length}>
                                        We found <span className="font-bold text-foreground">{openInsights.length} recommendations</span> pending affecting your performance score.
                                    </Trans>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Update Button + Settings & Tabs */}
                    <div className="flex flex-col lg:flex-row items-end lg:items-center gap-4">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="h-10 inline-flex">
                                <TabsTrigger value="open" className="font-semibold">
                                    {t('insights.tabs.open_count', { count: openInsights.length })}
                                </TabsTrigger>
                                <TabsTrigger value="ignored" className="font-semibold">
                                    {t('insights.tabs.ignored_count', { count: ignoredInsights.length })}
                                </TabsTrigger>
                                <TabsTrigger value="dismissed" className="font-semibold">
                                    {t('insights.tabs.archived_count', { count: dismissedInsights.length })}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsSettingsModalOpen(true)}
                                className="h-10 px-4 border-white/10 hover:bg-white/5"
                            >
                                <Settings2 className="w-3.5 h-3.5 mr-2" />
                                <span className="text-sm">{t('sidebar.settings', 'Settings')}</span>
                            </Button>

                            <Button
                                variant="outline"
                                onClick={fetchAnomalies}
                                disabled={isLoading}
                                className="h-10 px-4 border-white/10 hover:bg-white/5"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="text-sm">{t('insights.actions.refresh', 'Refresh')}</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>



            {/* FILTER PILLS - GROUPED */}
            <Tabs value={filterType} onValueChange={(val) => setFilterType(val as any)} className="w-full">
                <TabsList className="w-full justify-start h-auto flex-wrap gap-2 overflow-visible bg-transparent border-none shadow-none px-0">
                    {[
                        { id: 'ALL', label: t('insights.filters.all', 'All'), icon: Sparkles, count: openInsights.length },
                        { id: 'OPPORTUNITY', label: t('insights.filters.opportunity', 'Opportunities'), icon: Zap, count: opportunityInsights.length },
                        { id: 'RISK', label: t('insights.filters.risk', 'Risks'), icon: AlertTriangle, count: riskInsights.length },
                        { id: 'CAMPAIGNS', label: t('insights.filters.performance', 'Performance'), icon: Target, count: openInsights.filter(i => ['ROAS', 'CPA', 'CPL', 'SPEND'].includes(i.details.metric || '')).length },
                        { id: 'CREATIVE', label: t('insights.filters.creative', 'Creatives'), icon: ImageIcon, count: creativeInsights.length + openInsights.filter(i => i.type !== 'CREATIVE' && ['CTR', 'CPC', 'CPM', 'Frequency'].includes(i.details.metric || '')).length },
                        { id: 'COMMENT', label: t('insights.filters.comments', 'Comments'), icon: MessageSquare, count: commentInsights.length + openInsights.filter(i => i.type !== 'COMMENT' && (i.details.metric === 'Engagement' || i.details.metric === 'Sentiment')).length },
                        { id: 'TRACKING', label: t('insights.filters.tracking', 'Tracking'), icon: Activity, count: trackingInsights.length },
                    ].map(filter => {
                        return (
                            <TabsTrigger
                                key={filter.id}
                                value={filter.id}
                                className="flex gap-2 min-w-fit rounded-full px-4 h-9 shadow-sm"
                            >
                                <filter.icon className="w-3.5 h-3.5" />
                                <span>{filter.label}</span>
                                <span className={filterType === filter.id ? "opacity-100 font-bold" : "opacity-60"}>({filter.count})</span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </Tabs>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsContent value="open" className="space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredInsights.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-muted mt-4">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-foreground">{t('insights.empty.open', 'Everything Optimized! 🚀')}</h3>
                            <p className="max-w-md mx-auto">
                                {filterType === 'ALL'
                                    ? t('insights.empty.open_desc', 'No pending recommendations. Your account is running perfectly.')
                                    : t('insights.empty.filtered_desc', { type: t(`insights.filters.${filterType.toLowerCase()}`, filterType) })}
                            </p>
                        </div>
                    ) : (
                        filteredInsights.map((insight) => {
                            const isExpanded = expandedId === insight.id;
                            const isRisk = insight.type === 'RISK' || insight.type === 'STOP_LOSS' || insight.type === 'TRACKING';

                            // Define color scheme based on type
                            let colorClass = 'border-muted bg-card';
                            let iconColor = 'text-primary';

                            if (insight.type === 'RISK' || insight.type === 'STOP_LOSS' || insight.type === 'TRACKING') {
                                colorClass = 'border-border bg-muted/30 hover:bg-muted/50';
                                iconColor = 'text-red-500';
                            } else if (insight.type === 'OPPORTUNITY' || insight.type === 'SCALING') {
                                colorClass = 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10';
                                iconColor = 'text-green-500';
                            } else if (insight.type === 'CREATIVE') {
                                colorClass = 'border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10';
                                iconColor = 'text-purple-500';
                            } else if (insight.type === 'COMMENT') {
                                // Default for generic comments if any remain
                                colorClass = 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10';
                                iconColor = 'text-blue-500';
                            }

                            return (
                                <div key={insight.id} id={`insight-card-${insight.id}`} className={`rounded-lg border transition-all shadow-none ${colorClass} ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}>
                                    <div className="p-4 flex items-start justify-between cursor-pointer gap-6" onClick={() => toggleExpand(insight.id)}>
                                        {/* Left: Content */}
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div className={`p-3 rounded-md transition-colors bg-background/80 shadow-none border ${iconColor}`}>
                                                <insight.icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <Badge variant={isRisk ? 'destructive' : 'default'} className={`rounded-md text-xs ${!isRisk ? 'bg-green-600' : ''}`}>
                                                        {insight.type === 'OPPORTUNITY' && insight.details.metric === 'Engagement' ? t('insights.metrics.engagement', 'Engagement') : toTitleCase(insight.type)}
                                                    </Badge>
                                                    {insight.details.metric && (
                                                        <Badge variant="secondary" className={`text-xs rounded-md border-0 ${getMetricColor(insight.details.metric)}`}>
                                                            {insight.details.metric}
                                                        </Badge>
                                                    )}
                                                    {insight.analysisTimeframe && (
                                                        <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-800 rounded-md">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {toTitleCase(insight.analysisTimeframe)}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <h3 className="text-base font-semibold text-foreground truncate">{insight.title}</h3>
                                                <p className="text-sm text-muted-foreground truncate">
                                                    {insight.subtitle}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Right: Actions - Far right with visual separation */}
                                        <div className="flex items-center gap-2 shrink-0 ml-4 border-l pl-4 border-border/30">
                                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); handleIgnore(insight.id); }}>
                                                <EyeOff className="w-4 h-4 mr-1" />
                                                {t('insights.actions.ignore', 'Ignore')}
                                            </Button>
                                            <Button
                                                variant={isExpanded ? "secondary" : "outline"}
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(insight.id); }}
                                            >
                                                {isExpanded ? t('insights.actions.hide', 'Hide') : t('insights.actions.details', 'View details')}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* EXPANDED CONTENT - Rich Campaign Preview */}
                                    {isExpanded && (
                                        <div className="border-t border-border/50 animate-in slide-in-from-top-2 fade-in duration-200">
                                            <div className="p-5 bg-muted/30">
                                                {/* Campaign Preview Card - Full Interactive View */}
                                                {insight.entity_id && (
                                                    <CampaignPreviewCard
                                                        campaignId={insight.entity_id}
                                                        campaignName={insight.subtitle}
                                                        recommendedBudgetMultiplier={
                                                            // Parse budget recommendation from automation_action
                                                            // e.g., "Escalar Orçamento +20%" -> 1.20
                                                            insight.details.automation_action?.includes('+20%') ? 1.20 :
                                                                insight.details.automation_action?.includes('+30%') ? 1.30 :
                                                                    insight.details.automation_action?.includes('+10%') ? 1.10 :
                                                                        insight.details.automation_action?.includes('-20%') ? 0.80 :
                                                                            insight.type === 'OPPORTUNITY' || insight.type === 'SCALING' ? 1.20 :
                                                                                undefined
                                                        }
                                                        onBudgetApplied={(newBudget) => {
                                                            toast({
                                                                title: t('insights.toasts.budget_updated', 'Budget Updated!'),
                                                                description: t('insights.toasts.new_budget', { budget: newBudget.toFixed(2) })
                                                            });
                                                        }}
                                                    />
                                                )}

                                                {/* Comments Section for COMMENT type insights */}
                                                {insight.type === 'COMMENT' && (
                                                    <div className="mt-4">
                                                        <CommentsSection
                                                            adId={insight.details.ad_id}
                                                            postId={insight.details.post_id}
                                                            insightType={insight.type}
                                                            initialComments={insight.details.unanswered_comments || insight.details.comments}
                                                        />
                                                    </div>
                                                )}

                                                {/* Fallback: Static Metrics Grid when no campaign_id */}
                                                {!insight.entity_id && insight.type !== 'COMMENT' && (
                                                    <div className="bg-card border rounded-lg p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{t('insights.metrics.title', 'METRICS')}</span>
                                                            <Badge variant="outline" className="text-xs">
                                                                {insight.type === 'CREATIVE' ? t('insights.entity.creative', 'Creative') :
                                                                    t('insights.entity.campaign', 'Campaign')}
                                                            </Badge>
                                                        </div>
                                                        <h4 className="font-semibold text-foreground mb-4 truncate">{insight.subtitle}</h4>

                                                        {/* Metrics Grid */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {insight.details.current_value !== undefined && (
                                                                <div className="bg-muted/50 p-2.5 rounded-lg border">
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 block mb-1">{t('insights.metrics.current_value', 'VALOR ATUAL')}</span>
                                                                    <p className={`text-2xl font-black ${isRisk ? 'text-red-500' : 'text-green-500'}`}>
                                                                        {insight.details.metric === 'CPA' || insight.details.metric === 'SPEND'
                                                                            ? `R$ ${insight.details.current_value?.toFixed(2)}`
                                                                            : insight.details.metric === 'ROAS'
                                                                                ? `${insight.details.current_value?.toFixed(2)}x`
                                                                                : `${insight.details.current_value?.toFixed(1)}%`
                                                                        }
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {insight.details.average_value !== undefined && (
                                                                <div className="bg-muted/50 p-2.5 rounded-lg border">
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 block mb-1">{t('insights.metrics.average', 'MÉDIA')}</span>
                                                                    <p className="text-2xl font-black text-foreground">
                                                                        {insight.details.metric === 'CPA' || insight.details.metric === 'SPEND'
                                                                            ? `R$ ${insight.details.average_value?.toFixed(2)}`
                                                                            : insight.details.metric === 'ROAS'
                                                                                ? `${insight.details.average_value?.toFixed(2)}x`
                                                                                : `${insight.details.average_value?.toFixed(1)}%`
                                                                        }
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {insight.details.change_percent && (
                                                                <div className="bg-muted/50 p-2.5 rounded-lg border">
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 block mb-1">{t('insights.metrics.variance', 'VARIAÇÃO')}</span>
                                                                    <p className={`text-2xl font-black ${isRisk ? 'text-red-500' : 'text-green-500'}`}>
                                                                        {insight.details.change_percent > 0 ? '+' : ''}{insight.details.change_percent?.toFixed(1)}%
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </TabsContent>

                <TabsContent value="ignored" className="space-y-4">
                    {ignoredInsights.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            <Clock className="w-12 h-12 mx-auto mb-4 text-amber-500/50" />
                            <h3 className="text-lg font-semibold mb-2">{t('insights.empty.ignored', 'No ignored insights')}</h3>
                            <p className="text-sm">{t('insights.empty.ignored_desc', 'Ignored insights automatically reappear after 24 hours.')}</p>
                        </div>
                    ) : (
                        ignoredInsights.map((insight) => {
                            const timeRemaining = insight.ignoredAt
                                ? Math.max(0, Math.ceil((TWENTY_FOUR_HOURS - (now - insight.ignoredAt)) / (1000 * 60 * 60)))
                                : 0;

                            return (
                                <div key={insight.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Clock className="w-5 h-5 text-amber-500" />
                                        <div>
                                            <h3 className="text-sm font-medium text-foreground">{insight.title}</h3>
                                            <p className="text-xs text-muted-foreground">{insight.subtitle}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                                            {t('insights.reappears_in', { hours: timeRemaining })}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setInsights(prev => prev.map(i => i.id === insight.id ? { ...i, ignored: false, ignoredAt: undefined } : i))}
                                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-100/50"
                                        >
                                            {t('insights.actions.restore', 'Restore')}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </TabsContent>

                <TabsContent value="dismissed">
                    {dismissedInsights.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            {t('insights.empty.completed', 'No completed recommendations yet.')}
                        </div>
                    ) : (
                        dismissedInsights.map((insight) => (
                            <div key={insight.id} className="rounded-lg border border-border/50 bg-card/50 p-4 flex items-center justify-between opacity-60">
                                <div className="flex items-center gap-4">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <div>
                                        <h3 className="text-sm font-medium text-foreground line-through">{insight.title}</h3>
                                        <p className="text-xs text-muted-foreground">{insight.subtitle}</p>
                                    </div>
                                </div>
                                <Badge variant="secondary">{t('insights.status.completed', 'Completed')}</Badge>
                            </div>
                        ))
                    )}
                </TabsContent>
            </Tabs>

            {/* UTM Builder Modal */}
            <UTMBuilderModal
                isOpen={utmModalOpen}
                onClose={() => {
                    setUtmModalOpen(false);
                    setSelectedUtmInsight(null);
                }}
                adId={selectedUtmInsight?.details.ad_id || selectedUtmInsight?.ad_id || ''}
                adName={selectedUtmInsight?.details.ad_name || selectedUtmInsight?.ad_name || selectedUtmInsight?.subtitle || ''}
                campaignName={selectedUtmInsight?.details.campaign_name || ''}
                adsetName={selectedUtmInsight?.details.adset_name || ''}
                onApply={handleUtmApplied}
            />

            <AccountSettingsModal
                open={isSettingsModalOpen}
                onOpenChange={setIsSettingsModalOpen}
                accountId={selectedAccountId}
            />
        </div >
    );
};

export default InsightsPage;
