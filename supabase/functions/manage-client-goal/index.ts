import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(instrument("manage-client-goal", async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  let metric;
  let action;
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY", {
      db: {
        schema: 'ads'
      }
    }) ?? "");
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Invalid or missing user authentication");
    }
    // Payload esperado:
    // account_id: ID da conta de anúncios (opcional, mantido para compatibilidade, mas não usado na busca)
    // metric: Métrica a gerenciar (ex: 'target_roas', 'target_cpa')
    // action: 'SET' ou 'GET'
    // target_value: Valor da meta (obrigatório apenas para 'SET')
    const body = await req.json();
    const account_id = body.account_id;
    metric = body.metric;
    action = body.action;
    const target_value = body.target_value;
    if (!metric || !action) {
      throw new Error("Parâmetros incompletos: metric e action são obrigatórios.");
    }
    // Validar metric
    const validMetrics = [
      'target_roas',
      'target_cpa',
      'target_cpc',
      'target_ctr'
    ];
    if (!validMetrics.includes(metric)) {
      throw new Error(`Métrica inválida: ${metric}. Métricas permitidas: ${validMetrics.join(', ')}`);
    }
    // Validar action
    if (![
      'SET',
      'GET'
    ].includes(action)) {
      throw new Error(`Ação inválida: ${action}. Ações permitidas: SET, GET`);
    }
    // Validar target_value para SET
    if (action === 'SET') {
      if (target_value === undefined || target_value === null) {
        throw new Error("target_value é obrigatório para ação 'SET'");
      }
      if (typeof target_value !== 'number' || target_value <= 0) {
        throw new Error("target_value deve ser um número positivo");
      }
    }
    if (action === 'SET') {
      // Salvar ou atualizar meta (global por usuário, não por conta)
      // Usar account_id como 'global' para manter compatibilidade com a constraint UNIQUE(account_id, metric)
      const finalAccountId = account_id || 'global';
      // Primeiro, verificar se já existe uma meta para este usuário e métrica
      const { data: existing } = await supabase.from('client_goals').select('id, account_id').eq('user_id', user.id).eq('metric', metric).limit(1);
      // Se já existe, atualizar pelo ID
      if (existing && existing.length > 0 && existing[0]?.id) {
        const { data: updatedData, error: updateError } = await supabase.from('client_goals').update({
          target_value,
          updated_at: new Date().toISOString()
        }).eq('id', existing[0].id).select().single();
        if (updateError) {
          console.error("[MANAGE-CLIENT-GOAL] Erro ao atualizar meta:", updateError);
          throw new Error(`Erro ao atualizar meta: ${updateError.message}`);
        }
        return new Response(JSON.stringify({
          success: true,
          action: 'SET',
          metric,
          target_value,
          message: `Meta ${metric} atualizada para ${target_value}x (global por usuário)`
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Se não existe, criar nova meta (usando account_id='global' para manter constraint)
      const { data: insertedData, error: insertError } = await supabase.from('client_goals').insert({
        account_id: finalAccountId,
        user_id: user.id,
        metric,
        target_value,
        updated_at: new Date().toISOString()
      }).select().single();
      if (insertError) {
        console.error("[MANAGE-CLIENT-GOAL] Erro ao criar meta:", insertError);
        throw new Error(`Erro ao salvar meta: ${insertError.message}`);
      }
      return new Response(JSON.stringify({
        success: true,
        action: 'SET',
        metric,
        target_value,
        message: `Meta ${metric} definida como ${target_value}x (global por usuário)`
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else if (action === 'GET') {
      // 🔥 LÓGICA BLINDADA: Usar maybeSingle() para evitar acesso a [0]
      console.log(`🔍 [MANAGE-CLIENT-GOAL] Buscando meta para User: ${user.id}, Metric: ${metric}`);
      const defaultValues = {
        'target_roas': 3.0,
        'target_cpa': 50.0,
        'target_cpc': 5.0,
        'target_ctr': 2.0
      };
      const defaultValue = defaultValues[metric] || 3.0;
      // 1. Tenta buscar por User ID (meta global por usuário)
      const { data: userData, error: userError } = await supabase.from('client_goals').select('target_value, updated_at').eq('user_id', user.id).eq('metric', metric).maybeSingle(); // <--- USE maybeSingle() EM VEZ DE select() + [0]
      if (userError) {
        console.error(`❌ [MANAGE-CLIENT-GOAL] Erro ao buscar por user_id:`, userError);
      }
      if (userData && userData.target_value !== null && userData.target_value !== undefined) {
        console.log(`✅ [MANAGE-CLIENT-GOAL] Meta ${metric} encontrada por user_id: ${userData.target_value}`);
        return new Response(JSON.stringify({
          success: true,
          action: 'GET',
          metric,
          target_value: userData.target_value,
          updated_at: userData.updated_at || null,
          is_default: false,
          source: 'User',
          message: `Meta ${metric}: ${userData.target_value}`
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // 2. Se account_id foi fornecido, tenta buscar por conta (fallback)
      if (account_id) {
        const { data: accountData, error: accountError } = await supabase.from('client_goals').select('target_value, updated_at').eq('account_id', account_id).eq('metric', metric).maybeSingle(); // <--- USE maybeSingle() EM VEZ DE select() + [0]
        if (accountError) {
          console.error(`❌ [MANAGE-CLIENT-GOAL] Erro ao buscar por account_id:`, accountError);
        }
        if (accountData && accountData.target_value !== null && accountData.target_value !== undefined) {
          console.log(`✅ [MANAGE-CLIENT-GOAL] Meta ${metric} encontrada por account_id: ${accountData.target_value}`);
          return new Response(JSON.stringify({
            success: true,
            action: 'GET',
            metric,
            target_value: accountData.target_value,
            updated_at: accountData.updated_at || null,
            is_default: false,
            source: 'Account',
            message: `Meta ${metric}: ${accountData.target_value}`
          }), {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      }
      // 3. Fallback Final (Segurança Máxima) - NUNCA quebrar o chat
      console.log(`⚠️ [MANAGE-CLIENT-GOAL] Nenhuma meta encontrada. Retornando padrão de segurança ${defaultValue}.`);
      return new Response(JSON.stringify({
        success: true,
        action: 'GET',
        metric,
        target_value: null,
        default_value: defaultValue,
        is_default: true,
        source: 'Default',
        message: `Meta ${metric} não definida. Usando valor padrão de ${defaultValue}.`
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  } catch (error) {
    console.error("[MANAGE-CLIENT-GOAL] Erro geral:", error);
    console.error("[MANAGE-CLIENT-GOAL] Stack trace:", error?.stack);
    // Para GET, sempre retornar sucesso com valor padrão (nunca quebrar o chat)
    if (action === 'GET' && metric) {
      const defaultValues = {
        'target_roas': 3.0,
        'target_cpa': 50.0,
        'target_cpc': 5.0,
        'target_ctr': 2.0
      };
      const defaultValue = defaultValues[metric] || 3.0;
      console.log(`⚠️ [MANAGE-CLIENT-GOAL] Erro no GET, retornando fallback de ${defaultValue} para não quebrar o chat.`);
      return new Response(JSON.stringify({
        success: true,
        action: 'GET',
        metric,
        target_value: null,
        default_value: defaultValue,
        is_default: true,
        error_message: error.message || "Erro ao buscar meta, usando valor padrão",
        message: `Meta ${metric} não definida. Usando valor padrão de ${defaultValue}.`
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Para SET, retornar erro (mas ainda com status 200 para não quebrar)
    return new Response(JSON.stringify({
      success: false,
      action: action || 'UNKNOWN',
      error: error.message || "Erro desconhecido"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));
