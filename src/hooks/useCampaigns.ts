import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDashboard } from '@/contexts/DashboardContext';

interface Campaign {
  id: string;
  name: string;
  status: string;
  effective_status?: string | null;
  objective?: string | null;
  daily_budget?: string | number | null;
  lifetime_budget?: string | number | null;
  buying_type?: string | null;
  start_time?: string | null;
  last_updated_at?: string | null;
  platform?: string | null;
  account_id: string;
  created_at?: string;
  updated_at?: string;
}

interface Insight {
  entity_id?: string; // Novo schema
  campaign_id?: string; // Schema antigo (para compatibilidade)
  entity_type?: string;
  date: string;
  spend: number | string;
  impressions: number;
  clicks: number;
  cpc?: string | null;
  cpm?: number | string | null;
  ctr?: number | string | null;
  reach: number;
  frequency?: number | string | null;
  conversions: number;
  conversion_value?: string;
  purchase_roas?: number | null;
  roas?: number | null; // Novo campo
  cpa?: number | string | null;
}

export interface CampaignWithInsights extends Campaign {
  insight?: Insight;
  currency?: string;
}

interface CampaignInsights {
  spend: string;
  impressions: string;
  clicks: string;
  conversions?: string;
  cpa?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<CampaignWithInsights[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { toast } = useToast();

  // Usar o contexto global
  const { selectedAccountId, selectedClientId, viewMode } = useDashboard();

  // 🔥 SWR: Buscar campanhas com insights do DB (SEM blocking)
  const loadCampaignsFromDB = useCallback(async (silent = false): Promise<CampaignWithInsights[] | null> => {
    if (!silent) setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn("⚠️ [useCampaigns] Usuário não autenticado. Mantendo dados anteriores.");
        return null; // Retorna null para preservar dados anteriores se houver
      }

      let accountIdsToFetch: string[] = [];
      let currency = 'BRL'; // Default

      // LÓGICA DE SELEÇÃO (FOLDER vs ACCOUNT)
      if (viewMode === 'account' && selectedAccountId) {
        // Modo Conta Única
        accountIdsToFetch = [selectedAccountId];

        // Buscar currency da conta
        const { data: account } = await supabase
          .from('ad_accounts')
          .select('currency')
          .eq('id', selectedAccountId)
          .maybeSingle();

        if (account) currency = account.currency || 'BRL';

      } else if (viewMode === 'client' && selectedClientId) {
        // Modo Pasta (Cliente) - Buscar todas as contas do cliente
        const { data: clientAccounts } = await supabase
          .from('client_ad_accounts')
          .select('ad_account_id')
          .eq('client_id', selectedClientId);

        if (clientAccounts && clientAccounts.length > 0) {
          accountIdsToFetch = clientAccounts.map(ca => ca.ad_account_id);
        }
      } else {
        // Fallback: Se nada selecionado, buscar primeira conta ativa (comportamento legado)
        const { data: account } = await supabase
          .from('ad_accounts')
          .select('id, currency')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .limit(1)
          .maybeSingle();

        if (account) {
          accountIdsToFetch = [account.id];
          currency = account.currency || 'BRL';
        }
      }

      if (accountIdsToFetch.length === 0) {
        // Se não temos contas pra buscar, mas estamos carregando contexto, talvez melhor retornar null
        // Mas se realmente não tem conta, é vazio. 
        // Assumindo que se loadCampaigns foi chamado, deveríamos ter contexto.
        if (selectedAccountId || selectedClientId) return [];
        return null; // Contexto ainda carregando?
      }

      // Buscar campanhas - FILTRAR POR LISTA DE account_ids
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .in('account_id', accountIdsToFetch)
        .order('last_updated_at', { ascending: false });

      if (campaignsError) {
        console.error('Erro ao buscar campanhas:', campaignsError);
        return null; // Erro no fetch -> manter anterior
      }

      /** ATENÇÃO: Retornar vazio é válido se a query foi sucesso mas não tem dados.
       * Mas para evitar o "sumiço" em refresh falho, poderiamos ser mais agressivos?
       * Por enquanto, confiamos que se não deu erro, é vazio mesmo.
       */
      if (!campaignsData || campaignsData.length === 0) {
        return [];
      }

      // Buscar insights mais recentes para cada campanha
      const campaignIds = campaignsData.map(c => c.id);

      // Buscar insights agrupados por entity_id (campaign_id), pegando o mais recente
      const { data: insightsData, error: insightsError } = await supabase
        .from('insights')
        .select('*')
        .in('entity_id', campaignIds)
        .eq('entity_type', 'CAMPAIGN')
        .order('date', { ascending: false });

      if (insightsError) {
        console.error('Erro ao buscar insights:', insightsError);
        // Não falha por causa de insights, apenas loga
      }

      // Criar mapa de insights por entity_id (campaign_id) - insight mais recente
      const insightsMap = new Map<string, Insight>();
      if (insightsData) {
        insightsData.forEach(insight => {
          const entityId = insight.entity_id || (insight as any).campaign_id; // Suporte para ambos os schemas
          if (entityId && !insightsMap.has(entityId)) {
            insightsMap.set(entityId, {
              ...insight,
              campaign_id: entityId, // Normalizar para campaign_id para compatibilidade
            } as Insight);
          }
        });
      }

      // Combinar campanhas com insights
      const campaignsWithInsights: CampaignWithInsights[] = campaignsData.map(campaign => ({
        ...campaign,
        insight: insightsMap.get(campaign.id),
        currency,
      }));

      return campaignsWithInsights;
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      return null; // Erro -> manter anterior
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [selectedAccountId, selectedClientId, viewMode]);

  // 🔥 SWR: Sincronização em background (não bloqueia UI)
  const syncCampaigns = useCallback(async (accountId?: string, accessToken?: string, silent = true) => {
    // Se não for silencioso, mostrar indicador
    if (!silent) setIsSyncing(true);
    try {
      // Se estiver em modo CLIENT, precisamos iterar sobre as contas (complexo para sync)
      // Por simplicidade, o sync manual foca na conta selecionada ou na primeira disponível

      let finalAccountId = accountId;
      let finalAccessToken = accessToken;

      if (!finalAccountId || !finalAccessToken) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        // Usar selectedAccountId se disponível
        let accountIdToUse = selectedAccountId;

        // Se estiver em modo CLIENT, tentar pegar a primeira conta do cliente para sync (melhoria futura: sync all)
        if (!accountIdToUse && viewMode === 'client' && selectedClientId) {
          const { data: clientAccounts } = await supabase
            .from('client_ad_accounts')
            .select('ad_account_id')
            .eq('client_id', selectedClientId)
            .limit(1)
            .maybeSingle();

          if (clientAccounts) accountIdToUse = clientAccounts.ad_account_id;
        }

        let account;
        let accountError;

        if (accountIdToUse) {
          // Buscar pela conta selecionada
          const result = await supabase
            .from('ad_accounts')
            .select('id, access_token')
            .eq('id', accountIdToUse)
            .eq('status', 'ACTIVE')
            .maybeSingle();

          account = result.data;
          accountError = result.error;
        } else {
          // Buscar a primeira conta ativa do usuário
          const result = await supabase
            .from('ad_accounts')
            .select('id, access_token')
            .eq('user_id', user.id)
            .eq('status', 'ACTIVE')
            .limit(1)
            .maybeSingle();

          account = result.data;
          accountError = result.error;
        }

        if (accountError || !account) {
          throw new Error('Conta de anúncios não encontrada para sincronização');
        }

        finalAccountId = account.id.replace('act_', ''); // Remove 'act_' prefix
        finalAccessToken = account.access_token;
      }

      // O supabase-js adiciona o Authorization header automaticamente
      // 🔥 ARQUITETURA DAY-BY-DAY: Não passa time_range nem datePreset
      // A Edge Function sempre usa date_preset='last_30d' com time_increment=1
      const body: any = {
        accountId: finalAccountId,
        accessToken: finalAccessToken,
      };

      console.log(`🔄 [SYNC] Sincronizando (Day-by-Day: last_30d com time_increment=1)`);

      // 🔧 FIX: Add timeout to prevent infinite loading (45 seconds)
      const TIMEOUT_MS = 45000;

      const syncPromise = supabase.functions.invoke('sync-meta-campaigns', {
        body,
      });

      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite de sincronização excedido (45s). A operação continuará em segundo plano.')), TIMEOUT_MS)
      );

      let data, error;
      try {
        const result = await Promise.race([syncPromise, timeoutPromise]);
        data = result.data;
        error = result.error;
      } catch (err: any) {
        // 🛑 Tratamento gracioso de Timeout
        if (err.message && err.message.includes && err.message.includes('Tempo limite')) {
          console.warn('⚠️ [SYNC] Client-side timeout (45s). Assumindo execução em background.');
          if (!silent) {
            toast({
              title: 'Sincronização em andamento',
              description: 'O processo está levando mais tempo que o normal, mas continua rodando em segundo plano.',
              duration: 5000
            });
          }
          // Não lançar erro, apenas parar de esperar
          return;
        }
        throw err;
      }

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Após sync, recarregar do banco silenciosamente
      const updatedCampaigns = await loadCampaignsFromDB(true);
      if (updatedCampaigns !== null) {
        setCampaigns(updatedCampaigns);
      }
      setLastSyncTime(new Date());

      // Mostrar toast apenas se não for silencioso
      if (!silent) {
        toast({
          title: "Sincronização concluída",
          description: `Campanhas: ${data?.stats?.campaigns || 0}, Conjuntos: ${data?.stats?.adsets || 0}, Anúncios: ${data?.stats?.ads || 0}`,
        });
      }

      return data;
    } catch (error) {
      console.error('Erro ao sincronizar campanhas:', error);
      // Toast apenas se não for silencioso
      if (!silent) {
        toast({
          title: "Erro ao sincronizar",
          description: error instanceof Error ? error.message : "Não foi possível sincronizar as campanhas.",
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, [loadCampaignsFromDB, toast, selectedAccountId, selectedClientId, viewMode]);

  // Listener para Auth State (Token Refresh / Wake up)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Quando o token é renovado (ex: volta de sleep) ou usuário loga
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        console.log(`🔄 [AUTH] Evento ${event} detectado. Recarregando campanhas...`);
        const refreshedData = await loadCampaignsFromDB(true);
        if (refreshedData !== null) {
          setCampaigns(refreshedData);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadCampaignsFromDB]);

  // 🔥 SWR: Carregar dados do DB primeiro (sem sync automático para evitar travamentos)
  useEffect(() => {
    let isMounted = true;

    const loadFromDB = async () => {
      // CARREGAR DADOS DO DB IMEDIATAMENTE (sem esperar API)
      console.log('⚡ [SWR] Carregando dados do DB...');
      const dbCampaigns = await loadCampaignsFromDB(false);

      if (isMounted) {
        if (dbCampaigns !== null) {
          setCampaigns(dbCampaigns);
          console.log(`✅ [SWR] ${dbCampaigns.length} campanhas carregadas do DB`);
          // 🚫 REMOVIDO: Sync automático em background
          // O sync agora é 100% manual (botão "Sincronizar")
          // Isso evita travamentos de 45s na navegação
        } else {
          console.log('⚠️ [SWR] Falha ao carregar dados do DB (Auth/Erro). Mantendo estado atual.');
        }
      }
    };

    // Recarregar sempre que mudar a seleção ou modo
    loadFromDB();

    return () => {
      isMounted = false;
    };
  }, [selectedAccountId, selectedClientId, viewMode, loadCampaignsFromDB]);

  const fetchCampaigns = useCallback(async (accountId: string) => {
    // Esta função agora apenas dispara sync
    await syncCampaigns();
    return campaigns;
  }, [syncCampaigns, campaigns]);

  const fetchCampaignInsights = useCallback(async (campaignId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from('ad_accounts')
        .select('access_token')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .single();

      if (tokenError || !tokenData) {
        throw new Error('Token de acesso não encontrado');
      }

      // Buscar insights da campanha
      const response = await fetch(
        `https://graph.facebook.com/v24.0/${campaignId}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type,cpc,cpm,ctr&access_token=${tokenData.access_token}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao buscar insights');
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        return data.data[0] as CampaignInsights;
      }

      return null;
    } catch (error) {
      console.error('Error fetching campaign insights:', error);
      toast({
        title: "Erro ao buscar insights",
        description: error instanceof Error ? error.message : "Não foi possível carregar os insights.",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  return {
    campaigns,
    isLoading,
    isSyncing,
    lastSyncTime,
    fetchCampaigns,
    fetchCampaignInsights,
    syncCampaigns,
    loadCampaignsFromDB,
    setCampaigns,
  };
}
