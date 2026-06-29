// @ts-ignore: Deno types
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
/**
 * 🔥 FUNÇÃO DE RECUPERAÇÃO DE TOKEN COM FALLBACK STRATEGY
 * Tenta múltiplas fontes para encontrar o access_token do Facebook
 * @param fallbackUserId - Pode ser passado diretamente quando chamado de outra Edge Function
 */ async function getAccessToken(supabase, accountId, authHeader, fallbackUserId = null) {
  console.log("🔍 [GET_TOKEN] Iniciando busca de token...");
  console.log("🔍 [GET_TOKEN] Account ID recebido:", accountId);
  console.log("🔍 [GET_TOKEN] Fallback User ID:", fallbackUserId);
  // 1. LIMPAR PREFIXO 'ACT_' DO ACCOUNTID (se existir)
  let cleanAccountId = accountId;
  let cleanAccountIdWithoutPrefix = accountId;
  if (accountId) {
    cleanAccountIdWithoutPrefix = accountId.replace(/^act_/i, '');
    console.log("🔍 [GET_TOKEN] Account ID limpo (sem act_):", cleanAccountIdWithoutPrefix);
  }
  // 2. OBTER USER_ID DO SUPABASE AUTH (obrigatório para fallback)
  let userId = fallbackUserId; // 🆕 Usar fallbackUserId se fornecido
  if (!userId && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError) {
        console.error("❌ [GET_TOKEN] Erro ao obter user do auth:", userError);
      } else if (user) {
        userId = user.id;
        console.log("👤 [GET_TOKEN] User ID (Auth):", userId);
      } else {
        console.warn("⚠️ [GET_TOKEN] User não encontrado no auth");
      }
    } catch (error) {
      console.error("❌ [GET_TOKEN] Erro ao chamar auth.getUser():", error);
    }
  } else if (userId) {
    console.log("👤 [GET_TOKEN] User ID (do fallback):", userId);
  } else {
    console.warn("⚠️ [GET_TOKEN] Authorization header não encontrado e sem fallbackUserId");
  }
  // TENTATIVA 1: Buscar token vinculado especificamente à conta (ad_accounts table)
  if (accountId) {
    console.log("🔍 [GET_TOKEN] Tentativa 1: Buscando token em ad_accounts...");
    // Tentar com ID original (pode ter 'act_' ou não)
    let { data: account, error: accountError } = await supabase.from('ad_accounts').select('access_token, id, user_id').eq('id', accountId).single();
    if (accountError && cleanAccountIdWithoutPrefix !== accountId) {
      // Se falhou, tentar sem o prefixo 'act_'
      console.log("🔍 [GET_TOKEN] Tentando sem prefixo 'act_'...");
      accountError = null;
      const { data: accountWithoutPrefix } = await supabase.from('ad_accounts').select('access_token, id, user_id').eq('id', cleanAccountIdWithoutPrefix).single();
      if (accountWithoutPrefix) {
        account = accountWithoutPrefix;
      }
    }
    if (accountError) {
      console.log("⚠️ [GET_TOKEN] Tentativa 1 falhou:", accountError.message);
    } else if (account?.access_token) {
      console.log("✅ [GET_TOKEN] Token encontrado em ad_accounts! ID:", account.id);
      // 🚨 LOGS DE TOKEN: Confirmar o que foi encontrado
      const token = account.access_token;
      console.log("🔍 [GET_TOKEN] TOKEN ENCONTRADO NO BANCO:", token ? `SIM (Começa com "${token.substring(0, 10)}...")` : "NÃO");
      console.log("🔍 [GET_TOKEN] Token length:", token?.length || 0);
      return token;
    } else {
      console.log("⚠️ [GET_TOKEN] Token não encontrado em ad_accounts");
    }
    // Tentar meta_tokens table com account_id
    console.log("🔍 [GET_TOKEN] Tentativa 1.1: Buscando em meta_tokens por account_id...");
    let { data: metaToken, error: metaTokenError } = await supabase.from('meta_tokens').select('access_token, account_id, user_id').eq('account_id', accountId).eq('status', 'connected').single();
    if (metaTokenError && cleanAccountIdWithoutPrefix !== accountId) {
      // Tentar sem prefixo
      console.log("🔍 [GET_TOKEN] Tentando meta_tokens sem prefixo 'act_'...");
      metaTokenError = null;
      const { data: metaTokenWithoutPrefix } = await supabase.from('meta_tokens').select('access_token, account_id, user_id').eq('account_id', cleanAccountIdWithoutPrefix).eq('status', 'connected').single();
      if (metaTokenWithoutPrefix) {
        metaToken = metaTokenWithoutPrefix;
      }
    }
    if (metaTokenError) {
      console.log("⚠️ [GET_TOKEN] Tentativa 1.1 falhou:", metaTokenError.message);
    } else if (metaToken?.access_token) {
      console.log("✅ [GET_TOKEN] Token encontrado em meta_tokens por account_id!");
      // 🚨 LOGS DE TOKEN: Confirmar o que foi encontrado
      const token = metaToken.access_token;
      console.log("🔍 [GET_TOKEN] TOKEN ENCONTRADO NO BANCO:", token ? `SIM (Começa com "${token.substring(0, 10)}...")` : "NÃO");
      console.log("🔍 [GET_TOKEN] Token length:", token?.length || 0);
      return token;
    }
  }
  // TENTATIVA 2 (FALLBACK OBRIGATÓRIO): Buscar token do usuário (connections ou meta_tokens)
  if (!userId) {
    console.error("❌ [GET_TOKEN] User ID não disponível para fallback. Token não encontrado.");
    return null;
  }
  console.log("🔍 [GET_TOKEN] Tentativa 2 (FALLBACK): Buscando token do usuário...");
  // Tentar connections table (se existir)
  try {
    const { data: connection, error: connectionError } = await supabase.from('connections').select('access_token, provider, user_id').eq('user_id', userId).eq('provider', 'facebook').eq('status', 'connected').limit(1).single();
    if (connectionError) {
      console.log("⚠️ [GET_TOKEN] Tabela 'connections' não encontrada ou sem dados:", connectionError.message);
    } else if (connection?.access_token) {
      console.log("✅ [GET_TOKEN] Token encontrado em connections (user-level)!");
      // 🚨 LOGS DE TOKEN: Confirmar o que foi encontrado
      const token = connection.access_token;
      console.log("🔍 [GET_TOKEN] TOKEN ENCONTRADO NO BANCO:", token ? `SIM (Começa com "${token.substring(0, 10)}...")` : "NÃO");
      console.log("🔍 [GET_TOKEN] Token length:", token?.length || 0);
      return token;
    }
  } catch (error) {
    console.log("⚠️ [GET_TOKEN] Tabela 'connections' pode não existir, continuando...");
  }
  // Tentar meta_tokens table por user_id (token geral do Facebook do usuário)
  console.log("🔍 [GET_TOKEN] Tentativa 2.1: Buscando em meta_tokens por user_id...");
  const { data: userMetaToken, error: userMetaTokenError } = await supabase.from('meta_tokens').select('access_token, user_id, account_id').eq('user_id', userId).eq('status', 'connected').order('updated_at', {
    ascending: false
  }).limit(1).single();
  if (userMetaTokenError) {
    console.log("⚠️ [GET_TOKEN] Tentativa 2.1 falhou:", userMetaTokenError.message);
  } else if (userMetaToken?.access_token) {
    console.log("✅ [GET_TOKEN] Token encontrado em meta_tokens (user-level)! Account ID:", userMetaToken.account_id);
    // 🚨 LOGS DE TOKEN: Confirmar o que foi encontrado
    const token = userMetaToken.access_token;
    console.log("🔍 [GET_TOKEN] TOKEN ENCONTRADO NO BANCO:", token ? `SIM (Começa com "${token.substring(0, 10)}...")` : "NÃO");
    console.log("🔍 [GET_TOKEN] Token length:", token?.length || 0);
    return token;
  }
  // TENTATIVA 3: Tentar pegar do provider_token da sessão (se disponível via RPC)
  console.log("⚠️ [GET_TOKEN] Todas as tentativas falharam. Token não encontrado.");
  console.log("📊 [GET_TOKEN] Resumo:");
  console.log("  - Account ID:", accountId);
  console.log("  - User ID:", userId || "N/A");
  console.log("  - Auth Header presente:", !!authHeader);
  return null;
}
// @ts-ignore: Deno global
serve(instrument("search-meta-geo", async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  // 🔥 BLINDAGEM GLOBAL: Try/catch envolvendo TODO o corpo da função
  try {
    const { query, accountId, accessToken: providedToken, userId: bodyUserId } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({
        error: 'Query parameter is required and must be a string',
        results: []
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 🔥 STATIC MAPPING: Tratamento robusto para "Brasil" e variações
    const normalizedQuery = query.toLowerCase().trim();
    if ([
      'brasil',
      'br',
      'brasil inteiro',
      'todo o brasil',
      'brazil'
    ].includes(normalizedQuery)) {
      console.log(`✅ [STATIC MAP] Mapeando '${query}' para Brasil (BR)`);
      return new Response(JSON.stringify({
        success: true,
        query: query,
        locations: [
          {
            key: "BR",
            name: "Brazil",
            type: "country",
            country_code: "BR",
            country_name: "Brazil"
          }
        ],
        count: 1
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get Supabase client
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY', {
      db: {
        schema: 'ads'
      }
    }) ?? '');
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    // 🆕 Se userId foi passado no body (de lads-brain), usá-lo como fallback
    if (bodyUserId) {
      console.log(`👤 [SEARCH-GEO] userId recebido no body: ${bodyUserId}`);
    }
    // 0. 🔥 CACHE LAYER: Verificar se já pesquisamos este termo
    const cacheKey = query.toLowerCase().trim();
    try {
      const { data: cacheEntry, error: cacheError } = await supabase.from('targeting_cache').select('data').eq('term', cacheKey).eq('type', 'geo').single();
      if (cacheEntry && cacheEntry.data) {
        console.log(`✅ [CACHE HIT] Termo '${cacheKey}' encontrado no cache!`);
        return new Response(JSON.stringify({
          success: true,
          query: query,
          locations: cacheEntry.data.locations || [],
          count: cacheEntry.data.count || 0
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (err) {
      console.warn("⚠️ [CACHE READ ERROR] Erro ao ler cache (ignorando):", err);
    }
    // 🔥 USAR FUNÇÃO DE RECUPERAÇÃO COM FALLBACK
    // Prioridade: Token injetado > Buscar no banco
    let accessToken = providedToken;
    if (!accessToken) {
      console.log("ℹ️ [SEARCH GEO] Token não injetado. Buscando no banco...");
      accessToken = await getAccessToken(supabase, accountId || null, authHeader, bodyUserId || null);
    } else {
      console.log("✅ [SEARCH GEO] Token injetado via body. Usando-o.");
    }
    if (!accessToken) {
      console.error('[SEARCH GEO] Access token not found após todas as tentativas.');
      console.error('[SEARCH GEO] Account ID:', accountId);
      return new Response(JSON.stringify({
        error: 'Access token not found. Por favor, verifique sua conexão com o Facebook na página de Conexões.',
        results: [],
        accountId: accountId || null
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Call Meta Graph API to search geo locations
    // 🌍 LOCALE: Force English results to avoid localized names (e.g., "Nova Iorque" instead of "New York")
    const searchUrl = `https://graph.facebook.com/v24.0/search?type=adgeolocation&q=${encodeURIComponent(query)}&location_types=["city","region","country"]&limit=20&locale=en_US&access_token=${accessToken}`;
    console.log(`[SEARCH GEO] Searching for: "${query}"`);
    console.log(`[SEARCH GEO] Token length: ${accessToken.length} caracteres`);
    // 🔥 TIMEOUT: Adicionar AbortSignal com timeout de 5 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), 5000);
    let response;
    let data;
    try {
      response = await fetch(searchUrl, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      // 🔥 VALIDAÇÃO DE RESPOSTA: Verificar se response.ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SEARCH GEO] HTTP Error:', response.status, errorText);
        return new Response(JSON.stringify({
          error: `Meta API retornou erro HTTP ${response.status}`,
          results: []
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      data = await response.json();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[SEARCH GEO] Timeout após 5 segundos');
        return new Response(JSON.stringify({
          error: 'Timeout: A busca demorou mais de 5 segundos. Tente novamente.',
          results: []
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      throw fetchError; // Re-throw para ser capturado pelo catch global
    }
    // 🔥 VALIDAÇÃO DE RESPOSTA: Verificar se data existe e se tem erro
    if (!data) {
      console.error('[SEARCH GEO] Resposta vazia do Meta API');
      return new Response(JSON.stringify({
        error: 'Resposta vazia do Meta API',
        results: []
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (data.error) {
      console.error('[SEARCH GEO ERROR]', data.error);
      // Não lançar exceção - retornar JSON com erro estruturado
      return new Response(JSON.stringify({
        error: `Meta API error: ${data.error.message || data.error.type || 'Erro desconhecido'}`,
        error_code: data.error.code || null,
        error_subcode: data.error.error_subcode || null,
        results: []
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 🔥 VALIDAÇÃO: Verificar se data.data existe
    if (!data.data || !Array.isArray(data.data)) {
      console.warn('[SEARCH GEO] data.data não é um array válido:', data);
      return new Response(JSON.stringify({
        success: true,
        query: query,
        locations: [],
        count: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Format response - Meta returns locations with keys array
    const locations = (data.data || []).map((item)=>({
        key: item.key || item.id,
        name: item.name,
        type: item.type,
        country_code: item.country_code || null,
        country_name: item.country_name || null,
        region: item.region || null,
        region_id: item.region_id || null
      }));
    console.log(`[SEARCH GEO] Found ${locations.length} locations`);
    console.log(`[SEARCH GEO] Names: ${locations.map((l)=>l.name).join(', ')}`);
    return new Response(JSON.stringify({
      success: true,
      query: query,
      locations: locations,
      results: locations,
      count: locations.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // 🔥 CAPTURA GLOBAL: Sempre retornar JSON válido, nunca quebrar
    console.error('[SEARCH GEO] Error fatal:', error);
    console.error('[SEARCH GEO] Stack:', error.stack);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      results: []
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
