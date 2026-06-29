import { z } from "zod";
import { loadConfig } from "../../config.js";
import type { Tool } from "../types.js";

export const listShopsTool: Tool = {
  name: "list_shops",
  description:
    "List all configured Shopify shops with their aliases, labels, domains, and whether their access token is loaded. Use this first to discover which shops are available before calling shop-scoped tools.",
  inputSchema: z.object({}),
  async handler() {
    const config = loadConfig();
    const rows = Object.entries(config.shops).map(([alias, shop]) => ({
      alias,
      label: shop.label,
      domain: shop.domain,
      apiVersion: shop.apiVersion ?? config.defaults.apiVersion,
      tokenEnv: shop.tokenEnv,
      tokenLoaded: Boolean(process.env[shop.tokenEnv]),
    }));
    return {
      total: rows.length,
      defaultApiVersion: config.defaults.apiVersion,
      shops: rows,
    };
  },
};
