// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const LOOPS_API_URL = "https://app.loops.so/api/v1/transactional";
/**
 * Fallback insights when AI is unavailable
 */ function generateFallbackInsights(metrics) {
  const roasStatus = metrics.roas >= 3 ? "excellent" : metrics.roas >= 2 ? "good" : metrics.roas >= 1 ? "acceptable" : "below target";
  const spendLevel = metrics.spend > 10000 ? "significant" : metrics.spend > 1000 ? "moderate" : "conservative";
  let insight = `Campaign shows ${roasStatus} performance with a ${metrics.roas.toFixed(2)}x ROAS on ${spendLevel} spend of $${metrics.spend.toLocaleString()}. `;
  insight += `Generated ${metrics.conversions.toLocaleString()} conversions. `;
  if (metrics.roas < 2) {
    insight += "Consider optimizing targeting or refreshing creative assets to improve return.";
  } else {
    insight += "Strong performance indicates effective audience targeting and creative resonance.";
  }
  return insight;
}
/**
 * Generate AI insights using OpenAI
 */ async function generateAIInsights(metrics) {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    console.log("[send-report-email] OPENAI_API_KEY not configured, using fallback");
    return generateFallbackInsights(metrics);
  }
  try {
    const systemPrompt = `You are a senior digital marketing analyst specializing in Meta Ads (Facebook/Instagram). 
Your responses are concise, data-driven, and actionable. 
Always provide analysis in English.
Focus on:
1. Brief performance summary (1 sentence)
2. Key strength or concern (1 sentence)
3. One actionable recommendation (1 sentence)
Keep total response under 100 words.`;
    const userPrompt = `Analyze these campaign metrics:
- ROAS: ${metrics.roas.toFixed(2)}x
- Spend: $${metrics.spend.toLocaleString()}
- Conversions: ${metrics.conversions.toLocaleString()}
${metrics.revenue ? `- Revenue: $${metrics.revenue.toLocaleString()}` : ''}
${metrics.clicks ? `- Clicks: ${metrics.clicks.toLocaleString()}` : ''}
${metrics.impressions ? `- Impressions: ${metrics.impressions.toLocaleString()}` : ''}
${metrics.ctr ? `- CTR: ${(metrics.ctr * 100).toFixed(2)}%` : ''}
${metrics.cpc ? `- CPC: $${metrics.cpc.toFixed(2)}` : ''}

Provide a brief, professional analysis paragraph.`;
    console.log("[send-report-email] Calling OpenAI for insights...");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });
    if (!response.ok) {
      console.error("[send-report-email] OpenAI error:", await response.text());
      return generateFallbackInsights(metrics);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || generateFallbackInsights(metrics);
  } catch (error) {
    console.error("[send-report-email] AI insights error:", error);
    return generateFallbackInsights(metrics);
  }
}
serve(instrument("send-report-email", async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const requestData = await req.json();
    const { recipientEmail, clientName, metrics, reportLink, templateId, agencyColor, agencyName, agencyLogo } = requestData;
    // Validate required fields
    if (!recipientEmail || !clientName || !metrics) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required fields: recipientEmail, clientName, metrics"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get Loops API key from environment (securely stored in Supabase secrets)
    const loopsApiKey = Deno.env.get("LOOPS_API_KEY");
    if (!loopsApiKey) {
      console.error("[send-report-email] LOOPS_API_KEY not configured in secrets");
      return new Response(JSON.stringify({
        success: false,
        error: "Email service not configured"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get the template ID from request or environment
    const reportTemplateId = templateId || Deno.env.get("LOOPS_REPORT_TEMPLATE_ID") || "cmkloocwy05er0i0423zvs65q";
    // Generate AI insights
    console.log("[send-report-email] Generating AI insights for", clientName);
    const aiInsights = await generateAIInsights(metrics);
    console.log("[send-report-email] AI insights generated:", aiInsights.substring(0, 50) + "...");
    // Log the received report link for debugging
    console.log("[send-report-email] Received report_link from frontend:", reportLink);
    // Build the Loops.so payload - ALWAYS include report_link (required by template)
    const loopsPayload = {
      transactionalId: reportTemplateId,
      email: recipientEmail,
      dataVariables: {
        client_name: clientName,
        ai_insights: aiInsights,
        roas: metrics.roas.toFixed(2),
        spend: `$${metrics.spend.toLocaleString()}`,
        conversions: metrics.conversions.toLocaleString(),
        // ALWAYS include report_link - use empty string if not provided
        report_link: reportLink || "",
        // Agency branding
        agency_color: agencyColor || "#7C3AED",
        agency_name: agencyName || "Beacon",
        agency_logo: agencyLogo || "",
        ...metrics.revenue && {
          revenue: `$${metrics.revenue.toLocaleString()}`
        },
        ...metrics.clicks && {
          clicks: metrics.clicks.toLocaleString()
        },
        ...metrics.impressions && {
          impressions: metrics.impressions.toLocaleString()
        }
      }
    };
    console.log("[send-report-email] Sending email via Loops.so to:", recipientEmail);
    console.log("[send-report-email] dataVariables.report_link:", loopsPayload.dataVariables.report_link);
    // Send email via Loops.so
    const loopsResponse = await fetch(LOOPS_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${loopsApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(loopsPayload)
    });
    if (!loopsResponse.ok) {
      const errorText = await loopsResponse.text();
      console.error("[send-report-email] Loops.so error:", loopsResponse.status, errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `Email service error: ${loopsResponse.status}`,
        details: errorText
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const loopsResult = await loopsResponse.json();
    console.log("[send-report-email] Email sent successfully:", loopsResult);
    return new Response(JSON.stringify({
      success: true,
      message: "Email sent successfully",
      aiInsights: aiInsights
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[send-report-email] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));
