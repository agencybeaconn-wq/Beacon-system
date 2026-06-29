// @ts-ignore - Deno import
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(instrument("manage-custom-audiences", async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const params = await req.json();
    const { action, accountId, accessToken } = params;
    if (!accountId || !accessToken) {
      return new Response(JSON.stringify({
        error: "Missing accountId or accessToken"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const apiAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    // LIST - Get all audiences (Custom, Lookalike, Saved)
    if (action === 'LIST') {
      // Fetch Custom Audiences (includes Lookalike) and Saved Audiences in parallel
      const [customRes, savedRes] = await Promise.all([
        fetch(`https://graph.facebook.com/v24.0/${apiAccountId}/customaudiences?fields=id,name,subtype,description,time_created,rule,lookalike_spec,pixel_id,retention_days,approximate_count&limit=200&access_token=${accessToken}`),
        fetch(`https://graph.facebook.com/v24.0/${apiAccountId}/saved_audiences?fields=id,name,approximate_count,time_created,targeting&limit=200&access_token=${accessToken}`)
      ]);
      const customData = await customRes.json();
      const savedData = await savedRes.json();
      if (customData.error) {
        console.error('❌ [manage-custom-audiences] LIST Custom error:', customData.error);
      }
      if (savedData.error) {
        console.error('❌ [manage-custom-audiences] LIST Saved error:', savedData.error);
      }
      const customAudiences = (customData.data || []).map((a)=>({
          ...a,
          type: 'CUSTOM',
          origin: 'META'
        }));
      const savedMetaAudiences = (savedData.data || []).map((a)=>({
          ...a,
          type: 'SAVED',
          subtype: 'SAVED',
          origin: 'META'
        }));
      // Sort by creation time (newest first)
      const allAudiences = [
        ...customAudiences,
        ...savedMetaAudiences
      ].sort((a, b)=>{
        return new Date(b.time_created || 0).getTime() - new Date(a.time_created || 0).getTime();
      });
      return new Response(JSON.stringify({
        success: true,
        audiences: allAudiences
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // CREATE_WEBSITE - Create website custom audience
    if (action === 'CREATE_WEBSITE') {
      const { name, pixelId, retentionDays = 30, eventType = 'PageView', urlContains } = params;
      if (!name || !pixelId) {
        return new Response(JSON.stringify({
          error: "Missing name or pixelId for CREATE_WEBSITE"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Build rule based on event type and optional URL filter
      const filters = [];
      // Event filter
      if (eventType && eventType !== 'all') {
        filters.push({
          field: "event",
          operator: "eq",
          value: eventType
        });
      }
      // URL filter (optional)
      if (urlContains) {
        filters.push({
          field: "url",
          operator: "i_contains",
          value: urlContains
        });
      }
      const rule = {
        inclusions: {
          operator: "or",
          rules: [
            {
              event_sources: [
                {
                  id: pixelId,
                  type: "pixel"
                }
              ],
              retention_seconds: retentionDays * 24 * 60 * 60,
              filter: filters.length > 0 ? {
                operator: "and",
                filters: filters
              } : undefined
            }
          ]
        }
      };
      console.log('📣 [manage-custom-audiences] Creating website audience:', {
        name,
        pixelId,
        rule
      });
      // Note: For website audiences, we DON'T send 'subtype' - the API infers it from the rule
      const formData = new FormData();
      formData.append('name', name);
      formData.append('rule', JSON.stringify(rule));
      formData.append('prefill', '1');
      formData.append('access_token', accessToken);
      const response = await fetch(`https://graph.facebook.com/v24.0/${apiAccountId}/customaudiences`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.error) {
        console.error('❌ [manage-custom-audiences] CREATE_WEBSITE error:', data.error);
        return new Response(JSON.stringify({
          error: data.error.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      console.log('✅ [manage-custom-audiences] Created audience:', data);
      return new Response(JSON.stringify({
        success: true,
        audience: {
          id: data.id,
          name
        }
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // CREATE_LOOKALIKE - Create lookalike audience
    if (action === 'CREATE_LOOKALIKE') {
      const { name, originAudienceId, ratio = 0.01, country = 'BR' } = params;
      if (!name || !originAudienceId) {
        return new Response(JSON.stringify({
          error: "Missing name or originAudienceId for CREATE_LOOKALIKE"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // lookalike_spec MUST include location_spec or country
      const lookalikeSpec = {
        type: "custom_ratio",
        ratio: ratio,
        country: country // Required: country code for the lookalike
      };
      console.log('📣 [manage-custom-audiences] Creating lookalike audience:', {
        name,
        originAudienceId,
        lookalikeSpec
      });
      const formData = new FormData();
      formData.append('name', name);
      formData.append('subtype', 'LOOKALIKE');
      formData.append('origin_audience_id', originAudienceId);
      formData.append('lookalike_spec', JSON.stringify(lookalikeSpec));
      formData.append('access_token', accessToken);
      const response = await fetch(`https://graph.facebook.com/v24.0/${apiAccountId}/customaudiences`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.error) {
        console.error('❌ [manage-custom-audiences] CREATE_LOOKALIKE error:', data.error);
        return new Response(JSON.stringify({
          error: data.error.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      console.log('✅ [manage-custom-audiences] Created lookalike:', data);
      return new Response(JSON.stringify({
        success: true,
        audience: {
          id: data.id,
          name
        }
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // DELETE - Delete audience
    if (action === 'DELETE') {
      const { audienceId } = params;
      if (!audienceId) {
        return new Response(JSON.stringify({
          error: "Missing audienceId for DELETE"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const response = await fetch(`https://graph.facebook.com/v24.0/${audienceId}?access_token=${accessToken}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.error) {
        console.error('❌ [manage-custom-audiences] DELETE error:', data.error);
        return new Response(JSON.stringify({
          error: data.error.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      return new Response(JSON.stringify({
        success: true
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      error: `Unknown action: ${action}`
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [manage-custom-audiences] Error:', error);
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));
