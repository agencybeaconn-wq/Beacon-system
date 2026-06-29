// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const META_API_VERSION = "v24.0";
serve(instrument("manage-ad-rules", async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    const body = await req.json();
    const { action, ruleId, ruleData, accountId, accessToken, workspaceId } = body;
    console.log(`📋 [manage-ad-rules] Action: ${action}`);
    // ==========================================
    // ACTION: CREATE
    // ==========================================
    if (action === "CREATE") {
      if (!ruleData || !accountId || !workspaceId) {
        throw new Error("Missing required fields: ruleData, accountId, workspaceId");
      }
      // Insert into Supabase first
      const { data: newRule, error: insertError } = await supabase.from("automation_rules").insert({
        workspace_id: workspaceId,
        ad_account_id: accountId,
        name: ruleData.name,
        description: ruleData.description || null,
        status: "ACTIVE",
        rule_type: ruleData.rule_type || "LOCAL",
        trigger_type: ruleData.trigger_type || "SCHEDULE",
        schedule_spec: ruleData.schedule_spec || null,
        evaluation_spec: ruleData.evaluation_spec,
        execution_spec: ruleData.execution_spec
      }).select().single();
      if (insertError) throw insertError;
      // If META_NATIVE, sync to Meta's adrules_library
      if (ruleData.rule_type === "META_NATIVE" && accessToken) {
        try {
          console.log(`📤 [manage-ad-rules] Syncing to Meta with payload:`, {
            evaluation_spec: ruleData.evaluation_spec,
            execution_spec: ruleData.execution_spec,
            schedule_spec: ruleData.schedule_spec
          });
          const formData = new FormData();
          formData.append("name", ruleData.name);
          formData.append("evaluation_spec", JSON.stringify(ruleData.evaluation_spec));
          formData.append("execution_spec", JSON.stringify(ruleData.execution_spec));
          formData.append("status", "ENABLED");
          formData.append("access_token", accessToken);
          // schedule_spec is required for SCHEDULE evaluation_type
          if (ruleData.schedule_spec) {
            formData.append("schedule_spec", JSON.stringify(ruleData.schedule_spec));
          }
          const metaRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${accountId}/adrules_library`, {
            method: "POST",
            body: formData
          });
          const metaData = await metaRes.json();
          console.log(`📥 [manage-ad-rules] Meta response:`, JSON.stringify(metaData));
          if (metaData.id) {
            // Update local rule with Meta's ID
            await supabase.from("automation_rules").update({
              meta_rule_id: metaData.id,
              last_synced_at: new Date().toISOString()
            }).eq("id", newRule.id);
            newRule.meta_rule_id = metaData.id;
            console.log(`✅ [manage-ad-rules] Synced to Meta: ${metaData.id}`);
          } else if (metaData.error) {
            console.error(`❌ [manage-ad-rules] Meta sync failed:`, JSON.stringify(metaData.error));
            // Store the error message in the rule for debugging
            await supabase.from("automation_rules").update({
              meta_sync_error: metaData.error.message || JSON.stringify(metaData.error),
              last_synced_at: new Date().toISOString()
            }).eq("id", newRule.id);
            newRule.meta_sync_error = metaData.error.message;
          }
        } catch (metaErr) {
          console.error(`❌ [manage-ad-rules] Meta API error:`, metaErr);
        }
      }
      return new Response(JSON.stringify({
        success: true,
        rule: newRule
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: READ_ALL
    // ==========================================
    if (action === "READ_ALL") {
      if (!accountId) throw new Error("Missing accountId");
      const { data: rules, error } = await supabase.from("automation_rules").select("*").eq("ad_account_id", accountId).neq("status", "DELETED").order("created_at", {
        ascending: false
      });
      if (error) throw error;
      return new Response(JSON.stringify({
        success: true,
        rules
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: READ_ONE
    // ==========================================
    if (action === "READ_ONE") {
      if (!ruleId) throw new Error("Missing ruleId");
      const { data: rule, error } = await supabase.from("automation_rules").select("*").eq("id", ruleId).single();
      if (error) throw error;
      // Fetch recent logs
      const { data: logs } = await supabase.from("automation_rule_logs").select("*").eq("rule_id", ruleId).order("executed_at", {
        ascending: false
      }).limit(10);
      return new Response(JSON.stringify({
        success: true,
        rule,
        logs: logs || []
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: UPDATE
    // ==========================================
    if (action === "UPDATE") {
      if (!ruleId || !ruleData) throw new Error("Missing ruleId or ruleData");
      const { data: updatedRule, error } = await supabase.from("automation_rules").update({
        name: ruleData.name,
        description: ruleData.description,
        status: ruleData.status,
        trigger_type: ruleData.trigger_type,
        schedule_spec: ruleData.schedule_spec,
        evaluation_spec: ruleData.evaluation_spec,
        execution_spec: ruleData.execution_spec
      }).eq("id", ruleId).select().single();
      if (error) throw error;
      // TODO: Sync updates to Meta if META_NATIVE
      return new Response(JSON.stringify({
        success: true,
        rule: updatedRule
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: DELETE (Soft Delete)
    // ==========================================
    if (action === "DELETE") {
      if (!ruleId) throw new Error("Missing ruleId");
      // Fetch rule to check if it has a Meta ID
      const { data: rule } = await supabase.from("automation_rules").select("meta_rule_id").eq("id", ruleId).single();
      // Delete from Meta if synced
      if (rule?.meta_rule_id && accessToken) {
        try {
          await fetch(`https://graph.facebook.com/${META_API_VERSION}/${rule.meta_rule_id}?access_token=${accessToken}`, {
            method: "DELETE"
          });
          console.log(`✅ [manage-ad-rules] Deleted from Meta: ${rule.meta_rule_id}`);
        } catch (metaErr) {
          console.error(`❌ [manage-ad-rules] Meta delete failed:`, metaErr);
        }
      }
      // Soft delete locally
      const { error } = await supabase.from("automation_rules").update({
        status: "DELETED"
      }).eq("id", ruleId);
      if (error) throw error;
      return new Response(JSON.stringify({
        success: true
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: TOGGLE (Pause/Unpause)
    // ==========================================
    if (action === "TOGGLE") {
      if (!ruleId) throw new Error("Missing ruleId");
      const { data: rule } = await supabase.from("automation_rules").select("status, meta_rule_id").eq("id", ruleId).single();
      if (!rule) throw new Error("Rule not found");
      const newStatus = rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      // Update Meta if synced
      if (rule.meta_rule_id && accessToken) {
        try {
          const formData = new FormData();
          formData.append("status", newStatus === "ACTIVE" ? "ENABLED" : "DISABLED");
          formData.append("access_token", accessToken);
          await fetch(`https://graph.facebook.com/${META_API_VERSION}/${rule.meta_rule_id}`, {
            method: "POST",
            body: formData
          });
        } catch (metaErr) {
          console.error(`❌ [manage-ad-rules] Meta toggle failed:`, metaErr);
        }
      }
      const { data: updatedRule, error } = await supabase.from("automation_rules").update({
        status: newStatus
      }).eq("id", ruleId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({
        success: true,
        rule: updatedRule
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: PREVIEW
    // ==========================================
    if (action === "PREVIEW") {
      if (!ruleId || !accessToken) throw new Error("Missing ruleId or accessToken");
      const { data: rule } = await supabase.from("automation_rules").select("meta_rule_id").eq("id", ruleId).single();
      if (!rule?.meta_rule_id) {
        return new Response(JSON.stringify({
          success: false,
          error: "Rule not synced to Meta"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const previewRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${rule.meta_rule_id}/preview?access_token=${accessToken}`, {
        method: "POST"
      });
      const previewData = await previewRes.json();
      return new Response(JSON.stringify({
        success: true,
        preview: previewData
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: EXECUTE_NOW
    // ==========================================
    if (action === "EXECUTE_NOW") {
      if (!ruleId || !accessToken) throw new Error("Missing ruleId or accessToken");
      const { data: rule } = await supabase.from("automation_rules").select("meta_rule_id").eq("id", ruleId).single();
      if (!rule?.meta_rule_id) {
        return new Response(JSON.stringify({
          success: false,
          error: "Rule not synced to Meta for manual execution"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const execRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${rule.meta_rule_id}/execute?access_token=${accessToken}`, {
        method: "POST"
      });
      const execData = await execRes.json();
      // Log execution
      await supabase.from("automation_rule_logs").insert({
        rule_id: ruleId,
        action_taken: "MANUAL_EXECUTE",
        result: execData.success ? "SUCCESS" : "FAILED",
        details: execData
      });
      // Update rule execution count
      await supabase.from("automation_rules").update({
        last_executed_at: new Date().toISOString(),
        execution_count: supabase.raw("execution_count + 1")
      }).eq("id", ruleId);
      return new Response(JSON.stringify({
        success: true,
        execution: execData
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: GET_HISTORY
    // ==========================================
    if (action === "GET_HISTORY") {
      if (!ruleId) throw new Error("Missing ruleId");
      const { data: logs, error } = await supabase.from("automation_rule_logs").select("*").eq("rule_id", ruleId).order("executed_at", {
        ascending: false
      }).limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({
        success: true,
        logs
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ==========================================
    // ACTION: SYNC_FROM_META
    // ==========================================
    if (action === "SYNC_FROM_META") {
      if (!accountId || !accessToken) {
        throw new Error("Missing accountId or accessToken for sync");
      }
      console.log(`🔄 [manage-ad-rules] Starting sync from Meta for account ${accountId}`);
      // 1. Fetch all rules from Meta's adrules_library
      const metaRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${accountId}/adrules_library?access_token=${accessToken}&fields=id,name,status,evaluation_spec,execution_spec,schedule_spec`);
      const metaData = await metaRes.json();
      if (metaData.error) {
        console.error(`❌ [manage-ad-rules] Meta fetch failed:`, metaData.error);
        throw new Error(metaData.error.message);
      }
      const metaRules = metaData.data || [];
      const metaRuleIds = metaRules.map((r)=>r.id);
      console.log(`📥 [manage-ad-rules] Found ${metaRules.length} rules in Meta`);
      // 2. Get local rules that have meta_rule_id
      const { data: localRules, error: localError } = await supabase.from("automation_rules").select("id, meta_rule_id, status").eq("ad_account_id", accountId).not("meta_rule_id", "is", null);
      if (localError) throw localError;
      // 3. Mark rules as DELETED if they don't exist in Meta anymore
      let deletedCount = 0;
      let updatedCount = 0;
      for (const localRule of localRules || []){
        if (localRule.meta_rule_id && !metaRuleIds.includes(localRule.meta_rule_id)) {
          // Rule was deleted in Meta, mark as DELETED locally
          await supabase.from("automation_rules").update({
            status: "DELETED",
            last_synced_at: new Date().toISOString()
          }).eq("id", localRule.id);
          deletedCount++;
          console.log(`🗑️ [manage-ad-rules] Marked rule ${localRule.id} as DELETED (not found in Meta)`);
        }
      }
      // 4. Update status of existing rules from Meta
      for (const metaRule of metaRules){
        const localMatch = (localRules || []).find((l)=>l.meta_rule_id === metaRule.id);
        if (localMatch) {
          const newStatus = metaRule.status === "ENABLED" ? "ACTIVE" : "PAUSED";
          if (localMatch.status !== newStatus && localMatch.status !== "DELETED") {
            await supabase.from("automation_rules").update({
              status: newStatus,
              last_synced_at: new Date().toISOString()
            }).eq("id", localMatch.id);
            updatedCount++;
          }
        }
      }
      console.log(`✅ [manage-ad-rules] Sync complete: ${deletedCount} deleted, ${updatedCount} updated`);
      return new Response(JSON.stringify({
        success: true,
        sync: {
          metaRulesCount: metaRules.length,
          deletedCount,
          updatedCount
        }
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("❌ [manage-ad-rules] Error:", error);
    return new Response(JSON.stringify({
      success: false,
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
