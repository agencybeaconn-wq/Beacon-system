import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
    ChevronDown,
    ChevronRight,
    DollarSign,
    Eye,
    MousePointer,
    TrendingUp,
    TrendingDown,
    Pause,
    Play,
    ExternalLink,
    Loader2,
    Target,
    Layers,
    ImageIcon,
    Calendar,
    ShoppingCart,
    Percent,
    Edit3,
    Zap,
    Check,
    MoreHorizontal
} from 'lucide-react';
import metaIcon from '@/assets/meta.svg';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface CampaignMetrics {
    impressions?: number;
    clicks?: number;
    spend?: number;
    ctr?: number;
    cpc?: number;
    cpm?: number;
    roas?: number;
    conversions?: number;
    cpa?: number;
}

interface AdSet {
    id: string;
    name: string;
    status: string;
    daily_budget?: string;
    targeting?: any;
    insights?: CampaignMetrics;
}

interface Ad {
    id: string;
    name: string;
    status: string;
    creative?: any;
    insights?: CampaignMetrics;
}

interface CampaignData {
    id: string;
    name: string;
    status: string;
    objective?: string;
    daily_budget?: string;
    lifetime_budget?: string;
    insights?: CampaignMetrics;
}

interface CampaignPreviewCardProps {
    campaignId: string;
    campaignName?: string;
    onClose?: () => void;
    // Optional: pass data directly if already available
    initialData?: CampaignData;
    // Budget recommendation from insight (e.g., +20% = 1.20)
    recommendedBudgetMultiplier?: number;
    // Callback when budget change is applied
    onBudgetApplied?: (newBudget: number) => void;
}

const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toFixed(0);
};

const formatCurrency = (num?: number) => {
    if (num === undefined || num === null) return '-';
    return `R$ ${num.toFixed(2)}`;
};

const formatPercent = (num?: number) => {
    if (num === undefined || num === null) return '-';
    return `${num.toFixed(2)}%`;
};

export function CampaignPreviewCard({
    campaignId,
    campaignName,
    onClose,
    initialData,
    recommendedBudgetMultiplier,
    onBudgetApplied
}: CampaignPreviewCardProps) {
    const { selectedAccountId, selectedProfileId } = useDashboard();
    const { toast } = useToast();

    const [campaign, setCampaign] = useState<CampaignData | null>(initialData || null);
    const [adSets, setAdSets] = useState<AdSet[]>([]);
    const [ads, setAds] = useState<Ad[]>([]);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [isExpanded, setIsExpanded] = useState(true);
    const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [budgetValue, setBudgetValue] = useState<number>(0);
    const [isDraggingBudget, setIsDraggingBudget] = useState(false);
    const [hasPendingBudgetChange, setHasPendingBudgetChange] = useState(false);
    const [isApplyingBudget, setIsApplyingBudget] = useState(false);
    const [dateRange, setDateRange] = useState<string>('last_7d');

    const dateRangeOptions = [
        { value: 'today', label: 'Hoje' },
        { value: 'yesterday', label: 'Ontem' },
        { value: 'last_7d', label: 'Últimos 7 dias' },
        { value: 'last_14d', label: 'Últimos 14 dias' },
        { value: 'last_30d', label: 'Últimos 30 dias' },
        { value: 'this_month', label: 'Este mês' },
    ];

    // Load campaign data on mount and when dateRange changes
    useEffect(() => {
        loadCampaignData();
    }, [campaignId, selectedAccountId, dateRange]);

    const loadCampaignData = async () => {
        if (!selectedAccountId || !campaignId) return;

        // Only show hard loading state if we don't have data yet
        if (!campaign) {
            setIsLoading(true);
        }
        try {
            console.log('[CampaignPreviewCard] Fetching campaign with ID:', campaignId);

            // Map dateRange to Meta API date_preset
            const datePresetMap: Record<string, string> = {
                'today': 'today',
                'yesterday': 'yesterday',
                'last_7d': 'last_7d',
                'last_14d': 'last_14d',
                'last_30d': 'last_30d',
                'this_month': 'this_month',
            };
            const metaDatePreset = datePresetMap[dateRange] || 'last_7d';

            // Fetch everything in parallel
            const [campaignRes, adSetsRes, adsRes] = await Promise.all([
                supabase.functions.invoke('fetch-meta-data', {
                    body: {
                        endpoint: 'campaign',
                        accountId: selectedAccountId,
                        params: {
                            campaignId: campaignId,
                            fields: 'id,name,status,objective,daily_budget,lifetime_budget,insights.date_preset(' + metaDatePreset + '){impressions,clicks,spend,ctr,cpc,cpm,actions,action_values,purchase_roas}'
                        }
                    }
                }),
                supabase.functions.invoke('fetch-meta-data', {
                    body: {
                        endpoint: 'campaign_adsets',
                        accountId: selectedAccountId,
                        params: {
                            campaignId: campaignId,
                            fields: 'id,name,status,daily_budget,targeting,insights{impressions,clicks,spend,ctr,cpc}'
                        }
                    }
                }),
                supabase.functions.invoke('fetch-meta-data', {
                    body: {
                        endpoint: 'campaign_ads',
                        accountId: selectedAccountId,
                        params: {
                            campaignId: campaignId,
                            fields: 'id,name,status,adset_id,creative{id,thumbnail_url,image_url},insights{impressions,clicks,spend,ctr,cpc}'
                        }
                    }
                })
            ]);

            if (campaignRes.error) throw campaignRes.error;

            const campaignData = campaignRes.data?.id ? campaignRes.data : (campaignRes.data?.data?.[0] || null);

            if (campaignData && campaignData.id) {
                const insights = campaignData.insights?.data?.[0] || {};
                const actions = insights.actions || [];
                const actionValues = insights.action_values || [];

                const purchaseAction = actions.find((a: any) =>
                    a.action_type === 'purchase' ||
                    a.action_type === 'omni_purchase' ||
                    a.action_type === 'offsite_conversion.fb_pixel_purchase'
                );
                const conversions = purchaseAction ? parseInt(purchaseAction.value) : undefined;

                const purchaseValue = actionValues.find((a: any) =>
                    a.action_type === 'purchase' ||
                    a.action_type === 'omni_purchase' ||
                    a.action_type === 'offsite_conversion.fb_pixel_purchase'
                );
                const revenue = purchaseValue ? parseFloat(purchaseValue.value) : undefined;

                const spend = insights.spend ? parseFloat(insights.spend) : undefined;
                const roas = spend && revenue && spend > 0 ? revenue / spend : (insights.purchase_roas?.[0]?.value ? parseFloat(insights.purchase_roas[0].value) : undefined);
                const cpa = spend && conversions && conversions > 0 ? spend / conversions : undefined;

                setCampaign({
                    id: campaignData.id,
                    name: campaignData.name,
                    status: campaignData.status,
                    objective: campaignData.objective,
                    daily_budget: campaignData.daily_budget,
                    lifetime_budget: campaignData.lifetime_budget,
                    insights: {
                        impressions: insights.impressions ? parseInt(insights.impressions) : undefined,
                        clicks: insights.clicks ? parseInt(insights.clicks) : undefined,
                        spend: spend,
                        ctr: insights.ctr ? parseFloat(insights.ctr) : undefined,
                        cpc: insights.cpc ? parseFloat(insights.cpc) : undefined,
                        cpm: insights.cpm ? parseFloat(insights.cpm) : undefined,
                        roas: roas,
                        cpa: cpa,
                        conversions: conversions,
                    }
                });

                // Set initial budget for CBO
                if (campaignData.daily_budget) {
                    setBudgetValue(parseFloat(campaignData.daily_budget) / 100);
                }
            } else {
                console.log('[CampaignPreviewCard] Campaign data not found:', campaignRes.data);
                setIsLoading(false);
                return;
            }

            // Process AdSets
            if (adSetsRes.data?.data) {
                const mappedAdSets = adSetsRes.data.data.map((adset: any) => {
                    const insights = adset.insights?.data?.[0] || {};
                    return {
                        id: adset.id,
                        name: adset.name,
                        status: adset.status,
                        daily_budget: adset.daily_budget,
                        targeting: adset.targeting,
                        insights: {
                            impressions: insights.impressions ? parseInt(insights.impressions) : undefined,
                            clicks: insights.clicks ? parseInt(insights.clicks) : undefined,
                            spend: insights.spend ? parseFloat(insights.spend) : undefined,
                            ctr: insights.ctr ? parseFloat(insights.ctr) : undefined,
                            cpc: insights.cpc ? parseFloat(insights.cpc) : undefined,
                        }
                    };
                });
                setAdSets(mappedAdSets);

                // Initialize budgetValue for ABO campaigns
                if (!campaignData.daily_budget) {
                    const totalAdSetBudget = mappedAdSets.reduce((sum: number, as: any) =>
                        sum + (parseFloat(as.daily_budget || '0') / 100), 0
                    );
                    setBudgetValue(totalAdSetBudget);
                }
            }

            // Process Ads
            if (adsRes.data?.data) {
                setAds(adsRes.data.data.map((ad: any) => {
                    const insights = ad.insights?.data?.[0] || {};
                    return {
                        id: ad.id,
                        name: ad.name,
                        status: ad.status,
                        adset_id: ad.adset_id,
                        creative: ad.creative,
                        insights: {
                            impressions: insights.impressions ? parseInt(insights.impressions) : undefined,
                            clicks: insights.clicks ? parseInt(insights.clicks) : undefined,
                            spend: insights.spend ? parseFloat(insights.spend) : undefined,
                            ctr: insights.ctr ? parseFloat(insights.ctr) : undefined,
                            cpc: insights.cpc ? parseFloat(insights.cpc) : undefined,
                        }
                    };
                }));
            }

        } catch (err: any) {
            console.error('[CampaignPreviewCard] Error loading data:', err);
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!campaign || !selectedAccountId) return;

        setIsTogglingStatus(true);
        try {
            const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

            const { error } = await supabase.functions.invoke('update-meta-entity', {
                body: {
                    entityType: 'campaign',
                    entityId: campaign.id,
                    accountId: selectedAccountId,
                    updates: { status: newStatus }
                }
            });

            if (error) throw error;

            setCampaign({ ...campaign, status: newStatus });
            toast({
                title: newStatus === 'ACTIVE' ? 'Campanha Ativada' : 'Campanha Pausada',
                description: campaign.name
            });
        } catch (err: any) {
            console.error('[CampaignPreviewCard] Error toggling status:', err);
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const handleBudgetChange = async (newBudget: number) => {
        if (!campaign || !selectedAccountId) return;

        try {
            const budgetInCents = Math.round(newBudget * 100);

            const { error } = await supabase.functions.invoke('update-meta-entity', {
                body: {
                    entityType: 'campaign',
                    entityId: campaign.id,
                    accountId: selectedAccountId,
                    updates: { daily_budget: budgetInCents }
                }
            });

            if (error) throw error;

            setCampaign({ ...campaign, daily_budget: budgetInCents.toString() });
            toast({
                title: 'Orçamento Atualizado',
                description: `Novo orçamento: R$ ${newBudget.toFixed(2)}`
            });
        } catch (err: any) {
            console.error('[CampaignPreviewCard] Error updating budget:', err);
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        }
    };

    const handleApplyBudget = async () => {
        if (!budgetValue) return;
        setIsApplyingBudget(true);

        try {
            if (isCBO) {
                const budgetInCents = Math.round(budgetValue * 100);
                await supabase.functions.invoke('update-meta-entity', {
                    body: {
                        entityType: 'campaign',
                        entityId: campaignId,
                        accountId: selectedAccountId,
                        updates: { daily_budget: budgetInCents }
                    }
                });
            } else {
                // ABO: Proportional Distribution
                if (currentBudget > 0) {
                    const ratio = budgetValue / currentBudget;
                    await Promise.all(adSets.map(async (adset) => {
                        if (!adset.daily_budget) return;
                        const oldBudget = parseFloat(adset.daily_budget) / 100;
                        const newBudget = oldBudget * ratio;
                        const budgetInCents = Math.round(newBudget * 100);
                        await supabase.functions.invoke('update-meta-entity', {
                            body: {
                                entityType: 'adset',
                                entityId: adset.id,
                                accountId: selectedAccountId,
                                updates: { daily_budget: budgetInCents }
                            }
                        });
                    }));
                }
            }

            toast({ title: 'Orçamento Atualizado', description: `Novo orçamento: R$ ${budgetValue.toFixed(2)}` });

            // Optimistic Update
            if (isCBO && campaign) {
                setCampaign({ ...campaign, daily_budget: (budgetValue * 100).toString() });
            } else {
                loadCampaignData(); // Reload for ABO to get fresh values
            }

            setIsDraggingBudget(false); // Stop Editing
            setHasPendingBudgetChange(false);
            onBudgetApplied?.(budgetValue);

        } catch (error: any) {
            console.error('Error applying budget:', error);
            toast({ title: 'Erro', description: 'Falha ao aplicar orçamento.', variant: 'destructive' });
        } finally {
            setIsApplyingBudget(false);
        }
    };

    const toggleAdSetExpansion = (adSetId: string) => {
        const newExpanded = new Set(expandedAdSets);
        if (newExpanded.has(adSetId)) {
            newExpanded.delete(adSetId);
        } else {
            newExpanded.add(adSetId);
        }
        setExpandedAdSets(newExpanded);
    };

    if (isLoading) {
        return (
            <div className="bg-card border rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-5 w-48" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="bg-card border rounded-xl p-6 text-center text-muted-foreground">
                <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Campanha não disponível</p>
                <p className="text-xs mt-1">A campanha pode ter sido arquivada ou deletada</p>
            </div>
        );
    }

    const isActive = campaign.status === 'ACTIVE';
    const isCBO = !!campaign.daily_budget;
    const currentBudget = isCBO
        ? (parseFloat(campaign.daily_budget) / 100)
        : adSets.reduce((sum, adset) => sum + (parseFloat(adset.daily_budget || '0') / 100), 0);

    return (
        <div className="bg-card border rounded-xl overflow-hidden">
            {/* Campaign Header */}
            <div className="p-4 border-b border-border/50 bg-muted/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={metaIcon} className="w-5 h-5" alt="Meta" />
                        <div>
                            <h4 className="font-semibold text-foreground">{campaign.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant={isActive ? 'default' : 'secondary'} className={isActive ? 'bg-green-600' : ''}>
                                    {isActive ? 'Ativa' : 'Pausada'}
                                </Badge>
                                {campaign.objective && (
                                    <Badge variant="outline" className="text-xs">
                                        {campaign.objective.replace('OUTCOME_', '')}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Toggle Status */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{isActive ? 'Ativa' : 'Pausada'}</span>
                            <Switch
                                checked={isActive}
                                onCheckedChange={handleToggleStatus}
                                disabled={isTogglingStatus}
                                className="data-[state=checked]:bg-green-600"
                            />
                        </div>
                        {/* Expand/Collapse */}
                        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Collapsible Content (Metrics + AdSets) */}
            {isExpanded && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Date Filter + Metrics Row */}
                    <div className="mt-4 px-4 pb-4 border-b border-border/30">
                        {/* Date Filter */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground">Período das Métricas</span>
                            <Select value={dateRange} onValueChange={setDateRange}>
                                <SelectTrigger className="w-[150px] h-8 text-xs">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {dateRangeOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {/* Orçamento - Dynamic value */}
                            {/* Orçamento - Editable */}
                            <div className={`p-3 rounded-lg border transition-colors ${hasPendingBudgetChange ? 'bg-green-500/10 border-green-500/40' : 'bg-background/60'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                        <DollarSign className="w-3 h-3" />
                                        Orçamento
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1 text-muted-foreground hover:text-primary" onClick={() => {
                                        if (!isDraggingBudget) {
                                            // Start Editing
                                            setBudgetValue(currentBudget);
                                            setIsDraggingBudget(true);
                                        } else {
                                            setIsDraggingBudget(false);
                                        }
                                    }}>
                                        <Edit3 className="w-3 h-3" />
                                    </Button>
                                </div>

                                {isDraggingBudget ? (
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-transparent border-b border-primary focus:outline-none font-bold text-lg pl-6 p-0 h-7"
                                                value={budgetValue}
                                                onChange={(e) => setBudgetValue(parseFloat(e.target.value))}
                                                onKeyDown={(e) => e.key === 'Enter' && handleApplyBudget()}
                                                autoFocus
                                            />
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-500/10" onClick={handleApplyBudget} disabled={isApplyingBudget}>
                                            {isApplyingBudget ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                ) : (
                                    <p className={`text-lg font-bold ${hasPendingBudgetChange ? 'text-green-600' : ''}`}>
                                        R$ {currentBudget.toFixed(2)}
                                    </p>
                                )}
                                {/* Simple Variation Display for ABO/CBO if needed, mostly handled by diff */}
                            </div>
                            {/* Gasto */}
                            <div className="bg-background/60 p-3 rounded-lg border">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <TrendingDown className="w-3 h-3" />
                                    Gasto
                                </div>
                                <p className="text-lg font-bold">{formatCurrency(campaign.insights?.spend)}</p>
                            </div>
                            {/* ROAS */}
                            <div className="bg-background/60 p-3 rounded-lg border">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <TrendingUp className="w-3 h-3 text-green-500" />
                                    ROAS
                                </div>
                                <p className="text-lg font-bold text-green-600">{campaign.insights?.roas ? `${campaign.insights.roas.toFixed(2)}x` : '-'}</p>
                            </div>
                            {/* CPA */}
                            <div className="bg-background/60 p-3 rounded-lg border">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <Percent className="w-3 h-3" />
                                    CPA
                                </div>
                                <p className="text-lg font-bold">{formatCurrency(campaign.insights?.cpa)}</p>
                            </div>
                            {/* Conversões + Receita */}
                            <div className="bg-background/60 p-3 rounded-lg border">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <ShoppingCart className="w-3 h-3 text-blue-500" />
                                    Conversões
                                </div>
                                <p className="text-lg font-bold">{formatNumber(campaign.insights?.conversions)}</p>
                                {campaign.insights?.roas && campaign.insights?.spend && (
                                    <p className="text-xs text-green-600 font-medium">
                                        R$ {(campaign.insights.roas * campaign.insights.spend).toFixed(2)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AdSets & Ads Hierarchy */}
                    <div className="divide-y divide-border/30">
                        {adSets.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhum conjunto de anúncios encontrado</p>
                            </div>
                        ) : (
                            adSets.map(adSet => {
                                const adSetAds = ads.filter(ad => (ad as any).adset_id === adSet.id);
                                const isAdSetExpanded = expandedAdSets.has(adSet.id);
                                const isAdSetActive = adSet.status === 'ACTIVE';

                                return (
                                    <div key={adSet.id}>
                                        {/* AdSet Row */}
                                        <div
                                            className="pl-6 pr-4 py-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer transition-colors"
                                            onClick={() => toggleAdSetExpansion(adSet.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                                    {isAdSetExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </Button>
                                                <div className="flex items-center gap-2">
                                                    <Layers className="w-4 h-4 text-blue-500" />
                                                    <span className="font-medium">{adSet.name}</span>
                                                    <Badge variant={isAdSetActive ? 'default' : 'secondary'} className={`text-xs ${isAdSetActive ? 'bg-green-600' : ''}`}>
                                                        {isAdSetActive ? 'Ativo' : 'Pausado'}
                                                    </Badge>
                                                    {!campaign.daily_budget && adSet.daily_budget && (
                                                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-600 bg-green-500/5">
                                                            {formatCurrency(parseFloat(adSet.daily_budget) / 100)}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground">({adSetAds.length} anúncios)</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span>Imp: {formatNumber(adSet.insights?.impressions)}</span>
                                                <span>Cliques: {formatNumber(adSet.insights?.clicks)}</span>
                                                <span>Gasto: {formatCurrency(adSet.insights?.spend)}</span>
                                            </div>
                                        </div>

                                        {/* Ads under this AdSet */}
                                        {isAdSetExpanded && (
                                            <div className="bg-muted/20">
                                                {adSetAds.length === 0 ? (
                                                    <div className="pl-16 pr-4 py-3 text-sm text-muted-foreground">
                                                        Nenhum anúncio neste conjunto
                                                    </div>
                                                ) : (
                                                    adSetAds.map(ad => {
                                                        const isAdActive = ad.status === 'ACTIVE';
                                                        const thumbnailUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;

                                                        return (
                                                            <div
                                                                key={ad.id}
                                                                className="pl-14 pr-4 py-2 flex items-center justify-between hover:bg-muted/40 transition-colors border-t border-border/20"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    {thumbnailUrl ? (
                                                                        <img src={thumbnailUrl} className="w-8 h-8 rounded object-cover" alt="" />
                                                                    ) : (
                                                                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                                                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                                                        </div>
                                                                    )}
                                                                    <span className="text-sm">{ad.name}</span>
                                                                    <Badge variant={isAdActive ? 'default' : 'secondary'} className={`text-xs ${isAdActive ? 'bg-green-600' : ''}`}>
                                                                        {isAdActive ? 'Ativo' : 'Pausado'}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                                        <span>Gasto: {formatCurrency(ad.insights?.spend)}</span>
                                                                        <span>Cliques: {formatNumber(ad.insights?.clicks)}</span>
                                                                        <span>CTR: {formatPercent(ad.insights?.ctr)}</span>
                                                                    </div>
                                                                    {/* Edit Ad Button */}
                                                                    <a
                                                                        href={`https://facebook.com/ads/manager/account/ads/edit?act=${selectedAccountId?.replace('act_', '')}&ids=${ad.id}`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="hover:text-primary transition-colors"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </a>
                                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-background/80" onClick={() => {
                                                                        // Open edit modal or logic
                                                                    }}>
                                                                        <MoreHorizontal className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Slider Removed */}

            {/* Footer with Link to Campaigns Page */}
            <div className="p-3 border-t border-border/50 bg-muted/20 flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => window.location.href = `/campaigns?campaign=${campaignId}`}
                >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Abrir no Editor Completo
                </Button>
            </div>
        </div>
    );
}
