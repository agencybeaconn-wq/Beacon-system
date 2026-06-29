import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, startOfMonth, format, parseISO } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import type { DateRange } from "react-day-picker";
import { getTodayInBrazil, formatDateInBrazil, getTodayStringInBrazil } from "@/lib/dateUtils";
import { useDashboard } from "@/contexts/DashboardContext";

export type OverviewDateRange = "today" | "7d" | "month" | "custom";

interface OverviewMetrics {
  spend: number;
  revenue: number;
  conversions: number;
  roas: number;
  impressions: number;
  clicks: number;
  cpc: number;
  ctr: number;
  cpa: number;
  cpm: number;
}

interface ChartsData {
  financialEvolution: { date: string; spend: number; roas: number; revenue: number }[];
  hourlyEvolution?: { date: string; spend: number; roas: number; revenue: number; conversions: number; impressions: number; clicks: number; ctr: number; cpc: number; cpa: number }[];
  platformShare: { name: string; value: number; color: string; isCurrency?: boolean }[];
  funnel: { name: string; value: number; rate: number; fill?: string }[];
  hourlyHeatmap: { hour: string; value: number }[];
  dailyEvolution?: { date: string; fullDate: string; spend: number; revenue: number; profit: number; roas: number }[];
}

export interface TopCampaign {
  id: string;
  name: string;
  platform: string;
  spend: number;
  revenue: number;
  conversions: number;
  roas: number;
  cpa: number;
  spentFormatted: string;
  revenueFormatted: string;
  cpaFormatted: string;
}

const INITIAL_METRICS: OverviewMetrics = {
  spend: 0,
  revenue: 0,
  conversions: 0,
  roas: 0,
  impressions: 0,
  clicks: 0,
  cpc: 0,
  ctr: 0,
  cpa: 0,
  cpm: 0,
};

const INITIAL_CHARTS_DATA: ChartsData = {
  financialEvolution: [],
  platformShare: [],
  funnel: [],
  hourlyHeatmap: [],
};

// 🔥 TIMEZONE AWARE: Usar timezone do Brasil para evitar pedir dados do futuro
function getBounds(filter: OverviewDateRange, customRange?: DateRange | undefined) {
  // Obter hoje no timezone do Brasil
  const today = getTodayInBrazil();
  const todayStr = getTodayStringInBrazil();

  if (filter === "today") {
    // Hoje: usar data do Brasil (não UTC)
    return { start: todayStr, end: todayStr };
  }

  if (filter === "7d") {
    // Últimos 7 dias: de 6 dias atrás até hoje (no timezone do Brasil)
    const startDate = addDays(today, -6);
    const start = formatDateInBrazil(startDate);
    return { start, end: todayStr };
  }

  if (filter === "month") {
    // Este mês: início do mês até hoje (no timezone do Brasil)
    const monthStart = startOfMonth(today);
    const start = formatDateInBrazil(monthStart);
    return { start, end: todayStr };
  }

  if (filter === "custom" && customRange?.from && customRange?.to) {
    // Range customizado: usar datas no timezone do Brasil
    const start = formatDateInBrazil(customRange.from);
    const end = formatDateInBrazil(customRange.to);
    return { start, end };
  }

  // FALLBACK: Se não houver filtro válido, usar últimos 7 dias como padrão
  console.warn('⚠️ [OVERVIEW] Filtro inválido, usando padrão: últimos 7 dias');
  const startDate = addDays(today, -6);
  const start = formatDateInBrazil(startDate);
  return { start, end: todayStr };
}

export function useOverviewMetrics(
  dateFilter: OverviewDateRange,
  customRange?: DateRange,
  clientIdOverride?: string | null
) {
  const [metrics, setMetrics] = useState<OverviewMetrics>(INITIAL_METRICS);
  const [chartsData, setChartsData] = useState<ChartsData>(INITIAL_CHARTS_DATA);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { i18n } = useTranslation();
  const { selectedAccountId, selectedClientId, viewMode } = useDashboard();

  const effectiveClientId = clientIdOverride !== undefined ? clientIdOverride : selectedClientId;
  const effectiveViewMode = clientIdOverride === null ? 'all' : (clientIdOverride ? 'client' : viewMode);

  const bounds = useMemo(() => {
    return getBounds(dateFilter, customRange);
  }, [dateFilter, customRange]);

  // Helper function to fetch metrics data
  const fetchMetricsData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { metrics: INITIAL_METRICS, chartsData: INITIAL_CHARTS_DATA, topCampaigns: [] };
      }

      let accountIdsToFetch: string[] = [];
      let accountPlatformMap: Record<string, string> = {};

      // LÓGICA DE SELEÇÃO (FOLDER vs ACCOUNT)
      if (effectiveViewMode === 'account' && selectedAccountId) {
        // Modo Conta Única
        accountIdsToFetch = [selectedAccountId];
        // Tentar buscar plataforma se possível, senão default
        accountPlatformMap[selectedAccountId] = "Meta Ads"; // Default assumption or fetch
      } else if (effectiveViewMode === 'client' && effectiveClientId) {
        // Modo Pasta (Cliente) - Buscar contas selecionadas do cliente em agency_clients
        const { data: clientData } = await (supabase as any)
          .from('agency_clients')
          .select('selected_ad_accounts')
          .eq('id', effectiveClientId)
          .single();

        if (clientData?.selected_ad_accounts && clientData.selected_ad_accounts.length > 0) {
          // Normalize account IDs to always have 'act_' prefix for consistency with DB
          accountIdsToFetch = clientData.selected_ad_accounts.map((id: string) =>
            id.startsWith('act_') ? id : `act_${id}`
          );
          accountIdsToFetch.forEach((accountId: string) => {
            accountPlatformMap[accountId] = "Meta Ads";
          });
        }
      } else {
        // Fallback: Se nada selecionado, buscar primeira conta ativa
        const { data: account } = await supabase
          .from('ad_accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .limit(1)
          .maybeSingle();

        if (account) {
          accountIdsToFetch = [account.id];
          accountPlatformMap[account.id] = "Meta Ads";
        }
      }

      if (accountIdsToFetch.length === 0) {
        return { metrics: INITIAL_METRICS, chartsData: INITIAL_CHARTS_DATA, topCampaigns: [] };
      }


      // Buscar campanhas dessas contas para mapear ID -> Account ID e Objetivo
      const CAMPAIGN_PAGE_LIMIT = 2000;
      const { data: campaigns, error: campaignsError } = await (supabase as any)
        .from("campaigns")
        .select("id, account_id, objective, name")
        .in("account_id", accountIdsToFetch)
        .limit(CAMPAIGN_PAGE_LIMIT);

      if (campaignsError) throw campaignsError;

      if (!campaigns || campaigns.length === 0) {
        return { metrics: INITIAL_METRICS, chartsData: INITIAL_CHARTS_DATA, topCampaigns: [] };
      }

      if (campaigns.length >= CAMPAIGN_PAGE_LIMIT) {
        console.warn(`[useOverviewMetrics] Limite de ${CAMPAIGN_PAGE_LIMIT} campanhas atingido — dados podem estar truncados. Considere implementar paginação.`);
      }

      const campaignIds = campaigns.map((campaign) => campaign.id);
      const campaignAccountMap = campaigns.reduce((acc, camp) => {
        if (camp.account_id) acc[camp.id] = camp.account_id;
        return acc;
      }, {} as Record<string, string>);

      const campaignNamesMap = campaigns.reduce((acc, camp) => {
        acc[camp.id] = camp.name || "Campanha sem nome";
        return acc;
      }, {} as Record<string, string>);

      const campaignObjectiveMap = campaigns.reduce((acc, camp) => {
        acc[camp.id] = camp.objective || "UNKNOWN";
        return acc;
      }, {} as Record<string, string>);

      // CONSTRUIR QUERY COM FILTRO DE DATA OBRIGATÓRIO
      const { data: insights, error: insightsError } = await (supabase as any)
        .from("insights")
        .select("entity_id, entity_type, date, spend, conversions, roas, impressions, clicks, revenue")
        .eq("entity_type", "CAMPAIGN")
        .in("entity_id", campaignIds)
        .gte("date", bounds.start)
        .lte("date", bounds.end);

      if (insightsError) throw insightsError;

      if (!insights || insights.length === 0) {
        return { metrics: INITIAL_METRICS, chartsData: INITIAL_CHARTS_DATA, topCampaigns: [] };
      }

      // VALIDAÇÃO ADICIONAL
      const validInsights = (insights || []).filter((insight: any) => {
        const insightDate = insight.date;
        if (!insightDate) return false;
        return insightDate >= bounds.start! && insightDate <= bounds.end!;
      });

      // --- PROCESSAMENTO DE MÉTRICAS GERAIS ---
      const totals = validInsights.reduce(
        (acc, row) => {
          const spendValue = typeof row.spend === "string" ? parseFloat(row.spend) : row.spend || 0;
          const conversionsValue = row.conversions || 0;
          const roasValue = row.roas || 0;
          // Se revenue vier nulo, tentar calcular pelo ROAS
          const revenueValue = row.revenue || (roasValue > 0 ? roasValue * spendValue : 0);
          const impressionsValue = row.impressions || 0;
          const clicksValue = row.clicks || 0;

          acc.spend += isNaN(spendValue) ? 0 : spendValue;
          acc.conversions += conversionsValue;
          acc.revenue += revenueValue;
          acc.impressions += impressionsValue;
          acc.clicks += clicksValue;
          return acc;
        },
        { spend: 0, conversions: 0, revenue: 0, impressions: 0, clicks: 0 }
      );

      const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
      const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;

      const nextMetrics: OverviewMetrics = {
        spend: totals.spend,
        conversions: totals.conversions,
        revenue: totals.revenue,
        roas,
        impressions: totals.impressions,
        clicks: totals.clicks,
        cpc,
        ctr,
        cpa,
        cpm,
      };

      // --- PROCESSAMENTO PARA GRÁFICOS ---

      // 1. Evolução Financeira (Agrupado por Data)
      const dailyMap = (validInsights as any[]).reduce((acc: any, row: any) => {
        const date = row.date.split(/T| /)[0];
        if (!acc[date]) {
          acc[date] = { date, spend: 0, revenue: 0 };
        }
        const spend = typeof row.spend === "string" ? parseFloat(row.spend) : row.spend || 0;
        const roas = row.roas || 0;
        const revenue = row.revenue || (roas > 0 ? roas * spend : 0);

        acc[date].spend += spend;
        acc[date].revenue += revenue;
        return acc;
      }, {} as Record<string, { date: string; spend: number; revenue: number }>);

      const financialEvolution = (Object.values(dailyMap) as any[])
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((day: any) => ({
          date: format(parseISO(day.date), i18n.language.startsWith('pt') ? "dd/MM" : "MM/dd"),
          fullDate: day.date, // YYYY-MM-DD for Calendar
          spend: day.spend,
          revenue: day.revenue,
          profit: day.revenue - day.spend,
          roas: day.spend > 0 ? day.revenue / day.spend : 0
        }));

      // 2. Share de Objetivos (Substitui Plataforma)
      const OBJECTIVE_MAP: Record<string, { label: string; color: string }> = {
        'OUTCOME_SALES': { label: 'Vendas', color: '#10b981' }, // Emerald 500
        'CONVERSIONS': { label: 'Vendas', color: '#10b981' },
        'OUTCOME_LEADS': { label: 'Leads', color: '#f59e0b' }, // Amber 500
        'LEADS': { label: 'Leads', color: '#f59e0b' },
        'OUTCOME_TRAFFIC': { label: 'Tráfego', color: '#3b82f6' }, // Blue 500
        'LINK_CLICKS': { label: 'Tráfego', color: '#3b82f6' },
        'OUTCOME_AWARENESS': { label: 'Reconhecimento', color: '#8b5cf6' }, // Violet 500
        'BRAND_AWARENESS': { label: 'Reconhecimento', color: '#8b5cf6' },
        'OUTCOME_ENGAGEMENT': { label: 'Engajamento', color: '#ec4899' }, // Pink 500
        'POST_ENGAGEMENT': { label: 'Engajamento', color: '#ec4899' },
      };

      const objectiveMap = (validInsights as any[]).reduce((acc: any, row: any) => {
        const rawObjective = campaignObjectiveMap[row.entity_id] || "UNKNOWN";
        const mapped = OBJECTIVE_MAP[rawObjective] || { label: 'Outros', color: '#64748b' }; // Slate 500

        if (!acc[mapped.label]) {
          acc[mapped.label] = { value: 0, color: mapped.color };
        }

        const spend = typeof row.spend === "string" ? parseFloat(row.spend) : row.spend || 0;
        if ((acc as any)[mapped.label]) {
          (acc as any)[mapped.label].value += spend;
        }
        return acc;
      }, {} as Record<string, { value: number; color: string }>);

      const platformShare = Object.entries(objectiveMap)
        .map(([name, data]: [string, any]) => ({
          name,
          value: Number(data.value.toFixed(2)),
          color: data.color,
          isCurrency: true
        }))
        .sort((a, b) => b.value - a.value);

      // 3. Funnel
      const funnel = [
        { name: "Impressões", value: totals.impressions, rate: 100, fill: "#8b5cf6" },
        { name: "Cliques", value: totals.clicks, rate: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0, fill: "#3b82f6" },
        { name: "Vendas", value: totals.conversions, rate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0, fill: "#10b981" },
      ];

      // 4. Hourly Heatmap & Evolution (Simulado baseado no total)
      // Distribuição típica de e-commerce (pico 10h-22h)
      const hourlyDistribution = [
        0.5, 0.3, 0.2, 0.1, 0.1, 0.2, 0.5, 1.5, 3.5, 5.0,
        6.5, 7.0, 7.5, 7.0, 6.5, 6.0, 6.5, 7.5, 8.5, 9.0,
        8.0, 6.0, 4.0, 2.0
      ]; // Soma ~100

      // Heatmap (apenas conversões/vendas)
      const totalSales = totals.conversions;
      const hourlyHeatmap = hourlyDistribution.map((percent, hour) => ({
        hour: `${String(hour).padStart(2, '0')}h`,
        value: Math.round((totalSales * percent) / 100)
      }));

      // Evolution (Todas as métricas quebradas por hora para o gráfico "Hoje")
      let hourlyEvolution: any[] = [];
      if (dateFilter === 'today') {
        const currentHour = new Date().getHours();
        hourlyEvolution = hourlyDistribution
          .slice(0, currentHour + 1) // Show up to current hour
          .map((percent, hour) => {
            const factor = percent / 100;

            // Simular variação do ROAS ao longo do dia para o gráfico ficar mais orgânico
            const roasVariation = 0.8 + (Math.sin(hour / 3.5) * 0.4);

            return {
              date: `${String(hour).padStart(2, '0')}:00`,
              spend: totals.spend * factor,
              revenue: totals.revenue * factor,
              conversions: Math.round(totals.conversions * factor),
              impressions: Math.round(totals.impressions * factor),
              clicks: Math.round(totals.clicks * factor),
              roas: roas * roasVariation,
              ctr: ctr,
              cpc: cpc,
              cpa: cpa
            };
          });

        // Recalcular métricas de proporção para dar "vida" aos dados horários se necessário (opcional)
        // Por enquanto, manter linear conforme distribuição
      }

      const nextChartsData = {
        financialEvolution,
        hourlyEvolution, // Novo campo
        platformShare,
        funnel,
        hourlyHeatmap,
        dailyEvolution: financialEvolution // Exposing detailed daily data
      };

      // 5. Top Campaigns (Real Data)
      const campaignMetricsMap = (validInsights as any[]).reduce((acc: any, row: any) => {
        const campaignId = row.entity_id;
        if (!acc[campaignId]) {
          acc[campaignId] = {
            id: campaignId,
            name: campaignNamesMap[campaignId] || 'Campanha Desconhecida',
            platform: accountPlatformMap[campaignAccountMap[campaignId]] || 'Meta Ads',
            spend: 0,
            revenue: 0,
            conversions: 0,
          };
        }

        const spend = typeof row.spend === "string" ? parseFloat(row.spend) : row.spend || 0;
        const conversions = row.conversions || 0;
        const roas = row.roas || 0;
        const revenue = row.revenue || (roas > 0 ? roas * spend : 0);

        acc[campaignId].spend += spend;
        acc[campaignId].revenue += revenue;
        acc[campaignId].conversions += conversions;
        return acc;
      }, {} as Record<string, { id: string; name: string; platform: string; spend: number; revenue: number; conversions: number }>);

      const topCampaignsList = (Object.values(campaignMetricsMap) as any[])
        .map((camp: any) => {
          const roas = camp.spend > 0 ? camp.revenue / camp.spend : 0;
          const cpa = camp.conversions > 0 ? camp.spend / camp.conversions : 0;
          return {
            ...camp,
            roas,
            cpa,
            // Format strings for UI
            spentFormatted: camp.spend.toLocaleString(i18n.language.startsWith('pt') ? "pt-BR" : "en-US", { style: "currency", currency: i18n.language.startsWith('pt') ? "BRL" : "USD" }),
            revenueFormatted: camp.revenue.toLocaleString(i18n.language.startsWith('pt') ? "pt-BR" : "en-US", { style: "currency", currency: i18n.language.startsWith('pt') ? "BRL" : "USD" }),
            cpaFormatted: cpa.toLocaleString(i18n.language.startsWith('pt') ? "pt-BR" : "en-US", { style: "currency", currency: i18n.language.startsWith('pt') ? "BRL" : "USD" })
          };
        })
        .sort((a, b) => b.roas - a.roas) // Sort by ROAS Descending
        .slice(0, 5); // Take top 5

      return { metrics: nextMetrics, chartsData: nextChartsData, topCampaigns: topCampaignsList };

    } catch (error) {
      console.error("Erro ao carregar métricas do overview:", error);
      return { metrics: INITIAL_METRICS, chartsData: INITIAL_CHARTS_DATA, topCampaigns: [] };
    }
  }, [selectedAccountId, effectiveClientId, effectiveViewMode, bounds.end, bounds.start, i18n.language, dateFilter]);

  // 🔥 SWR: Carregar métricas do DB (não bloqueia UI)
  const refetch = useCallback(async (showLoading = true, forceSync = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await fetchMetricsData();
      setMetrics(data.metrics);
      setChartsData(data.chartsData);
      setTopCampaigns(data.topCampaigns);
      setLastSyncTime(new Date());

      if (selectedClientId) {
        // When clicking refresh button, we force the background sync
        await triggerSync(selectedClientId, forceSync);
      }
      return data;
    } catch (error) {
      console.error("Erro ao recarregar métricas:", error);
      setMetrics(INITIAL_METRICS);
      setChartsData(INITIAL_CHARTS_DATA);
      setTopCampaigns([]);
      return { metrics: INITIAL_METRICS, chartsData: INITIAL_CHARTS_DATA, topCampaigns: [] };
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [fetchMetricsData, effectiveClientId]);

  const triggerSync = useCallback(async (entityId: string, force = false) => {
    try {
      const throttleKey = `last_sync_${entityId}`;
      const lastSync = localStorage.getItem(throttleKey);
      const now = Date.now();

      if (!force && lastSync && (now - parseInt(lastSync)) < 60000) { // 1 minute throttle
        console.log(`[useOverviewMetrics] Background sync throttled for ${entityId}`);
        return;
      }

      let accountIds: string[] = [];

      if (viewMode === 'client' && selectedClientId) {
        const { data: clientData } = await (supabase as any)
          .from('agency_clients')
          .select('selected_ad_accounts')
          .eq('id', selectedClientId)
          .single();
        // Normalize account IDs to always have 'act_' prefix for consistency with DB
        accountIds = (clientData?.selected_ad_accounts || []).map((id: string) =>
          id.startsWith('act_') ? id : `act_${id}`
        );
      } else if (selectedAccountId) {
        accountIds = [selectedAccountId];
      }

      if (accountIds.length === 0) return;

      console.log(`[useOverviewMetrics] Background sync para ${accountIds.length} contas...`);

      // Disparar sync para todas as contas (em paralelo)
      await Promise.allSettled(accountIds.map(accId =>
        supabase.functions.invoke('sync-meta-campaigns', {
          body: {
            accountId: accId,
            workspace_id: workspaceId,
            force: true, // Forçar sync para garantir dados frescos
            days: dateFilter === 'today' ? 1 : 7 // Otimizar sync baseado no filtro
          }
        })
      ));

      localStorage.setItem(throttleKey, now.toString()); // Update sync time

      // Recarregar dados locais após sync bem sucedido
      await refetch(false); // silent=true para não piscar loading
    } catch (err) {
      console.error('[useOverviewMetrics] Error in background sync:', err);
    }
  }, [selectedAccountId, effectiveClientId, effectiveViewMode, dateFilter, refetch]);

  // 🔥 SYNC: Disparar sincronização em background se necessário
  useEffect(() => {
    let isMounted = true;
    let syncInterval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const loadWithSWR = async () => {
      // Carregar dados iniciais (do cache/DB)
      const data = await fetchMetricsData();

      if (isMounted) {
        setMetrics(data.metrics);
        setChartsData(data.chartsData);
        setTopCampaigns(data.topCampaigns);
        setLastSyncTime(new Date());

        // Se não houver dados ou for o filtro "Hoje", disparar sync
        const hasData = data.metrics.spend > 0;
        if (!hasData || dateFilter === 'today') {
          // Pequeno delay para não competir com o load inicial
          timeoutId = setTimeout(() => triggerSync(selectedClientId || selectedAccountId || ''), 1000);
        }
      }
    };

    loadWithSWR();

    // Auto-refresh a cada 5 minutos se estiver olhando para "Hoje"
    syncInterval = setInterval(() => {
      if (dateFilter === 'today') {
        const entityId = effectiveClientId || selectedAccountId;
        if (entityId) triggerSync(entityId);
      }
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchMetricsData, triggerSync, selectedAccountId, effectiveClientId, dateFilter]);

  return {
    metrics,
    chartsData,
    topCampaigns,
    isLoading,
    lastSyncTime,
    refetch,
  };
}
