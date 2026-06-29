/**
 * lever_meta_campaigns — Meta Ads campaigns + insights for ONE Lever client.
 *
 * Calls Lever System edge `mcp-meta-proxy` action=campaigns.
 * Returns spend/impressions/clicks/ctr/purchases/ROAS per campaign + totals.
 */
import { z } from "zod";
import { callLeverEdge } from "../_shared/lever-edge.js";
import type { Tool, ToolContext } from "../types.js";

const DATE_PRESET = z.enum([
  "today", "yesterday", "last_3d", "last_7d", "last_14d", "last_30d", "this_month", "last_month",
]);

const STATUS = z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]);

export const metaCampaignsTool: Tool = {
  name: "lever_meta_campaigns",
  description:
    "List Meta Ads campaigns for one Lever client with spend, impressions, clicks, CTR, purchases, ROAS. Uses the client's first selected ad account. date_preset controls insights window (default last_7d). status filters by effective_status (comma-separated, e.g. 'ACTIVE,PAUSED'). Use lever_list_clients first to discover client_id.",
  inputSchema: z.object({
    client_id: z.string().uuid(),
    date_preset: DATE_PRESET.optional().default("last_7d"),
    status: z.array(STATUS).optional().describe("Filter by effective_status. Default returns all."),
  }),
  async handler(input, ctx: ToolContext) {
    return callLeverEdge("mcp-meta-proxy", {
      action: "campaigns",
      client_id: input.client_id,
      date_preset: input.date_preset,
      status: input.status ? input.status.join(",") : undefined,
    }, ctx);
  },
};
