/**
 * lever_revenue — Shopify revenue for ONE Lever client over a period.
 *
 * Calls Lever System edge `mcp-shopify-proxy` action=revenue.
 * Visibility enforced server-side via team_members lookup.
 */
import { z } from "zod";
import { callLeverEdge } from "../_shared/lever-edge.js";
import type { Tool, ToolContext } from "../types.js";

const PERIOD = z.union([
  z.enum(["today", "7d", "30d", "90d", "mtd", "ytd"]),
  z.string().regex(/^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD:YYYY-MM-DD for custom range"),
]);

export const revenueTool: Tool = {
  name: "lever_revenue",
  description:
    "Get Shopify paid revenue for one Lever agency client. Returns totalSales, order count, AOV, daily breakdown, currency. Period: today | 7d | 30d | 90d | mtd | ytd | YYYY-MM-DD:YYYY-MM-DD (custom range). Use lever_list_clients first to discover client_id.",
  inputSchema: z.object({
    client_id: z.string().uuid().describe("UUID of the agency client (from lever_list_clients)."),
    period: PERIOD.optional().default("30d"),
  }),
  async handler(input, ctx: ToolContext) {
    return callLeverEdge("mcp-shopify-proxy", {
      action: "revenue",
      client_id: input.client_id,
      period: input.period,
    }, ctx);
  },
};
