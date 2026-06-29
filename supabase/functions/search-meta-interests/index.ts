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
  // 🔥 IGNORAR TENTATIVA 1: O usuário pediu para ir direto para o token do usuário (Provider Level)
  // Mas vamos manter como fallback reverso ou apenas logar que pulamos
  console.log("🔍 [GET_TOKEN] Tentativa 1 (Account Level): Pulando/Prioridade baixa. Focando no User Level.");
  // TENTATIVA 2 (PRIORIDADE MÁXIMA): Buscar token do usuário (connections ou meta_tokens)
  if (!userId) {
    console.error("❌ [GET_TOKEN] User ID não disponível. Impossível buscar token.");
    return null;
  }
  console.log("🔍 [GET_TOKEN] Tentativa 2 (MASTER KEY): Buscando token do usuário:", userId);
  // Tentar connections table (se existir)
  try {
    const { data: connection, error: connectionError } = await supabase.from('connections').select('access_token, provider, user_id').eq('user_id', userId).eq('provider', 'facebook').limit(1) // Não filtrar por status, pegar qualquer um
    .single();
    if (connectionError) {
      console.log("⚠️ [GET_TOKEN] Tabela 'connections' erro ou vazio:", connectionError.message);
    } else if (connection?.access_token) {
      console.log("✅ [GET_TOKEN] Token encontrado em connections (user-level)!");
      // 🚨 LOGS DE TOKEN
      const token = connection.access_token;
      console.log("🔍 [GET_TOKEN] TOKEN ENCONTRADO NO BANCO:", token ? `SIM (Começa com "${token.substring(0, 10)}...")` : "NÃO");
      return token;
    }
  } catch (error) {
    console.log("⚠️ [GET_TOKEN] Erro ao buscar em connections:", error);
  }
  // Tentar meta_tokens table por user_id (token geral do Facebook do usuário)
  console.log("🔍 [GET_TOKEN] Tentativa 2.1: Buscando em meta_tokens por user_id...");
  const { data: userMetaToken, error: userMetaTokenError } = await supabase.from('meta_tokens').select('access_token, user_id').eq('user_id', userId).order('updated_at', {
    ascending: false
  }).limit(1).single();
  if (userMetaTokenError) {
    console.log("⚠️ [GET_TOKEN] Tentativa 2.1 falhou:", userMetaTokenError.message);
  } else if (userMetaToken?.access_token) {
    console.log("✅ [GET_TOKEN] Token encontrado em meta_tokens (user-level)!");
    const token = userMetaToken.access_token;
    console.log("🔍 [GET_TOKEN] TOKEN ENCONTRADO NO BANCO:", token ? `SIM (Começa com "${token.substring(0, 10)}...")` : "NÃO");
    return token;
  }
  // TENTATIVA 3 (LAST RESORT): Buscar por Account ID (apenas se user level falhou)
  if (accountId) {
    console.log("🔍 [GET_TOKEN] Tentativa 3 (Fallback): Buscando por Account ID em ad_accounts...");
    const { data: account } = await supabase.from('ad_accounts').select('access_token').eq('id', accountId).single();
    if (account?.access_token) {
      console.log("✅ [GET_TOKEN] Token encontrado em ad_accounts (Account Level)!");
      return account.access_token;
    }
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
serve(instrument("search-meta-interests", async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { query, accountId, accessToken: providedToken, userId: bodyUserId } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({
        error: 'Query parameter is required and must be a string'
      }), {
        status: 400,
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
      console.log(`👤 [SEARCH-INTERESTS] userId recebido no body: ${bodyUserId}`);
    }
    // 0. 🔥 CACHE LAYER: Verificar se já pesquisamos este termo
    const cacheKey = query.toLowerCase().trim();
    try {
      const { data: cacheEntry, error: cacheError } = await supabase.from('targeting_cache').select('data').eq('term', cacheKey).eq('type', 'interest').single();
      if (cacheEntry && cacheEntry.data) {
        console.log(`✅ [CACHE HIT] Termo '${cacheKey}' encontrado no cache!`);
        return new Response(JSON.stringify({
          data: cacheEntry.data
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
      console.log("ℹ️ [SEARCH INTERESTS] Token não injetado. Buscando no banco...");
      accessToken = await getAccessToken(supabase, accountId || null, authHeader, bodyUserId || null);
    } else {
      console.log("✅ [SEARCH INTERESTS] Token injetado via body. Usando-o.");
    }
    if (!accessToken) {
      console.error('[SEARCH INTERESTS] Access token not found após todas as tentativas.');
      console.error('[SEARCH INTERESTS] Account ID:', accountId);
      return new Response(JSON.stringify({
        error: 'Access token not found. Por favor, verifique sua conexão com o Facebook na página de Conexões.',
        accountId: accountId || null,
        debug: 'Verifique os logs da Edge Function para mais detalhes'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Call Meta Graph API to search interests
    // 🌍 LOCALE: Force English results to avoid localized names
    const searchUrl = `https://graph.facebook.com/v24.0/search?type=adinterest&q=${encodeURIComponent(query)}&limit=20&locale=en_US&access_token=${accessToken}`;
    console.log(`[SEARCH INTERESTS] Searching for: "${query}"`);
    console.log(`[SEARCH INTERESTS] Token length: ${accessToken.length} caracteres`);
    const response = await fetch(searchUrl);
    const data = await response.json();
    if (data.error) {
      console.error('[SEARCH INTERESTS ERROR]', data.error);
      return new Response(JSON.stringify({
        error: `Meta API error: ${data.error.message}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Format response
    const interests = (data.data || []).map((item)=>({
        id: item.id,
        name: item.name,
        audience_size: item.audience_size || null,
        path: item.path || []
      }));
    console.log(`[SEARCH INTERESTS] Found ${interests.length} interests`);
    return new Response(JSON.stringify({
      success: true,
      query: query,
      interests: interests,
      results: interests,
      count: interests.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[SEARCH INTERESTS] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
