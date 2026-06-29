import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const META_API_VERSION = "v24.0";
// Helper to make Meta API calls with proper body encoding
async function callMetaApi(url, accessToken, body, method = "POST") {
  // For complex nested objects (like targeting), use JSON body with Content-Type
  const hasComplexFields = Object.values(body).some((v)=>typeof v === 'object' && v !== null);
  if (hasComplexFields) {
    // Use JSON body for complex fields
    const response = await fetch(`${url}?access_token=${accessToken}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    return response.json();
  } else {
    // Use URL params for simple fields
    const params = new URLSearchParams({
      ...body,
      access_token: accessToken
    });
    const response = await fetch(`${url}?${params.toString()}`, {
      method
    });
    return response.json();
  }
}
serve(instrument("manage-meta-campaign", async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY", {
      db: {
        schema: 'ads'
      }
    }) ?? "");
    // Extended payload:
    // action: 'toggle_status' | 'update_budget' | 'update_url_tags' | 'delete' | 
    //         'update_name' | 'update_adset' | 'update_campaign' | 'update_ad_copy'
    // entityId: ID da campanha/conjunto/anúncio
    // entityType: 'campaign' | 'adset' | 'ad'
    // value: Novo valor (para ações simples)
    // changes: Objeto com campos a atualizar (para ações complexas)
    // accountId: ID da conta para buscar o token
    const { action, entityId, entityType, value, accountId, changes } = await req.json();
    if (!entityId || !accountId) {
      throw new Error("Parâmetros incompletos (entityId, accountId).");
    }
    // 1. Buscar token da conta
    const { data: account, error: accountError } = await supabase.from("ad_accounts").select("access_token, meta_account_id").eq("id", accountId).single();
    if (accountError || !account) {
      throw new Error("Conta de anúncios não encontrada ou sem token.");
    }
    const accessToken = account.access_token;
    const metaAccountId = account.meta_account_id;
    const url = `https://graph.facebook.com/${META_API_VERSION}/${entityId}`;
    let body = {};
    let dbUpdateData = {};
    // ===========================================
    // ACTION: toggle_status
    // ===========================================
    if (action === "toggle_status") {
      if (!value) throw new Error("value é obrigatório para toggle_status");
      body.status = value;
      dbUpdateData.status = value;
    } else if (action === "update_budget") {
      if (!value) throw new Error("value é obrigatório para update_budget");
      body.daily_budget = value;
      dbUpdateData.daily_budget = value;
    } else if (action === "update_url_tags") {
      if (!value) throw new Error("value é obrigatório para update_url_tags");
      body.url_tags = value;
    } else if (action === "update_name") {
      if (!value) throw new Error("value é obrigatório para update_name");
      body.name = value;
      dbUpdateData.name = value;
    } else if (action === "update_adset") {
      if (!changes) throw new Error("changes é obrigatório para update_adset");
      console.log(`[Meta API] Update AdSet ${entityId}:`, changes);
      // Map frontend field names to Meta API field names
      if (changes.name) {
        body.name = changes.name;
        dbUpdateData.name = changes.name;
      }
      if (changes.daily_budget || changes.dailyBudget) {
        const budget = changes.daily_budget || changes.dailyBudget;
        body.daily_budget = typeof budget === 'number' ? budget : parseInt(budget) * 100;
        dbUpdateData.daily_budget = body.daily_budget;
      }
      if (changes.optimization_goal || changes.optimizationGoal) {
        body.optimization_goal = changes.optimization_goal || changes.optimizationGoal;
        dbUpdateData.optimization_goal = body.optimization_goal;
      }
      if (changes.billing_event || changes.billingEvent) {
        body.billing_event = changes.billing_event || changes.billingEvent;
        dbUpdateData.billing_event = body.billing_event;
      }
      if (changes.bid_amount || changes.bidAmount) {
        body.bid_amount = changes.bid_amount || changes.bidAmount;
        dbUpdateData.bid_amount = body.bid_amount;
      }
      if (changes.promoted_object || changes.promotedObject) {
        const po = changes.promoted_object || changes.promotedObject;
        body.promoted_object = po;
        dbUpdateData.promoted_object = po;
      }
      // Targeting - complex nested object
      if (changes.targeting) {
        const targeting = {};
        if (changes.targeting.age_min !== undefined) {
          targeting.age_min = changes.targeting.age_min;
        }
        if (changes.targeting.age_max !== undefined) {
          targeting.age_max = changes.targeting.age_max;
        }
        if (changes.targeting.genders) {
          targeting.genders = Array.isArray(changes.targeting.genders) ? changes.targeting.genders : [
            changes.targeting.genders
          ];
        }
        if (changes.targeting.geo_locations) {
          targeting.geo_locations = changes.targeting.geo_locations;
        }
        if (changes.targeting.flexible_spec) {
          targeting.flexible_spec = changes.targeting.flexible_spec;
        }
        if (changes.targeting.targeting_automation) {
          targeting.targeting_automation = changes.targeting.targeting_automation;
        }
        if (Object.keys(targeting).length > 0) {
          body.targeting = targeting;
          dbUpdateData.targeting = changes.targeting;
        }
      }
      if (Object.keys(body).length === 0) {
        throw new Error("Nenhum campo válido para atualizar no AdSet");
      }
    } else if (action === "update_campaign") {
      if (!changes) throw new Error("changes é obrigatório para update_campaign");
      console.log(`[Meta API] Update Campaign ${entityId}:`, changes);
      if (changes.name) {
        body.name = changes.name;
        dbUpdateData.name = changes.name;
      }
      if (changes.daily_budget || changes.dailyBudget) {
        const budget = changes.daily_budget || changes.dailyBudget;
        body.daily_budget = typeof budget === 'number' ? budget : parseInt(budget) * 100;
        dbUpdateData.daily_budget = body.daily_budget;
      }
      if (changes.lifetime_budget || changes.lifetimeBudget) {
        const budget = changes.lifetime_budget || changes.lifetimeBudget;
        body.lifetime_budget = typeof budget === 'number' ? budget : parseInt(budget) * 100;
        dbUpdateData.lifetime_budget = body.lifetime_budget;
      }
      if (changes.bid_strategy || changes.bidStrategy) {
        body.bid_strategy = changes.bid_strategy || changes.bidStrategy;
        dbUpdateData.bid_strategy = body.bid_strategy;
      }
      if (changes.spend_cap || changes.spendCap) {
        body.spend_cap = changes.spend_cap || changes.spendCap;
      }
      if (Object.keys(body).length === 0) {
        throw new Error("Nenhum campo válido para atualizar na Campaign");
      }
    } else if (action === "update_ad_copy") {
      if (!changes) throw new Error("changes é obrigatório para update_ad_copy");
      if (!metaAccountId) throw new Error("meta_account_id é obrigatório para criar AdCreative");
      console.log(`[Meta API] Update Ad Copy for ${entityId}:`, changes);
      // First, we need to get the current ad to get its page_id and other info
      const adInfoResponse = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${entityId}?fields=creative{object_story_spec,instagram_actor_id},adset_id&access_token=${accessToken}`);
      const adInfo = await adInfoResponse.json();
      if (adInfo.error) {
        throw new Error(`Erro ao buscar info do Ad: ${adInfo.error.message}`);
      }
      const currentCreative = adInfo.creative?.object_story_spec || {};
      const pageId = currentCreative.page_id || changes.page_id;
      const instagramActorId = adInfo.creative?.instagram_actor_id || changes.instagram_actor_id;
      if (!pageId) {
        throw new Error("page_id é obrigatório para criar AdCreative");
      }
      // Build new object_story_spec with updated copy
      const linkData = currentCreative.link_data || {};
      const newObjectStorySpec = {
        page_id: pageId,
        link_data: {
          link: changes.destination_url || linkData.link,
          message: changes.primary_text !== undefined ? changes.primary_text : linkData.message,
          name: changes.headline !== undefined ? changes.headline : linkData.name,
          description: changes.description !== undefined ? changes.description : linkData.description,
          call_to_action: {
            type: changes.cta_type || linkData.call_to_action?.type || 'LEARN_MORE'
          }
        }
      };
      // Preserve image/video hash if not changed
      if (changes.image_hash) {
        newObjectStorySpec.link_data.image_hash = changes.image_hash;
      } else if (linkData.image_hash) {
        newObjectStorySpec.link_data.image_hash = linkData.image_hash;
      }
      // Create new AdCreative
      const creativeUrl = `https://graph.facebook.com/${META_API_VERSION}/${metaAccountId}/adcreatives`;
      const creativeBody = {
        name: `Updated Creative - ${new Date().toISOString()}`,
        object_story_spec: newObjectStorySpec,
        ...instagramActorId ? {
          instagram_actor_id: instagramActorId
        } : {}
      };
      console.log(`[Meta API] Creating new AdCreative:`, creativeBody);
      const createCreativeResult = await callMetaApi(creativeUrl, accessToken, creativeBody);
      if (createCreativeResult.error) {
        throw new Error(`Erro ao criar AdCreative: ${createCreativeResult.error.message}`);
      }
      const newCreativeId = createCreativeResult.id;
      console.log(`[Meta API] New AdCreative created: ${newCreativeId}`);
      // Update the Ad to use the new creative
      body.creative = {
        creative_id: newCreativeId
      };
      // Update local DB with new copy info
      dbUpdateData.creative = {
        object_story_spec: newObjectStorySpec,
        creative_id: newCreativeId
      };
    } else if (action === "delete") {
      console.log(`[Meta API] Deleting ${entityType} ${entityId}`);
      const result = await callMetaApi(url, accessToken, {}, "DELETE");
      if (result.error) {
        console.error("[Meta API Error]", result.error);
        throw new Error(`Erro no Meta: ${result.error.message}`);
      }
      if (result.success) {
        const tableMap = {
          'campaign': 'campaigns',
          'adset': 'adsets',
          'ad': 'ads'
        };
        const tableName = tableMap[entityType];
        if (tableName) {
          const { error: dbError } = await supabase.from(tableName).delete().eq('id', entityId);
          if (dbError) console.error("Erro ao deletar do banco local:", dbError);
        }
      }
      return new Response(JSON.stringify({
        success: true,
        meta_response: result
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else {
      throw new Error(`Ação desconhecida: ${action}`);
    }
    // ===========================================
    // Execute the update (for all non-delete actions)
    // ===========================================
    console.log(`[Meta API] Updating ${entityType} ${entityId}:`, body);
    const result = await callMetaApi(url, accessToken, body);
    if (result.error) {
      console.error("[Meta API Error]", result.error);
      throw new Error(`Erro no Meta: ${result.error.message}`);
    }
    // Update local database
    if (result.success && Object.keys(dbUpdateData).length > 0) {
      const tableMap = {
        'campaign': 'campaigns',
        'adset': 'adsets',
        'ad': 'ads'
      };
      const tableName = tableMap[entityType];
      if (tableName) {
        const { error: dbError } = await supabase.from(tableName).update(dbUpdateData).eq('id', entityId);
        if (dbError) console.error("Erro ao atualizar banco local:", dbError);
        else console.log(`[DB] Updated ${tableName} ${entityId}:`, dbUpdateData);
      }
    }
    return new Response(JSON.stringify({
      success: true,
      meta_response: result,
      updated_fields: Object.keys(body)
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[manage-meta-campaign] Error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));
