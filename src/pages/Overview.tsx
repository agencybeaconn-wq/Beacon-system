import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DollarSign, TrendingUp, TrendingDown, CalendarIcon, ChevronDown, Eye, Loader2, X, Send, Check, MousePointerClick, BarChart3, Percent, ArrowUpRight, ArrowDownRight, RefreshCw, Columns, Zap, Share2, Copy, ExternalLink, CheckCircle2, ShoppingCart, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import roboAiIcon from "@/assets/robo-ai.svg";
import { DateRange } from "react-day-picker";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import metaIcon from "@/assets/meta.svg";
import googleAdsIcon from "@/assets/google-ads.svg";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverviewMetrics, OverviewDateRange } from "@/hooks/useOverviewMetrics";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { ProfitCalendar } from "@/components/ProfitCalendar";
import BudgetPacingWidget from "@/components/BudgetPacingWidget";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAccountType } from "@/contexts/AccountTypeContext";
import { cn } from "@/lib/utils";
import { useInsights, Insight } from '@/hooks/useInsights';
import { useClientMetrics } from '@/hooks/useClientMetrics';
import { useCartPandaOrders } from '@/hooks/useCartPandaOrders';
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


interface OverviewProps {
  isPortalView?: boolean;
}

const Overview = ({ isPortalView = false }: OverviewProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Base metrics array (CartPanda will be added dynamically)
  const BASE_METRICS = useMemo(() => [
    { key: 'profit', label: t('overview.metrics.profit', 'Lucro Estimado'), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
    { key: 'roas', label: 'ROAS', icon: TrendingUp, color: 'text-yellow-500', bg: 'bg-yellow-500/10', ring: 'ring-yellow-500/20' },
    { key: 'revenue', label: t('overview.metrics.revenue', 'Conv. Value'), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
    { key: 'spend', label: t('overview.metrics.spend', 'Cost'), icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
    { key: 'conversions', label: t('overview.metrics.results', 'Conversions'), icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
    { key: 'impressions', label: t('overview.metrics.impressions', 'Impressions'), icon: Eye, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
    { key: 'clicks', label: t('overview.metrics.clicks', 'Clicks'), icon: MousePointerClick, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
    { key: 'cpc', label: t('overview.metrics.cpc', 'CPC'), icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
    { key: 'ctr', label: t('overview.metrics.ctr', 'CTR'), icon: Percent, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
    { key: 'cpa', label: t('overview.metrics.cpa', 'CPA'), icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
    { key: 'cpm', label: t('overview.metrics.cpm', 'CPM'), icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20' },
  ], [t]);

  const TOP_CAMPAIGNS_METRICS = useMemo(() => [
    { key: 'spend', label: t('campaigns.table.spend', 'Cost'), align: 'right' },
    { key: 'revenue', label: t('campaigns.table.conversion_value', 'Conv. Value'), align: 'right' },
    { key: 'roas', label: 'ROAS', align: 'right' },
    { key: 'cpa', label: 'CPA', align: 'right' },
    { key: 'cpl', label: t('campaigns.table.cpl', 'CPL'), align: 'right' },
    { key: 'impressions', label: t('campaigns.table.impressions', 'Impressions'), align: 'right' },
    { key: 'clicks', label: t('campaigns.table.clicks', 'Clicks'), align: 'right' },
  ], [t]);
  // Use global date filter from DashboardContext for consistency across all pages
  const { dateFilter, dateRange, setDateFilter, setDateRange, getDateRangeForAPI } = useDashboard();
  const [insight1Open, setInsight1Open] = useState(false);
  const [insight2Open, setInsight2Open] = useState(false);
  const [isInsightsDismissed, setIsInsightsDismissed] = useState(false);
  const [quickChatInput, setQuickChatInput] = useState("");

  // Usar Contexto Global Unificado
  const { selectedAccountId, selectedClientId: dashboardClientId, viewMode, clientData, refreshClients, linkedClientId } = useDashboard();
  const { isAgency } = useAccountType();

  // Se estiver no portal, forçar o linkedClientId
  const selectedClientId = isPortalView ? linkedClientId : dashboardClientId;

  // Hook para métricas de cliente em tempo real (quando um cliente é selecionado)
  const datePresetMap: Record<string, 'last_7d' | 'last_30d' | 'this_month' | 'today'> = {
    'today': 'today',
    '7d': 'last_7d',
    'month': 'this_month',
  };
  const apiDates = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);

  const { metrics: clientMetrics, isLoading: isClientMetricsLoading } = useClientMetrics({
    clientId: selectedClientId || null,
    datePreset: datePresetMap[dateFilter] || 'last_7d',
    startDate: apiDates.startDate,
    endDate: apiDates.endDate
  });

  // Top Campaigns State
  const [topCampaignsSort, setTopCampaignsSort] = useState<'roas' | 'spend' | 'revenue' | 'cpa'>('roas');
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(['spend', 'revenue', 'roas', 'cpa']);

  // Estado para as métricas selecionadas nos 4 cards
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['cartpanda_revenue', 'spend', 'cpc', 'roas']);

  // Share Dashboard State
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Hook agora usa o contexto internamente
  const { metrics: dbMetrics, isLoading: isMetricsLoading, lastSyncTime, chartsData, topCampaigns: topCampaignsData, refetch } = useOverviewMetrics(dateFilter, dateRange);

  // Profit Config State derived from DashboardContext
  const [profitSettings, setProfitSettings] = useState({
    gateway_percent: (clientData as any)?.profit_gateway_percent || 0,
    tax_percent: (clientData as any)?.profit_tax_percent || 0,
    fixed_costs: (clientData as any)?.profit_fixed_costs || 0
  });
  const [isProfitSettingsOpen, setIsProfitSettingsOpen] = useState(false);
  const [isSavingProfitSettings, setIsSavingProfitSettings] = useState(false);

  // Sync profitSettings with clientData when it changes
  useEffect(() => {
    if (clientData) {
      setProfitSettings({
        gateway_percent: (clientData as any).profit_gateway_percent || 0,
        tax_percent: (clientData as any).profit_tax_percent || 0,
        fixed_costs: (clientData as any).profit_fixed_costs || 0
      });
    }
  }, [clientData]);

  const handleSaveProfitSettings = async (settings: typeof profitSettings) => {
    if (!selectedClientId) return;
    setIsSavingProfitSettings(true);
    try {
      const { error } = await (supabase as any)
        .from('agency_clients')
        .update({
          profit_gateway_percent: settings.gateway_percent,
          profit_tax_percent: settings.tax_percent,
          profit_fixed_costs: settings.fixed_costs
        })
        .eq('id', selectedClientId);

      if (error) throw error;

      // Update local and global state
      setProfitSettings(settings);
      await refreshClients();

      setIsProfitSettingsOpen(false);
      toast.success(t('overview.profit_settings.success', 'Configurações salvas com sucesso'));
    } catch (err) {
      console.error("Error saving profit settings:", err);
      toast.error(t('overview.profit_settings.error', 'Erro ao salvar configurações'));
    } finally {
      setIsSavingProfitSettings(false);
    }
  };

  // Merge metrics: use real-time client metrics when a client is selected, otherwise use DB metrics
  const metrics = useMemo(() => {
    // If we have a client selected, we prioritize fetching from Meta API (clientMetrics)
    if (selectedClientId && clientMetrics) {
      // Fallback: Se as métricas em tempo real vierem zeradas mas temos dados no banco, priorizar banco
      // Isso evita o dashboard "zerado" enquanto o sync ainda não refletiu ou se houver erro na API
      if (clientMetrics.totalSpend === 0 && dbMetrics.spend > 0) {
        return dbMetrics;
      }

      return {
        spend: clientMetrics.totalSpend || 0,
        revenue: clientMetrics.totalConversionValue || 0,
        conversions: clientMetrics.totalConversions || 0,
        roas: clientMetrics.roas || 0,
        impressions: clientMetrics.totalImpressions || 0,
        clicks: clientMetrics.totalClicks || 0,
        cpc: clientMetrics.cpc || 0,
        ctr: clientMetrics.ctr || 0,
        cpa: clientMetrics.cpa || 0,
        cpm: clientMetrics.totalImpressions > 0 ? (clientMetrics.totalSpend / clientMetrics.totalImpressions) * 1000 : 0,
        reach: clientMetrics.totalReach || 0,
        addToCart: clientMetrics.totalAddToCart || 0,
        initiateCheckout: clientMetrics.totalInitiateCheckout || 0,
      };
    }
    return dbMetrics;
  }, [selectedClientId, clientMetrics, dbMetrics]);

  // Hook para Batalha de Criativos
  const { topCreatives, isLoading: isCreativesLoading } = useAnalyticsData('all', dateFilter === 'today' ? 'today' : dateFilter === '7d' ? '7d' : 'month', dateRange);

  // Hook para Pedidos Pagos da CartPanda (quando cliente selecionado)
  // Use global date range calculation from DashboardContext
  const cartPandaDateRange = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);

  // The hook now uses SelectedClientContext internally as fallback
  const { summary: cartPandaSummary, orders, isLoading: isCartPandaLoading, isConnected: isCartPandaConnected, refetch: refetchCartPanda } = useCartPandaOrders(cartPandaDateRange, selectedClientId || undefined);

  // Process and Sort Top Campaigns
  const topCampaigns = useMemo(() => {
    if (!topCampaignsData) return [];

    let sorted = [...topCampaignsData];

    // Sorting Logic
    sorted.sort((a, b) => {
      if (topCampaignsSort === 'cpa') {
        const aVal = a.cpa || Infinity;
        const bVal = b.cpa || Infinity;
        if (aVal === 0) return 1; if (bVal === 0) return -1;
        return aVal - bVal;
      }
      if (topCampaignsSort === 'spend') return (b.spend || 0) - (a.spend || 0);
      if (topCampaignsSort === 'revenue') return (b.revenue || 0) - (a.revenue || 0);
      return (b.roas || 0) - (a.roas || 0);
    });

    return sorted.slice(0, 5);
  }, [topCampaignsData, topCampaignsSort]);

  // AVAILABLE_METRICS with CartPanda (Always show Pedidos Pagos to allow testing)
  const AVAILABLE_METRICS = useMemo(() => {
    return [
      ...BASE_METRICS,
      { key: 'cartpanda_revenue', label: 'Pedidos Pagos', icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' }
    ];
  }, [BASE_METRICS]);

  // Combined metrics with CartPanda revenue and global ROAS calculation
  const combinedMetrics = useMemo(() => {
    const cpRevenue = cartPandaSummary?.totalRevenue || 0;
    const totalSpend = metrics.spend || 0;

    // Direct ROAS calculation: CartPanda Revenue (Real) / Ad Spend (Meta)
    const globalRoas = totalSpend > 0 ? cpRevenue / totalSpend : 0;

    // Actual Profit Formula: (Revenue * (1 - Gateway% - Tax%)) - AdSpend - FixedCosts
    const feeMultiplier = 1 - (profitSettings.gateway_percent / 100) - (profitSettings.tax_percent / 100);
    const netRevenue = cpRevenue * feeMultiplier;
    const actualProfit = netRevenue - totalSpend - profitSettings.fixed_costs;

    return {
      ...metrics,
      cartpanda_revenue: cpRevenue,
      // If we have CartPanda revenue, that's our ROAS source of truth for Overview
      roas: cpRevenue > 0 ? globalRoas : (metrics.roas || 0),
      profit: actualProfit,
    };
  }, [metrics, cartPandaSummary, profitSettings]);

  // ======= PERSIST CLIENT METRICS TO client_daily_metrics =======
  // When the Overview page successfully loads data for a client,
  // save it to the database so the Smart Data dashboard can read it.
  useEffect(() => {
    if (!selectedClientId) return;
    // Only persist if we have real data (at least some revenue or spend)
    const cpRevenue = cartPandaSummary?.totalRevenue || 0;
    const totalSpend = metrics.spend || 0;
    if (cpRevenue === 0 && totalSpend === 0) return;
    // Don't persist while still loading
    if (isCartPandaLoading || isClientMetricsLoading) return;

    const today = new Date().toISOString().split('T')[0];
    const cpOrders = cartPandaSummary?.totalOrders || 0;
    const cpAvgOrderValue = cartPandaSummary?.averageOrderValue || 0;

    const payload = {
      client_id: selectedClientId,
      date: today,
      // Meta Ads data
      spend: totalSpend,
      impressions: metrics.impressions || 0,
      clicks: metrics.clicks || 0,
      reach: (metrics as any).reach || 0,
      conversions: metrics.conversions || 0,
      conversion_value: metrics.revenue || 0,
      // Funnel data from Meta pixel
      add_to_cart: (metrics as any).addToCart || 0,
      checkouts_initiated: (metrics as any).initiateCheckout || 0,
      revenue: cpRevenue > 0 ? cpRevenue : (metrics.revenue || 0),
      // CartPanda data
      cartpanda_revenue: cpRevenue,
      cartpanda_orders: cpOrders,
      avg_order_value: cpAvgOrderValue,
      orders: cpOrders,
    };

    console.log('[Overview] Persisting client metrics to client_daily_metrics:', payload);

    (supabase as any)
      .from('client_daily_metrics')
      .upsert(payload, { onConflict: 'client_id,date' })
      .then(({ error }: any) => {
        if (error) {
          console.warn('[Overview] Failed to persist metrics:', error);
        } else {
          console.log('[Overview] ✅ Metrics persisted for', selectedClientId);
        }
      });
  }, [selectedClientId, cartPandaSummary, metrics, isCartPandaLoading, isClientMetricsLoading]);

  // Format large numbers
  const formatValue = (value: number, key: string) => {
    const locale = i18n.language.startsWith('pt') ? 'pt-BR' : 'en-US';
    if (['revenue', 'spend', 'cpc', 'cpa', 'cpm', 'cartpanda_revenue', 'profit'].includes(key)) {
      return value.toLocaleString(locale, {
        style: "currency",
        currency: i18n.language.startsWith('pt') ? "BRL" : "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (key === 'ctr') {
      return `${value.toFixed(2)}%`;
    }
    if (key === 'roas') {
      return `${value.toFixed(2)}x`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const displayedChartData = useMemo(() => {
    let data = [];

    // 🔥 DATA REAL: Mudar para Hourly se for "Today", senão Financial Daily
    if (dateFilter === 'today') {
      const baseHourly = chartsData.hourlyEvolution || [];

      // If we are in client view, we want the "simulated" hourly data to reflect REAL-TIME totals from CartPanda/Meta
      if (selectedClientId && (combinedMetrics.cartpanda_revenue > 0 || combinedMetrics.spend > 0)) {
        const totalCPRevenue = combinedMetrics.cartpanda_revenue;
        const totalSpend = combinedMetrics.spend || 0;

        // Distribution factor constant
        const hourlyDistribution = [
          0.5, 0.3, 0.2, 0.1, 0.1, 0.2, 0.5, 1.5, 3.5, 5.0,
          6.5, 7.0, 7.5, 7.0, 6.5, 6.0, 6.5, 7.5, 8.5, 9.0,
          8.0, 6.0, 4.0, 2.0
        ];

        const currentHour = new Date().getHours();
        data = hourlyDistribution.slice(0, currentHour + 1).map((percent, hour) => {
          const factor = percent / 100;
          const hSpend = totalSpend * factor;
          const hRevenue = totalCPRevenue * factor;
          const roasVariation = 0.8 + (Math.sin(hour / 3.5) * 0.4);

          const currentDayStr = new Date().toISOString().split('T')[0];
          return {
            date: `${String(hour).padStart(2, '0')}:00`,
            fullDate: currentDayStr,
            spend: hSpend,
            revenue: hRevenue,
            cartpanda_revenue: hRevenue,
            profit: hRevenue - hSpend,
            roas: (totalSpend > 0 ? (totalCPRevenue / totalSpend) : 0) * roasVariation,
          };
        });
      } else {
        data = baseHourly;
      }
    } else {
      // For Multi-day views (7d, month), aggregate all data by DAY to ensure a smooth, constant line.
      const rawBaseData = chartsData.financialEvolution || [];

      // 1. Group and sum metrics by day (fullDate)
      const dailyAggregated: Record<string, any> = {};

      rawBaseData.forEach(item => {
        const fullDate = (item as any).fullDate || item.date;
        if (!fullDate) return;

        // Use the YYYY-MM-DD part as the key
        const dateKey = fullDate.split(' ')[0].split('T')[0];

        if (!dailyAggregated[dateKey]) {
          dailyAggregated[dateKey] = {
            date: dateKey.split('-').slice(1).reverse().join('/'), // DD/MM
            fullDate: dateKey,
            spend: 0,
            revenue: 0,
            profit: 0,
            roas: 0
          };
        }

        dailyAggregated[dateKey].spend += (item.spend || 0);
        dailyAggregated[dateKey].revenue += (item.revenue || 0);
      });

      // 2. Incorporate CartPanda Revenue per day
      if (selectedClientId && orders && orders.length > 0) {
        orders.forEach(order => {
          const dateStr = order.createdAt.split(/T| /)[0];
          if (dailyAggregated[dateStr]) {
            dailyAggregated[dateStr].cartpanda_revenue = (dailyAggregated[dateStr].cartpanda_revenue || 0) + order.totalPrice;
          } else {
            // If date is not in Meta/Google data, create it
            dailyAggregated[dateStr] = {
              date: dateStr.split('-').slice(1).reverse().join('/'),
              fullDate: dateStr,
              spend: 0,
              revenue: 0,
              cartpanda_revenue: order.totalPrice,
              profit: order.totalPrice,
              roas: 0
            };
          }
        });
      }

      // 3. Final transform and sort
      data = Object.values(dailyAggregated)
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
        .map(day => {
          const cpRevenue = day.cartpanda_revenue || 0;
          const feeMultiplier = 1 - (profitSettings.gateway_percent / 100) - (profitSettings.tax_percent / 100);
          const netRevenue = cpRevenue * feeMultiplier;
          const actualProfit = netRevenue - day.spend - profitSettings.fixed_costs;

          return {
            ...day,
            profit: actualProfit,
            roas: day.spend > 0 ? (cpRevenue > 0 ? cpRevenue / day.spend : (day.revenue / day.spend)) : 0
          };
        });
    }

    return data;
  }, [chartsData.financialEvolution, chartsData.hourlyEvolution, dateFilter, selectedClientId, combinedMetrics, orders, profitSettings]);

  const handleDateFilterChange = (value: OverviewDateRange) => {
    setDateFilter(value as any);
    if (value !== "custom") {
      setDateRange(undefined);
    }
  };

  const handleCustomRange = (range: DateRange | undefined) => {
    setDateRange(range as any);
    if (range?.from && range?.to) {
      setDateFilter("custom" as any);
    }
  };

  const handleMetricChange = (index: number, newMetricKey: string) => {
    const newMetrics = [...selectedMetrics];
    newMetrics[index] = newMetricKey;
    setSelectedMetrics(newMetrics);
  };

  // Share Dashboard Functions
  const createShareLink = async () => {
    if (!selectedAccountId) {
      toast.error(t('overview.share.select_account', "Select an account to share first."));
      return;
    }

    setIsCreatingShare(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('common.auth_error', "User not authenticated"));

      // Get White Label settings from localStorage
      const agencyName = localStorage.getItem('lads_agency_name') || null;
      const agencyLogo = localStorage.getItem('lads_agency_logo') || null;

      // Check if share already exists for this account
      const { data: existing } = await supabase
        .from('shared_dashboards')
        .select('share_token')
        .eq('ad_account_id', selectedAccountId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle() as any;

      let token: string;

      if (existing) {
        token = (existing as any).share_token;
      } else {
        // Create new shared dashboard
        const { data: newShare, error } = await supabase
          .from('shared_dashboards')
          .insert({
            ad_account_id: selectedAccountId,
            user_id: user.id,
            agency_name: agencyName,
            agency_logo: agencyLogo,
          })
          .select('share_token')
          .single() as any;

        if (error) throw error;
        token = (newShare as any).share_token;
      }

      // Build the share URL - Always use production domain
      const prodDomain = import.meta.env.VITE_APP_URL || 'https://app.leverag.digital';
      const link = `${prodDomain}/portal/${token}`;
      setShareLink(link);
      toast.success(t('overview.share.success', "Share link created!"));

    } catch (err) {
      console.error('Erro ao criar link:', err);
      toast.error(t('overview.share.error', "Error creating share link"));
    } finally {
      setIsCreatingShare(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      toast.success(t('common.link_copied', "Link copied!"));
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      toast.error(t('common.error_copy_link', "Error copying link"));
    }
  };

  const handleQuickChatSubmit = () => {
    if (!quickChatInput.trim()) return;

    // Navegar para o chat com a mensagem pré-preenchida
    const encodedMessage = encodeURIComponent(quickChatInput.trim());
    navigate(`/chat?message=${encodedMessage}`);
  };

  const handleQuickChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickChatSubmit();
    }
  };

  // Bento Grid Card Style - Matte & Subtle - Updated to Squared Premium
  const bentoCardClass = "bg-card border border-border/50 transition-all duration-300 rounded-lg";

  // --- GERAÇÃO DE INSIGHTS REAIS (Agora Via Hook) ---
  const { insights: realInsights, isLoading: loadingInsights } = useInsights();

  // Filtrar e preparar apenas os mais importantes para o Dashboard
  const insights = useMemo(() => {
    // Pegar top 2 insights (Prioridade: Risco > Oportunidade)
    // O hook já ordena por impacto
    const topInsights = realInsights.slice(0, 2);

    return topInsights.map(insight => ({
      id: insight.id,
      type: insight.type === 'RISK' || insight.type === 'STOP_LOSS' ? 'warning' : 'success', // Mapear para tipos visuais do Dashboard
      title: <><span className={cn("font-semibold", insight.type === 'RISK' || insight.type === 'STOP_LOSS' ? "text-amber-500" : "text-emerald-500")}>{insight.type === 'RISK' ? t('overview.insights.risk', 'Risk:') : t('overview.insights.opportunity', 'Opportunity:')}</span> {insight.title}</>,
      description: insight.subtitle || insight.details.automation_action || t('overview.insights.see_details', "See details on the insights page."),
      action: {
        label: t('common.details', "See Details"),
        icon: ArrowUpRight,
        onClick: () => {
          // Navegar para Insights passando o ID via state para (futuramente) focar nele
          navigate('/insights', { state: { focusInsightId: insight.id } });
        }
      }
    }));
  }, [realInsights, navigate]);

  return (
    <div className={cn("flex-1 space-y-6 px-2 md:px-4 pb-8 w-full", isPortalView ? "pt-2" : "pt-8")}>
      {/* ... Header e Filtros ... */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Título e Status */}
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('overview.title', 'Overview')}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              {t('overview.subtitle', 'Track your campaign performance')}
            </p>
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground/70 font-normal">
                • {t('campaigns.labels.updated', 'Updated')} {formatDistanceToNow(lastSyncTime, { addSuffix: true, locale: i18n.language.startsWith('pt') ? ptBR : enUS })}
              </span>
            )}
            {isMetricsLoading && (
              <span className="text-xs text-muted-foreground/70 font-normal flex items-center gap-1">
                • <Loader2 className="h-2.5 w-2.5 animate-spin" /> {t('common.loading', 'Loading...')}
              </span>
            )}
          </div>
        </div>

        {/* Filtros de Data e Configurações */}
        <div className="flex flex-wrap items-center gap-2">
          {!isPortalView && (
            <div className="flex gap-2 mr-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsProfitSettingsOpen(true)}
                className="h-9 px-3 border-white/5 bg-secondary/30 hover:bg-white/5"
              >
                <Settings className="h-4 w-4 mr-2" />
                Lucro
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={createShareLink}
                className="h-9 px-3 border-white/5 bg-secondary/30 hover:bg-white/5"
                disabled={isCreatingShare || !selectedAccountId}
              >
                <Share2 className={cn("h-4 w-4 mr-2", isCreatingShare && "animate-spin")} />
                Compartilhar
              </Button>
            </div>
          )}

          <div className="flex gap-1 items-center bg-secondary/30 p-1 rounded-md border border-white/5">
            <Button
              variant={dateFilter === "today" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleDateFilterChange("today")}
              className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "today" && "font-semibold")}
            >
              {t('common.today', 'Today')}
            </Button>
            <Button
              variant={dateFilter === "7d" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleDateFilterChange("7d")}
              className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "7d" && "font-semibold")}
            >
              7d
            </Button>
            <Button
              variant={dateFilter === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleDateFilterChange("month")}
              className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "month" && "font-semibold")}
            >
              {t('common.month', 'Month')}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={dateFilter === "custom" ? "default" : "ghost"}
                  size="sm"
                  className={cn("rounded-sm h-7 px-2", dateFilter === "custom" && "font-semibold")}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleCustomRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>


          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch(false, true); // false = show loading, true = force sync
              refetchCartPanda();
            }}
            className="h-9 px-3 border-white/5 bg-secondary/30 hover:bg-white/5"
            disabled={isMetricsLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isMetricsLoading && "animate-spin")} />
            {t('common.refresh', 'Refresh')}
          </Button>

          {/* Share Dashboard Button (Agency Feature) */}
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* 2. Key Metrics Grid (Span 12 -> 4 cols) */}
        <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {selectedMetrics.map((metricKey, index) => {
            const metricConfig = AVAILABLE_METRICS.find(m => m.key === metricKey) || AVAILABLE_METRICS[0];
            const Icon = metricConfig.icon;
            const value = combinedMetrics[metricKey as keyof typeof combinedMetrics] || 0;

            return (
              <Card
                key={index}
                className={cn("p-6 flex flex-col justify-between h-36 relative overflow-hidden group", bentoCardClass)}
              >
                <div className="flex items-start justify-between relative z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent font-medium text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
                        <div className="flex items-center gap-1.5">
                          {metricConfig.label}
                          {metricKey === 'spend' && selectedClientId && isClientMetricsLoading && (
                            <span className="flex items-center gap-1 text-[10px] text-blue-500 font-normal animate-pulse bg-blue-500/5 px-1.5 py-0.5 rounded-full border border-blue-500/10">
                              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                              Sincronizando...
                            </span>
                          )}
                        </div>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {AVAILABLE_METRICS.map((m) => (
                        <DropdownMenuItem
                          key={m.key}
                          onClick={() => handleMetricChange(index, m.key)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <m.icon className={cn("h-4 w-4", m.color)} />
                          <span>{m.label}</span>
                          {m.key === metricKey && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className={cn("p-2.5 rounded-lg transition-colors", metricConfig.bg)}>
                    <Icon className={cn("h-5 w-5", metricConfig.color)} />
                  </div>
                </div>

                <div className="space-y-1 relative z-10">
                  {(metricKey === 'cartpanda_revenue' && isCartPandaLoading) ||
                    (metricKey !== 'cartpanda_revenue' && isClientMetricsLoading) ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {formatValue(value, metricKey)}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+12.3%</span>
                    <span className="text-muted-foreground font-normal ml-1">{t('overview.metrics.vs_previous', 'vs anterior')}</span>
                  </div>
                </div>

                {/* Subtle background gradient based on metric color */}
                <div className={cn("absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none", metricConfig.bg.replace('/10', '/30'))} />
              </Card>
            );
          })}
        </div>

        {/* 3. Main Performance Chart (Now more responsive height) */}
        <Card className={cn("md:col-span-12 lg:col-span-8 p-6 flex flex-col min-h-[400px] h-[420px]", bentoCardClass)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('overview.chart_title', 'Performance in Period')}</h3>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs bg-white/5 border-white/10 hover:bg-white/10">
              <BarChart3 className="h-3.5 w-3.5 mr-2" />
              {t('common.details', 'Details')}
            </Button>
          </div>

          <div className="flex-1 w-full min-h-0 border border-dashed border-border/40 rounded-lg relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayedChartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={true} horizontal={true} stroke="currentColor" strokeOpacity={0.15} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 400, opacity: 0.5 }}
                  dy={10}
                  minTickGap={dateFilter === 'today' ? 30 : 50}
                  interval={dateFilter === 'today' ? 'preserveStartEnd' : 'equidistantPreserveStart'}
                  tickFormatter={(value) => {
                    if (dateFilter === 'today') return value;
                    // Se o valor contiver horário (ex: 15/01 10:00), removemos o horário
                    if (typeof value === 'string' && value.includes(' ')) {
                      return value.split(' ')[0];
                    }
                    return value;
                  }}
                />

                {/* Eixos Y Dinâmicos */}
                {(() => {
                  const axesComponents = [];
                  const renderedAxes = new Set<string>();

                  // Helper para determinar ID do eixo
                  const getAxisId = (key: string) => ['revenue', 'spend', 'cartpanda_revenue', 'profit'].includes(key) ? 'shared_currency' : key;

                  selectedMetrics.forEach((metricKey, index) => {
                    const axisId = getAxisId(metricKey);

                    // Renderizar eixo apenas uma vez
                    if (!renderedAxes.has(axisId)) {
                      renderedAxes.add(axisId);

                      // Lógica de visualização:
                      // Se for moeda compartilhada, sempre à esquerda ou direita dependendo
                      // Simplificação: 
                      // - Se 'shared_currency' existir, ela pega Left.
                      // - O próximo eixo único pega Right.
                      // - Outros ficam hidden.

                      let orientation: 'left' | 'right' = 'left';
                      let hide = true;

                      const activeAxisIds = Array.from(new Set(selectedMetrics.map(getAxisId)));
                      const axisIndex = activeAxisIds.indexOf(axisId);

                      if (axisIndex === 0) {
                        orientation = 'left';
                        hide = false;
                      } else if (axisIndex === 1) {
                        orientation = 'right';
                        hide = false;
                      }

                      axesComponents.push(
                        <YAxis
                          key={axisId}
                          yAxisId={axisId}
                          orientation={orientation}
                          hide={hide}
                          axisLine={false}
                          tickLine={false}
                          tick={hide ? false : { fill: 'currentColor', fontSize: 10, opacity: 0.5 }}
                          width={hide ? 0 : 35}
                          domain={[0, 'auto']}
                          tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}
                        />
                      );
                    }
                  });
                  return axesComponents;
                })()}

                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(20, 20, 25, 0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    backdropFilter: 'blur(10px)'
                  }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => {
                    return [
                      value.toLocaleString(i18n.language.startsWith('pt') ? 'pt-BR' : 'en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        style: ['Valor Conversão', 'Custo', 'CPC', 'Revenue', 'Spend', 'Conv. Value', 'Cost', 'Pedidos Pagos', 'cartpanda_revenue'].includes(name) || name === 'revenue' || name === 'spend' || name === 'cartpanda_revenue' ? 'currency' : undefined,
                        currency: i18n.language.startsWith('pt') ? 'BRL' : 'USD'
                      }),
                      name
                    ];
                  }}
                />

                {selectedMetrics.map((metricKey) => {
                  const m = AVAILABLE_METRICS.find(m => m.key === metricKey);
                  const colorMap: Record<string, string> = {
                    'text-blue-500': '#3b82f6',
                    'text-emerald-500': '#10b981',
                    'text-rose-500': '#f43f5e',
                    'text-pink-500': '#ec4899',
                    'text-primary': '#e5e5e5',
                    'text-fuchsia-500': '#d946ef',
                    'text-red-400': '#f87171',
                    'text-rose-400': '#fb7185',
                    'text-stone-500': '#78716c',
                    'text-yellow-500': '#eab308',
                  };
                  const color = colorMap[m?.color || 'text-primary'] || '#8884d8';
                  const axisId = ['revenue', 'spend', 'cartpanda_revenue'].includes(metricKey) ? 'shared_currency' : metricKey;

                  return (
                    <Line
                      key={metricKey}
                      yAxisId={axisId}
                      type="monotone"
                      dataKey={metricKey}
                      stroke={color}
                      strokeWidth={3}
                      name={m?.label}
                      dot={false}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                    />
                  );
                })}

              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 4. Side Column (Span 12 -> 4 on Desktop) - Profit Calendar */}
        <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Profit Calendar - Replaces Estimated Profit */}
          <ProfitCalendar
            data={displayedChartData}
            totalProfit={combinedMetrics.profit}
            totalRevenue={combinedMetrics.cartpanda_revenue}
            totalSpend={combinedMetrics.spend}
            currentDateFilter={dateFilter}
            hourlyData={dateFilter === 'today' ? displayedChartData : undefined}
            onConfigClick={() => setIsProfitSettingsOpen(true)}
            className={cn("h-[420px]", bentoCardClass)}
          />
        </div>

        {/* 4.5. Budget Pacing Widget (Agency Only - Span 12) */}
        {isAgency && (
          <Card className={cn("md:col-span-12 p-0 overflow-hidden border-none", bentoCardClass)}>
            <BudgetPacingWidget
              accountId={selectedAccountId}
              currentSpend={metrics.spend}
              currency="BRL"
            />
          </Card>
        )}

        {/* 6. Melhores Criativos (Span 12) */}
        <Card className={cn("md:col-span-12 overflow-hidden", bentoCardClass)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground truncate">{t('overview.top_creatives', 'Top Creatives')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('overview.top_creatives_desc', 'Performance of the top performing ads')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs whitespace-nowrap">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {t('common.sort', 'Sort')}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-white whitespace-nowrap">
                {t('common.view_all', 'View all')} <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-4 border-r border-border w-[60px] text-center align-middle">#</TableHead>
                  <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border min-w-[250px] align-middle">{t('common.creative', 'Creative')}</TableHead>
                  <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border w-[180px] text-right align-middle">{t('campaigns.table.spend', 'Cost')}</TableHead>
                  <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border w-[180px] text-right align-middle">{t('campaigns.table.conversion_value', 'Conv. Value')}</TableHead>
                  <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border w-[120px] text-right align-middle">ROAS</TableHead>
                  <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[140px] text-right align-middle">CPA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isCreativesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="py-4 pl-4 border-r border-border text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                      <TableCell className="py-4 border-r border-border"><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="py-4 border-r border-border"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="py-4 border-r border-border"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="py-4 border-r border-border"><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : topCreatives.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      {t('common.no_data', 'No ads found in period')}
                    </TableCell>
                  </TableRow>
                ) : (
                  topCreatives.slice(0, 5).map((ad, index) => (
                    <TableRow key={ad.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                      <TableCell className="py-4 pl-4 border-r border-border text-center">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted border border-border text-[10px] font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors mx-auto">
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 border-r border-border">
                        <span className="font-medium text-sm text-foreground max-w-[250px] truncate block" title={ad.name}>
                          {ad.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 border-r border-border text-xs font-semibold text-right text-muted-foreground">
                        {ad.spend.toLocaleString(i18n.language.startsWith('pt') ? 'pt-BR' : 'en-US', { style: 'currency', currency: i18n.language.startsWith('pt') ? 'BRL' : 'USD', maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-4 border-r border-border text-xs font-semibold text-right text-muted-foreground align-middle">
                        {ad.revenue?.toLocaleString(i18n.language.startsWith('pt') ? 'pt-BR' : 'en-US', { style: 'currency', currency: i18n.language.startsWith('pt') ? 'BRL' : 'USD', maximumFractionDigits: 2 }) || (i18n.language.startsWith('pt') ? 'R$ 0,00' : '$0.00')}
                      </TableCell>
                      <TableCell className="py-4 border-r border-border text-right align-middle">
                        <span className={cn(
                          "text-xs font-bold",
                          ad.roas >= 2.0 ? "text-emerald-500" :
                            ad.roas >= 1.0 ? "text-primary" : "text-red-500"
                        )}>
                          {ad.roas.toFixed(2)}x
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-xs font-semibold text-right text-muted-foreground align-middle">
                        {ad.cpa.toLocaleString(i18n.language.startsWith('pt') ? 'pt-BR' : 'en-US', { style: 'currency', currency: i18n.language.startsWith('pt') ? 'BRL' : 'USD', maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Nenhum pedido encontrado
        </div>
      </div>



      {/* Modal de Configuração de Lucro */}
      <Dialog open={isProfitSettingsOpen} onOpenChange={setIsProfitSettingsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('overview.profit_settings.title', 'Configurar Lucro Estimado')}</DialogTitle>
            <DialogDescription>
              {t('overview.profit_settings.description', 'Defina as taxas e custos fixos para um cálculo de lucro mais preciso.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="gateway" className="text-sm font-medium">Gateway de Pagamento (%)</label>
              <div className="relative">
                <Input
                  id="gateway"
                  type="number"
                  step="0.01"
                  value={profitSettings.gateway_percent}
                  onChange={(e) => setProfitSettings({ ...profitSettings, gateway_percent: parseFloat(e.target.value) || 0 })}
                  className="pr-8"
                />
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="tax" className="text-sm font-medium">Impostos (%)</label>
              <div className="relative">
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  value={profitSettings.tax_percent}
                  onChange={(e) => setProfitSettings({ ...profitSettings, tax_percent: parseFloat(e.target.value) || 0 })}
                  className="pr-8"
                />
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="fixed_costs" className="text-sm font-medium">Custos Fixos Mensais (R$)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <span className="text-muted-foreground text-xs">R$</span>
                </div>
                <Input
                  id="fixed_costs"
                  type="number"
                  step="0.01"
                  value={profitSettings.fixed_costs}
                  onChange={(e) => setProfitSettings({ ...profitSettings, fixed_costs: parseFloat(e.target.value) || 0 })}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProfitSettingsOpen(false)}>Cancelar</Button>
            <Button onClick={() => handleSaveProfitSettings(profitSettings)} disabled={isSavingProfitSettings}>
              {isSavingProfitSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Overview;
