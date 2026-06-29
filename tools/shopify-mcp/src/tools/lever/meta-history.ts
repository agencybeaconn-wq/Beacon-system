/**
 * lever_meta_history — Daily Meta Ads insights for ONE Lever client.
 *
 * Returns per-day spend, impressions, clicks, conversions, CTR, CPC, CPA, ROAS_est
 * for N days. Optionally narrow to a specific campaign_id.
 */
import { z } from "zod";
import { callLeverEdge } from "../_shared/lever-edge.js";
import type { Tool, ToolContext } from "../types.js";

export const metaHistoryTool: Tool = {
  name: "lever_meta_history",
  description:
    "Daily Meta Ads history for ONE Lever client. Returns per-day spend/clicks/conversions/CTR/CPC/CPA/ROAS for the last N days. Pass campaign_id to narrow to one campaign; omit to aggregate the whole ad account.",
  inputSchema: z.object({
    client_id: z.string().uuid(),
    days: z.number().int().min(1).max(180).optional().default(30),
    campaign_id: z.string().optional(),
  }),
  async handler(input, ctx: ToolContext) {
    return callLeverEdge("mcp-meta-proxy", {
      action: "campaign_history",
      client_id: input.client_id,
      days: input.days,
      campaign_id: input.campaign_id,
    }, ctx);
  },
};
