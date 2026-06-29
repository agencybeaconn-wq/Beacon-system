/**
 * lever_recent_orders — last N Shopify orders for ONE Lever client.
 */
import { z } from "zod";
import { callLeverEdge } from "../_shared/lever-edge.js";
import type { Tool, ToolContext } from "../types.js";

export const recentOrdersTool: Tool = {
  name: "lever_recent_orders",
  description:
    "Get the most recent Shopify orders for one Lever agency client. Returns name, price, status, created_at, country, city. Use lever_list_clients first to discover client_id.",
  inputSchema: z.object({
    client_id: z.string().uuid(),
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
  async handler(input, ctx: ToolContext) {
    return callLeverEdge("mcp-shopify-proxy", {
      action: "recent_orders",
      client_id: input.client_id,
      limit: input.limit,
    }, ctx);
  },
};
