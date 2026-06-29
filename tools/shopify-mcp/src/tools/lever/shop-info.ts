/**
 * lever_shop_info — Shopify shop metadata for ONE Lever client.
 */
import { z } from "zod";
import { callLeverEdge } from "../_shared/lever-edge.js";
import type { Tool, ToolContext } from "../types.js";

export const shopInfoTool: Tool = {
  name: "lever_shop_info",
  description:
    "Fetch Shopify shop metadata for one Lever agency client (name, domain, currency, country, plan, timezone). Use lever_list_clients first to discover client_id.",
  inputSchema: z.object({
    client_id: z.string().uuid(),
  }),
  async handler(input, ctx: ToolContext) {
    return callLeverEdge("mcp-shopify-proxy", {
      action: "shop_info",
      client_id: input.client_id,
    }, ctx);
  },
};
