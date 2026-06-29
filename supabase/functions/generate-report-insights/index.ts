// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { prompt, metrics } = await req.json();
    if (!metrics) {
      return new Response(JSON.stringify({
        error: "Metrics are required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[generate-report-insights] OPENAI_API_KEY not configured");
      return new Response(JSON.stringify({
        error: "OpenAI API key not configured",
        insights: generateFallbackInsights(metrics)
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Build the prompt
    const systemPrompt = `You are a senior digital marketing analyst specializing in Meta Ads (Facebook/Instagram). 
Your responses are concise, data-driven, and actionable. 
Always provide analysis in English.
Focus on:
1. Brief performance summary (1 sentence)
2. Key strength or concern (1 sentence)
3. One actionable recommendation (1 sentence)
Keep total response under 100 words.`;
    const userPrompt = prompt || `Analyze these campaign metrics:
- ROAS: ${metrics.roas.toFixed(2)}x
- Spend: $${metrics.spend.toLocaleString()}
- Conversions: ${metrics.conversions.toLocaleString()}
${metrics.revenue ? `- Revenue: $${metrics.revenue.toLocaleString()}` : ''}
${metrics.clicks ? `- Clicks: ${metrics.clicks.toLocaleString()}` : ''}
${metrics.impressions ? `- Impressions: ${metrics.impressions.toLocaleString()}` : ''}
${metrics.ctr ? `- CTR: ${(metrics.ctr * 100).toFixed(2)}%` : ''}
${metrics.cpc ? `- CPC: $${metrics.cpc.toFixed(2)}` : ''}

Provide a brief, professional analysis paragraph.`;
    console.log("[generate-report-insights] Calling OpenAI API...");
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
      const errorData = await response.text();
      console.error("[generate-report-insights] OpenAI API error:", errorData);
      return new Response(JSON.stringify({
        error: "OpenAI API error",
        insights: generateFallbackInsights(metrics)
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const data = await response.json();
    const insights = data.choices?.[0]?.message?.content?.trim() || generateFallbackInsights(metrics);
    console.log("[generate-report-insights] Generated insights:", insights.substring(0, 100) + "...");
    return new Response(JSON.stringify({
      insights
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[generate-report-insights] Error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      insights: "Campaign performance data was analyzed. Please review the detailed metrics in the attached report for specific insights and recommendations."
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
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
