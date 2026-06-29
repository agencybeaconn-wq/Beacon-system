/**
 * lever_meta_anomalies — RISK/OPPORTUNITY/CREATIVE scan for ONE Lever client.
 *
 * Compares today vs previous 3-day average across campaigns. Detects CPA spikes,
 * ROAS drops, conversion drops, and ROAS jumps (opportunities). Sorted by severity.
 */
import { z } from "zod";
import { callLeverEdge } from "../_shared/lever-edge.js";
import type { Tool, ToolContext } from "../types.js";

export const metaAnomaliesTool: Tool = {
  name: "lever_meta_anomalies",
  description:
    "Scan Meta Ads for anomalies in ONE Lever client — RISK (CPA spike, ROAS drop, conversion drop), OPPORTUNITY (ROAS jump), CREATIVE (fatigue). Compares today vs previous 3-day average. Sorted by severity (CRITICAL/HIGH/MEDIUM/LOW). Daily ritual for Wesley/Campanhã.",
  inputSchema: z.object({
    client_id: z.string().uuid(),
  }),
  async handler(input, ctx: ToolContext) {
    return callLeverEdge("mcp-meta-proxy", { action: "anomalies", client_id: input.client_id }, ctx);
  },
};
