// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// @ts-ignore
Deno.serve(instrument("update-shared-dashboard-costs", async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Método não permitido'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    const { shareToken, clientCosts } = await req.json();
    if (!shareToken) {
      return new Response(JSON.stringify({
        error: 'Token de compartilhamento é obrigatório'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!clientCosts) {
      return new Response(JSON.stringify({
        error: 'Dados de custos são obrigatórios'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate cost fields
    const validatedCosts = {
      supplier_cost_mode: clientCosts.supplier_cost_mode === 'fixed' ? 'fixed' : 'per_sale',
      supplier_cost_value: Math.max(0, Number(clientCosts.supplier_cost_value) || 0),
      gateway_fee_percent: Math.min(100, Math.max(0, Number(clientCosts.gateway_fee_percent) || 0))
    };
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    // Update client_costs in the shared dashboard
    const { data, error } = await supabase.from('shared_dashboards').update({
      client_costs: validatedCosts,
      updated_at: new Date().toISOString()
    }).eq('share_token', shareToken).eq('is_active', true).select('id').maybeSingle();
    if (error) {
      console.error('❌ [UPDATE-COSTS] Erro ao atualizar custos:', error.message);
      return new Response(JSON.stringify({
        error: 'Erro ao salvar custos'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!data) {
      return new Response(JSON.stringify({
        error: 'Dashboard não encontrado ou inativo'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`✅ [UPDATE-COSTS] Custos atualizados para dashboard ${data.id}`);
    return new Response(JSON.stringify({
      success: true,
      clientCosts: validatedCosts
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ [UPDATE-COSTS] Erro fatal:', errorMessage);
    return new Response(JSON.stringify({
      error: 'Erro interno do servidor'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
