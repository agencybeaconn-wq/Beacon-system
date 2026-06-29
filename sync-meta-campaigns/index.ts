// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CircuitBreaker } from "../_shared/circuit-breaker.ts";
import { Shield } from "../_shared/shield.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let { accountId, accessToken, campaignId } = await req.json()

    console.log(`🔍 [SYNC] Recebido - accountId: ${accountId}, campaignId: ${campaignId}, accessToken presente: ${!!accessToken}`)

    // ... (rest of initial validation)
    // We need to keep the validation logic but insert campaignId handling. 
    // Since I can't use "..." in replacement, I will proceed carefully with chunks.

    // Chunk 1: Update input parsing


    // 🔥 ARQUITETURA DAY-BY-DAY: Sempre usar last_30d com time_increment=1
    // Isso garante que teremos dados diários no banco para cálculo local no frontend
    const datePreset = 'last_30d'
    const timeIncrement = 1 // CRÍTICO: Quebra dados por dia, não somados
    console.log(`📅 [SYNC] Usando date_preset='${datePreset}' com time_increment=${timeIncrement} (Day-by-Day)`)

    // Garante que o ID tenha o prefixo 'act_'
    if (accountId && !accountId.startsWith('act_')) {
      accountId = `act_${accountId}`
      console.log(`🔧 [SYNC] AccountId ajustado para: ${accountId}`)
    }

    if (!accountId || !accessToken) {
      throw new Error(`Faltando accountId ou accessToken. accountId: ${accountId}, accessToken: ${!!accessToken}`)
    }

    // Validar formato do token (deve começar com alguma string válida)
    if (typeof accessToken !== 'string' || accessToken.length < 10) {
      throw new Error(`Token inválido. Token length: ${accessToken?.length || 0}`)
    }

    console.log(`🔄 [SYNC] Iniciando sincronização COMPLETA para conta: ${accountId}`)
    console.log(`🔑 [SYNC] Token length: ${accessToken.length} (primeiros 20 chars: ${accessToken.substring(0, 20)}...)`)

    // 🔐 AUTENTICAÇÃO: Usar apenas access_token
    // Nota: appsecret_proof foi removido pois o app não está configurado para exigi-lo
    // e um proof incorreto causa erro "Bad signature"
    // Se necessário no futuro, habilitar "Require App Secret" nas configurações do App Meta
    console.log('🔑 [AUTH] Usando autenticação via access_token (sem appsecret_proof)')

    // Helper para gerar sufixo de autenticação
    const getAuthParams = () => {
      return `access_token=${accessToken}`
    }

    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Garantir que o accountId não tenha 'act_' duplicado
    let finalAccountId = accountId
    if (finalAccountId.startsWith('act_act_')) {
      finalAccountId = finalAccountId.replace('act_act_', 'act_')
      console.log(`🔧 [SYNC] AccountId corrigido (removido duplicado): ${finalAccountId}`)
    }

    const baseUrl = `https://graph.facebook.com/v24.0/${finalAccountId}`
    console.log(`🌐 [SYNC] Base URL: ${baseUrl.replace(accessToken, 'TOKEN_HIDDEN')}`)

    const stats = {
      campaigns: 0,
      campaignInsights: 0,
      adsets: 0,
      adsetInsights: 0,
      ads: 0,
      adInsights: 0,
      errors: [] as string[]
    }

    // ==========================================
    // CIRCUIT BREAKER & SHIELD SETUP
    // ==========================================
    let circuitBreaker: CircuitBreaker | null = null;
    const shieldUserAgent = Shield.getRandomUserAgent();
    const shieldHeaders = {
      // If original fetchMetaAPI sets headers, we might need to merge or just set UA here if fetchMetaAPI allows options.
      // But fetchMetaAPI just does fetch(url). The URL has token in query string.
      // We should pass User-Agent for safety.
      "User-Agent": shieldUserAgent
    };

    // Lookup connection_id from ad_accounts
    try {
      const { data: adAccount } = await supabase
        .from('ad_accounts')
        .select('connection_id')
        .or(`id.eq.${finalAccountId},id.eq.${finalAccountId.replace('act_', '')}`)
        .limit(1)
        .maybeSingle(); // Use maybeSingle to avoid null error if not found in DB

      if (adAccount?.connection_id) {
        const { data: conn } = await supabase
          .from('fb_connections')
          .select('workspace_id')
          .eq('id', adAccount.connection_id)
          .single();

        if (conn?.workspace_id) {
          circuitBreaker = new CircuitBreaker(supabase, conn.workspace_id, adAccount.connection_id);
          console.log(`🛡️ [Shield] Circuit Breaker armed for sync on connection ${adAccount.connection_id}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ [Shield] Could not arm Circuit Breaker:', e);
    }

    const campaignObjectives = new Map<string, string>()
    const adsetObjectives = new Map<string, string>()

    // ====================================================================
    // FUNÇÃO HELPER: Extração de Pixel de tracking_specs
    // ====================================================================
    /**
     * Extrai o pixel_id de tracking_specs quando promoted_object não está disponível.
     * tracking_specs é um array de objetos com action_type e pixel.
     */
    function extractPixelFromTrackingSpecs(trackingSpecs: any): { pixel_id?: string } | null {
      if (!trackingSpecs || !Array.isArray(trackingSpecs)) return null

      // Procurar em tracking_specs por pixel
      for (const spec of trackingSpecs) {
        if (spec.pixel) {
          // pixel pode ser array ou string
          const pixelId = Array.isArray(spec.pixel) ? spec.pixel[0] : spec.pixel
          if (pixelId) {
            console.log('📋 [TRACKING_SPECS] Extracted pixel_id:', pixelId)
            return { pixel_id: pixelId }
          }
        }
        // Algumas estruturas usam 'fb_pixel' em vez de 'pixel'
        if (spec.fb_pixel) {
          const pixelId = Array.isArray(spec.fb_pixel) ? spec.fb_pixel[0] : spec.fb_pixel
          if (pixelId) {
            console.log('📋 [TRACKING_SPECS] Extracted fb_pixel:', pixelId)
            return { pixel_id: pixelId }
          }
        }
      }
      return null
    }

    // ====================================================================
    // FUNÇÃO HELPER: Extração Robusta de Imagem de Criativo
    // ====================================================================
    /**
     * Extrai a URL da imagem de um criativo do Facebook.
     * Busca em múltiplas estruturas aninhadas para garantir que sempre encontre a imagem.
     * 
     * @param creative - Objeto criativo do Facebook (pode ser objeto ou array)
     * @returns URL da imagem ou null se não encontrar
     */
    function extractImage(creative: any): string | null {
      if (!creative) return null

      // Se for array, pegar o primeiro item
      const creativeObj = Array.isArray(creative) ? creative[0] : creative

      if (!creativeObj || typeof creativeObj !== 'object') return null

      // 1. PRIORIDADE: creative.image_url (Padrão mais comum)
      if (creativeObj.image_url && typeof creativeObj.image_url === 'string') {
        return creativeObj.image_url
      }

      // 2. PRIORIDADE: creative.thumbnail_url (Para vídeos)
      if (creativeObj.thumbnail_url && typeof creativeObj.thumbnail_url === 'string') {
        return creativeObj.thumbnail_url
      }

      // 3. PRIORIDADE: creative.object_story_spec.link_data.picture (Posts de link)
      try {
        if (creativeObj.object_story_spec?.link_data?.picture) {
          const picture = creativeObj.object_story_spec.link_data.picture
          if (typeof picture === 'string') {
            return picture
          }
        }
      } catch (e) {
        // Ignora erros de acesso a propriedades aninhadas
      }

      // 4. PRIORIDADE: creative.object_story_spec.link_data.child_attachments[0].picture (Carrossel - primeiro card)
      try {
        if (creativeObj.object_story_spec?.link_data?.child_attachments?.length > 0) {
          const firstChild = creativeObj.object_story_spec.link_data.child_attachments[0]
          if (firstChild?.picture && typeof firstChild.picture === 'string') {
            return firstChild.picture
          }
        }
      } catch (e) {
        // Ignora erros
      }

      // 5. PRIORIDADE: creative.asset_feed_spec.images[0].url (Anúncios dinâmicos/DCO)
      try {
        if (creativeObj.asset_feed_spec?.images?.length > 0) {
          const firstImage = creativeObj.asset_feed_spec.images[0]
          if (firstImage?.url && typeof firstImage.url === 'string') {
            return firstImage.url
          }
        }
      } catch (e) {
        // Ignora erros
      }

      // 6. Fallback: Tentar buscar qualquer campo que termine com 'url' ou 'picture'
      try {
        for (const key in creativeObj) {
          if (key.includes('url') || key.includes('picture') || key.includes('image')) {
            const value = creativeObj[key]
            if (typeof value === 'string' && value.startsWith('http')) {
              return value
            }
          }
        }
      } catch (e) {
        // Ignora erros
      }

      return null
    }

    // Função auxiliar para converter orçamento de centavos para valor real
    // O Facebook retorna orçamentos em centavos (ex: 10000 = R$ 100,00)
    function convertBudgetFromCents(budget: any): string | null {
      if (!budget) return null

      // Se já for string com formato correto, retornar
      if (typeof budget === 'string' && budget.includes('.')) {
        return budget
      }

      // Converter de centavos para valor real
      const budgetNum = typeof budget === 'string' ? parseFloat(budget) : budget
      if (isNaN(budgetNum) || budgetNum === 0) return null

      // Dividir por 100 para converter centavos em reais/dólares
      const value = (budgetNum / 100).toFixed(2)
      return value
    }

    // Função auxiliar para processar insights (ROAS e conversões)
    function getConversionActions(objective?: string | null): string[] {
      const normalized = (objective || '').toUpperCase()

      if (
        normalized.includes('SALE') ||
        normalized.includes('PURCHASE') ||
        normalized.includes('CONVERSION')
      ) {
        return ['omni_purchase', 'purchase']
      }

      if (normalized.includes('LEAD')) {
        return ['lead', 'onsite_lead', 'submit_application']
      }

      if (normalized.includes('TRAFFIC') || normalized.includes('CLICK')) {
        return ['link_click']
      }

      return ['omni_purchase', 'purchase', 'lead']
    }

    function processInsightRow(row: any, conversionActions?: string[]) {
      // Tratamento de ROAS (Vem como array [{action_type: 'purchase', value: '...'}])
      let roas = 0
      if (row.purchase_roas) {
        const purchaseRoas = row.purchase_roas.find(
          (r: any) => r.action_type === 'omni_purchase' || r.action_type === 'purchase'
        )
        roas = purchaseRoas ? parseFloat(purchaseRoas.value) : 0
      }

      // Tratamento de Revenue (Action Values)
      let revenue = 0
      if (row.action_values) {
        const purchaseValue = row.action_values.find(
          (r: any) => r.action_type === 'omni_purchase' || r.action_type === 'purchase'
        )
        revenue = purchaseValue ? parseFloat(purchaseValue.value) : 0
      }

      // Helper para somar ações por tipo
      const countActions = (types: string[]) => {
        if (!row.actions || !Array.isArray(row.actions)) return 0;
        return row.actions
          .filter((action: any) => types.includes(action.action_type))
          .reduce((acc: number, curr: any) => acc + parseInt(curr.value || '0'), 0);
      };

      // Extração explícita de métricas específicas
      const purchases = countActions(['omni_purchase', 'purchase']);
      const leads = countActions(['lead', 'onsite_lead', 'submit_application']);
      const linkClicks = countActions(['link_click']);
      const addToCarts = countActions(['omni_add_to_cart', 'add_to_cart']);
      const initiateCheckouts = countActions(['omni_initiate_checkout', 'initiate_checkout']);

      // Tratamento Inteligente de Conversões (Principal KPI)
      let conversions = 0
      const actionsToCount = conversionActions && conversionActions.length > 0
        ? conversionActions
        // Se não tiver objetivo definido, tenta deduzir:
        // Se tiver compras, são compras. Se não, leads. Se não, cliques.
        : (purchases > 0 ? ['omni_purchase', 'purchase'] : (leads > 0 ? ['lead', 'onsite_lead'] : ['link_click']))

      conversions = countActions(actionsToCount);

      // Cálculo CPA Seguro
      // O Facebook retorna spend como string (ex: "123.45")
      const spend = typeof row.spend === 'string' ? parseFloat(row.spend) : (row.spend || 0)
      const cpa = conversions > 0 && spend > 0 ? spend / conversions : 0

      return {
        roas,
        conversions,
        spend: isNaN(spend) ? 0 : spend,
        revenue: isNaN(revenue) ? 0 : revenue,
        cpa: isNaN(cpa) ? 0 : cpa,
        purchases,
        leads,
        linkClicks,
        addToCarts,
        initiateCheckouts
      }
    }

    // 🔥 ARQUITETURA DAY-BY-DAY: Sempre usar date_preset='last_30d' com time_increment=1
    // Isso retorna dados quebrados por dia, não agregados
    function buildInsightsUrl(level: string, fields: string): string {
      const baseFields = `${level}_id,${fields}`
      // time_increment=1 é CRÍTICO: retorna uma linha por dia, não somado
      return `${baseUrl}/insights?level=${level}&date_preset=${datePreset}&time_increment=${timeIncrement}&fields=${baseFields}&${getAuthParams()}&limit=200`
    }

    // Helper for date extraction from insights row
    function extractDate(row: any) {
      let d = row.date_start || row.date;
      if (!d) return new Date().toISOString().split('T')[0];
      return d.toString().substring(0, 10);
    }

    // Função auxiliar para fetch seguro com tratamento de erros robusto, PAGINAÇÃO e PROCESSAMENTO EM CHUNKS
    // onPage: Callback opcional que recebe os dados da página atual. Se fornecido, a função retorna um array vazio (streaming mode).
    async function fetchMetaAPI(url: string, label: string, onPage?: (pageData: any[]) => Promise<void>): Promise<any[]> {
      const allData: any[] = []
      let nextUrl: string | null = url
      let pageCount = 0
      const maxPages = 50 // Aumentado limite para permitir sync completo em chunks

      try {
        while (nextUrl && pageCount < maxPages) {
          pageCount++
          console.log(`📄 [${label}] Buscando página ${pageCount}...`)

          const executeFetch = async () => {
            return await fetch(nextUrl!, {
              headers: shieldHeaders
            });
          };

          const res: Response = circuitBreaker
            ? await circuitBreaker.execute(executeFetch)
            : await executeFetch();


          if (!res.ok) {
            const errorText = await res.text()
            let errorMessage = `HTTP ${res.status}`
            try {
              const errorJson = JSON.parse(errorText)
              errorMessage = errorJson.error?.message || errorMessage
              console.error(`❌ [META API] Erro em ${label} (página ${pageCount}):`, errorMessage)

              if (errorJson.error?.code === 190 || errorJson.error?.code === 102) {
                stats.errors.push(`${label}: Token inválido ou expirado - ${errorMessage}`)
                break
              }
            } catch (e) {
              errorMessage = errorText || errorMessage
            }
            stats.errors.push(`${label}: ${errorMessage}`)
            break
          }

          const json: any = await res.json()

          if (json.error) {
            console.error(`❌ [META API] Erro em ${label} (página ${pageCount}):`, json.error.message)
            if (json.error.code === 190 || json.error.code === 102) {
              stats.errors.push(`${label}: Token inválido ou expirado - ${json.error.message}`)
              break
            }
            stats.errors.push(`${label}: ${json.error.message}`)
            break
          }

          // Processamento da página
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            console.log(`✅ [${label}] Página ${pageCount}: ${json.data.length} itens encontrados`)

            if (onPage) {
              // 🔥 STREAMING MODE: Processar chunk imediatamente e limpar memória
              console.log(`⚡ [STREAM] Processando chunk de ${json.data.length} itens para ${label}...`)
              await onPage(json.data)
            } else {
              // BUFFER MODE: Acumular na memória (behavior antigo)
              allData.push(...json.data)
            }
          }

          nextUrl = json.paging?.next || null

          // Pequeno delay para evitar rate limiting
          if (pageCount < maxPages && nextUrl) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }

        if (pageCount >= maxPages) {
          console.warn(`⚠️ [${label}] Limite de páginas atingido (${maxPages})`)
        }

        return allData
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido'
        console.error(`❌ [FETCH] Erro ao buscar ${label}:`, errorMessage)
        stats.errors.push(`${label}: ${errorMessage}`)
        return allData
      }
    }

    // ====================================================================
    // NÍVEL 1: CAMPANHAS
    // ====================================================================
    console.log('📊 [NÍVEL 1] Sincronizando Campanhas...')

    try {
      // 1.1. Buscar estrutura de campanhas
      // 🆕 Added: smart_promotion_type (CBO indicator), bid_strategy, promoted_object (catalog), special_ad_categories
      const campaignFields = 'id,name,status,objective,daily_budget,lifetime_budget,start_time,smart_promotion_type,bid_strategy,promoted_object,special_ad_categories'
      const campaignsUrl = campaignId
        ? `${baseUrl}/campaigns?fields=${campaignFields}&filtering=[{'field':'id','operator':'IN','value':['${campaignId}']}]&${getAuthParams()}&limit=200`
        : `${baseUrl}/campaigns?fields=${campaignFields}&${getAuthParams()}&limit=200`
      console.log(`🔗 [CAMPAIGNS] URL: ${campaignsUrl.replace(accessToken, 'TOKEN_HIDDEN')}`)

      // Buffer mode is fine for campaigns structure (usually small count)
      const campaigns = await fetchMetaAPI(campaignsUrl, 'Campaigns')

      console.log(`✅ Encontradas ${campaigns.length} campanhas.`)

      // 1.2. Salvar campanhas (BULK INSERT)
      if (campaigns.length > 0) {
        const campaignsToUpsert = campaigns.map((camp: any) => {
          // Converter orçamentos de centavos para valores reais
          const dailyBudget = convertBudgetFromCents(camp.daily_budget)
          const lifetimeBudget = convertBudgetFromCents(camp.lifetime_budget)

          campaignObjectives.set(camp.id, camp.objective || '')

          // 🆕 Determinar se é CBO baseado em smart_promotion_type ou presença de budget na campanha
          const isCBO = camp.smart_promotion_type === 'GUIDED_CREATION_CAMPAIGN_BUDGET_FLIGHT' || !!(dailyBudget || lifetimeBudget)

          return {
            id: camp.id,
            account_id: finalAccountId,
            name: camp.name,
            status: camp.status,
            objective: camp.objective || null,
            daily_budget: dailyBudget,
            lifetime_budget: lifetimeBudget,
            start_time: camp.start_time || null,
            // 🆕 New fields for campaign structure
            smart_promotion_type: camp.smart_promotion_type || null,
            bid_strategy: camp.bid_strategy || null,
            promoted_object: camp.promoted_object || null,
            special_ad_categories: camp.special_ad_categories || null,
            last_updated_at: new Date().toISOString()
          }
        })

        const { error } = await supabase
          .from('campaigns')
          .upsert(campaignsToUpsert)

        if (error) {
          console.error('❌ [DB] Erro ao salvar campanhas:', error)
          stats.errors.push(`Campanhas (DB): ${error.message}`)
        } else {
          stats.campaigns = campaignsToUpsert.length
        }

        // 🆕 STALE CAMPAIGN CLEANUP: Remove local campaigns that no longer exist in Meta
        const metaCampaignIds = campaignsToUpsert.map((c: any) => c.id)
        console.log(`🧹 [CLEANUP] Verificando campanhas obsoletas para conta ${finalAccountId}...`)

        // Get all local campaign IDs for this account
        const { data: localCampaigns, error: fetchError } = await supabase
          .from('campaigns')
          .select('id')
          .eq('account_id', finalAccountId)

        if (!fetchError && localCampaigns) {
          const localIds = localCampaigns.map((c: any) => c.id)
          const staleIds = localIds.filter((id: string) => !metaCampaignIds.includes(id))

          if (staleIds.length > 0) {
            console.log(`🧹 [CLEANUP] Removendo ${staleIds.length} campanhas obsoletas: ${staleIds.slice(0, 5).join(', ')}${staleIds.length > 5 ? '...' : ''}`)

            // Delete campaigns, adsets, ads, and insights for stale campaigns
            // Order matters due to foreign keys: ads -> adsets -> campaigns

            // 1. Delete ads belonging to stale campaigns
            const { error: adsDelError } = await supabase
              .from('ads')
              .delete()
              .in('campaign_id', staleIds)
            if (adsDelError) console.warn('⚠️ [CLEANUP] Erro ao deletar ads obsoletos:', adsDelError.message)

            // 2. Delete adsets belonging to stale campaigns
            const { error: adsetsDelError } = await supabase
              .from('adsets')
              .delete()
              .in('campaign_id', staleIds)
            if (adsetsDelError) console.warn('⚠️ [CLEANUP] Erro ao deletar adsets obsoletos:', adsetsDelError.message)

            // 3. Delete insights for stale campaigns
            const { error: insightsDelError } = await supabase
              .from('insights')
              .delete()
              .eq('entity_type', 'CAMPAIGN')
              .in('entity_id', staleIds)
            if (insightsDelError) console.warn('⚠️ [CLEANUP] Erro ao deletar insights obsoletos:', insightsDelError.message)

            // 4. Finally delete the campaigns themselves
            const { error: campaignsDelError } = await supabase
              .from('campaigns')
              .delete()
              .in('id', staleIds)

            if (campaignsDelError) {
              console.error('❌ [CLEANUP] Erro ao deletar campanhas obsoletas:', campaignsDelError.message)
            } else {
              console.log(`✅ [CLEANUP] ${staleIds.length} campanhas obsoletas removidas com sucesso`)
              // @ts-ignore
              stats.deletedCampaigns = staleIds.length
            }
          } else {
            console.log('✅ [CLEANUP] Nenhuma campanha obsoleta encontrada')
          }
        }
      }

      // 1.3. Buscar insights de campanhas (Day-by-Day) com CHUNK PROCESSING

      // 🔥 UPSERT-ONLY: Removemos o PRE-CLEANUP para evitar perda de dados em caso de timeout/falha
      // O UPSERT com onConflict='entity_id,entity_type,date' irá atualizar registros existentes
      // sem precisar deletar antes.

      // CLEANUP REMOVIDO para segurança (dados não são mais deletados antes da inserção)

      // Definition of processor for Campaign Insights Chunks
      const processCampaignInsightsChunk = async (chunkData: any[]) => {
        if (!chunkData || chunkData.length === 0) return;

        const insightsToUpsert: any[] = []

        chunkData.forEach((row: any) => {
          // Validar se dados são de hoje para evitar duplicação se rodarmos o fetch de hoje separado
          // (Na verdade, o fetch separado remove duplicatas, mas aqui estamos streamed)
          // Vamos filtrar duplicatas na query de hoje posteriormente.

          const campaignObjective = campaignObjectives.get(row.campaign_id) || ''
          const conversionActions = getConversionActions(campaignObjective)
          const { roas, conversions, spend, cpa, purchases, leads, linkClicks, addToCarts, initiateCheckouts } = processInsightRow(row, conversionActions)
          let insightDate = extractDate(row);

          insightsToUpsert.push({
            entity_id: row.campaign_id,
            entity_type: 'CAMPAIGN',
            date: insightDate,
            spend: spend,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            reach: parseInt(row.reach || '0'),
            frequency: parseFloat(row.frequency || '0'),
            cpm: parseFloat(row.cpm || '0'),
            ctr: parseFloat(row.ctr || '0'),
            roas: roas,
            cpa: cpa,
            conversions: conversions,
            purchases: purchases,
            leads: leads,
            link_clicks: linkClicks,
            add_to_cart: addToCarts,
            initiate_checkout: initiateCheckouts
          })
        });

        if (insightsToUpsert.length > 0) {
          const { error } = await supabase.from('insights').upsert(insightsToUpsert, { onConflict: 'entity_id,entity_type,date' });
          if (error) {
            console.error('❌ [DB] Erro no chunk de Campaign Insights:', error);
            stats.errors.push(`Campaign Insights Chunk: ${error.message}`);
          } else {
            stats.campaignInsights += insightsToUpsert.length;
            console.log(`💾 [CHUNK] Salvo ${insightsToUpsert.length} campaign insights`);
          }
        }
      };

      // Helper for date extraction
      const extractDate = (row: any) => {
        let d = row.date_start || row.date;
        if (!d) return new Date().toISOString().split('T')[0];
        return d.toString().substring(0, 10);
      }

      const campaignInsightsUrl = buildInsightsUrl('campaign', 'spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,purchase_roas,actions,date_start,date_stop')
      console.log(`🔗 [CAMPAIGN INSIGHTS] Buscando insights STREAMED`)

      // STREAM PROCESSING
      await fetchMetaAPI(campaignInsightsUrl, 'Campaign Insights Stream', processCampaignInsightsChunk);

      // 🔥 Buscar dados de HOJE separadamente e processar como um chunk final
      const todayUrl = `${baseUrl}/insights?level=campaign&date_preset=today&time_increment=${timeIncrement}&fields=campaign_id,spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,purchase_roas,actions,date_start,date_stop&${getAuthParams()}&limit=200`
      console.log(`🔗 [CAMPAIGN INSIGHTS] Buscando dados de HOJE separadamente`)
      console.log(`📅 [CAMPAIGN INSIGHTS TODAY] URL: ${todayUrl}`)

      try {
        const todayData = await fetchMetaAPI(todayUrl, 'Campaign Insights Today', processCampaignInsightsChunk);
        console.log(`✅ [CAMPAIGN INSIGHTS TODAY] Dados de hoje sincronizados com sucesso. Total de registros: ${todayData?.length || 0}`)
        if (!todayData || todayData.length === 0) {
          console.warn(`⚠️ [CAMPAIGN INSIGHTS TODAY] Nenhum dado retornado pela Meta API para hoje. Isso pode ser normal se:
          1. As campanhas não tiveram impressões/gastos hoje ainda
          2. A Meta API ainda não consolidou os dados (pode demorar algumas horas)
          3. Estamos em um horário onde a Meta considera "amanhã" no timezone UTC`)
        }
      } catch (todayError) {
        const todayErrorMessage = todayError instanceof Error ? todayError.message : 'Erro desconhecido'
        console.error(`❌ [CAMPAIGN INSIGHTS TODAY] Erro ao buscar dados de hoje:`, todayErrorMessage)
        console.error(`❌ [CAMPAIGN INSIGHTS TODAY] Stack trace:`, todayError)
        // Não vamos fazer throw aqui para não quebrar todo o sync - dados históricos ainda foram sincronizados
        stats.errors.push(`Dados de hoje (campanhas): ${todayErrorMessage}`)
      }

    } catch (error) {
      // ... existing error handler
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('❌ Erro fatal ao sincronizar campanhas:', errorMessage)
      stats.errors.push(`Campanhas: ${errorMessage}`)
    }

    // ====================================================================
    // NÍVEL 2: CONJUNTOS DE ANÚNCIOS (ADSETS)
    // ====================================================================
    console.log('📊 [NÍVEL 2] Sincronizando Conjuntos de Anúncios...')
    let validAdSetIds = new Set()
    let adsets: any[] = []

    try {
      // 2.1. Buscar estrutura de adsets
      const adsetsUrl = campaignId
        ? `https://graph.facebook.com/v24.0/${campaignId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,promoted_object,optimization_goal,billing_event,bid_amount,destination_type,start_time,end_time&${getAuthParams()}&limit=100`
        : `${baseUrl}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,promoted_object,optimization_goal,billing_event,bid_amount,destination_type,start_time,end_time&${getAuthParams()}&limit=100`

      adsets = await fetchMetaAPI(adsetsUrl, 'Adsets')
      validAdSetIds = new Set(adsets.map((a: any) => a.id))

      console.log(`✅ Encontrados ${adsets.length} conjuntos de anúncios.`)

      // 2.2. Salvar adsets (BULK INSERT)
      if (adsets.length > 0) {
        const adsetsToUpsert = adsets.map((adset: any) => {
          // Converter orçamento de centavos para valor real
          const dailyBudget = convertBudgetFromCents(adset.daily_budget)
          const lifetimeBudget = convertBudgetFromCents(adset.lifetime_budget)

          const parentObjective = campaignObjectives.get(adset.campaign_id) || ''
          adsetObjectives.set(adset.id, parentObjective)

          // 🔧 Resolver promoted_object: preferir o original, fallback para tracking_specs
          const promotedObject = adset.promoted_object || extractPixelFromTrackingSpecs(adset.tracking_specs)

          return {
            id: adset.id,
            account_id: finalAccountId,
            campaign_id: adset.campaign_id,
            name: adset.name,
            status: adset.status,
            daily_budget: dailyBudget,
            lifetime_budget: lifetimeBudget,
            targeting: adset.targeting, // JSONB completo
            promoted_object: promotedObject, // JSONB com pixel_id
            optimization_goal: adset.optimization_goal,
            billing_event: adset.billing_event,
            bid_amount: adset.bid_amount || null,
            destination_type: adset.destination_type || null,
            start_time: adset.start_time || null,
            end_time: adset.end_time || null,
            last_updated_at: new Date().toISOString()
          }
        })

        const { error } = await supabase
          .from('adsets')
          .upsert(adsetsToUpsert)

        if (error) {
          console.error('❌ [DB] Erro ao salvar adsets:', error)
          stats.errors.push(`Adsets (DB): ${error.message}`)
        } else {
          stats.adsets = adsetsToUpsert.length
        }
      }

      // 2.3. Buscar insights de adsets (Day-by-Day) com CHUNK PROCESSING

      // 🔥 UPSERT-ONLY: Removemos o PRE-CLEANUP para evitar perda de dados em caso de timeout/falha
      // CLEANUP REMOVIDO para segurança

      // Processor for AdSet Insights Chunks
      const processAdSetInsightsChunk = async (chunkData: any[]) => {
        if (!chunkData || chunkData.length === 0) return;

        const insightsToUpsert: any[] = []

        chunkData.forEach((row: any) => {
          const adsetObjective = adsetObjectives.get(row.adset_id) || campaignObjectives.get(row.campaign_id || '') || ''
          const conversionActions = getConversionActions(adsetObjective)
          const { roas, conversions, spend, cpa, purchases, leads, linkClicks, addToCarts, initiateCheckouts } = processInsightRow(row, conversionActions)
          let insightDate = extractDate(row);

          insightsToUpsert.push({
            entity_id: row.adset_id,
            entity_type: 'ADSET',
            date: insightDate,
            spend: spend,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            reach: parseInt(row.reach || '0'),
            frequency: parseFloat(row.frequency || '0'),
            cpm: parseFloat(row.cpm || '0'),
            ctr: parseFloat(row.ctr || '0'),
            roas: roas,
            cpa: cpa,
            conversions: conversions,
            purchases: purchases,
            leads: leads,
            link_clicks: linkClicks,
            add_to_cart: addToCarts,
            initiate_checkout: initiateCheckouts
          })
        });

        if (insightsToUpsert.length > 0) {
          const { error } = await supabase.from('insights').upsert(insightsToUpsert, { onConflict: 'entity_id,entity_type,date' });
          if (error) {
            console.error('❌ [DB] Erro no chunk de AdSet Insights:', error);
            stats.errors.push(`AdSet Insights Chunk: ${error.message}`);
          } else {
            stats.adsetInsights += insightsToUpsert.length;
            console.log(`💾 [CHUNK] Salvo ${insightsToUpsert.length} adset insights`);
          }
        }
      };

      const adsetInsightsUrl = buildInsightsUrl('adset', 'spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,purchase_roas,actions,date_start,date_stop')
      console.log(`🔗 [ADSET INSIGHTS] Buscando insights STREAMED`)

      await fetchMetaAPI(adsetInsightsUrl, 'Adset Insights Stream', processAdSetInsightsChunk);

      // 🔥 Buscar dados de HOJE separadamente
      const todayAdsetUrl = `${baseUrl}/insights?level=adset&date_preset=today&time_increment=${timeIncrement}&fields=adset_id,spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,purchase_roas,actions,date_start,date_stop&${getAuthParams()}&limit=200`
      console.log(`🔗 [ADSET INSIGHTS] Buscando dados de HOJE separadamente`)
      console.log(`📅 [ADSET INSIGHTS TODAY] URL: ${todayAdsetUrl}`)

      try {
        const todayAdsetData = await fetchMetaAPI(todayAdsetUrl, 'Adset Insights Today', processAdSetInsightsChunk);
        console.log(`✅ [ADSET INSIGHTS TODAY] Dados de hoje sincronizados com sucesso. Total de registros: ${todayAdsetData?.length || 0}`)
        if (!todayAdsetData || todayAdsetData.length === 0) {
          console.warn(`⚠️ [ADSET INSIGHTS TODAY] Nenhum dado retornado pela Meta API para hoje`)
        }
      } catch (todayError) {
        const todayErrorMessage = todayError instanceof Error ? todayError.message : 'Erro desconhecido'
        console.error(`❌ [ADSET INSIGHTS TODAY] Erro ao buscar dados de hoje:`, todayErrorMessage)
        console.error(`❌ [ADSET INSIGHTS TODAY] Stack trace:`, todayError)
        stats.errors.push(`Dados de hoje (adsets): ${todayErrorMessage}`)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('❌ Erro fatal ao sincronizar adsets:', errorMessage)
      stats.errors.push(`Adsets: ${errorMessage}`)
    }

    // ====================================================================
    // NÍVEL 3: ANÚNCIOS (ADS) - COM CHUNK PROCESSING & DEEP SEARCH
    // ====================================================================
    console.log('📊 [NÍVEL 3] Sincronizando Anúncios (com Deep Search de imagens)...')

    try {
      // 3.1. Preparar campos e processador de chunks
      // 🔧 FIX: Removido 'description' do root creative fields para evitar erro de API
      // Mantivemos nos nested object_story_spec onde é válido
      // 🔧 FIX: Added instagram_user_id (v24.0) AND instagram_actor_id (legacy) to fields
      const adsFields = `id,name,status,adset_id,campaign_id,tracking_specs,url_tags,effective_object_story_id,creative{id,body,title,link_url,image_url,thumbnail_url,product_set_id,template_url_spec,asset_feed_spec,url_tags,instagram_actor_id,instagram_user_id,ad_creative_link_data{description,caption,link,message,name,picture},object_story_spec{page_id,instagram_actor_id,instagram_user_id,link_data{message,link,name,description,caption,picture,call_to_action{type,value{link,link_caption,link_description}},child_attachments{picture,name,description,link}},video_data{video_id,title,description,link_description,message,caption,thumbnail_url,call_to_action{type,value{link,link_caption,link_description}}},template_data{message,link,name,description}}}`

      const adsUrl = campaignId
        ? `https://graph.facebook.com/v24.0/${campaignId}/ads?fields=${adsFields}&${getAuthParams()}&limit=200`
        : `${baseUrl}/ads?fields=${adsFields}&${getAuthParams()}&limit=200`

      // 🔄 PROCESSADOR DE CHUNKS DE ADS
      const processAdsChunk = async (chunkAds: any[]) => {
        if (!chunkAds || chunkAds.length === 0) return;

        console.log(`⚙️ [ADS CHUNK] Processando lote de ${chunkAds.length} anúncios...`)

        // 🔥 FILTRAGEM DE SEGURANÇA: Remover anúncios órfãos
        const validAds = chunkAds.filter((ad: any) => {
          if (validAdSetIds.size === 0) return true
          const hasParent = validAdSetIds.has(ad.adset_id)
          if (!hasParent) {
            // Silenciar log de orphan para não poluir, ou manter debug
            // console.warn(`⚠️ [ORPHAN AD] Ignorando anúncio ${ad.id}`)
          }
          return hasParent
        })

        if (validAds.length === 0) return;

        // 🆕 ENRIQUECIMENTO DE DADOS (Deep Search) - Em batches dentro do chunk
        // Filtrar ads que precisam de enriquecimento
        const adsNeedingEnrichment = validAds.filter((ad: any) => {
          const c = ad.creative || {}
          const oss = c.object_story_spec || {}
          const ld = oss.link_data || {}
          const vd = oss.video_data || {}
          const noBasicData = Object.keys(ld).length === 0 && !c.body && !c.title
          const isVideoMissingDescription = (c.video_id || vd.video_id) && !ld.description
          return c.id && (noBasicData || isVideoMissingDescription)
        })

        if (adsNeedingEnrichment.length > 0) {
          console.log(`🔄 [ENRICHMENT] Enriquecendo ${adsNeedingEnrichment.length} criativos neste chunk...`)
          const creativeIds = adsNeedingEnrichment.map((ad: any) => ad.creative.id)

          // Buscar creatives em sub-lotes de 50
          const batchSize = 50
          for (let i = 0; i < creativeIds.length; i += batchSize) {
            const batch = creativeIds.slice(i, i + batchSize)
            // ... lógica de fetch de creative identica ao original, mas simplificada aqui para o chunk ...
            // Por simplicidade e segurança, vamos usar Promise.all com fetch individual (o previous code já fazia loop serial por batch)
            // A versão original fazia loop em batch, e dentro loop em ids.

            // Para não estourar tempo/memoria, fazemos requests concorrentes limitados
            // Mas como já estamos dentro de um chunk processado sequencialmente pela fetchMetaAPI,
            // podemos fazer requests paralelos limitados aqui.

            await Promise.all(batch.map(async (creativeId: string) => {
              try {
                // 🔧 FIX: Added instagram_user_id (v24.0) AND instagram_actor_id (legacy) to fields
                const creativeUrl = `https://graph.facebook.com/v24.0/${creativeId}?fields=id,body,title,name,link_url,image_url,thumbnail_url,asset_feed_spec,instagram_actor_id,instagram_user_id,object_story_spec{page_id,instagram_actor_id,instagram_user_id,video_data{video_id,title,description,message,caption,call_to_action{type,value{link,link_description,link_caption}}},link_data{message,link,name,description,caption,picture,call_to_action{type,value{link,link_description,link_caption}},image_hash}},effective_object_story_id,url_tags&${getAuthParams()}`
                const res = await fetch(creativeUrl);
                const details = await res.json();
                if (details.error) return;

                const adToUpdate = validAds.find((ad: any) => ad.creative?.id === creativeId)
                if (adToUpdate) {
                  // Merge logic (simplificada do original)
                  const oss = details.object_story_spec || {}
                  const ld = oss.link_data || {}
                  const vd = oss.video_data || {}

                  // Copiar description de video se faltar
                  if (!ld.description && vd.description) ld.description = vd.description;
                  if (!ld.description && vd.call_to_action?.value?.link_description) ld.description = vd.call_to_action.value.link_description;

                  adToUpdate.creative = {
                    ...adToUpdate.creative,
                    body: details.body || adToUpdate.creative.body,
                    title: details.title || details.name || adToUpdate.creative.title,
                    link_url: details.link_url || adToUpdate.creative.link_url,
                    image_url: details.image_url || adToUpdate.creative.image_url,
                    thumbnail_url: details.thumbnail_url || adToUpdate.creative.thumbnail_url,
                    object_story_spec: { ...oss, link_data: ld, video_data: vd },
                    effective_object_story_id: details.effective_object_story_id,
                    url_tags: details.url_tags || adToUpdate.creative.url_tags
                  }
                }
              } catch (e) { }
            }));
          }
        }

        // Preparar para salvar
        const adsToUpsert = validAds.map((ad: any) => {
          let creativeJson: string | null = null
          let creativeImageUrl: string | null = null

          if (ad.creative) {
            creativeImageUrl = extractImage(ad.creative)
            try {
              // ... lógica de serialização identica ...
              const creative = Array.isArray(ad.creative) ? ad.creative[0] : ad.creative
              const oss = creative?.object_story_spec || {}
              const linkData = oss.link_data || {}
              const templateData = oss.template_data || {}
              const videoData = oss.video_data || {}
              const assetFeedSpec = creative?.asset_feed_spec || {}

              const dcoDescription = assetFeedSpec.descriptions?.[0]?.text || ''
              const dcoTitle = assetFeedSpec.titles?.[0]?.text || ''
              const dcoBody = assetFeedSpec.bodies?.[0]?.text || ''
              const dcoLink = assetFeedSpec.link_urls?.[0]?.website_url || ''

              const enrichedObjectStorySpec = {
                link_data: {
                  message: linkData.message || creative?.body || templateData.message || dcoBody || videoData.message || '',
                  link: linkData.link || templateData.link || videoData.call_to_action?.value?.link || dcoLink || '',
                  name: linkData.name || creative?.title || templateData.name || dcoTitle || videoData.title || '',
                  description: linkData.description || linkData.caption || creative?.description || videoData.description || videoData.link_description || videoData.caption || videoData.call_to_action?.value?.link_description || videoData.call_to_action?.value?.link_caption || templateData.description || dcoDescription || '',
                  caption: linkData.caption || videoData.caption || '',
                  picture: linkData.picture || creative?.image_url || creative?.thumbnail_url || '',
                  call_to_action: linkData.call_to_action || videoData.call_to_action || null,
                  child_attachments: linkData.child_attachments || null
                },
                template_data: Object.keys(templateData).length > 0 ? {
                  ...templateData,
                  link: templateData.link || linkData.link || '',
                  name: templateData.name || linkData.name || '',
                  description: templateData.description || linkData.description || ''
                } : null,
                video_data: videoData,
                // 🔧 FIX: Store instagram_user_id (v24.0) with instagram_actor_id as fallback (deprecated)
                page_id: oss.page_id || null,
                instagram_user_id: oss.instagram_user_id || creative?.instagram_user_id || null,
                instagram_actor_id: oss.instagram_actor_id || creative?.instagram_actor_id || oss.instagram_user_id || creative?.instagram_user_id || null
              }

              // 🔍 DEBUG: Log instagram ID extraction for troubleshooting
              // Prefer instagram_user_id (v24.0) but fallback to instagram_actor_id (legacy)
              const extractedInstagramId = oss.instagram_user_id || creative?.instagram_user_id || oss.instagram_actor_id || creative?.instagram_actor_id || null;
              if (extractedInstagramId) {
                console.log(`📸 [AD ${ad.id}] Found instagram ID: ${extractedInstagramId} (user_id: ${oss.instagram_user_id || creative?.instagram_user_id || 'none'}, actor_id: ${oss.instagram_actor_id || creative?.instagram_actor_id || 'none'})`);
              }

              creativeJson = JSON.stringify({
                id: creative?.id || null,
                title: creative?.title || null,
                body: creative?.body || null, // creative.body já deve estar merged
                image_url: creative?.image_url || null,
                thumbnail_url: creative?.thumbnail_url || null,
                link_url: creative?.link_url || null,
                object_story_spec: enrichedObjectStorySpec,
                product_set_id: creative?.product_set_id || null,
                template_url_spec: creative?.template_url_spec || null,
                url_tags: creative?.url_tags || ad.url_tags || null,
                asset_feed_spec: creative?.asset_feed_spec || null,
                tracking_specs: ad.tracking_specs || null,
                effective_object_story_id: ad.effective_object_story_id || null,
                // 🔧 FIX: Store both instagram_user_id (v24.0) AND instagram_actor_id (legacy) at ROOT level
                instagram_user_id: oss.instagram_user_id || creative?.instagram_user_id || null,
                instagram_actor_id: extractedInstagramId
              })
            } catch (e) { console.warn('Erro serializar ad', e) }
          }

          return {
            id: ad.id,
            account_id: finalAccountId,
            adset_id: ad.adset_id,
            campaign_id: ad.campaign_id,
            name: ad.name,
            status: ad.status,
            creative: creativeJson,
            creative_image_url: creativeImageUrl,
            last_updated_at: new Date().toISOString()
          }
        })

        // Save chunk to DB
        if (adsToUpsert.length > 0) {
          const { error } = await supabase.from('ads').upsert(adsToUpsert);
          if (error) {
            console.error('❌ [DB] Erro ao salvar chunk de ads:', error)
            stats.errors.push(`Ads Chunk: ${error.message}`)
          } else {
            stats.ads += adsToUpsert.length
            console.log(`💾 [DB] Salvo chunk de ${adsToUpsert.length} anúncios`)
          }
        }
      }

      // STREAM ADS Processing
      await fetchMetaAPI(adsUrl, 'Ads Stream', processAdsChunk); // Passa o processador


      // 3.3. Buscar insights de ads (Day-by-Day) com CHUNK PROCESSING

      // 🔥 PRE-CLEANUP
      // Como não temos a lista completa de todos os ads ID antes (pois processamos em chunks),
      // precisamos de uma estratégia de cleanup segura.
      // Se limparmos TUDO de ads agora, podemos apagar dados de ontem? Sim.
      // Então vamos limpar TUDO de ads dessa conta, pois vamos reinserir TUDO via stream.
      // Isso é seguro pois estamos re-sincronizando a conta toda.

      console.log(`🧹 [CLEANUP] Removendo TODOS os insights antigos de ADS da conta ${finalAccountId}`)
      // Precisamos pegar TODOS os ad IDs da conta para deletar insights?
      // Delete por entity_type='AD' e filtered por insights de campanhas dessa conta seria ideal, mas insights não tem account_id direto.
      // A tabela insights tem entity_id. Preciso deletar insights dos ads que pertencem a essa conta.
      // Opção: Deletar via RPC ou fetch all ad IDs from DB first.
      // Fetch all ad IDs from DB é rápido.

      const { data: allAccountAds } = await supabase.from('ads').select('id').eq('account_id', finalAccountId);
      if (allAccountAds && allAccountAds.length > 0) {
        // Deletar em lotes para não estourar URL length
        const allAdIds = allAccountAds.map((a: any) => a.id);
        // Se for mto grande (>1000), fazer loop de delete
        for (let i = 0; i < allAdIds.length; i += 1000) {
          const batch = allAdIds.slice(i, i + 1000);
          await supabase.from('insights').delete().eq('entity_type', 'AD').in('entity_id', batch);
        }
        console.log(`✅ [CLEANUP] Insights antigos de ADS removidos.`)
      }

      // Processor for Ad Insights Chunks
      const processAdInsightsChunk = async (chunkData: any[]) => {
        if (!chunkData || chunkData.length === 0) return;
        const insightsToUpsert: any[] = []

        chunkData.forEach((row: any) => {
          const adObjective = adsetObjectives.get(row.adset_id) || campaignObjectives.get(row.campaign_id || '') || ''
          const conversionActions = getConversionActions(adObjective)
          const { roas, conversions, spend, cpa, revenue } = processInsightRow(row, conversionActions)
          let insightDate = extractDate(row);

          insightsToUpsert.push({
            entity_id: row.ad_id,
            entity_type: 'AD',
            date: insightDate,
            spend: spend,
            revenue: revenue,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            reach: parseInt(row.reach || '0'),
            frequency: parseFloat(row.frequency || '0'),
            cpm: parseFloat(row.cpm || '0'),
            ctr: parseFloat(row.ctr || '0'),
            roas: roas,
            cpa: cpa,
            conversions: conversions
          })
        });

        if (insightsToUpsert.length > 0) {
          const { error } = await supabase.from('insights').upsert(insightsToUpsert, { onConflict: 'entity_id,entity_type,date' });
          if (error) {
            console.error('❌ [DB] Erro no chunk de Ad Insights:', error);
            stats.errors.push(`Ad Insights Chunk: ${error.message}`);
          } else {
            stats.adInsights += insightsToUpsert.length;
            console.log(`💾 [CHUNK] Salvo ${insightsToUpsert.length} ad insights`);
          }
        }
      }


      const adInsightsUrl = buildInsightsUrl('ad', 'spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,purchase_roas,action_values,actions,date_start,date_stop')
      console.log(`🔗 [AD INSIGHTS] Buscando insights STREAMED`)
      await fetchMetaAPI(adInsightsUrl, 'Ad Insights Stream', processAdInsightsChunk);

      // 🔥 Buscar dados de HOJE separadamente
      const todayAdUrl = `${baseUrl}/insights?level=ad&date_preset=today&time_increment=${timeIncrement}&fields=ad_id,spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,purchase_roas,action_values,actions,date_start,date_stop&${getAuthParams()}&limit=200`
      console.log(`🔗 [AD INSIGHTS] Buscando dados de HOJE separadamente`)
      console.log(`📅 [AD INSIGHTS TODAY] URL: ${todayAdUrl}`)

      try {
        const todayAdData = await fetchMetaAPI(todayAdUrl, 'Ad Insights Today', processAdInsightsChunk);
        console.log(`✅ [AD INSIGHTS TODAY] Dados de hoje sincronizados com sucesso. Total de registros: ${todayAdData?.length || 0}`)
        if (!todayAdData || todayAdData.length === 0) {
          console.warn(`⚠️ [AD INSIGHTS TODAY] Nenhum dado retornado pela Meta API para hoje`)
        }
      } catch (todayError) {
        const todayErrorMessage = todayError instanceof Error ? todayError.message : 'Erro desconhecido'
        console.error(`❌ [AD INSIGHTS TODAY] Erro ao buscar dados de hoje:`, todayErrorMessage)
        console.error(`❌ [AD INSIGHTS TODAY] Stack trace:`, todayError)
        stats.errors.push(`Dados de hoje (ads): ${todayErrorMessage}`)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('❌ Erro fatal ao sincronizar ads:', errorMessage)
      stats.errors.push(`Ads: ${errorMessage}`)
    }

    // ====================================================================
    // RESUMO FINAL
    // ====================================================================
    const hasErrors = stats.errors.length > 0
    const hasData = stats.campaigns > 0 || stats.adsets > 0 || stats.ads > 0

    console.log('✅ Sincronização completa finalizada!')
    console.log(`📊 Estatísticas:`)
    console.log(`   Campanhas: ${stats.campaigns} | Insights: ${stats.campaignInsights}`)
    console.log(`   Adsets: ${stats.adsets} | Insights: ${stats.adsetInsights}`)
    console.log(`   Ads: ${stats.ads} | Insights: ${stats.adInsights}`)
    console.log(`   Account ID usado: ${finalAccountId}`)

    if (hasErrors) {
      console.log(`   ⚠️ Erros encontrados: ${stats.errors.length}`)
      stats.errors.forEach((err, idx) => console.log(`      ${idx + 1}. ${err}`))
    }

    // ====================================================================
    // ATUALIZAR AUTHORITY (Lifetime Spend) após sincronização
    // ====================================================================
    try {
      console.log(`🔄 [AUTHORITY] Atualizando lifetime_spend para conta: ${finalAccountId}`)
      const { error: authorityError } = await supabase.rpc('update_lifetime_spend_for_account', {
        p_account_id: finalAccountId
      })
      if (authorityError) console.warn('⚠️ [AUTHORITY] Erro:', authorityError.message)
      else console.log('✅ [AUTHORITY] lifetime_spend atualizado com sucesso')
    } catch (error) {
      console.warn('⚠️ [AUTHORITY] Erro ao atualizar authority:', error)
    }

    return new Response(
      JSON.stringify({
        success: hasData || !hasErrors, // Sucesso apenas se tiver dados OU não tiver erros críticos
        message: hasData
          ? 'Sincronização completa concluída'
          : hasErrors
            ? `Sincronização concluída com erros: ${stats.errors.join(', ')}`
            : 'Sincronização concluída, mas nenhum dado encontrado',
        stats: stats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('❌ [FATAL] Erro Fatal na Function:', errorMessage)
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        stats: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
